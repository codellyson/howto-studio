# python3 voice.py <project> <guide> [voice]: one wav per script line in <project>/audio/<guide>/, plus durations.json.
import json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lines import read

# Kokoro runs in this one process when its Python and model files are here (about 1 s to load, then a fraction of a
# second per line). Otherwise each line goes through `hyperframes tts`, which also fetches the model the first time.
KVENV = os.path.expanduser('~/.cache/howto-video/kvenv/bin/python')
MODEL = os.path.expanduser('~/.cache/hyperframes/tts/models/kokoro-v1.0.onnx')
VOICES = os.path.expanduser('~/.cache/hyperframes/tts/voices/voices-v1.0.bin')
try:
    import kokoro_onnx, soundfile
except ImportError:
    # The venv's python is a symlink to the system one, so compare environments, not binaries.
    if os.path.exists(KVENV) and os.path.realpath(sys.prefix) != os.path.realpath(os.path.dirname(os.path.dirname(KVENV))):
        os.execv(KVENV, [KVENV, *sys.argv])
    kokoro_onnx = None
kokoro = kokoro_onnx.Kokoro(MODEL, VOICES) if kokoro_onnx and os.path.exists(MODEL) and os.path.exists(VOICES) else None

project, guide = sys.argv[1], sys.argv[2]
voice = sys.argv[3] if len(sys.argv) > 3 else 'af_heart'
out = os.path.abspath(os.path.join(project, 'audio', guide))
os.makedirs(out, exist_ok=True)
env = dict(os.environ)
env.setdefault('HYPERFRAMES_PYTHON', os.path.expanduser('~/.cache/howto-video/kvenv/bin/python'))
# Lines whose words and voice are unchanged keep their audio, so a small script change only remakes those lines.
made_file = os.path.join(out, 'made.json')
made = json.load(open(made_file)) if os.path.exists(made_file) else {}
old = json.load(open(os.path.join(out, 'durations.json'))) if os.path.exists(os.path.join(out, 'durations.json')) else {}
durations, remade = {}, []
for line_id, text in read(os.path.join(project, 'scripts', guide, 'script.md')):
    wav = os.path.join(out, line_id + '.wav')
    if made.get(line_id) == [voice, text] and os.path.exists(wav) and line_id in old:
        durations[line_id] = old[line_id]
        continue
    remade.append(line_id)
    if kokoro:
        samples, rate = kokoro.create(text, voice=voice, speed=1.0, lang='en-us')
        soundfile.write(wav, samples, rate)
    else:
        subprocess.check_call(['pnpm', 'dlx', 'hyperframes@latest', 'tts', text, '-v', voice, '-o', wav], env=env, cwd=out, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
    durations[line_id] = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav]))
    made[line_id] = [voice, text]
assert durations, 'no lines in the script table'
json.dump(durations, open(os.path.join(out, 'durations.json'), 'w'), indent=1)
json.dump({k: v for k, v in made.items() if k in durations}, open(made_file, 'w'), indent=1)
print(guide, round(sum(durations.values()), 1), 's', 'remade:', ' '.join(remade) or 'none', durations)
