import urllib.request, json, uuid, pathlib, hashlib, datetime
root=pathlib.Path(__file__).parent
base='https://www.blenderkit.com'
query=base+'/api/v1/search/?query=asset_base_id:a5be7449-3b42-4ae4-9275-3c67907ac973'
def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'}),timeout=60) as r:
        assert r.status==200
        return r.read()
data=fetch(query)
(root/'source-api.json').write_bytes(data)
a=json.loads(data)['results'][0]
assert a['isFree'] and a['license']=='royalty_free'
f=next(f for f in a['files'] if f['fileType']=='blend')
scene=str(uuid.uuid4())
receipt=json.loads(fetch(f['downloadUrl']+'?scene_uuid='+scene))
b=fetch(receipt['filePath'])
assert len(b)==f['fileUploadSize'], (len(b),f['fileUploadSize'])
(root/'canon_eos5d_mark_iv_original.blend').write_bytes(b)
for name,url in [('license-official.html',base+'/docs/licenses/'),('license-faq-official.html',base+'/docs/licenses/licensing-faq/')]:
    try: (root/name).write_bytes(fetch(url))
    except Exception as e: print('HTML capture unavailable; web_extract verified separately:',url,str(e))
(root/'author-preview.jpg').write_bytes(fetch(a['thumbnailLargeUrl']))
metadata={'source':base+'/asset-gallery-detail/'+a['assetBaseId']+'/', 'api':query,'download_api':f['downloadUrl'],'download_response_status':200,'authentication':'Anonymous official public API; no credentials, cookies or login used','scene_uuid':scene,'retrieved_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'author':a['author']['fullName'],'license':a['license'],'license_url':base+'/docs/licenses/','asset_id':a['id'],'asset_base_id':a['assetBaseId'],'file':'canon_eos5d_mark_iv_original.blend','bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'file_header_hex':b[:12].hex(),'use':'Film render / higher-level derivative work permitted; not a license to resell or redistribute standalone 3D assets','thumbnail_notice':'author-preview.jpg is the source author preview, not our validation render'}
(root/'source-license-metadata.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2))
print(json.dumps(metadata,ensure_ascii=False,indent=2))
