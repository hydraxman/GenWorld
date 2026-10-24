import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class SourceBundleTest(unittest.TestCase):
    def test_required_files_are_present(self):
        required = [
            'public/index.html',
            'public/vendor/maplibre-gl.js',
            'public/vendor/maplibre-gl.css',
            'public/vendor/LICENSE-maplibre-gl-js.txt',
            'LICENSE-DATA.md',
            'data/itinerary.json',
            'data/route.geojson',
            'data/narration.json',
            'data/narration-schedule.json',
            'scripts/build-route.py',
            'scripts/capture-tour.mjs',
            'scripts/validate-marker-anchors.mjs',
            'skills/routed-map-tour-video/SKILL.md',
        ]
        self.assertEqual([], [p for p in required if not (ROOT / p).is_file()])

    def test_marker_outer_element_preserves_maplibre_positioning(self):
        page = (ROOT / 'public/index.html').read_text()
        self.assertIn('.pin{position:absolute;width:120px;height:88px', page)
        self.assertIn('.badge{position:absolute', page)
        self.assertIn('subpixelPositioning:true', page)
        self.assertIn("fetch('../data/route.geojson')", page)
        self.assertNotIn("fetch('/data/", page)
        self.assertIn('Powered by Esri', page)
        self.assertIn('openstreetmap.org/copyright', page)

    def test_tianzhuangtai_is_not_mislabeled_as_a_ticketed_ancient_town(self):
        itinerary = (ROOT / 'data/itinerary.json').read_text()
        self.assertIn('田庄台镇', itinerary)
        self.assertNotIn('田庄台古镇', itinerary)

    def test_maplibre_bundle_is_frozen_and_licensed(self):
        bundle = (ROOT / 'public/vendor/maplibre-gl.js').read_text(errors='ignore')
        license_text = (ROOT / 'public/vendor/LICENSE-maplibre-gl-js.txt').read_text()
        self.assertIn('5.24.0', bundle)
        self.assertIn('MapLibre contributors', license_text)
        self.assertIn('BSD-3-Clause', license_text)

    def test_azure_region_is_validated_before_keyed_requests(self):
        script = (ROOT / 'scripts/build-azure-voice.py').read_text()
        self.assertIn("re.fullmatch(r'[a-z0-9]{2,32}',region)", script)
        self.assertLess(script.index("re.fullmatch(r'[a-z0-9]{2,32}',region)"), script.index("voices_url=f'https://{region}"))

    def test_encode_script_creates_generated_directories(self):
        script = (ROOT / 'scripts/encode-video-v3.sh').read_text()
        self.assertIn('mkdir -p output qa .cache', script)
        self.assertIn('PASSLOG="$ROOT/.cache/', script)

    def test_skill_frontmatter_and_portability(self):
        content = (ROOT / 'skills/routed-map-tour-video/SKILL.md').read_text()
        self.assertTrue(content.startswith('---\n'))
        match = re.search(r'^description:\s*(.+)$', content, re.M)
        if match is None:
            self.fail('skill description is missing')
        description = match.group(1).strip()
        self.assertLessEqual(len(description), 60)
        self.assertTrue(description.endswith('.'))
        self.assertIn('author: Bryan (hydraxman), Hermes Agent', content)
        self.assertNotIn('/Users/', content)

    def test_source_contains_no_machine_path_or_committed_secret(self):
        suffixes = {'.py', '.mjs', '.md', '.html', '.json', '.css', '.example'}
        offenders = []
        for path in ROOT.rglob('*'):
            if not path.is_file() or path.suffix not in suffixes or 'qa' in path.parts or 'tests' in path.parts:
                continue
            text = path.read_text(errors='ignore')
            if re.search(r'/(?:Users|home)/[^/\s]+/', text) or re.search(r'AZURE_SPEECH_KEY[ \t]*=[ \t]*[^\s#]+', text):
                offenders.append(str(path.relative_to(ROOT)))
        self.assertEqual([], offenders)


if __name__ == '__main__':
    unittest.main()
