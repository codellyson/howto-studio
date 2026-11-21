# python3 cut.py <project> <guide> [--deflash TOP HEIGHT] [--redress]
# Drops off-camera stretches, runs the checks, has dress.cjs draw captions, cursor and pinned marks, mixes in the voice,
# and writes final/<guide>.mp4 plus out/<guide>-sheet.png. --redress skips the cut and only draws and mixes again,
# for a new look.json or pins.json.
import json, os, shutil, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from deflash import deflash


def duration(path):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]))


def read_marks(src, count):
    """Video time of each event: the first frame where the corner block shows the next colour."""
    PALETTE = [(255, 0, 255), (0, 255, 0), (0, 0, 255), (255, 255, 0)]
    times = subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v', '-show_entries', 'frame=pts_time', '-of', 'csv=p=0', src], text=True).split()
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', src, '-vf', 'crop=4:4:2:2,scale=1:1,format=rgb24', '-fps_mode', 'passthrough', '-f', 'rawvideo', '-'])
    found = []
    for i, t in enumerate(times):
        if len(found) == count:
            break
        px = raw[i * 3:i * 3 + 3]
        want = PALETTE[len(found) % 4]
        if len(px) == 3 and all(abs(px[c] - want[c]) < 70 for c in range(3)):
            found.append(float(t.strip(',')))
    assert len(found) == count, f'found {len(found)} of {count} marks'
    return found


def keep_ranges(cuts, dur):
    keep, t = [], 0.0
    for a, b in sorted(cuts):
        if a > t:
            keep.append((t, a))
        t = max(t, b)
    keep.append((t, dur))
    return keep


def shift(t, keep):
    """Where a raw-video time lands once only the keep ranges remain."""
    gone_before, last = 0.0, 0.0
    for a, b in keep:
        gone_before += a - last
        last = b
        if a <= t <= b:
            return t - gone_before
    raise ValueError(f'time {t:.2f} falls inside a cut')


def check(said, voice, video_len):
    """Every line starts inside the video, ends inside it, and finishes before the next line starts."""
    assert said, 'no lines'
    for i, s in enumerate(said):
        assert s['t'] >= 0, f"{s['id']} starts before the video"
        assert s['t'] + voice[s['id']] <= video_len, f"{s['id']} runs past the end of the video"
        if i:
            prev = said[i - 1]
            assert prev['t'] + voice[prev['id']] <= s['t'], f"{prev['id']} overlaps {s['id']}"


def to_video(wall, events, marks):
    """Raw-video time of a clock time, by the marks on either side of it."""
    pts = [(e['wall'], t) for e, t in zip(events, marks)]
    if wall <= pts[0][0]:
        return pts[0][1] + (wall - pts[0][0]) / 1000
    for (w1, t1), (w2, t2) in zip(pts, pts[1:]):
        if wall <= w2:
            return t1 + (t2 - t1) * (wall - w1) / max(w2 - w1, 1)
    return pts[-1][1] + (wall - pts[-1][0]) / 1000


def overlay_plan(timing, marks, keep, said, voice, video_len):
    """Cursor moves and clicked elements in final-video time, for dress.cjs.
    Anything inside a cut moves to where the video picks up again, so the cursor keeps its last place."""
    def place(wall):
        t = to_video(wall, timing['events'], marks)
        later = [a for a, b in keep if a > t]
        try:
            return round(shift(t, keep), 3)
        except ValueError:
            return round(shift(later[0], keep), 3) if later else None
    cursor = [{'t': t, 'k': c['k'], 'x': c['x'], 'y': c['y']} for c in timing.get('cursor', []) if (t := place(c['wall'])) is not None]
    targets = [{'line': x['line'], 't': t, 'name': x['name'], 'box': x['box']} for x in timing.get('targets', []) if x['line'] and (t := place(x['wall'])) is not None]
    says = [e for e in timing['events'] if e['kind'] == 'say' and e.get('url')]
    return {'address': says[0]['url'] if says else '', 'size': timing.get('size', [1440, 900]), 'scale': timing.get('scale', 1), 'duration': round(video_len, 3), 'lines': [{**s, 'len': voice[s['id']]} for s in said], 'cursor': cursor, 'targets': targets}


def sheet(video, said, voice, dst):
    """One frame early and one late in each line, to compare caption and action against the voice."""
    expr = '+'.join(f"eq(n\\,{round((s['t'] + f * voice[s['id']]) * 25)})" for s in said for f in (0.25, 0.9))
    subprocess.check_call(['ffmpeg', '-loglevel', 'error', '-y', '-i', video, '-vf', f"select='{expr}',scale=480:-1,tile=4x{(len(said) * 2 + 3) // 4}", '-frames:v', '1', '-fps_mode', 'vfr', dst])


