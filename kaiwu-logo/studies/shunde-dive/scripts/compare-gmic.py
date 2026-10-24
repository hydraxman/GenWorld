"""Native-1080p G'MIC brush comparison. Uses only its own comparison-v4 files.

Run `test`, inspect the saved sheets, then run `render --workers 2`.
`render` resumes frames only when recipe and output hashes match.
`finish` re-encodes existing painted frames; `provenance` records local tool hashes.
The official portable binary and pinned stdlib live under output/comparison-v4/gmic.
"""

import argparse
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import statistics
import subprocess
import time

import numpy as np
from PIL import Image, ImageDraw


PROJECT = Path(__file__).resolve().parents[1]
ROOT = PROJECT / "output" / "comparison-v4" / "gmic"
SOURCE_VIDEO = PROJECT / "output" / "background-v3-clean.mp4"
OUTPUT = ROOT.parent / "01-gmic-background.mp4"
BIN = ROOT / "tools" / "gmic-4.0.5" / "gmic-4.0.5-cli-win64"
EXE = BIN / "gmic.exe"
STDLIB = ROOT / "provenance" / "gmic_stdlib.gmic"
COMMIT = "0ae8bad5b32b0a1cc37f51746e28f66cb171218f"
SIZE = (1920, 1080)
COUNT = 120
SEED = 42
DARKEN = 0.92
PARAMETER_NAMES = (
    "predefined_style previous_style painting_order nb_iterations precision "
    "details_threshold background_threshold sharpness anisotropy smoothness "
    "coherence twist_angle twist_strength init_canvas brush_diameter_details "
    "stroke_length_details hue_randomness_details saturation_randomness_details "
    "value_randomness_details opacity_details brush_diameter_background "
    "stroke_length_background hue_randomness_background saturation_randomness_background "
    "value_randomness_background opacity_background brush_diameter_dynamics "
    "stroke_length_dynamics hue_randomness_dynamics saturation_randomness_dynamics "
    "value_randomness_dynamics opacity_dynamics spatial_step angular_step preview_progression"
).split()
PRESETS = {
    "pilot": "0,-1,1,8,1.25,100,100,10,90,0.8,3,0,0,4,3.5,15,0,0,2,75,9,24,0,0,3,60,18,18,15,15,15,18,2,90,0",
    "balanced": "0,-1,1,8,2,100,100,10,90,0.8,3,0,0,4,2.6,12,0,0,2,75,7,20,0,0,3,60,18,18,15,15,15,18,2,90,0",
}


def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    stage = path.with_suffix(path.suffix + ".partial")
    stage.write_text(json.dumps(value, indent=2, ensure_ascii=False), encoding="utf-8")
    stage.replace(path)


def sha256(path):
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def run(command, timeout=180, log=None, env=None):
    result = subprocess.run(
        [str(value) for value in command], capture_output=True, text=True,
        encoding="utf-8", errors="replace", timeout=timeout, env=env,
    )
    if log:
        log.write_text(result.stdout + result.stderr, encoding="utf-8")
    if result.returncode:
        raise RuntimeError(
            f"Command failed ({result.returncode}): {subprocess.list2cmdline(list(map(str, command)))}\n"
            f"{result.stdout[-3000:]}\n{result.stderr[-3000:]}"
        )
    return result.stdout + result.stderr


def probe(path):
    return json.loads(run([
        "ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format",
        "-of", "json", path,
    ]))


def verify_video(info):
    if len(info["streams"]) != 1:
        raise RuntimeError("Expected exactly one video stream and no audio")
    video = info["streams"][0]
    expected = {
        "width": 1920, "height": 1080, "codec_type": "video", "codec_name": "h264",
        "pix_fmt": "yuv420p", "avg_frame_rate": "30/1", "nb_read_frames": "120",
    }
    for key, value in expected.items():
        if video.get(key) != value:
            raise RuntimeError(f"Wrong {key}: {video.get(key)!r}; expected {value!r}")
    if abs(float(info["format"]["duration"]) - 4) > 0.00001:
        raise RuntimeError("Expected exactly 4 seconds")


def check_image(path):
    with Image.open(path) as image:
        image.load()
        if image.size != SIZE or image.mode != "RGB":
            raise RuntimeError(f"Invalid native frame {path}: {image.size}, {image.mode}")


