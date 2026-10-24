"""Composite frozen HyperFrames passes without a second browser RGB roundtrip."""

import argparse
import json
from pathlib import Path
import subprocess

PROJECT = Path(__file__).resolve().parents[1]
OUTPUT = PROJECT / "output"
COMPARISON = OUTPUT / "comparison-v4"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--names", nargs="+")
    parser.add_argument("--soundtrack", type=Path,
                        default=OUTPUT / "kaiwu-shunde-dive-2026-4s-v2-red-sem.mp4",
                        help="Mixed four-second audio/video to copy audio from; defaults to the historical export")
    args = parser.parse_args()
    variants = json.loads((PROJECT / "scripts" / "comparison-variants.json").read_text())
    known = {variant["name"] for variant in variants}
    if args.names and not set(args.names) <= known:
        parser.error(f"Unknown variants: {set(args.names) - known}")
    badge = OUTPUT / "badge-v3-alpha.mov"
    soundtrack = args.soundtrack
    if not soundtrack.is_file():
        raise FileNotFoundError(f"Missing soundtrack: {soundtrack}. Supply --soundtrack with an existing mixed audio/video.")
    for variant in variants:
        name = variant["name"]
        if args.names and name not in args.names:
            continue
        background = PROJECT / variant["backgroundSource"]
        destination = COMPARISON / f"{name}-final.mp4"
        for source in (background, badge, soundtrack):
            if not source.is_file():
                raise FileNotFoundError(source)
        if destination.exists():
            raise FileExistsError(f"Refusing to overwrite {destination}")
        command = [
            "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-n",
            "-i", str(background), "-i", str(badge), "-i", str(soundtrack),
            "-filter_complex",
            "[0:v][1:v]overlay=format=yuv420:alpha=straight:shortest=1[video]",
            "-map", "[video]", "-map", "2:a:0", "-c:v", "libx264",
            "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
            "-color_range", "tv", "-colorspace", "bt709",
            "-color_primaries", "bt709", "-color_trc", "bt709",
            "-threads", "4", "-c:a", "copy", "-t", "4",
            "-movflags", "+faststart", str(destination),
        ]
        with (COMPARISON / f"{name}-compose.log").open("wb") as log:
            subprocess.run(command, check=True, stderr=log)
        print(f"Composited {destination.name}", flush=True)


if __name__ == "__main__":
    main()