def main(project, g, flash, redress=False):
    out = os.path.join(project, 'out')
    final_dir = os.path.join(project, 'final')
    os.makedirs(final_dir, exist_ok=True)
    audio = os.path.join(project, 'audio', g)
    voice = json.load(open(os.path.join(audio, 'durations.json')))
    silent = os.path.join(out, g + '.silent.mp4')
    plan_file = os.path.join(out, g + '.overlay.json')
    if redress:
        assert os.path.exists(plan_file) and os.path.exists(silent), 'this video was filmed before looks could change; record it again'
        said = [{'id': l['id'], 't': l['t']} for l in json.load(open(plan_file))['lines']]
    else:
        said = cut(project, g, flash, voice, silent, plan_file)
    subprocess.check_call(['node', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dress.cjs'), project, g])
    dressed = os.path.join(out, g + '.dressed.mp4')
    final = os.path.join(final_dir, g + '.mp4')
    args = ['ffmpeg', '-loglevel', 'error', '-y', '-i', dressed]
    graph = ''
    for i, s in enumerate(said):
        args += ['-i', os.path.join(audio, s['id'] + '.wav')]
        ms = round(s['t'] * 1000)
        graph += f'[{i + 1}:a]adelay={ms}|{ms}[a{i}];'
    graph += ''.join(f'[a{i}]' for i in range(len(said))) + f'amix=inputs={len(said)}:normalize=0:duration=longest,apad[voice]'
    subprocess.check_call(args + ['-filter_complex', graph, '-map', '0:v', '-map', '[voice]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', final])
    sheet(final, said, voice, os.path.join(out, g + '-sheet.png'))
    json.dump({'duration': round(duration(final), 3), 'lines': [{**s, 'len': voice[s['id']]} for s in said]}, open(os.path.join(final_dir, g + '.lines.json'), 'w'), indent=1)
    print(g, round(duration(final), 1), 's', [(s['id'], s['t']) for s in said])


def cut(project, g, flash, voice, silent, plan_file):
    """Keeps only the on-camera stretches of the raw take, checks the line timing, and writes the clean silent cut."""
    out = os.path.join(project, 'out')
    src = os.path.join(out, 'raw', g + '.webm')
    timing = json.load(open(os.path.join(out, 'raw', g + '.timing.json')))
    assert not timing['blocked'], f"take tried to write to protected data: {timing['blocked']}"
    events = timing['events']
    marks = read_marks(src, len(events))
    timed = [{'id': e['id'], 't': t} for e, t in zip(events, marks) if e['kind'] == 'say']
    assert {s['id'] for s in timed} == set(voice), 'this take did not say every line'
    cuts, opened = [[0.0, timed[0]['t']]], None
    for e, t in zip(events, marks):
        if e['kind'] == 'cut-start':
            opened = t
        elif e['kind'] == 'cut-end':
            cuts.append([opened, t])
    keep = keep_ranges(cuts, marks[-1] - 0.05)
    cut = os.path.join(out, g + '.cut.mp4')
    expr = '+'.join(f'between(t,{a:.2f},{b:.2f})' for a, b in keep)
    # The patch beside the mark covers it, so no box shows on any background colour.
    graph = f"split[a][b];[b]crop=10:10:10:0[p];[a][p]overlay=0:0,select='{expr}',setpts=N/FRAME_RATE/TB"
    subprocess.check_call(['ffmpeg', '-loglevel', 'error', '-y', '-i', src, '-vf', graph, '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', cut])
    said = []
    for s in timed:
        start, stop = s['t'], s['t'] + voice[s['id']]
        assert abs(shift(stop, keep) - shift(start, keep) - voice[s['id']]) < 0.01, f"a cut falls inside {s['id']}"
        said.append({'id': s['id'], 't': round(shift(start, keep), 3)})
    if flash:
        deflash(cut, silent, said[0]['t'] + voice[said[0]['id']] + 0.3, *flash)
    else:
        shutil.copyfile(cut, silent)
    check(said, voice, duration(silent))
    json.dump(overlay_plan(timing, marks, keep, said, voice, duration(silent)), open(plan_file, 'w'))
    return said


if __name__ == '__main__':
    assert keep_ranges([[2, 3]], 10) == [(0.0, 2), (3, 10)]
    assert shift(5, [(0.0, 2), (3, 10)]) == 4
    assert to_video(1500, [{'wall': 1000}, {'wall': 2000}], [10.0, 11.0]) == 10.5
    check([{'id': 'a', 't': 0}, {'id': 'b', 't': 2}], {'a': 2, 'b': 1}, 3)
    argv = sys.argv[1:]
    redress = '--redress' in argv
    if redress:
        argv.remove('--redress')
    flash = None
    if '--deflash' in argv:
        i = argv.index('--deflash')
        flash = (int(argv[i + 1]), int(argv[i + 2]))
        del argv[i:i + 3]
    main(os.path.abspath(argv[0]), argv[1], flash, redress)