def prepare_source():
    info = probe(SOURCE_VIDEO)
    verify_video(info)
    source = ROOT / "source"
    source.mkdir(parents=True, exist_ok=True)
    expected = [source / f"{i:06d}.png" for i in range(1, COUNT + 1)]
    if not all(path.exists() for path in expected):
        run([
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-threads", "2",
            "-i", SOURCE_VIDEO, "-map", "0:v:0", "-fps_mode", "passthrough",
            "-threads", "2", source / "%06d.png",
        ])
    for path in expected:
        check_image(path)
    save_json(ROOT / "provenance" / "input-probe.json", info)
    return expected


def recipe(preset):
    params = PRESETS[preset]
    values = params.split(",")
    if len(values) != 35:
        raise RuntimeError("Paint With Brush requires exactly 35 parameters")
    return {
        "preset": preset, "parameters": params,
        "named_parameters": dict(zip(PARAMETER_NAMES, map(float, values))),
        "seed": SEED, "post_multiply": DARKEN, "processing_size": list(SIZE),
        "source_sha256": sha256(SOURCE_VIDEO), "executable_sha256": sha256(EXE),
        "stdlib_sha256": sha256(STDLIB),
    }


def paint(index, directory, spec, timeout, resume=True):
    directory.mkdir(parents=True, exist_ok=True)
    output = directory / f"{index:06d}.png"
    metadata = output.with_suffix(".json")
    fingerprint = hashlib.sha256(json.dumps(spec, sort_keys=True).encode()).hexdigest()
    if resume and output.exists() and metadata.exists():
        saved = json.loads(metadata.read_text(encoding="utf-8"))
        if saved["recipe_sha256"] == fingerprint and saved["output_sha256"] == sha256(output):
            check_image(output)
            return {**saved, "resumed": True}
    stage = directory / f"{index:06d}.partial.png"
    command = [
        EXE, "-v", "-1", "-m", STDLIB, ROOT / "source" / f"{index:06d}.png",
        "-srand", str(SEED), "-fx_paint_with_brush", spec["parameters"],
        "-mul", str(DARKEN), "-cut", "0,255", "-round", "-o", stage,
    ]
    env = {
        **os.environ, "OMP_NUM_THREADS": "1", "OMP_THREAD_LIMIT": "1",
        "OPENBLAS_NUM_THREADS": "1", "MKL_NUM_THREADS": "1",
    }
    start = time.perf_counter()
    try:
        run(command, timeout=timeout, log=directory / f"{index:06d}.log", env=env)
        check_image(stage)
        stage.replace(output)
    except subprocess.TimeoutExpired as error:
        raise RuntimeError(f"G'MIC frame {index} exceeded measured safety bound {timeout}s") from error
    finally:
        stage.unlink(missing_ok=True)
    result = {
        "source_frame": index, "source_timestamp_seconds": (index - 1) / 30,
        "processing_seconds": time.perf_counter() - start, "size": list(SIZE),
        "recipe_sha256": fingerprint, "output_sha256": sha256(output),
        "command": list(map(str, command)), "resumed": False,
    }
    save_json(metadata, result)
    print(f"frame {index:03d}: {result['processing_seconds']:.2f}s", flush=True)
    return result


def contact_sheet(rows, destination, width=640, crop=None):
    height = round(width * (crop[3] - crop[1]) / (crop[2] - crop[0])) if crop else round(width * 9 / 16)
    sheet = Image.new("RGB", (width * len(rows[0]), (height + 32) * len(rows)), "#16191c")
    draw = ImageDraw.Draw(sheet)
    for y, row in enumerate(rows):
        for x, (path, label) in enumerate(row):
            with Image.open(path) as original:
                image = original.convert("RGB")
                if crop:
                    image = image.crop(crop)
                image = image.resize((width, height), Image.Resampling.LANCZOS)
            sheet.paste(image, (x * width, y * (height + 32) + 32))
            draw.text((x * width + 12, y * (height + 32) + 9), label, fill="white")
    sheet.save(destination, quality=94)


