"""Download only Shunde's selected Poly Haven assets and verify originals.
Run with system python3 (requests and Pillow required). Writes inside this folder.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
import json
import re
import time
import requests
from PIL import Image

ROOT = Path(__file__).resolve().parent
IDS = ['white_plaster_02', 'granite_tile_03', 'granite_tile', 'leafy_grass', 'noon_grass']
USES = {
    'white_plaster_02': '浅灰方砖的细微矿物表面；保留原有0.105工作尺度正交砖缝，不改成整面抹灰墙',
    'granite_tile_03': '棕色入口石材颗粒来源；原图棕灰而非深棕，必须匹配原场景深棕色并控制自带板缝',
    'granite_tile': '灰色前庭、步道铺装；不替换建筑墙面',
    'noon_grass': '户外晴天正午HDR照明与反射，不代表清华校园实拍环境',
    'leafy_grass': '现有低饱和校园草坪的地表细节，含真实草叶和少量枯叶；不作植物种类鉴定',
}
LICENSE_URL = 'https://polyhaven.com/license'
CC0_URL = 'https://creativecommons.org/publicdomain/zero/1.0/'
NOW = datetime.now(timezone.utc).isoformat()


def fetch(url):
    for attempt in range(3):
        try:
            r = requests.get(url, timeout=(20, 120), headers={'User-Agent': 'Shunde-local-asset-acquisition/1.0'})
            r.raise_for_status()
            return r
        except requests.RequestException:
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)
    raise RuntimeError('Download retries exhausted')


def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def main():
    evidence = ROOT / 'evidence'
    evidence.mkdir(parents=True, exist_ok=True)
    lic = fetch(LICENSE_URL)
    assert 'Our assets are all licensed as' in lic.text and 'CC0' in lic.text
    deed = fetch(CC0_URL)
    assert 'CC0 1.0' in deed.text
    license_evidence = {
        'checked_at_utc': NOW,
        'license_url': LICENSE_URL,
        'license_page_status': lic.status_code,
        'license_page_response_sha256': hashlib.sha256(lic.content).hexdigest(),
        'asset_license_quote': 'Our assets are all licensed as CC0',
        'permissions_summary_zh': '官方许可页允许任意用途、商用、再分发；不要求署名。资产许可不延伸至网站商标、作者头像、示例渲染图或建筑照片。',
        'cc0_deed_url': CC0_URL,
        'cc0_deed_status': deed.status_code,
        'cc0_legalcode_url': 'https://creativecommons.org/publicdomain/zero/1.0/legalcode',
    }
    dump(evidence / 'license-verification.json', license_evidence)
    jobs = []
    asset_records = []
    for asset_id in IDS:
        info_url = 'https://api.polyhaven.com/info/' + asset_id
        files_url = 'https://api.polyhaven.com/files/' + asset_id
        info = fetch(info_url).json()
        files = fetch(files_url).json()
        page_url = 'https://polyhaven.com/a/' + asset_id
        page = fetch(page_url)
        assert asset_id in page.text and info['name'] in page.text
        title_match = re.search(r'<title[^>]*>(.*?)</title>', page.text, re.S)
        record = {
            'asset_id': asset_id, 'name': info['name'], 'asset_page_url': page_url,
            'license': 'CC0-1.0', 'license_url': LICENSE_URL, 'cc0_url': CC0_URL,
            'authors': info.get('authors'), 'source_description': info.get('description'),
            'source_dimensions_mm': info.get('dimensions'), 'source_coords': info.get('coords'),
            'intended_use_zh': USES[asset_id],
            'asset_page_readback': {'http_status': page.status_code, 'title': title_match.group(1) if title_match else None,
                                    'cc0_token_present': 'CC0' in page.text, 'sha256': hashlib.sha256(page.content).hexdigest()},
        }
        asset_records.append(record)
        dump(evidence / (asset_id + '.json'), {'checked_at_utc': NOW, 'info_url': info_url, 'files_url': files_url, 'info': info, 'files': files, 'page_readback': record['asset_page_readback']})
        channels = [('hdri', 'hdr', 'hdri', 'Linear / Linear Rec.709 (scene-linear)')] if asset_id == 'noon_grass' else [('Diffuse', 'jpg', 'albedo', 'sRGB'), ('Rough', 'jpg', 'roughness', 'Non-Color'), ('nor_gl', 'png', 'normal_opengl', 'Non-Color')]
        for key, fmt, kind, colorspace in channels:
            spec = files[key]['2k'][fmt]
            directory = 'hdri' if kind == 'hdri' else 'textures/' + asset_id
            relative = directory + '/' + spec['url'].rsplit('/', 1)[-1]
            jobs.append({'asset_id': asset_id, 'url': spec['url'], 'asset_page_url': page_url,
                         'license': 'CC0-1.0', 'license_url': LICENSE_URL, 'cc0_url': CC0_URL,
                         'local_relative_path': relative, 'kind': kind, 'colorspace': colorspace,
                         'expected_bytes': spec['size'], 'expected_md5': spec['md5'],
                         'original_download': True, 'resolution_label': '2k'})
    manifest = {'schema_version': 1, 'acquired_at_utc': NOW, 'relative_path_base': 'blender/assets/',
                'scope': '舜德楼当前模型，3套建筑材质、1套可选草地与1个HDRI；不是实际建材或地理环境鉴定',
                'assets': asset_records, 'files': []}
    if (ROOT / 'manifest.json').exists():
        manifest['derivatives'] = json.loads((ROOT / 'manifest.json').read_text()).get('derivatives', [])
    dump(ROOT / 'manifest.json', manifest)

    def download(job):
        path = ROOT / job['local_relative_path']
        path.parent.mkdir(parents=True, exist_ok=True)
        data = path.read_bytes() if path.exists() else b''
        if len(data) != job['expected_bytes'] or hashlib.md5(data).hexdigest() != job['expected_md5']:
            data = fetch(job['url']).content
            assert len(data) == job['expected_bytes'], (job['url'], len(data), job['expected_bytes'])
            assert hashlib.md5(data).hexdigest() == job['expected_md5'], job['url']
            path.write_bytes(data)
        if job['kind'] == 'hdri':
            match = re.search(rb'-Y\s+(\d+)\s+\+X\s+(\d+)', data[:4096])
            assert match and data.startswith(b'#?RADIANCE')
            size = [int(match.group(2)), int(match.group(1))]
            assert size == [2048, 1024], size
        else:
            with Image.open(path) as image:
                image.load()
                size = list(image.size)
            assert size == [2048, 2048], size
        return {**job, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
                'dimensions_px': size, 'verified': True}

    with ThreadPoolExecutor(max_workers=3) as pool:
        for future in as_completed([pool.submit(download, job) for job in jobs]):
            entry = future.result()
            manifest['files'].append(entry)
            manifest['files'].sort(key=lambda item: item['local_relative_path'])
            dump(ROOT / 'manifest.json', manifest)
            print('OK', entry['local_relative_path'], entry['bytes'], entry['dimensions_px'], flush=True)
    final = json.loads((ROOT / 'manifest.json').read_text())
    assert len(final['assets']) == 5 and len(final['files']) == 13
    assert len({item['local_relative_path'] for item in final['files']}) == 13
    assert sum(item['kind'] == 'hdri' for item in final['files']) == 1
    for asset_id in IDS[:-1]:
        assert {item['kind'] for item in final['files'] if item['asset_id'] == asset_id} == {'albedo', 'roughness', 'normal_opengl'}
    report = {'verified_at_utc': datetime.now(timezone.utc).isoformat(), 'asset_count': len(final['assets']),
              'material_sets': 4, 'texture_maps': 12, 'hdri_count': 1, 'download_count': len(final['files']),
              'original_download_bytes': sum(item['bytes'] for item in final['files']),
              'all_sha256_recorded': all(len(item['sha256']) == 64 for item in final['files']),
              'provider_md5_and_size_match': True, 'pillow_texture_decode': True,
              'hdri_radiance_header_dimensions': [2048, 1024]}
    dump(ROOT / 'verification.json', report)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
