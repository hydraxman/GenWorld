# Official anonymous free-asset retrieval

Use the official BlenderKit search API with `query=asset_base_id:<UUID>` to resolve gallery/base IDs to version IDs. `/api/v1/assets/<base-id>/` may 404 because the endpoint needs the returned version ID.

Read `isFree`, `access`, `license` and `canDownload` from the actual asset. Select its `files` entry with `fileType=blend` and use the provided `downloadUrl`. Supply `scene_uuid=<new project UUID>`: missing this parameter returns HTTP 403 `Parameter scene_uuid not set`, which is not a login denial. The anonymous free asset endpoint can return HTTP 200 and an authorized signed `filePath`. Preserve that exact URL for download; do not synthesize asset-storage URLs. Stop if authentication/payment is actually required.

Python's default User-Agent may trigger Cloudflare 1010 on the public CDN. A standard User-Agent worked for an officially issued signed URL. This does not authorize circumventing login, payment, or asset-access checks. Official license pages may fail direct HTML retrieval yet work through web_extract; preserve source text and URLs.

Validate byte count against `fileUploadSize`, hash the original, then inspect with independent `--background --factory-startup --disable-autoexec` Blender. A compressed .blend starts with Zstandard magic, not necessarily `BLENDER`. Never use viewer-ripped geometry as a downloadable asset substitute. Extract packed image bytes by their magic: packed image.filepath can be empty and a .png-looking name may contain JPEG bytes.

Render independent front/rear views, check actual labels, back controls, textures and black-material appearance. Preserve original file unchanged; use separate review .blend. Royalty Free permits commercial renders/animations, but not resale of the standalone 3D model or scene on asset marketplaces. Do not describe it as CC0 or CC BY. Record meshes, polygons, materials, packed image count, bbox and axis orientation before handing off.
