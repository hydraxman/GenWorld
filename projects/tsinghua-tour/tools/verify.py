"""Validate frozen inputs and a rendered MP4. No credentials or network needed."""
import argparse
import hashlib
import json
import math
from pathlib import Path, PureWindowsPath
import subprocess
import wave

ROOT = Path(__file__).resolve().parents[1]
REMINDER = '实际游览请提前确认入校预约，并遵守校园现场的开放与通行安排。'


def asset_path(root, relative):
    path = Path(relative)
    if path.is_absolute() or PureWindowsPath(str(relative)).is_absolute() or '..' in path.parts:
        raise ValueError('Asset path must stay within the project')
    result = (root / path).resolve()
    if not result.is_relative_to(root.resolve()) or not result.is_file():
        raise ValueError('Missing asset or escaped project root')
    return result


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def verify_assets(root=ROOT):
    manifest = read_json(root / 'assets-manifest.json')
    paths = [item['path'] for item in manifest['files']]
    if len(paths) != len(set(paths)):
        raise ValueError('Duplicate manifest asset')
    for item in manifest['files']:
        file = asset_path(root, item['path'])
        if file.stat().st_size != item['bytes'] or digest(file) != item['sha256']:
            raise ValueError('Asset changed: ' + item['path'])
    photos = read_json(root / 'photos/all-manifest.json')
    audio = read_json(root / 'audio/manifest.json')
    route = read_json(root / 'route.json')
    timing = read_json(root / 'timing.json')
    narration = read_json(root / 'narration.json')
    if len(photos) != 12 or len({x['name'] for x in photos}) != 12 or len(audio) != 15:
        raise ValueError('Expected twelve photos and fifteen narration segments')
    if {x['name'] for x in photos} != {x['name'] for x in route['stops']}:
        raise ValueError('Photo/stop mismatch')
    if timing['fps'] != 24 or timing['total_frames'] != 8525:
        raise ValueError('Frozen timing changed')
    previous = 0
    for segment in timing['segments']:
        if segment['start_frame'] != previous or segment['end_frame'] <= previous:
            raise ValueError('Timeline is not contiguous')
        previous = segment['end_frame']
    if previous != timing['total_frames']:
        raise ValueError('Timeline end mismatch')
    by_id = {x['id']: x for x in audio}
    if len(by_id) != 15 or len(timing['voices']) != 15:
        raise ValueError('Duplicate/missing voices')
    for clip in timing['voices']:
        path = asset_path(root, clip['file'])
        record = by_id[clip['id']]
        if digest(path) != record['sha256'] or clip['voice'] != 'zh-CN-XiaoxiaoNeural':
            raise ValueError('Voice identity or file mismatch')
        with wave.open(str(path)) as wav:
            if (wav.getframerate(), wav.getnchannels(), wav.getsampwidth()) != (48000, 1, 2):
                raise ValueError('Expected mono 48kHz PCM16')
            duration = wav.getnframes() / wav.getframerate()
        if not math.isfinite(clip['duration_seconds']) or abs(duration - clip['duration_seconds']) > 1 / 48000:
            raise ValueError('Voice duration mismatch')
        if clip['start_frame'] / 24 + duration > timing['duration_seconds']:
            raise ValueError('Voice exceeds timeline')
    if REMINDER not in next(x for x in narration if x['id'] == 'outro')['text']:
        raise ValueError('Booking reminder missing')
    if REMINDER not in (root / 'audio/outro.ssml').read_text(encoding='utf-8'):
        raise ValueError('Booking SSML missing')
    cp = read_json(root / 'research/couplet-and-history.json')['couplet']
    chars = ''.join(x['char'] for x in timing['couplet']['characters'])
    if len(chars) != 34 or chars != cp['upper'] + cp['lower']:
        raise ValueError('Couplet text changed')
    return dict(photos=12, voice_segments=15, total_frames=8525,
                booking_reminder_preserved=True, asset_files=len(paths), couplet_characters=34)


def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True)


def audio_hash(path):
    return run(['ffmpeg', '-v', 'error', '-i', str(path), '-map', '0:a:0',
                '-c:a', 'copy', '-f', 'hash', '-hash', 'sha256', '-']).stdout.strip()


def verify_video(video, expected_frames=8525, root=ROOT):
    inputs = verify_assets(root)
    if not 1 <= expected_frames <= 8525:
        raise ValueError('Expected frame count is out of range')
    probe = json.loads(run(['ffprobe', '-v', 'error', '-count_frames', '-show_streams',
                            '-show_format', '-of', 'json', str(video)]).stdout)
    v = next(x for x in probe['streams'] if x['codec_type'] == 'video')
    a = next(x for x in probe['streams'] if x['codec_type'] == 'audio')
    if (int(v['nb_read_frames']), v['width'], v['height'], v['r_frame_rate']) != (expected_frames, 1280, 720, '24/1'):
        raise ValueError('Unexpected video dimensions, frame count, or rate')
    duration = float(probe['format']['duration'])
    if abs(duration - expected_frames / 24) > .08 or a['codec_name'] != 'aac':
        raise ValueError('Unexpected duration/audio codec')
    run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(video), '-f', 'null', '-'])
    full = expected_frames == 8525
    if full and audio_hash(video) != audio_hash(root / 'audio/approved-narration.m4a'):
        raise ValueError('Approved narration bitstream changed')
    qa = video.parent / (video.stem + '-qa')
    qa.mkdir(exist_ok=True)
    indices = sorted({0, min(192, expected_frames - 1), min(732, expected_frames - 1),
                      min(4888, expected_frames - 1), expected_frames - 1})
    from PIL import Image, ImageDraw
    sheet = Image.new('RGB', (1280, math.ceil(len(indices) / 2) * 380), 'white')
    draw = ImageDraw.Draw(sheet)
    for index, frame in enumerate(indices):
        target = qa / f'frame-{frame:05d}.png'
        run(['ffmpeg', '-v', 'error', '-i', str(video), '-vf', f'select=eq(n\\,{frame})',
             '-frames:v', '1', '-y', str(target)])
        image = Image.open(target).convert('RGB')
        x, y = index % 2 * 640, index // 2 * 380
        sheet.paste(image.resize((640, 360)), (x, y))
        draw.text((x + 8, y + 364), f'frame={frame}', fill='black')
    sheet.save(qa / 'contact.jpg')
    report = dict(artifact=video.name, sha256=digest(video), bytes=video.stat().st_size,
                  frames=expected_frames, duration_seconds=duration, strict_decode=True,
                  scope='full' if full else 'short smoke render',
                  audio_identity_verified=full, visual_review='pending', **{k: value for k, value in inputs.items() if k != 'total_frames'})
    (qa / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--video', type=Path)
    parser.add_argument('--expect-frames', type=int, default=8525)
    args = parser.parse_args()
    result = verify_video(args.video.resolve(), args.expect_frames) if args.video else verify_assets()
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
