"""Retain mosaic shading while restoring color from the matching source frames."""

import argparse
import json
from pathlib import Path
import subprocess

PROJECT = Path(__file__).resolve().parents[1]
OUTPUT = PROJECT / "output"
COMPARISON = OUTPUT / "comparison-v4"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-color", type=float, default=0.85)
    parser.add_argument("--saturation", type=float, default=1.12)
    parser.add_argument("--mosaic-lightness", type=float, default=0.85)
    parser.add_argument("--soundtrack", type=Path,
                        default=OUTPUT / "kaiwu-shunde-dive-2026-4s-v2-red-sem.mp4",
                        help="Mixed four-second audio/video to copy audio from; defaults to the historical export")
    args = parser.parse_args()
    if not 0 <= args.source_color <= 1 or not 0 <= args.mosaic_lightness <= 1:
        parser.error("Color and lightness mixing weights must be in [0,1]")
    if not 0.5 <= args.saturation <= 1.5:
        parser.error("Saturation must be in [0.5,1.5]")
    inputs = [
        COMPARISON / "03-reconet-background.mp4",
        OUTPUT / "background-v3-clean.mp4",
        OUTPUT / "badge-v3-alpha.mov",
        args.soundtrack,
    ]
    if not args.soundtrack.is_file():
        raise FileNotFoundError(f"Missing soundtrack: {args.soundtrack}. Supply --soundtrack with an existing mixed audio/video.")
    for source in inputs:
        if not source.is_file():
            raise FileNotFoundError(source)
    destination = COMPARISON / "03b-reconet-color-final.mp4"
    if destination.exists():
        raise FileExistsError(f"Refusing to overwrite {destination}")
    luma = f"{args.mosaic_lightness}*A+{1-args.mosaic_lightness}*B"
    chroma = (
        f"128+{args.saturation}*"
        f"({1-args.source_color}*(A-128)+{args.source_color}*(B-128))"
    )
    filters = (
        f"[0:v][1:v]blend=c0_expr='{luma}':c1_expr='{chroma}':c2_expr='{chroma}'[color];"
        "[color][2:v]overlay=format=yuv420:alpha=straight:shortest=1[video]"
    )
    command = ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-n"]
    for source in inputs:
        command.extend(["-i", str(source)])
    command.extend([
        "-filter_complex", filters, "-map", "[video]", "-map", "3:a:0",
        "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
        "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709",
        "-color_trc", "bt709", "-threads", "4", "-c:a", "copy",
        "-t", "4", "-movflags", "+faststart", str(destination),
    ])
    with (COMPARISON / "03b-reconet-color.log").open("wb") as log:
        subprocess.run(command, check=True, stderr=log)
    recipe = {
        "inputs": [str(source.relative_to(PROJECT)) if source.is_relative_to(PROJECT)
                   else str(source) for source in inputs],
        "parameters": {key: value for key, value in vars(args).items() if key != "soundtrack"},
        "method": "Aligned Rec.709 YUV-plane mix; original source supplies chroma.",
        "badge": "Unfiltered frozen HyperFrames alpha pass, applied after color.",
        "audio": "Unchanged audio from the selected four-second soundtrack.",
        "output": str(destination.relative_to(PROJECT)),
    }
    (COMPARISON / "03b-reconet-color.json").write_text(
        json.dumps(recipe, indent=2), encoding="utf-8"
    )
    print(destination, flush=True)


if __name__ == "__main__":
    main()
