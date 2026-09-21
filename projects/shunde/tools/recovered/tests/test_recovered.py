"""Focused offline regression checks; no delivery or remote generation.

Set RECOVERED_TEST_FONT to a readable CJK font to exercise image/video output.
RECOVERED_SOURCE_ROOT optionally points to the old project for RED reproduction.
"""
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
TOOLS = HERE.parent
FONT = os.environ.get('RECOVERED_TEST_FONT')


def script(name):
    old = os.environ.get('RECOVERED_SOURCE_ROOT')
    if old:
        folder = 'output/i2v-shunde' if name == 'compose.py' else 'review'
        return Path(old) / folder / name
    return TOOLS / name


def run(name, *args, cwd=HERE):
    return subprocess.run([sys.executable, str(script(name)), *map(str, args)],
                          cwd=cwd, capture_output=True, text=True, timeout=90)


def write_glb(path, transformed=False):
    # Synthetic geometry fixture, not a historical production asset.
    blob = struct.pack('<9f', 0, 0, 2, 3, 0, 2, 3, 0, 0)
    node = {'name': 'Nonrectangular roof cap', 'mesh': 0}
    if transformed:
        node['translation'] = [1, 0, 0]
    manifest = {'asset': {'version': '2.0'}, 'nodes': [node],
                'meshes': [{'primitives': [{'attributes': {'POSITION': 0}}]}],
                'accessors': [{'componentType': 5126, 'type': 'VEC3',
                               'bufferView': 0, 'count': 3}],
                'bufferViews': [{'buffer': 0, 'byteLength': len(blob)}],
                'buffers': [{'byteLength': len(blob)}]}
    doc = json.dumps(manifest).encode()
    doc += b' ' * (-len(doc) % 4)
    body = struct.pack('<II', len(doc), 0x4E4F534A) + doc
    body += struct.pack('<II', len(blob), 0x004E4942) + blob
    path.write_bytes(struct.pack('<III', 0x46546C67, 2, len(body) + 12) + body)


class RecoveredTests(unittest.TestCase):
    def test_font_is_explicit_cli_input(self):
        for name in ('make-comparison.py', 'make-plan-comparison.py', 'compose.py'):
            with self.subTest(script=name):
                result = run(name, '--help')
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn('--font', result.stdout)

    def test_glb_requires_explicit_paths_instead_of_cwd_defaults(self):
        result = run('verify-plan-glb.py')
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertIn('--glb', result.stderr)
        self.assertIn('--output', result.stderr)
        self.assertNotIn('Traceback', result.stderr)

    def test_real_glb_accessor_check(self):
        with tempfile.TemporaryDirectory(prefix='fixture-', dir=HERE) as temp:
            root = Path(temp)
            write_glb(root / 'roof.glb')
            result = run('verify-plan-glb.py', '--glb', root / 'roof.glb',
                         '--output', root / 'result.json', cwd=root)
            self.assertEqual(result.returncode, 0, result.stderr)
            report = json.loads((root / 'result.json').read_text())
            self.assertTrue(report['pass'])
            self.assertEqual(report['roofVertices'], 3)
            self.assertEqual(report['rightAngleDegrees'], 90)

    def test_transformed_glb_is_rejected(self):
        with tempfile.TemporaryDirectory(prefix='fixture-', dir=HERE) as temp:
            root = Path(temp)
            write_glb(root / 'roof.glb', transformed=True)
            result = run('verify-plan-glb.py', '--glb', root / 'roof.glb',
                         '--output', root / 'result.json')
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('unexpected cap transform', result.stderr)
            self.assertFalse((root / 'result.json').exists())

    @unittest.skipUnless(FONT, 'set RECOVERED_TEST_FONT for rendering checks')
    def test_image_sheets_with_explicit_font(self):
        from PIL import Image
        with tempfile.TemporaryDirectory(prefix='fixture-', dir=HERE) as temp:
            root = Path(temp)
            Image.new('RGB', (80, 120), 'red').save(root / 'before.png')
            Image.new('RGB', (120, 80), 'blue').save(root / 'after.png')
            for name, flags, size in (
                ('make-comparison.py', ('--reference', '--candidate'), (1920, 738)),
                ('make-plan-comparison.py', ('--before', '--after'), (1920, 930)),
            ):
                with self.subTest(script=name):
                    output = root / name / 'sheet.png'
                    result = run(name, flags[0], root / 'before.png', flags[1],
                                 root / 'after.png', '--output', output, '--font', FONT)
                    self.assertEqual(result.returncode, 0, result.stderr)
                    with Image.open(output) as sheet:
                        self.assertEqual(sheet.size, size)
                        center_y = 378 if name == 'make-comparison.py' else 430
                        self.assertEqual(sheet.getpixel((480, center_y)), (255, 0, 0))
                        self.assertEqual(sheet.getpixel((1440, center_y)), (0, 0, 255))

    @unittest.skipUnless(FONT and shutil.which('ffmpeg') and shutil.which('ffprobe'),
                         'requires RECOVERED_TEST_FONT, ffmpeg and ffprobe')
    def test_local_composition(self):
        with tempfile.TemporaryDirectory(prefix='fixture-', dir=HERE) as temp:
            root = Path(temp)
            subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i',
                            'color=c=green:s=640x360:r=24:d=5', '-c:v', 'libx264',
                            '-pix_fmt', 'yuv420p', str(root / 'source.mp4')],
                           check=True, timeout=30)
            subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i',
                            'sine=frequency=440:duration=3', str(root / 'narration.mp3')],
                           check=True, timeout=30)
            result = run('compose.py', '--video', root / 'source.mp4', '--crop',
                         0, 0, 640, 360, '--out', root / 'final.mp4', '--font', FONT)
            self.assertEqual(result.returncode, 0, result.stderr)
            report = json.loads(result.stdout)
            self.assertTrue(report['pass'])
            self.assertEqual(report['frames'], '120')
            self.assertEqual(report['size'], [640, 360])
            self.assertEqual(report['audio'], 'aac')
            self.assertEqual(len(list(root.glob('final-*s.jpg'))), 4)


if __name__ == '__main__':
    unittest.main()
