"""Verify the cadence mix (--preview) or the encoded video's gradual release."""
from array import array
import argparse
from html.parser import HTMLParser
import json
import math
from pathlib import Path
import subprocess
import sys

project = Path(__file__).resolve().parent.parent
output = project / "output"
rate = 48000
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--preview", action="store_true")
parser.add_argument("--video", type=Path, default=output / "kaiwu-sky-fusion-2026-4s-soft-ending.mp4")
args = parser.parse_args()


class MusicClip(HTMLParser):
    attributes = None

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "audio" and attributes.get("id") == "rhythm-study":
            self.attributes = attributes


def decode(path, filters=None):
    command = ["ffmpeg", "-v", "error", "-i", str(path), "-vn"]
    if filters:
        command += ["-af", filters]
    data = subprocess.check_output(command + [
        "-t", "4", "-ar", str(rate), "-ac", "2", "-f", "f32le", "-"])
    samples = array("f")
    samples.frombytes(data)
    if sys.byteorder != "little":
        samples.byteswap()
    return samples


def rms(samples, start, end):
    section = samples[round(start * rate) * 2:round(end * rate) * 2]
    assert section, "Missing audio interval"
    return math.sqrt(sum(value * value for value in section) / len(section))


clip = MusicClip()
clip.feed((project / "index.html").read_text(encoding="utf-8"))
attrs = clip.attributes
assert attrs is not None, "Missing music track"
assert float(attrs["data-playback-rate"]) == 2
points = json.loads(attrs["data-automation"])["lanes"][0]["points"]
assert points[1] == {"t": 3.275, "v": 1}
assert points[-2] == {"t": 3.98, "v": 0}
source = decode(project / attrs["src"], "atempo=2,apad,atrim=end=4")
assert len(source) == 4 * rate * 2
expected = array("f", source)
segment = 0
for frame in range(4 * rate):
    time = frame / rate
    while segment < len(points) - 2 and time > points[segment + 1]["t"]:
        segment += 1
    a, b = points[segment:segment + 2]
    level = a["v"] + (b["v"] - a["v"]) * (time - a["t"]) / (b["t"] - a["t"])
    for channel in range(2):
        expected[2 * frame + channel] *= level * float(attrs["data-volume"])
video = args.video
preview = args.preview
actual = expected if preview else decode(video)
assert len(actual) == len(expected), "Music must last exactly four seconds"
indices = range(round(.2 * rate) * 2, round(3.9 * rate) * 2, 17)
xy = sum(actual[i] * expected[i] for i in indices)
xx = sum(actual[i] ** 2 for i in indices)
yy = sum(expected[i] ** 2 for i in indices)
correlation = xy / math.sqrt(xx * yy)
windows = [(3.3, 3.45), (3.5, 3.65), (3.7, 3.85), (3.9, 3.98), (3.98, 4)]
levels = [rms(actual, start, end) for start, end in windows]
report = {
    "mode": "authored PCM mix only; not an encoded export" if preview else "encoded video audio",
    "video": None if preview else str(video),
    "duration_seconds": len(actual) / (rate * 2),
    "final_chord_seconds": 6.55 / 2,
    "release_rms": [{"from": a, "to": b, "rms": level,
                     "dbfs": 20 * math.log10(max(level, 1e-12))}
                    for (a, b), level in zip(windows, levels)],
    "new_last_20ms_rms": levels[-1],
    "peak": max(map(abs, actual)),
}
if not preview:
    report["correlation_to_pitch_preserved_source_with_fade"] = correlation
report_name = "music-ending-preview-proof.json" if preview else "music-ending-proof.json"
(output / report_name).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, indent=2))
if not preview:
    assert correlation > .98, "Rendered music does not match the full, pitch-preserved source and fade"
assert all(a > b for a, b in zip(levels, levels[1:])), "Release should get steadily quieter"
assert levels[-1] < .0001, "Ending must reach near-silence before the cut"
assert .01 < report["peak"] < .99, "Music must remain audible without clipping"
