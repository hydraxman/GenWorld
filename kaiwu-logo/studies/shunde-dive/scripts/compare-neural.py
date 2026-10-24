"""Native-1080p, single-frame neural background previews; never resizes inference.

Install compare-neural-requirements.txt in output/comparison-v4/neural/env.
The inspected, revision-pinned upstream architectures and checkpoints must be
present in that ignored directory. Run --phase preview before --phase render.
Model licenses do not imply independently verified checkpoint redistribution.
"""

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
from datetime import datetime, timezone

os.environ.setdefault("CUBLAS_WORKSPACE_CONFIG", ":4096:8")

import numpy as np
from PIL import Image, ImageDraw
import torch
import torch.nn.functional as F


PROJECT = Path(__file__).resolve().parents[1]
ROOT = PROJECT / "output" / "comparison-v4"
WORK = ROOT / "neural"
DIAG = WORK / "diagnostics"
SOURCE = PROJECT / "output" / "background-v3-clean.mp4"
WIDTH, HEIGHT, FPS, COUNT = 1920, 1080, 30, 120
SAMPLES = (0, 60, 119)
SPECS = {
    "pytorch": {
        "repository": "https://github.com/pytorch/examples",
        "commit": "acc295dc7b90714f1bf47f06004fc19a7fe235c4",
        "code_license": "BSD-3-Clause",
        "style": "rain_princess",
        "weight": "rain_princess.pth",
        "weight_url": "https://www.dropbox.com/s/lrvwfehqdcxoza8/saved_models.zip?dl=1",
        "weight_link_source": "fast_neural_style/download_saved_models.py",
        "output": "02-pytorch-background.mp4",
        "input_range": "[0,255] RGB float32",
        "temporal": "Independent frame inference; no temporal training objective.",
    },
    "reconet": {
        "repository": "https://github.com/EmptySamurai/pytorch-reconet",
        "commit": "a8e7e377f93b508f50a035983bdc8f83689ac097",
        "code_license": "MIT",
        "style": "FRN mosaic",
        "weight": "reconet-frn-mosaic.pth",
        "weight_url": "https://drive.google.com/open?id=1T7P5w_V5cMumeEoXs3WFituiiVGhGb3H",
        "weight_link_source": "README.md",
        "output": "03-reconet-background.mp4",
        "input_range": "[-1,1] RGB float32",
        "temporal": (
            "Third-party reproduction, not the original paper authors. Training "
            "includes temporal losses; inference is independent per frame with "
            "no previous-frame input or optical-flow feedback."
        ),
    },
}


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path, data):
    Path(path).write_text(json.dumps(data, indent=2), encoding="utf-8")


def probe(path):
    return json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-count_frames", "-show_streams",
        "-show_format", "-of", "json", str(path),
    ], text=True))


def validate_probe(data):
    streams = data["streams"]
    assert len(streams) == 1, "Expected silent video with exactly one stream"
    video = streams[0]
    assert video["codec_type"] == "video"
    assert (video["width"], video["height"]) == (WIDTH, HEIGHT)
    assert video["avg_frame_rate"] == "30/1"
    assert int(video["nb_read_frames"]) == COUNT
    assert abs(float(video["duration"]) - COUNT / FPS) < 1e-6
    assert video["codec_name"] == "h264" and video["pix_fmt"] == "yuv420p"


def decoded_frames(path, label):
    command = [
        "ffmpeg", "-nostdin", "-v", "error", "-threads", "2", "-i", str(path),
        "-map", "0:v:0", "-an", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
    ]
    with (DIAG / f"{label}-decode.log").open("wb") as errors:
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=errors)
        try:
            for index in range(COUNT):
                raw = process.stdout.read(WIDTH * HEIGHT * 3)
                if len(raw) != WIDTH * HEIGHT * 3:
                    raise RuntimeError(f"Truncated frame {index} in {path}")
                yield index, np.frombuffer(raw, np.uint8).reshape(HEIGHT, WIDTH, 3)
            if process.stdout.read(1):
                raise RuntimeError(f"Unexpected additional frames in {path}")
            if process.wait() != 0:
                raise RuntimeError(f"FFmpeg decode failed; see {label}-decode.log")
        finally:
            process.stdout.close()
            if process.poll() is None:
                process.terminate()
                process.wait()


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_model(key):
    source = WORK / "sources" / key
    if key == "pytorch":
        model = load_module("official_transformer", source / "transformer_net.py").TransformerNet()
    else:
        sys.modules["frn"] = load_module("frn", source / "frn.py")
        model = load_module("reconet_architecture", source / "model.py").ReCoNet(frn=True)
    checkpoint = WORK / "models" / SPECS[key]["weight"]
    state = torch.load(checkpoint, map_location="cpu", weights_only=True)
    assert isinstance(state, dict) and all(
        isinstance(k, str) and isinstance(v, torch.Tensor) for k, v in state.items()
    ), "Only a tensor state_dict is accepted; no unsafe pickle fallback"
    removed = []
    if key == "pytorch":
        for name in list(state):
            if re.search(r"in\d+\.running_(mean|var)$", name):
                removed.append(name)
                del state[name]
    model.load_state_dict(state, strict=True)
    model.requires_grad_(False)
    return model.eval().to("cuda", dtype=torch.float32), removed


