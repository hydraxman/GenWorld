"""Encode captured map frames with the approved, unmodified narration."""
import argparse
import json
import math
from pathlib import Path
import shutil
import subprocess
from verify import ROOT, read_json, verify_assets, verify_video, digest


def validate_frames(directory, expected, views=None):
    hashes = {row['frame']: row['sha256'] for row in views} if views is not None else None
    if views is not None and hashes is not None and len(hashes) != len(views):
        raise ValueError('Duplicate frame in capture report')
    if not 1 <= expected <= 8525:
        raise ValueError('Expected frames must be in 1..8525')
    for i in range(expected):
        path = directory / f'frame-{i:05d}.jpg'
        if not path.is_file() or path.stat().st_size == 0:
            raise ValueError(f'Missing or empty frame {i}; capture must start at frame zero')
        if hashes is not None and hashes.get(i) != digest(path):
            raise ValueError(f'Captured frame {i} changed or has no report binding')
    return expected


def run(command, log):
    with log.open('w', encoding='utf-8') as stream:
        subprocess.run(command, check=True, stdout=stream, stderr=subprocess.STDOUT)


def export(basemap='satellite', capture_dir=None, limit_frames=8525):
    verify_assets()
    directory = (capture_dir or ROOT / 'output' / basemap).resolve()
    report = read_json(directory / 'capture-report.json')
    if report.get('errors'):
        raise ValueError('Capture report contains errors')
    captured_mode = report.get('basemap', report.get('mode'))
    if captured_mode != basemap:
        raise ValueError('Capture basemap does not match requested export')
    if (not isinstance(report.get('fingerprint'), str)
            or not isinstance(report.get('settings'), dict)
            or not isinstance(report.get('files'), dict)
            or report.get('basemap') != basemap):
        raise ValueError('Capture report has no complete fingerprint record')
    current = json.loads(subprocess.run([
        'node', '--input-type=module', '-e',
        "import {readFileSync} from 'node:fs'; "
        "import {computeFingerprint} from './tools/capture-core.mjs'; "
        "const {root, basemap, settings} = JSON.parse(readFileSync(0, 'utf8')); "
        "console.log(JSON.stringify(await computeFingerprint(root, basemap, settings)));"
    ], cwd=ROOT, input=json.dumps({'root': str(ROOT), 'basemap': basemap, 'settings': report['settings']}),
        text=True, capture_output=True, check=True).stdout)
    if any(report.get(key) != value for key, value in current.items()):
        raise ValueError('Capture fingerprint does not match current inputs/settings; capture again in a new directory')
    if not isinstance(report.get('views'), list):
        raise ValueError('Capture report has no frame hash bindings')
    validate_frames(directory / 'frames', limit_frames, report['views'])
    duration = limit_frames / 24
    master = directory / 'tour-master.mp4'
    final = directory / 'tour.mp4'
    audio = ROOT / 'audio/approved-narration.m4a'
    state = directory / 'production-state.json'

    def stage(name):
        state.write_text(json.dumps({'stage': name, 'basemap': basemap, 'frames': limit_frames}, indent=2) + '\n')

    try:
        stage('encoding_master')
        run(['ffmpeg', '-v', 'error', '-framerate', '24', '-i', str(directory / 'frames/frame-%05d.jpg'),
             '-i', str(audio), '-map', '0:v:0', '-map', '1:a:0', '-t', str(duration),
             '-c:v', 'libx264', '-preset', 'slow', '-crf', '25', '-g', '24', '-keyint_min', '24',
             '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', '-y', str(master)],
            directory / 'encode-master.log')
        if master.stat().st_size < 29_000_000:
            shutil.copy2(master, final)
        else:
            stage('encoding_chat_copy')
            probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-of', 'json', str(audio)], text=True))
            bitrate = int(next(x for x in probe['streams'] if x['codec_type'] == 'audio')['bit_rate'])
            target = math.floor(27_500_000 * 8 / duration - bitrate - 12_000)
            base = ['ffmpeg', '-v', 'error', '-i', str(master), '-c:v', 'libx264', '-preset', 'slow',
                    '-b:v', str(target), '-pix_fmt', 'yuv420p', '-passlogfile', str(directory / 'chat-pass')]
            run(base + ['-pass', '1', '-an', '-f', 'null', '-y', '-'], directory / 'encode-chat-pass1.log')
            run(base + ['-pass', '2', '-c:a', 'copy', '-movflags', '+faststart', '-y', str(final)], directory / 'encode-chat-pass2.log')
        if final.stat().st_size >= 30_000_000:
            raise ValueError('Chat copy exceeds the 30 MB budget')
        stage('verifying')
        result = verify_video(final, limit_frames)
        stage('ready_for_visual_review')
        return result
    except BaseException:
        stage('failed')
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--basemap', choices=['standard', 'satellite'], default='satellite')
    parser.add_argument('--capture-dir', type=Path)
    parser.add_argument('--limit-frames', type=int, default=8525, help='Prefix smoke render only; full production uses 8525')
    args = parser.parse_args()
    print(json.dumps(export(args.basemap, args.capture_dir, args.limit_frames), ensure_ascii=False))


if __name__ == '__main__':
    main()
