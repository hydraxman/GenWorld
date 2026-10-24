import importlib.util
from pathlib import Path
import unittest
import tempfile
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))


def load_tool(name):
    path = ROOT / 'tools' / (name + '.py')
    if not path.exists():
        raise AssertionError(name + ' is not implemented')
    spec = importlib.util.spec_from_file_location('tour_' + name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

class FrozenAssetTests(unittest.TestCase):
    def test_frozen_asset_manifest_is_executable_and_complete(self):
        result = load_tool('verify').verify_assets(ROOT)
        self.assertEqual(result['photos'], 12)
        self.assertEqual(result['voice_segments'], 15)
        self.assertEqual(result['total_frames'], 8525)
        self.assertTrue(result['booking_reminder_preserved'])

    def test_asset_paths_cannot_escape(self):
        module = load_tool('verify')
        for value in ['../README.md', '/etc/passwd', 'C:\\Windows\\win.ini']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                module.asset_path(ROOT, value)

    def test_export_requires_a_contiguous_nonempty_prefix(self):
        module = load_tool('export')
        with tempfile.TemporaryDirectory() as tmp:
            frames = Path(tmp)
            (frames / 'frame-00000.jpg').write_bytes(b'fixture')
            with self.assertRaises(ValueError):
                module.validate_frames(frames, 2)
            (frames / 'frame-00001.jpg').write_bytes(b'fixture')
            self.assertEqual(module.validate_frames(frames, 2), 2)
            (frames / 'frame-00001.jpg').write_bytes(b'')
            with self.assertRaises(ValueError):
                module.validate_frames(frames, 2)

    def test_optional_tts_sdk_security_pin_and_api_shape(self):
        import subprocess
        result = subprocess.run([
            'node', '--input-type=commonjs', '-e',
            "const assert = require('node:assert/strict'); "
            "const sdk = require('microsoft-cognitiveservices-speech-sdk'); "
            "for (const fn of [sdk.SpeechConfig.fromSubscription, sdk.AudioConfig.fromAudioFileOutput, "
            "sdk.SpeechSynthesizer, sdk.SpeechSynthesizer.prototype.speakSsmlAsync, "
            "sdk.SpeechSynthesizer.prototype.close]) assert.equal(typeof fn, 'function'); "
            "assert.equal(typeof sdk.SpeechSynthesisOutputFormat.Riff48Khz16BitMonoPcm, 'number'); "
            "assert.equal(typeof sdk.ResultReason.SynthesizingAudioCompleted, 'number'); "
            "console.log(require('microsoft-cognitiveservices-speech-sdk/package.json').version);"
        ], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), '1.51.0')
        self.assertEqual(json.loads((ROOT / 'package.json').read_text())['dependencies']
                         ['microsoft-cognitiveservices-speech-sdk'], '1.51.0')

    def test_audio_tools_have_safe_dry_run_and_exact_sample_placement(self):
        import subprocess
        import os
        import wave
        import numpy as np
        synth = ROOT / 'tools/synthesize.cjs'
        self.assertTrue(synth.exists(), 'optional TTS entry is missing')
        env = {k: v for k, v in os.environ.items() if not k.startswith('AZURE_SPEECH_')}
        result = subprocess.run(['node', str(synth)], cwd=ROOT, env=env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        dry_run = json.loads(result.stdout)
        self.assertEqual(dry_run['action'], 'reuse')
        self.assertIs(dry_run['paid_api_called'], False)
        module = load_tool('mix_audio')
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / 'mixed.wav'
            module.mix_audio(json.loads((ROOT/'timing.json').read_text()), out, ROOT)
            with wave.open(str(out)) as w:
                self.assertEqual(w.getnframes(), 8525 * 2000)
                samples = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2')
            self.assertTrue(np.all(samples[:24000] == 0))
            with wave.open(str(ROOT/'audio/intro.wav')) as w:
                intro = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2')
            np.testing.assert_array_equal(samples[24000:24000+len(intro)], intro)

    def test_route_and_timing_can_be_rebuilt_from_packaged_inputs(self):
        import subprocess
        for name in ['build_route', 'build_timing']:
            self.assertTrue((ROOT/'tools'/f'{name}.py').exists(), name + ' is missing')
        with tempfile.TemporaryDirectory() as tmp:
            for name, frozen in [('build_route', 'route.json'), ('build_timing', 'timing.json')]:
                output = Path(tmp) / frozen
                result = subprocess.run([sys.executable, str(ROOT/'tools'/f'{name}.py'), '--output', str(output)], cwd=ROOT, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(json.loads(output.read_text()), json.loads((ROOT/frozen).read_text()))

    def test_export_rejects_frames_changed_after_capture(self):
        import hashlib
        module = load_tool('export')
        with tempfile.TemporaryDirectory() as tmp:
            frames = Path(tmp)
            file = frames/'frame-00000.jpg'
            file.write_bytes(b'original')
            views = [{'frame': 0, 'sha256': hashlib.sha256(b'original').hexdigest()}]
            self.assertEqual(module.validate_frames(frames, 1, views), 1)
            file.write_bytes(b'changed')
            with self.assertRaises(ValueError):
                module.validate_frames(frames, 1, views)

    def test_skill_and_document_links_are_self_contained(self):
        import re
        from urllib.parse import unquote
        skill = ROOT/'skills/campus-map-video/SKILL.md'
        text = skill.read_text()
        self.assertTrue(text.startswith('---\n'))
        front = text.split('---', 2)[1]
        description = re.search(r'^description: (.+)$', front, re.M)
        self.assertIsNotNone(description)
        assert description
        self.assertLessEqual(len(description.group(1)), 60)
        self.assertTrue(description.group(1).endswith('.'))
        self.assertIn('hydraxman', front)
        self.assertNotIn('/Users/', text)
        docs = [ROOT/'README.md', skill, *sorted((ROOT/'docs').glob('*.md'))]
        for doc in docs:
            for link in re.findall(r'\]\(([^)]+)\)', doc.read_text()):
                if link.startswith(('https:', 'http:', '#')):
                    continue
                self.assertTrue((doc.parent/unquote(link.split('#')[0])).exists(), str(doc)+': '+link)

class ExportFingerprintTests(unittest.TestCase):
    def setUp(self):
        import shutil
        import subprocess
        from PIL import Image
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name) / 'input copy'
        self.directory = Path(self.temporary.name) / 'capture'
        self.module = load_tool('export')
        setattr(self.module, 'ROOT', self.root)
        # Copy only fingerprint inputs; never mutate the packaged originals.
        spec = json.loads(subprocess.check_output([
            'node', '--input-type=module', '-e',
            "import {computeFingerprint} from './tools/capture-core.mjs'; "
            "console.log(JSON.stringify(await computeFingerprint(process.argv[1], 'satellite')));",
            str(ROOT)], cwd=ROOT, text=True))
        for relative in [*spec['files'], 'audio/approved-narration.m4a']:
            target = self.root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / relative, target)
        self.directory.mkdir()
        jpeg = self.directory / 'fixture.jpg'
        Image.new('RGB', (1280, 720), (40, 80, 120)).save(jpeg, 'JPEG')
        # Use the real capture report writer offline, without a browser or tiles.
        subprocess.run([
            'node', '--input-type=module', '-e',
            "import {readFile} from 'node:fs/promises'; "
            "import {computeFingerprint, openCapture, commitFrame, saveReport} from './tools/capture-core.mjs'; "
            "const [root, out, jpeg] = process.argv.slice(1); "
            "const cache = await openCapture(out, await computeFingerprint(root, 'satellite'), 8525, false); "
            "await commitFrame(cache, 0, await readFile(jpeg), {poseKey: 'offline-fixture'}); "
            "await saveReport(cache);",
            str(self.root), str(self.directory), str(jpeg)], cwd=ROOT, check=True, capture_output=True, text=True)
        self.report_path = self.directory / 'capture-report.json'
        self.report = json.loads(self.report_path.read_text())

    def assert_rejected_before_encoding(self):
        with self.assertRaisesRegex(ValueError, '[Ff]ingerprint'):
            self.module.export('satellite', self.directory, 1)
        for name in ['production-state.json', 'encode-master.log', 'tour-master.mp4', 'tour.mp4']:
            self.assertFalse((self.directory / name).exists(), name)

    def test_export_rejects_missing_fingerprint(self):
        for field in ['fingerprint', 'settings', 'files', 'basemap']:
            with self.subTest(field=field):
                report = {key: value for key, value in self.report.items() if key != field}
                self.report_path.write_text(json.dumps(report))
                self.assert_rejected_before_encoding()

    def test_export_rejects_mismatched_fingerprint_record(self):
        for field, value in [('fingerprint', '0' * 64), ('settings', {}), ('files', {})]:
            with self.subTest(field=field):
                self.report_path.write_text(json.dumps({**self.report, field: value}))
                self.assert_rejected_before_encoding()

    def test_export_rejects_inputs_changed_after_capture(self):
        for relative in ['map.html', 'styles/satellite.json', 'package-lock.json']:
            with self.subTest(input=relative):
                path = self.root / relative
                original = path.read_bytes()
                try:
                    path.write_bytes(original + b'\n')
                    self.assert_rejected_before_encoding()
                finally:
                    path.write_bytes(original)

    def test_export_accepts_current_fingerprint_and_real_jpeg(self):
        result = self.module.export('satellite', self.directory, 1)
        self.assertEqual(result['frames'], 1)
        self.assertTrue(result['strict_decode'])
        self.assertGreater((self.directory / 'tour.mp4').stat().st_size, 0)
        state = json.loads((self.directory / 'production-state.json').read_text())
        self.assertEqual(state['stage'], 'ready_for_visual_review')


if __name__ == '__main__':
    unittest.main()