def make_sheet(prefix):
    labels = ["source", "pytorch", "reconet"]
    available = [
        label for label in labels
        if all((DIAG / f"{prefix}-{label}-{index:03d}.png").exists() for index in SAMPLES)
    ]
    sheet = Image.new("RGB", (1920, len(available) * 396), "#181b22")
    draw = ImageDraw.Draw(sheet)
    for row, label in enumerate(available):
        for col, index in enumerate(SAMPLES):
            path = DIAG / f"{prefix}-{label}-{index:03d}.png"
            with Image.open(path) as image:
                sheet.paste(image.resize((640, 360), Image.Resampling.LANCZOS), (col * 640, row * 396 + 30))
            draw.text(
                (col * 640 + 12, row * 396 + 8),
                f"{label} | frame {index:03d} | {index / FPS:.3f}s | native 1920x1080",
                fill="white",
            )
    target = DIAG / f"{prefix}-contact-sheet.jpg"
    sheet.save(target, quality=95)
    return str(target)


def environment():
    return {
        "python": sys.version,
        "executable": sys.executable,
        "torch": torch.__version__,
        "torch_cuda": torch.version.cuda,
        "cudnn": torch.backends.cudnn.version(),
        "gpu": torch.cuda.get_device_name(0),
        "gpu_total_bytes": torch.cuda.get_device_properties(0).total_memory,
        "numpy": np.__version__,
        "pip_freeze": subprocess.check_output(
            ["uv", "pip", "freeze", "--python", sys.executable], text=True
        ).splitlines(),
        "ffmpeg": subprocess.check_output(["ffmpeg", "-version"], text=True).splitlines()[0],
        "nvidia_smi": subprocess.check_output([
            "nvidia-smi", "--query-gpu=name,driver_version,memory.total,memory.used",
            "--format=csv,noheader",
        ], text=True).strip(),
    }


