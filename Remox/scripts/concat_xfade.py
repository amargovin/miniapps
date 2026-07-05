#!/usr/bin/env python3
"""
concat_xfade.py — concat graded scenes with soft crossfades instead of butt joints.

Replaces the hard fade-to-black blink at scene boundaries (LEARNINGS §50) with
a video dissolve + audio crossfade at every join. Requires re-encode (one pass).

Usage:
  python3 concat_xfade.py out.mp4 scene1.mp4 scene2.mp4 ... [--fade 0.4] [--crf 18]

Notes:
- fade seconds default 0.4 (12f @ 30fps). Total duration = sum(durations) - (N-1)*fade.
- Audio joins ride the scenes' padded silence tails (LEARNINGS §42), so narration
  is never clipped by the acrossfade.
"""
import subprocess
import sys


def probe_duration(path: str) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", path],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


def main() -> None:
    args = [a for a in sys.argv[1:]]
    fade = 0.4
    crf = "18"
    if "--fade" in args:
        i = args.index("--fade")
        fade = float(args[i + 1]); del args[i:i + 2]
    if "--crf" in args:
        i = args.index("--crf")
        crf = args[i + 1]; del args[i:i + 2]
    out, files = args[0], args[1:]
    if len(files) < 2:
        sys.exit("need at least 2 input files")

    durs = [probe_duration(f) for f in files]

    inputs: list[str] = []
    for f in files:
        inputs += ["-i", f]

    fc: list[str] = []
    # chained video xfade
    v_prev = "[0:v]"
    cum = durs[0]
    for k in range(1, len(files)):
        offset = cum - fade
        v_out = f"[v{k}]" if k < len(files) - 1 else "[vout]"
        fc.append(f"{v_prev}[{k}:v]xfade=transition=fade:duration={fade}:offset={offset:.4f}{v_out}")
        v_prev = v_out
        cum = cum + durs[k] - fade
    # chained audio acrossfade
    a_prev = "[0:a]"
    for k in range(1, len(files)):
        a_out = f"[a{k}]" if k < len(files) - 1 else "[aout]"
        fc.append(f"{a_prev}[{k}:a]acrossfade=d={fade}{a_out}")
        a_prev = a_out

    cmd = (
        ["ffmpeg", "-y", "-v", "warning"] + inputs
        + ["-filter_complex", ";".join(fc),
           "-map", "[vout]", "-map", "[aout]",
           "-c:v", "libx264", "-preset", "medium", "-crf", crf,
           "-c:a", "aac", "-b:a", "192k", out]
    )
    print(f"concat_xfade: {len(files)} scenes, fade {fade}s → expected {cum:.2f}s")
    subprocess.run(cmd, check=True)
    print(f"done: {out} ({probe_duration(out):.2f}s)")


if __name__ == "__main__":
    main()