def test(args):
    prepare_source()
    spec = recipe(args.preset)
    directory = ROOT / "tests" / args.preset
    records = [paint(i, directory, spec, args.timeout) for i in args.frames]
    save_json(directory / "test.json", {"recipe": spec, "frames": records})
    rows = [
        [(ROOT / "source" / f"{i:06d}.png", f"Source frame {i} / {(i-1)/30:.3f}s") for i in args.frames],
        [(directory / f"{i:06d}.png", f"G'MIC {args.preset} frame {i}") for i in args.frames],
    ]
    contact_sheet(rows, directory / "before-after.jpg")
    contact_sheet(rows, directory / "native-detail.jpg", crop=(640, 340, 1280, 820))
    print(json.dumps({"seconds": [r["processing_seconds"] for r in records], "directory": str(directory)}))


def render(args):
    prepare_source()
    spec = recipe(args.preset)
    baseline_file = ROOT / "tests" / args.preset / "test.json"
    if not baseline_file.exists():
        raise RuntimeError("Benchmark and inspect this preset with 'test' before rendering")
    benchmark = json.loads(baseline_file.read_text(encoding="utf-8"))
    if benchmark["recipe"] != spec:
        raise RuntimeError("Preset changed since benchmark")
    measured_timeout = max(60, int(max(row["processing_seconds"] for row in benchmark["frames"]) * 6))
    workers = min(2, max(1, args.workers))
    start = time.perf_counter()
    directory = ROOT / "frames"
    records = []
    save_json(ROOT / "render-recipe.json", spec)
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        tasks = [pool.submit(paint, i, directory, spec, measured_timeout) for i in range(1, COUNT + 1)]
        for task in concurrent.futures.as_completed(tasks):
            records.append(task.result())
            save_json(ROOT / "render-progress.json", {
                "recipe": spec, "completed": len(records),
                "frames": sorted(records, key=lambda row: row["source_frame"]),
            })
    seconds = time.perf_counter() - start
    save_json(ROOT / "render-summary.json", {
        "recipe": spec, "workers": workers, "threads_per_worker": 1,
        "frame_timeout_seconds": measured_timeout, "benchmark": benchmark,
        "render_wall_seconds_this_invocation": seconds,
        "median_frame_seconds": statistics.median(row["processing_seconds"] for row in records),
        "total_frame_cpu_wall_seconds": sum(row["processing_seconds"] for row in records),
        "frames": sorted(records, key=lambda row: row["source_frame"]),
    })
    finish()


def finish():
    for i in range(1, COUNT + 1):
        check_image(ROOT / "frames" / f"{i:06d}.png")
    stage = OUTPUT.with_name(OUTPUT.stem + ".partial.mp4")
    command = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-framerate", "30",
        "-start_number", "1", "-i", ROOT / "frames" / "%06d.png",
        "-frames:v", "120", "-an", "-c:v", "libx264", "-preset", "slow",
        "-crf", "16", "-pix_fmt", "yuv420p", "-threads", "2",
        "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
        "-color_range", "tv", "-movflags", "+faststart", stage,
    ]
    start = time.perf_counter()
    run(command, timeout=300, log=ROOT / "encode.log")
    info = probe(stage)
    verify_video(info)
    stage.replace(OUTPUT)
    info["format"]["filename"] = str(OUTPUT)
    save_json(ROOT / "output-probe.json", info)
    decoded = ROOT / "encoded-frames"
    decoded.mkdir(exist_ok=True)
    run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-threads", "2",
        "-i", OUTPUT, "-fps_mode", "passthrough", "-threads", "2", decoded / "%06d.png",
    ])
    indices = (1, 61, 120)
    row = [(decoded / f"{i:06d}.png", f"ENCODED frame {i} / {(i-1)/30:.3f}s") for i in indices]
    before = [(ROOT / "source" / f"{i:06d}.png", f"SOURCE frame {i} / {(i-1)/30:.3f}s") for i in indices]
    contact_sheet([row], ROOT / "encoded-first-middle-last.jpg")
    contact_sheet([before, row], ROOT / "before-after-encoded.jpg")
    contact_sheet([before, row], ROOT / "native-detail-encoded.jpg", crop=(640, 340, 1280, 820))
    temporal_indices = (98, 99, 100, 101)
    contact_sheet([
        [(ROOT / "source" / f"{i:06d}.png", f"Source {i} / {(i-1)/30:.3f}s") for i in temporal_indices],
        [(decoded / f"{i:06d}.png", f"Encoded {i} / {(i-1)/30:.3f}s") for i in temporal_indices],
    ], ROOT / "temporal-detail-encoded.jpg", width=480, crop=(720, 370, 1200, 970))
    temporal = []
    previous_source = previous_output = None
    for i in range(1, COUNT + 1):
        with Image.open(ROOT / "source" / f"{i:06d}.png") as image:
            source = np.asarray(image, dtype=np.float32)
        with Image.open(decoded / f"{i:06d}.png") as image:
            output = np.asarray(image, dtype=np.float32)
        if previous_source is not None:
            temporal.append({
                "frame": i,
                "source_adjacent_mae_8bit": float(np.abs(source - previous_source).mean()),
                "encoded_adjacent_mae_8bit": float(np.abs(output - previous_output).mean()),
                "source_identical": bool(np.array_equal(source, previous_source)),
                "painted_identical": sha256(ROOT / "frames" / f"{i:06d}.png") == sha256(ROOT / "frames" / f"{i-1:06d}.png"),
            })
        previous_source, previous_output = source, output
    save_json(ROOT / "encoding-and-temporal.json", {
        "encode_command": list(map(str, command)), "output_sha256": sha256(OUTPUT),
        "encode_and_verification_seconds": time.perf_counter() - start,
        "frame_mapping": "Source n -> brush-rendered n -> encoded n, for all 120 frames",
        "temporal_caveat": "Fixed random seed is NOT motion tracking or temporal coherence. MAE is not flow-compensated.",
        "adjacent_frames": temporal,
    })
    print(f"VERIFIED: {OUTPUT} (1920x1080, 120 frames, 30 fps, 4.000s, silent)", flush=True)


