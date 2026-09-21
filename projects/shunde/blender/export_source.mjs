/** Freeze the current verified GLB plus omitted reflection grove and exact camera/tier tracks. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import puppeteer from 'puppeteer-core';
import {DURATION,SHUNDE,shundeCameraAt,assemblyAt} from '../src/spec.js';
const root=path.dirname(fileURLToPath(import.meta.url)), project=path.dirname(root);
const source=path.join(root,'source');await fs.mkdir(source,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const qa=JSON.parse(await fs.readFile(path.join(project,'qa/browser-check.json'),'utf8'));
const glb=await fs.readFile(path.join(project,'output/Shunde3D.glb'));
if(!qa.pass || qa.glb.sha256!==hash(glb)) throw Error('Run npm test, npm run build and npm run qa before export.');
await fs.writeFile(path.join(source,'shunde-campus.glb'),glb);
const bundled=await build({stdin:{contents:`
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createReflectionGrove,skyRGB} from './src/environment.js';
window.exportSky=()=>{const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1024;const context=canvas.getContext('2d'),image=context.createImageData(2048,1024);for(let y=0;y<1024;y++)for(let x=0;x<2048;x++){image.data.set([...skyRGB(x/2048,y/1024),255],(y*2048+x)*4);}context.putImageData(image,0,0);return canvas.toDataURL('image/png').split(',')[1];};
window.exportGrove=async()=>{
 const grove=createReflectionGrove(THREE);grove.traverse(o=>{if(o.isInstancedMesh)o.name='Distant crowns instances';});
 const buffer=await new GLTFExporter().parseAsync(grove,{binary:true,onlyVisible:true,includeCustomExtensions:true});
 const bytes=new Uint8Array(buffer),parts=[];
 for(let i=0;i<bytes.length;i+=32768)parts.push(String.fromCharCode(...bytes.subarray(i,i+32768)));
 return btoa(parts.join(''));
};`,resolveDir:project,loader:'js'},bundle:true,format:'iife',write:false});
const executablePath=process.env.CHROME_PATH||path.join(os.homedir(),'.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const browser=await puppeteer.launch({executablePath,headless:true});
try{const page=await browser.newPage();await page.addScriptTag({content:bundled.outputFiles[0].text});const b64=await page.evaluate(()=>window.exportGrove());await fs.writeFile(path.join(source,'reflection-grove.glb'),Buffer.from(b64,'base64'));const sky=await page.evaluate(()=>window.exportSky());await fs.writeFile(path.join(source,'original-sky.png'),Buffer.from(sky,'base64'));}finally{await browser.close();}
const tiers=[...SHUNDE.facadeBands.map(b=>b.name),'Recessed narrow roof window strip — not an asserted storey','Roof fascia — hidden roof inferred'];
const samples=Array.from({length:DURATION*30+1},(_,i)=>({frame:i+1,time:i/30,...shundeCameraAt(i/30),tierY:tiers.map((_,j)=>assemblyAt(i/30)*j*3.7)}));
const captures={front:{...shundeCameraAt(0),size:[1920,1080]},entrance:{...shundeCameraAt(27),size:[1920,1080]},rear:{position:[-74,66,-103],target:[0,9,-23],fov:46,size:[1600,1200]},top:{position:[0,110,-24],target:[0,0,-24],up:[0,0,-1],orthoWidth:112,size:[1600,1200]}};
const sourceHashes={};for(const dir of ['src','scripts']){for(const n of await fs.readdir(path.join(project,dir))){if(/\.(js|mjs)$/.test(n))sourceHashes[`${dir}/${n}`]=hash(await fs.readFile(path.join(project,dir,n)));}}
const manifest={sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:project,encoding:'utf8'}).trim(),sourceHashes,glbSha256:hash(glb),groveSha256:hash(await fs.readFile(path.join(source,'reflection-grove.glb'))),fps:30,duration:DURATION,axisConversion:'Three.js (x,y,z) -> Blender (x,-z,y)',stats:qa.stats,tiers,captures,samples};
await fs.writeFile(path.join(source,'scene-transfer.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({glbSha256:manifest.glbSha256,groveSha256:manifest.groveSha256,samples:samples.length,tiers:tiers.length,source},null,2));
