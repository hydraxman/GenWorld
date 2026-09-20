# 清华 MEM · 01–07

- `deliverables/Seven-Studies.html`: self-contained offline player; open directly in a browser. No network required.
- `deliverables/manifest.json`: seven explicit IDs, filenames and durations; comparison is a separate field.
- `index.html`: HyperFrames 42-second composition, seven contiguous 6-second studies.
- `inputs/logo.svg`: unchanged source SVG (53 paths, original transforms). All source lettering and circuitry are cutouts.
- `assets/`: vendored GSAP, seeded procedural textures, SVG stage and animation source.
- `proof/`: seek checks, source verification, HF gate and decoded video evidence.

## Rebuild / render
Node.js 22+, FFmpeg, and HyperFrames **0.8.38** are required to render. `npm run check` and `npm run render` use that pinned CLI (npx may download it on another machine). The installed 0.8.38 help confirms `delivery` is an alias for `high`; both are supported. No upgrade is required. `npm run render` writes the high-quality 42-second master into `renders/seven-master.mp4`.

The checked-in HTML and assets render without running a build. To regenerate them, install Python 3 with Pillow and NumPy, then `python3 scripts/build.py`. The bundled input SVG and GSAP are used first; original-machine paths are only missing-file recovery fallbacks. Do not delete bundled inputs. Build never regenerates the logo.

`python3 scripts/finish.py` splits/encodes the master, fully decodes all outputs, produces contacts and records the manifest/probe verification. The frame split is exact: 180 frames each, 1260 total, 960×960, 30fps, no audio.

`scripts/proof.mjs` is the production-machine browser QA runner and documents the tested Chrome-headless/Puppeteer paths. To run it elsewhere, set `PUPPETEER_MODULE` (a module path) and `CHROME_PATH`. The offline player does not require Puppeteer or a server.

All procedural assets are local and deterministic. No generated-image service, cloud GPU, music, fonts or outside network assets are used. No emblem layout, Chinese glyph or 2023 shape has been changed.
