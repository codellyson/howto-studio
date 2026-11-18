import re, subprocess


def blank_stretches(src, top, height):
    out = subprocess.run(['ffmpeg', '-hide_banner', '-i', src, '-vf',
                          f'crop=iw:{height}:0:{top},signalstats,metadata=print:key=lavfi.signalstats.YLOW',
                          '-f', 'null', '-'], capture_output=True, text=True).stderr
    times = [float(t) for t, y in re.findall(r'pts_time:([\d.]+).*?\n.*?YLOW=([\d.]+)', out) if float(y) >= 235]
    runs = []
    for t in times:
        if runs and t - runs[-1][1] <= 0.2:
            runs[-1][1] = t
        else:
            runs.append([t, t])
    return runs


def deflash(src, dst, keep_until, top, height):
    """Covers white stretches in the band top..top+height with the frame after them. The screen before keep_until is left alone."""
    mids = [(max(a, keep_until), b + 0.04) for a, b in blank_stretches(src, top, height) if b > keep_until]
    args, chain, last = ['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', src], '', '0:v'
    for i, (a, b) in enumerate(mids):
        args += ['-ss', f'{b + 0.08:.2f}', '-i', src]
        chain += (f'[{i + 1}:v]trim=end_frame=1,crop=iw:{height}:0:{top},loop=-1:1,setpts=N/25/TB[f{i}];'
                  f"[{last}][f{i}]overlay=0:{top}:shortest=1:enable='between(t,{a:.2f},{b:.2f})'[v{i}];")
        last = f'v{i}'
    chain += f'[{last}]setpts=PTS-STARTPTS[out]'
    args += ['-filter_complex', chain, '-map', '[out]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', dst]
    subprocess.run(args, check=True)
    print('covered', [(round(a, 2), round(b, 2)) for a, b in mids])
