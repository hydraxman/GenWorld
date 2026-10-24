"""Place PCM segments by frame index without speeding up the narration."""
import argparse
import json
from pathlib import Path
import wave
import numpy as np
from verify import ROOT, asset_path


def mix_audio(timing, output, root=ROOT):
    fps = timing['fps']
    if fps != 24 or not isinstance(timing['total_frames'], int) or timing['total_frames'] <= 0:
        raise ValueError('Expected a positive integer 24fps timeline')
    mixed = np.zeros(timing['total_frames'] * 2000, dtype=np.int32)
    for clip in timing['voices']:
        start = clip['start_frame']
        if not isinstance(start, int) or start < 0:
            raise ValueError('Invalid voice start frame')
        with wave.open(str(asset_path(root, clip['file']))) as source:
            if (source.getframerate(), source.getnchannels(), source.getsampwidth()) != (48000, 1, 2):
                raise ValueError('Only mono 48kHz PCM16 is supported')
            pcm = np.frombuffer(source.readframes(source.getnframes()), dtype='<i2')
        offset = start * 2000
        if offset + len(pcm) > len(mixed):
            raise ValueError('Voice exceeds the timeline')
        mixed[offset:offset + len(pcm)] += pcm.astype(np.int32)
    if mixed.max(initial=0) > 32767 or mixed.min(initial=0) < -32768:
        raise ValueError('Mix would clip; inspect overlapping source clips instead of silently normalizing')
    output.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(output), 'wb') as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(48000)
        target.writeframes(mixed.astype('<i2').tobytes())
    return dict(samples=len(mixed), duration_seconds=len(mixed) / 48000, speed_factor=1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--timing', type=Path, default=ROOT / 'timing.json')
    parser.add_argument('--output', type=Path, default=ROOT / 'output/rebuilt-narration.wav')
    args = parser.parse_args()
    if args.output.resolve().is_relative_to((ROOT / 'audio').resolve()):
        parser.error('Do not overwrite the frozen audio directory')
    print(json.dumps(mix_audio(json.loads(args.timing.read_text(encoding='utf-8')), args.output)))


if __name__ == '__main__':
    main()
