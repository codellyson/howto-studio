# python3 voice.py <project> <guide> [voice]: one wav per script line in <project>/audio/<guide>/, plus durations.json.
import json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lines import read

project, guide = sys.argv[1], sys.argv[2]
voice = sys.argv[3] if len(sys.argv) > 3 else 'am_michael'
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
    subprocess.check_call(['pnpm', 'dlx', 'hyperframes@latest', 'tts', text, '-v', voice, '-o', wav], env=env, cwd=out, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
    durations[line_id] = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav]))
    made[line_id] = [voice, text]
assert durations, 'no lines in the script table'
json.dump(durations, open(os.path.join(out, 'durations.json'), 'w'), indent=1)
json.dump({k: v for k, v in made.items() if k in durations}, open(made_file, 'w'), indent=1)
print(guide, round(sum(durations.values()), 1), 's', 'remade:', ' '.join(remade) or 'none', durations)