def render(key, args, input_probe):
    spec = SPECS[key]
    start = time.perf_counter()
    model, removed = load_model(key)
    torch.cuda.reset_peak_memory_stats()
    observed_shapes = set()
    model_calls = 0

    def record_shape(_module, inputs):
        nonlocal model_calls
        model_calls += 1
        observed_shapes.add(tuple(inputs[0].shape))

    hook = model.register_forward_pre_hook(record_shape)
    preview = args.phase == "preview"
    output = ROOT / spec["output"]
    command = [
        "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s:v", f"{WIDTH}x{HEIGHT}",
        "-r", str(FPS), "-i", "pipe:0", "-an", "-c:v", "libx264",
        "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
        "-vf", "scale=in_range=full:out_range=tv:out_color_matrix=bt709",
        "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709",
        "-color_trc", "bt709", "-threads", "4", "-frames:v", str(COUNT),
        "-movflags", "+faststart", str(output),
    ]
    encoder = None
    times = []
    sample_measurements = []
    repeat_max = None
    pixels = WIDTH * HEIGHT
    with (DIAG / f"{args.phase}-{key}-encode.log").open("wb") as errors:
        if not preview:
            encoder = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=errors)
        try:
            for index, frame in decoded_frames(SOURCE, f"{args.phase}-{key}-source"):
                if preview and index not in SAMPLES:
                    continue
                tensor = torch.from_numpy(frame.copy()).permute(2, 0, 1).unsqueeze(0)
                tensor = tensor.to("cuda", dtype=torch.float32)
                if key == "reconet":
                    tensor = tensor / 127.5 - 1
                pad_h, pad_w = (-HEIGHT) % 4, (-WIDTH) % 4
                if pad_h or pad_w:
                    tensor = F.pad(tensor, (0, pad_w, 0, pad_h), mode="reflect")
                assert tuple(tensor.shape) == (1, 3, HEIGHT + pad_h, WIDTH + pad_w)
                torch.cuda.synchronize()
                before = time.perf_counter()
                with torch.inference_mode():
                    styled = model(tensor)
                    if preview and index == 0:
                        repeated = model(tensor)
                        repeat_max = float((styled - repeated).abs().max())
                        del repeated
                    styled = styled[:, :, :HEIGHT, :WIDTH]
                    if key == "reconet":
                        styled = (styled + 1) * 127.5
                    assert tuple(styled.shape) == (1, 3, HEIGHT, WIDTH)
                    if not torch.isfinite(styled).all():
                        raise RuntimeError(f"Nonfinite model output at frame {index}")
                    raw_style = styled.clamp(0, 255)
                    styled = (raw_style * args.darkening).round().clamp(0, 255)
                    result = styled[0].permute(1, 2, 0).to(torch.uint8).cpu().numpy()
                torch.cuda.synchronize()
                times.append(time.perf_counter() - before)
                if index in SAMPLES:
                    Image.fromarray(frame).save(DIAG / f"{args.phase}-source-{index:03d}.png")
                    Image.fromarray(result).save(DIAG / f"{args.phase}-{key}-{index:03d}.png")
                    sample_measurements.append({
                        "frame": index,
                        "input_shape": list(tensor.shape),
                        "output_shape": list(styled.shape),
                        "mean_rgb": result.mean(axis=(0, 1)).tolist(),
                        "source_mae_rgb_0_255": float(np.abs(result.astype(np.float32) - frame).mean()),
                        "black_pixel_fraction": float((result.max(axis=2) <= 3).sum() / pixels),
                        "white_pixel_fraction": float((result.min(axis=2) >= 252).sum() / pixels),
                    })
                if encoder:
                    encoder.stdin.write(result.tobytes())
                if index % 20 == 0 or index == COUNT - 1:
                    print(f"{key} {args.phase}: frame {index + 1}/{COUNT}; {times[-1]:.3f}s inference+transfer", flush=True)
                del tensor, styled, raw_style
            if encoder:
                encoder.stdin.close()
                if encoder.wait() != 0:
                    raise RuntimeError(f"Encoding failed for {key}")
        finally:
            hook.remove()
            if encoder and encoder.poll() is None:
                encoder.terminate()
                encoder.wait()
    peak = torch.cuda.max_memory_allocated()
    reserved = torch.cuda.max_memory_reserved()
    elapsed = time.perf_counter() - start
    metadata = {
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "phase": args.phase,
        "source": str(SOURCE),
        "source_sha256": sha256(SOURCE),
        "source_probe": input_probe,
        "model": spec,
        "checkpoint_sha256": sha256(WORK / "models" / spec["weight"]),
        "checkpoint_bytes": (WORK / "models" / spec["weight"]).stat().st_size,
        "checkpoint_license": (
            "Independent weight license NOT verified. Authorized local comparison "
            "previews only; no implied external redistribution authorization. "
            "Weights are ignored local files and must not be delivered to OneDrive."
        ),
        "upstream_source_sha256": {
            p.name: sha256(p) for p in sorted((WORK / "sources" / key).iterdir()) if p.is_file()
        },
        "script_sha256": sha256(__file__),
        "requirements_sha256": sha256(Path(__file__).with_name("compare-neural-requirements.txt")),
        "execution_command": subprocess.list2cmdline([sys.executable, *sys.argv]),
        "encoder_command": None if preview else subprocess.list2cmdline(command),
        "environment": environment(),
        "inference": {
            "precision": "float32; TF32 disabled",
            "eval": True,
            "inference_mode": True,
            "weights_only_load": True,
            "strict_state_dict": True,
            "deprecated_pytorch_running_stats_removed": removed,
            "batch": 1,
            "observed_model_input_nchw": sorted(observed_shapes),
            "model_call_count": model_calls,
            "frames_processed": len(times),
            "preview_repeat_same_frame_max_abs_difference": repeat_max,
            "external_input_resize": False,
            "external_output_upscale": False,
            "tiles": False,
            "reflection_padding_lrtb": [0, (-WIDTH) % 4, 0, (-HEIGHT) % 4],
            "architectural_note": (
                "Full native frame enters the network. Its learned architecture "
                "internally downsamples/upsamples feature maps; no image resizing "
                "or tiled inference is performed outside the network."
            ),
            "torch_deterministic_algorithms": True,
            "cudnn_deterministic": True,
            "cudnn_benchmark": False,
            "seed": 2026,
        },
        "finish": {"neural_style_weight": 1.0, "source_blend": 0.0, "rgb_gain": args.darkening},
        "runtime_seconds_including_load_decode_encode": elapsed,
        "inference_transfer_seconds": times,
        "timing_note": (
            "Measured wall time, not a future speed guarantee. Per-frame timings "
            "include GPU execution, finish and host transfer; preview frame 0 "
            "also includes an extra identical-input determinism check."
        ),
        "peak_cuda_allocated_bytes": peak,
        "peak_cuda_reserved_bytes": reserved,
        "sample_measurements": sample_measurements,
        "output": None if preview else str(output),
        "output_sha256": None if preview else sha256(output),
    }
    if not preview:
        metadata["output_probe"] = probe(output)
        validate_probe(metadata["output_probe"])
    write_json(DIAG / f"{args.phase}-{key}.json", metadata)
    del model
    torch.cuda.empty_cache()
    print(f"{key}: verified {len(times)} native frames; peak CUDA allocated {peak / 2**30:.2f} GiB; elapsed {elapsed:.1f}s", flush=True)


