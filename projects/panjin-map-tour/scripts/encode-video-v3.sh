#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p output qa .cache
DURATION=$(python3 - <<'PY'
import json
print(json.load(open('data/narration-schedule.json'))['total_duration_s'])
PY
)
ffmpeg -y -framerate 24 -i frames/frame-%05d.jpg -i public/audio/narration-v3.wav \
  -map 0:v:0 -map 1:a:0 -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ar 48000 -ac 2 -t "$DURATION" -movflags +faststart \
  output/panjin-tour-route-v3.mp4
PASSLOG="$ROOT/.cache/panjin-tour-v3-pass"
ffmpeg -y -i output/panjin-tour-route-v3.mp4 -map 0:v:0 -an -c:v libx264 -preset slow \
  -b:v 1000k -maxrate 1300k -bufsize 2600k -pass 1 -passlogfile "$PASSLOG" -f mp4 /dev/null
ffmpeg -y -i output/panjin-tour-route-v3.mp4 -map 0:v:0 -map 0:a:0 -c:v libx264 -preset slow \
  -b:v 1000k -maxrate 1300k -bufsize 2600k -pass 2 -passlogfile "$PASSLOG" \
  -pix_fmt yuv420p -c:a aac -b:a 96k -ar 48000 -ac 2 -t "$DURATION" -movflags +faststart \
  output/panjin-tour-route-v3-chat.mp4
rm -f "${PASSLOG}-0.log" "${PASSLOG}-0.log.mbtree"
ffprobe -v error -show_entries format=duration,size:stream=codec_name,codec_type,width,height,r_frame_rate,pix_fmt,sample_rate,channels -of json output/panjin-tour-route-v3.mp4 > qa/v3-final-ffprobe.json
