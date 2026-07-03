#!/usr/bin/env bash
# Usage: ./concat.sh output.mp4 scene_01.mp4 scene_02.mp4 ...
set -euo pipefail

OUTPUT="$1"; shift
OUTDIR=$(dirname "$OUTPUT")
CONCATLIST="${OUTDIR}/concat.txt"

for f in "$@"; do
  echo "file '$(realpath "$f")'" >> "$CONCATLIST"
done

ffmpeg -y -f concat -safe 0 -i "$CONCATLIST" -c copy "$OUTPUT"
echo "Concat list preserved: $CONCATLIST"
echo "Output: $OUTPUT"
