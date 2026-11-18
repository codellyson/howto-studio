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
durations = {}
for line_id, text in read(os.path.join(project, 'scripts', guide, 'script.md')):
    wav = os.path.join(out, line_id + '.wav')
    subprocess.check_call(['pnpm', 'dlx', 'hyperframes@latest', 'tts', text, '-v', voice, '-o', wav], env=env, cwd=out, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
    durations[line_id] = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav]))
assert durations, 'no lines in the script table'
json.dump(durations, open(os.path.join(out, 'durations.json'), 'w'), indent=1)
print(guide, round(sum(durations.values()), 1), 's', durations)
