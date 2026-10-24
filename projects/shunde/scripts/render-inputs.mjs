import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export async function fingerprint(files){return Promise.all([...new Set(files.map(f=>path.resolve(f)))].sort().map(async file=>{const bytes=await fs.readFile(file);return {path:file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}));}
export async function verifyFingerprint(before){const after=await fingerprint(before.map(r=>r.path));const changed=after.filter((r,i)=>r.sha256!==before[i].sha256||r.bytes!==before[i].bytes);if(changed.length)throw new Error('Render inputs changed: '+changed.map(r=>r.path).join(', '));return true;}
export async function projectRenderInputs(){
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),files=[];
 for(const dir of ['src','scripts'])for(const name of await fs.readdir(path.join(root,dir)))if(/\.(m?js)$/.test(name)&&!name.endsWith('.test.js'))files.push(path.join(root,dir,name));
 for(const rel of ['index.html','viewer.html','assets/scene.js','assets/gsap.min.js','assets/name-glyphs.png','docs/courtyard/source-footprint.json','package.json','../../shared/illumination.js'])files.push(path.join(root,rel));
 // Actual file-backed fonts used on this Mac; no embedding or redistribution.
 const fonts=process.env.SHUNDE_FONT_FILES?.split(path.delimiter)||[
  '/System/Library/PrivateFrameworks/FontServices.framework/Resources/Reserved/PingFangUI.ttc',
  '/System/Library/AssetsV2/com_apple_MobileAsset_Font8/88d6cc32a907955efa1d014207889413890573be.asset/AssetData/Kaiti.ttc',
  '/System/Library/Fonts/Supplemental/Georgia.ttf'];
 for(const font of fonts){try{await fs.access(font);files.push(font);}catch{if(process.platform==='darwin')throw new Error('Resolve actual font via CoreText or SHUNDE_FONT_FILES: '+font);}}
 return fingerprint(files);
}
