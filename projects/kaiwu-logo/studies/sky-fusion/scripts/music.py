"""Original deterministic rhythm sketch; not a licensed-library or finished score."""
from array import array
import json
import math
from pathlib import Path
import random
import sys
import wave

RATE = 48000
DURATION = 8
COUNT = RATE * DURATION
left, right = array("d", [0]) * COUNT, array("d", [0]) * COUNT


def note(start, length, midi, level, pan=0, bell=False):
    frequency = 440 * 2 ** ((midi - 69) / 12)
    first = round(start * RATE)
    size = min(round(length * RATE), COUNT - first)
    gain_l, gain_r = math.sqrt((1 - pan) / 2), math.sqrt((1 + pan) / 2)
    for n in range(size):
        t = n / RATE
        attack = 1 - math.exp(-t / (.008 if bell else .22))
        release = min(1, (length - t) / (.25 if bell else .8))
        decay = math.exp(-t / (1.0 if bell else 5))
        phase = 2 * math.pi * frequency * t
        value = math.sin(phase) + .25 * math.sin(phase * 2) * math.exp(-t * 2)
        if bell:
            value += .12 * math.sin(phase * 3.01) * math.exp(-t * 4)
        else:
            value += .15 * math.sin(phase * 1.002)
        value *= level * attack * release * decay
        left[first + n] += value * gain_l
        right[first + n] += value * gain_r


for midi, pan in [(50, -.5), (57, .5), (61, -.25), (66, .3), (69, -.2)]:
    note(0, 5.2, midi, .055, pan)
for midi, pan in [(43, -.4), (57, .4), (62, -.2), (66, .2), (69, .6)]:
    note(4.35, 3.65, midi, .06, pan)
for i, midi in enumerate([74, 78, 81, 85, 86, 90]):
    note(.35 + i * .72, 2.0, midi, .085, (i % 3 - 1) * .45, True)
for start, midi, level in [(4.45, 86, .10), (4.45, 78, .06), (4.45, 74, .045),
                            (4.87, 81, .075), (5.29, 85, .065), (5.71, 86, .085),
                            (6.55, 86, .10), (6.55, 78, .06), (6.55, 74, .05)]:
    note(start, min(2.4, DURATION - start), midi, level, .12, True)

rng = random.Random(61387)
low = 0
for n in range(COUNT):
    t = n / RATE
    noise = rng.uniform(-1, 1)
    low = .94 * low + .06 * noise
    swell = math.exp(-((t - 3.7) / .52) ** 2) * .025 + math.exp(-((t - 6.8) / .4) ** 2) * .012
    left[n] += low * swell
    right[n] += low * swell

delay = round(.1875 * RATE)
dry_l, dry_r = array("d", left), array("d", right)
for offset, gain in [(delay, .19), (delay * 2, .10), (delay * 3, .055)]:
    for n in range(offset, COUNT):
        left[n] += dry_r[n - offset] * gain
        right[n] += dry_l[n - offset] * gain
peak = max(max(map(abs, left)), max(map(abs, right)))
pcm = array("h")
for n in range(COUNT):
    t = n / RATE
    fade = min(1, t / .08) * min(1, (DURATION - t) / .85)
    pcm.extend((round(left[n] / peak * .72 * fade * 32767),
                round(right[n] / peak * .72 * fade * 32767)))
if sys.byteorder != "little":
    pcm.byteswap()
root = Path(__file__).resolve().parent.parent
(root / "assets").mkdir(exist_ok=True)
with wave.open(str(root / "assets" / "study-music.wav"), "wb") as stream:
    stream.setnchannels(2)
    stream.setsampwidth(2)
    stream.setframerate(RATE)
    stream.writeframes(pcm.tobytes())
(root / "assets" / "music-provenance.json").write_text(json.dumps({
    "type": "original local synthesis",
    "purpose": "Rhythm and mood sketch only; not final music selection",
    "source": "scripts/music.py",
    "duration_seconds": DURATION,
    "sample_rate": RATE,
    "channels": 2,
    "borrowed_recordings_or_melodies": False,
    "cues_seconds": {"formation": .35, "three_layer_resolve": 4.4,
                    "glyphs": [4.45, 4.87, 5.29, 5.71], "sweep": 6.55, "hold": 7.2},
}, indent=2) + "\n", encoding="utf-8")
print("Created 8-second original stereo rhythm sketch.")
