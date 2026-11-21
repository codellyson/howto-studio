// How-to Studio for Mac: a native window over the local studio server, which the app starts and stops.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{Read, Write};
use std::net::TcpStream;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager, RunEvent};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_updater::UpdaterExt;

const PORT: u16 = 4700;

struct Engine(Arc<Mutex<Option<Child>>>);

// Who is on the port: our studio (its /api/health names it), something else, or nothing.
#[derive(PartialEq)]
enum Port { Ours, Other, Free }

fn engine_port() -> Port {
    let addr = format!("127.0.0.1:{PORT}").parse().unwrap();
    let Ok(mut s) = TcpStream::connect_timeout(&addr, Duration::from_millis(300)) else { return Port::Free };
    let _ = s.set_read_timeout(Some(Duration::from_millis(800)));
    let _ = s.write_all(format!("GET /api/health HTTP/1.0\r\nHost: localhost:{PORT}\r\n\r\n").as_bytes());
    let mut body = String::new();
    let _ = s.read_to_string(&mut body);
    if body.contains("\"service\":\"howto-studio\"") { Port::Ours } else { Port::Other }
}

#[tauri::command]
fn engine_status() -> &'static str {
    match engine_port() { Port::Ours => "ours", Port::Other => "other", Port::Free => "starting" }
}

// Starts the server through the user's own interactive login shell, so Node, claude, ffmpeg and
// python come from the same PATH as their Terminal.
fn spawn_engine(server: &str) -> Option<Child> {
    let shell = std::env::var("SHELL").ok().filter(|s| s.starts_with('/')).unwrap_or_else(|| "/bin/zsh".into());
    Command::new(shell)
        .args(["-ilc", &format!("PORT={PORT} HOST=127.0.0.1 exec node {server:?}")])
        .stdin(Stdio::null())
        .spawn()
        .ok()
}

// Keeps a server running while the app is open; never fights another program for the port.
fn watch_engine(slot: Arc<Mutex<Option<Child>>>, server: String) {
    thread::spawn(move || loop {
        if engine_port() == Port::Free {
            let mut child = slot.lock().unwrap();
            let alive = child.as_mut().map(|c| matches!(c.try_wait(), Ok(None))).unwrap_or(false);
            if !alive {
                *child = spawn_engine(&server);
            }
        }
        thread::sleep(Duration::from_secs(2));
    });
}

fn stop_engine(app: &AppHandle) {
    if let Some(mut child) = app.state::<Engine>().0.lock().unwrap().take() {
        let _ = child.kill();
    }
}

// On launch, look for a newer release on GitHub. If there is one, ask before installing; never update silently.
// Any failure (offline, no release yet) just leaves the current version running.
fn check_for_update(app: AppHandle) {
    thread::spawn(move || tauri::async_runtime::block_on(async move {
        let Ok(updater) = app.updater() else { return };
        let Ok(Some(update)) = updater.check().await else { return };
        let yes = app.dialog()
            .message(format!("How-to Studio {} is ready. Install it now? The app restarts when it is done, and any video being made stops.", update.version))
            .title("Update available")
            .buttons(MessageDialogButtons::OkCancelCustom("Install and restart".into(), "Later".into()))
            .blocking_show();
        if !yes { return }
        match update.download_and_install(|_, _| {}, || {}).await {
            Ok(()) => { stop_engine(&app); app.restart() }
            Err(e) => { app.dialog().message(format!("The update did not install: {e}")).title("Update failed").blocking_show(); }
        }
    }));
}

fn main() {
    let slot = Arc::new(Mutex::new(None));
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Engine(slot.clone()))
        .invoke_handler(tauri::generate_handler![engine_status])
        .setup(move |app| {
            let server = app.path().resource_dir()?.join("engine/.output/server/index.mjs");
            watch_engine(slot.clone(), server.to_string_lossy().into_owned());
            check_for_update(app.handle().clone());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building How-to Studio");

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            stop_engine(handle);
        }
    });
}
