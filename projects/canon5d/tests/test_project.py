"""Offline archive contract and real compositor smoke tests; no network or TTS."""
import ast
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import unittest
import wave

ROOT = Path(__file__).resolve().parents[1]
V3 = ROOT / 'film45/replacement-v3'


class ProjectContract(unittest.TestCase):
    def test_documentation_and_skills(self):
        for rel in ['README.md', 'docs/CORE-PARAMETERS.md', 'docs/CODE-AND-RUN.md',
                    'docs/MODELING-SOURCES.md', 'docs/SKILLS.md', 'parameters.json',
                    'skills/blender-cutaway/SKILL.md', 'skills/azure-hd-narration/SKILL.md']:
            self.assertTrue((ROOT / rel).is_file(), rel)

    def test_exact_delivered_video(self):
        video = V3 / 'Canon5D-NewModel-Xiaoxiao2-V3.mp4'
        self.assertEqual(hashlib.sha256(video.read_bytes()).hexdigest(),
                         '449ef099d879970670bd4129fd44b30d6bc7b76b9249d62774cab25ecc76b1ba')
        probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams',
                         '-show_format', '-of', 'json', str(video)]))
        stream = next(s for s in probe['streams'] if s['codec_type'] == 'video')
        self.assertEqual((stream['width'], stream['height'], stream['r_frame_rate'],
                          int(stream['nb_frames'])), (1280, 720, '24/1', 1080))
        self.assertAlmostEqual(float(probe['format']['duration']), 45)

    def test_frozen_baseline(self):
        for rel, digest in json.loads((V3 / 'preserved-source.json').read_text()).items():
            self.assertEqual(hashlib.sha256((V3.parent / rel).read_bytes()).hexdigest(), digest, rel)

    def test_complete_production_frames(self):
        frames = sorted((V3 / 'frames').glob('frame_*.png'))
        self.assertEqual([p.name for p in frames], [f'frame_{n:04d}.png' for n in range(1, 1081)])
        for path in frames:
            with path.open('rb') as f:
                f.seek(-12, 2)
                self.assertEqual(f.read(), b'\x00\x00\x00\x00IEND\xaeB\x60\x82', path.name)

    def test_audio_timeline(self):
        meta = json.loads((V3 / 'audio/narration_segments.json').read_text())
        self.assertEqual(meta['voice_id'], 'zh-CN-Xiaoxiao2:DragonHDFlashLatestNeural')
        self.assertEqual(len(meta['segments']), 11)
        timeline = json.loads((V3 / 'timeline.json').read_text())
        self.assertEqual(len(timeline), 1080)
        self.assertEqual(timeline, json.loads((V3.parent / 'timeline.json').read_text()))
        for seg in meta['segments']:
            for kind, directory in [('raw', 'raw'), ('fitted', 'fitted')]:
                path = V3 / 'audio' / directory / Path(seg[kind + '_wav']).name
                self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), seg[kind + '_sha256'])
        with wave.open(str(V3 / 'audio/narration_45s_48k_pcm.wav'), 'rb') as w:
            self.assertEqual((w.getframerate(), w.getnchannels(), w.getsampwidth(), w.getnframes()),
                             (48000, 1, 2, 2160000))

    def test_python_and_generation_paths(self):
        old = '/Users/bryannathan/Desktop/Canon5D-Cutaway'
        for path in ROOT.rglob('*.py'):
            if any(part.startswith('.') for part in path.relative_to(ROOT).parts):
                continue
            tree = ast.parse(path.read_text(), filename=str(path))
            if path.name in ['build_camera.py', 'materials_v2.py', 'build_film.py',
                             'integrate_model.py', 'render_qa.py', 'render_benchmark.py']:
                for node in ast.walk(tree):
                    if isinstance(node, ast.Constant) and isinstance(node.value, str):
                        self.assertNotIn(old, node.value, str(path))

    def test_real_compositor(self):
        from PIL import Image
        spec = importlib.util.spec_from_file_location('canon_v3_compose', V3 / 'compose.py')
        assert spec is not None and spec.loader is not None
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        output = ROOT / 'qa'
        output.mkdir(exist_ok=True)
        for frame in [1, 481, 1080]:
            with Image.open(V3 / 'frames' / f'frame_{frame:04d}.png') as image:
                annotated = module.annotate(image, frame)
            self.assertEqual(annotated.size, (1280, 720))
            annotated.save(output / f'compositor-{frame}.jpg')


if __name__ == '__main__':
    unittest.main(verbosity=2)
