// node check.cjs <project> <guide>
// Checks scripts/<guide>/script.md against the script rules before anything is filmed, and prints what to fix.
// Exits 1 when something is flagged. How-to Studio shows the same flags beside the lines.
const fs = require('fs');
const path = require('path');

const MAX_CAPTION = 70;
const MAX_SECONDS = 60;
const ACTION = /\b(click|type|paste|press|scroll|drag|switch|open|select|pick|choose|upload|go to|visit|tick|toggle|fill|enter|drop|tap|sign in)/i;
const CHANGE = /\b(opens|fills|changes|appears|shows|loads|turns|moves to|lands|arrives|updates|switch|view)\b/i;
const OTHER_SIDE = /\b(view|sees|see what|as the|customer|client|recipient|teammate|visitor|their|reached|inbox|public|approved|sent|saved|published|thank|finished)\b/i;

// script.md rows start with "| L": id, what is on screen, ..., the voice line.
function readLines(file) {
  return fs.readFileSync(file, 'utf8').split('\n').filter((l) => /^\|\s*L\d+/.test(l)).map((l) => {
    const cells = l.split('|').slice(1, -1).map((c) => c.trim());
    return { id: cells[0], screen: cells[1] || '', voice: cells[cells.length - 1] || '' };
  });
}

// What happens on screen once sentences about the cursor alone are taken out.
const withoutCursor = (screen) => screen.split(/(?<=\.)\s+/).filter((s) => !/^cursor\b/i.test(s.trim())).join(' ');

// lines: [{ id, screen, voice }]. durations: { id: seconds } from the voice, when it has been made.
function checkScript(lines, durations) {
  const flags = { lines: {}, video: [] };
  const flag = (id, text) => (flags.lines[id] = flags.lines[id] || []).push(text);
  lines.forEach((l, i) => {
    const screen = withoutCursor(l.screen);
    const acts = ACTION.test(screen) && !/not clicked/i.test(screen);
    if (i === 0 && !acts) flag(l.id, 'Nothing happens in the first line. Start on an action.');
    // The last line may hold still on the result; that is the payoff, not idling.
    else if (i < lines.length - 1 && !acts && !CHANGE.test(screen)) flag(l.id, 'Only the cursor moves here. Show something happening, or fold it into the line before.');
    if (/\bclick\b/i.test(l.voice) && (!/\bclick/i.test(l.screen) || /not clicked/i.test(l.screen))) flag(l.id, 'The voice says click, but nothing is clicked.');
    if (l.voice.length > MAX_CAPTION) flag(l.id, `Too long for one caption line (${l.voice.length} characters). Shorten or split it.`);
  });
  const known = lines.every((l) => durations && durations[l.id]);
  const seconds = lines.reduce((t, l) => t + (known ? durations[l.id] : l.voice.split(/\s+/).length / 2.6) + 0.35, 0);
  if (seconds > MAX_SECONDS) flags.video.push(`${known ? '' : 'About '}${Math.round(seconds)} s long. Aim for 30 to 60: cut the lines where nothing happens first.`);
  const last = lines[lines.length - 1];
  if (last && !OTHER_SIDE.test(`${last.screen} ${last.voice}`)) flags.video.push("It doesn't end on the result: show what changed, ideally as the customer, recipient or teammate sees it.");
  flags.count = flags.video.length + Object.values(flags.lines).reduce((n, f) => n + f.length, 0);
  flags.seconds = Math.round(seconds);
  return flags;
}

module.exports = { checkScript, readLines };

if (require.main === module) {
  const [project, guide] = process.argv.slice(2);
  const lines = readLines(path.join(project, 'scripts', guide, 'script.md'));
  const durFile = path.join(project, 'audio', guide, 'durations.json');
  const flags = checkScript(lines, fs.existsSync(durFile) ? JSON.parse(fs.readFileSync(durFile, 'utf8')) : null);
  for (const [id, list] of Object.entries(flags.lines)) for (const t of list) console.log(`${id}: ${t}`);
  for (const t of flags.video) console.log(`Video: ${t}`);
  console.log(flags.count ? `${flags.count} to fix` : `No flags. About ${flags.seconds} s.`);
  process.exit(flags.count ? 1 : 0);
}
