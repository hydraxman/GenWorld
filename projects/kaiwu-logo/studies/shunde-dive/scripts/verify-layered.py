import json
import hashlib
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUTPUT = Path(__file__).resolve().parents[1] / "output"
FILES = {
    "clean": OUTPUT / "background-v3-clean.mp4",
    "badge": OUTPUT / "badge-v3-alpha.mov",
}


def probe(path):
    return json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format",
        "-of", "json", str(path),
    ]))


def frame(path, number, output_format=None):
    filters = f"select=eq(n\\,{number})"
    if output_format:
        filters += f",format={output_format}"
    raw = subprocess.check_output([
        "ffmpeg", "-v", "error", "-i", str(path), "-vf", filters,
        "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1",
    ])
    return np.frombuffer(raw, np.uint8).reshape(1080, 1920, 4)


def differences(a, b, mask):
    values = np.abs(a[:, :, :3].astype(float) - b[:, :, :3].astype(float))[mask]
    assert len(values), "Comparison region is empty"
    return {"mean": float(values.mean()), "p99": float(np.percentile(values, 99))}

def verify_comparison():
    variants = json.loads((OUTPUT.parent / "scripts" / "comparison-variants.json").read_text())
    required = [*FILES.values(), *[
        path for variant in variants for path in (
            OUTPUT.parent / variant["backgroundSource"],
            OUTPUT / "comparison-v4" / f"{variant['name']}-final.mp4",
        )
    ]]
    missing = [str(path) for path in required if not path.is_file()]
    if missing:
        raise FileNotFoundError("Missing rendered comparison media; export the source passes and process/compose backgrounds first:\n"
                                + "\n".join(missing))
    for name, path in FILES.items():
        metadata = probe(path)
        stream = next(s for s in metadata["streams"] if s["codec_type"] == "video")
        assert (stream["width"], stream["height"], int(stream["nb_read_frames"])) == (1920, 1080, 120)
        assert stream["r_frame_rate"] == "30/1" and float(metadata["format"]["duration"]) == 4
        assert not any(s["codec_type"] == "audio" for s in metadata["streams"])
        if name == "badge":
            assert "yuva" in stream["pix_fmt"], "Badge export lost its alpha channel"
    frames = [18, 40, 75, 119]
    contact = Image.new("RGB", (1920, len(frames) * 392), "#e5e4df")
    draw = ImageDraw.Draw(contact)
    reference_sheet = Image.new("RGB", (1920, 1152), "#e5e4df")
    reference_draw = ImageDraw.Draw(reference_sheet)
    clean = frame(FILES["clean"], 119)
    reference_sheet.paste(Image.fromarray(clean[:, :, :3]).resize((960, 540)), (0, 0))
    reference_draw.text((16, 552), "00 | Untreated source background / same frame", fill="#263139")
    badge_frames = {n: frame(FILES["badge"], n) for n in frames}
    # Compare opaque pixels in the delivery's chroma format, not ProRes 4:4:4.
    badge_delivery = frame(FILES["badge"], 119, output_format="yuv420p")
    audio_hashes = []
    reports = []
    for column, variant in enumerate(variants):
        name = variant["name"]
        background = OUTPUT.parent / variant["backgroundSource"]
        video = OUTPUT / "comparison-v4" / f"{name}-final.mp4"
        result = {"name": name, "background": str(background), "video": str(video)}
        for path, needs_audio in [(background, False), (video, True)]:
            metadata = probe(path)
            stream = next(s for s in metadata["streams"] if s["codec_type"] == "video")
            assert (stream["width"], stream["height"], int(stream["nb_read_frames"])) == (1920, 1080, 120)
            assert stream["r_frame_rate"] == "30/1" and float(metadata["format"]["duration"]) == 4
            audio = [s for s in metadata["streams"] if s["codec_type"] == "audio"]
            assert len(audio) == int(needs_audio), (name, "unexpected audio tracks")
            if audio:
                assert audio[0]["sample_rate"] == "48000" and audio[0]["channels"] == 2
        pcm = subprocess.check_output([
            "ffmpeg", "-v", "error", "-i", str(video), "-vn", "-f", "f32le",
            "-acodec", "pcm_f32le", "pipe:1",
        ])
        samples = np.frombuffer(pcm, dtype=np.float32).reshape(-1, 2)[:192000]
        assert len(samples) == 192000 and np.isfinite(samples).all()
        tail_rms = float(np.sqrt(np.mean(samples[-960:] ** 2)))
        assert tail_rms < .00001, (name, "soundtrack ending must be silent")
        audio_hashes.append(hashlib.sha256(pcm).hexdigest())
        result.update(audioPCMHash=audio_hashes[-1], last20msRMS=tail_rms,
                      bytes=video.stat().st_size, frames=[])
        for row, n in enumerate(frames):
            painted, final = frame(background, n), frame(video, n)
            alpha = Image.fromarray(badge_frames[n][:, :, 3])
            outside = np.array(alpha.filter(ImageFilter.MaxFilter(9))) == 0
            delta = differences(final, painted, outside)
            assert delta["mean"] < 3, (name, n, "background must match processed source", delta)
            detail = {"frame": n, "backgroundDifference": delta}
            if n == 119:
                opaque = np.array(alpha.filter(ImageFilter.MinFilter(5))) == 255
                badge_delta = differences(final, badge_delivery, opaque)
                assert badge_delta["mean"] < 3 and badge_delta["p99"] < 13, (name, badge_delta)
                treatment_delta = differences(clean, painted, np.ones((1080, 1920), dtype=bool))
                assert treatment_delta["mean"] > 6, (name, "style is missing", treatment_delta)
                detail.update(unfilteredBadgeDifference=badge_delta, styleDifference=treatment_delta,
                              badgeReferenceFormat="unfiltered ProRes converted to delivery yuv420p")
                ref_x, ref_y = ((column + 1) % 2) * 960, ((column + 1) // 2) * 576
                reference_sheet.paste(Image.fromarray(painted[:, :, :3]).resize((960, 540)), (ref_x, ref_y))
                reference_draw.text((ref_x + 16, ref_y + 552), f"{name} | Processed background / same frame",
                                    fill="#263139")
            result["frames"].append(detail)
            x, y = column * 640, row * 392
            contact.paste(Image.fromarray(final[:, :, :3]).resize((640, 360), Image.Resampling.LANCZOS), (x, y))
            draw.text((x + 12, y + 372), f"{name} | {n / 30:.3f}s | actual encoded final", fill="#263139")
        reports.append(result)
    assert len(set(audio_hashes)) == 1, "comparison soundtracks must be identical"
    target = OUTPUT / "comparison-v4"
    contact.save(target / "three-styles-contact.jpg", quality=95)
    reference_sheet.save(target / "background-before-after.jpg", quality=95)
    (target / "delivery-proof.json").write_text(json.dumps(reports, indent=2), encoding="utf-8")
    print(json.dumps(reports, indent=2))


if __name__ == "__main__":
    verify_comparison()