def temporal_metrics():
    """Native-resolution temporal diagnostics, not a motion-coherence guarantee."""
    records = []
    previous = {}
    streams = {
        "source": decoded_frames(SOURCE, "verify-source"),
        **{key: decoded_frames(ROOT / spec["output"], f"verify-{key}") for key, spec in SPECS.items()},
    }
    for batches in zip(*streams.values(), strict=True):
        current = {}
        index = batches[0][0]
        record = {"frame": index}
        for (key, _), (frame_index, frame) in zip(streams.items(), batches, strict=True):
            assert frame_index == index
            current[key] = {
                "full": frame.astype(np.int16),
            }
            if index in SAMPLES:
                Image.fromarray(frame).save(DIAG / f"verified-{key}-{index:03d}.png")
            if key != "source":
                record[f"{key}_source_mae"] = float(np.abs(current[key]["full"] - current["source"]["full"]).mean())
        if previous:
            source_delta = current["source"]["full"] - previous["source"]["full"]
            for key in streams:
                delta = current[key]["full"] - previous[key]["full"]
                record[f"{key}_adjacent_mae_native"] = float(np.abs(delta).mean())
                record[f"{key}_mean_rgb_change"] = float(np.abs(delta.mean(axis=(0, 1))).mean())
                record[f"{key}_source_delta_residual_mae"] = float(np.abs(delta - source_delta).mean())
        records.append(record)
        previous = current
    keys = [key for key in records[1] if key != "frame"]
    summary = {}
    for key in keys:
        values = np.array([row[key] for row in records if key in row])
        summary[key] = {
            "mean": float(values.mean()), "p95": float(np.percentile(values, 95)),
            "max": float(values.max()), "last_10_mean": float(values[-10:].mean()),
        }
    report = {
        "method": (
            "RGB MAE in 0..255 on decoded H264; all pixel comparisons use native "
            "1920x1080 frames. Adjacent MAE and absolute per-channel mean change "
            "compare consecutive frames. Source-delta residual compares the "
            "stylized temporal derivative against the input temporal derivative. "
            "These are unwarped diagnostics: camera motion, occlusions, texture, "
            "palette and contrast confound the measurements. They do NOT isolate "
            "flicker or establish temporal coherence. No optical-flow analysis was "
            "used; PyPI CDN TLS failure prevented the optional OpenCV dependency."
        ),
        "summary": summary,
        "frames": records,
        "contact_sheet": make_sheet("verified"),
    }
    write_json(DIAG / "temporal-comparison.json", report)
    print(json.dumps(summary, indent=2), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--phase", choices=("preview", "render", "verify"), required=True)
    parser.add_argument("--models", nargs="+", choices=tuple(SPECS), default=list(SPECS))
    parser.add_argument("--darkening", type=float, default=0.9)
    args = parser.parse_args()
    if not 0.75 <= args.darkening <= 1.0:
        parser.error("--darkening must be between 0.75 and 1.0")
    DIAG.mkdir(parents=True, exist_ok=True)
    if args.phase == "verify":
        for spec in SPECS.values():
            validate_probe(probe(ROOT / spec["output"]))
        temporal_metrics()
        return
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA unavailable; refusing implicit CPU/downscaled fallback")
    torch.manual_seed(2026)
    np.random.seed(2026)
    torch.set_num_threads(4)
    torch.use_deterministic_algorithms(True)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False
    torch.backends.cuda.matmul.allow_tf32 = False
    torch.backends.cudnn.allow_tf32 = False
    input_probe = probe(SOURCE)
    validate_probe(input_probe)
    for key in args.models:
        render(key, args, input_probe)
    print(make_sheet(args.phase), flush=True)


if __name__ == "__main__":
    main()