def provenance():
    archive = ROOT / "tools" / "gmic_4.0.5_cli_win64.zip"
    save_json(ROOT / "provenance.json", {
        "algorithm": "G'MIC fx_paint_with_brush: actual diffusion-tensor-guided virtual ellipse strokes",
        "gmic_version_output": run([EXE, "-version"]).strip(),
        "source_repository": "https://github.com/GreycLab/gmic",
        "source_commit": COMMIT,
        "source_url": f"https://raw.githubusercontent.com/GreycLab/gmic/{COMMIT}/src/gmic_stdlib.gmic",
        "interface_lines": [48030, 48279],
        "archive_url": "https://gmic.eu/get_file.php?file=windows/gmic_4.0.5_cli_win64.zip",
        "archive_sha256": sha256(archive), "executable_sha256": sha256(EXE),
        "stdlib_sha256": sha256(STDLIB), "archive_bytes": archive.stat().st_size,
        "windows_authenticode": "NotSigned; downloaded from official HTTPS site; hashes are local integrity records, not an independent publisher signature",
        "license": {
            "stdlib": "Dual-licensed CeCILL-C or CeCILL v2.1",
            "bundled_license": str(BIN / "COPYING"), "bundled_readme": str(BIN / "README"),
            "license_sha256": sha256(BIN / "COPYING"),
            "copyright": "David Tschumperle / GREYC / CNRS",
            "redistribution": "Portable archive and bundled license retained locally; no model weights or third-party artwork used",
        },
        "native_processing": {
            "source": [1920, 1080], "gmic_input": [1920, 1080],
            "diffusion_tensor_field": [1920, 1080], "paint_canvas": [1920, 1080],
            "gmic_output": [1920, 1080], "encode": [1920, 1080],
            "spatial_downscale": False,
            "precision_explanation": "G'MIC precision subsamples the sorted list of candidate stroke positions, not the image or painting canvas",
        },
    })


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("test", "render", "finish", "provenance"))
    parser.add_argument("--preset", choices=PRESETS, default="balanced")
    parser.add_argument("--frames", type=int, nargs="+", default=[1, 61, 120])
    parser.add_argument("--timeout", type=int, default=180)
    parser.add_argument("--workers", type=int, choices=(1, 2), default=2)
    args = parser.parse_args()
    if any(i < 1 or i > COUNT for i in args.frames):
        parser.error("Frames must be within 1..120")
    ROOT.mkdir(parents=True, exist_ok=True)
    {"test": lambda: test(args), "render": lambda: render(args),
     "finish": finish, "provenance": provenance}[args.action]()


if __name__ == "__main__":
    main()
