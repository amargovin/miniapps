#!/bin/bash
# Finishing pass — unified grade applied to every rendered scene so photo
# scenes and vector scenes share one look. Gentle S-curve with lifted blacks,
# +4% saturation, subtle vignette, temporal film grain.
#
# Usage: finish.sh input.mp4 output.mp4
set -euo pipefail

IN="$1"
OUT="$2"

ffmpeg -y -v error -i "$IN" \
  -vf "curves=all='0/0.02 0.5/0.5 1/0.99',eq=saturation=1.05:contrast=1.015,vignette=angle=PI/7,noise=alls=4:allf=t+u" \
  -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p \
  -c:a copy \
  "$OUT"
