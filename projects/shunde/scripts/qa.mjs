import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const executablePath=process.env.CHROME_PATH||path.join(os.homedir(),'.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const mime={'.html':'text/html','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.glb':'model/gltf-binary'};
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),target=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}const data=await fs.readFile(target);res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/index.html`;
const browser=await puppeteer.launch({executablePath,headless:true,args:['--enable-gpu','--use-angle=metal','--hide-scrollbars','--force-color-profile=srgb'],protocolTimeout:240000});
const errors=[],warnings=[];const report={entry:'index.html',size:[1920,1080],fps:30,duration:46,source:'live browser, no synthetic frames'};
try{
 await fs.mkdir(path.join(root,'qa/frames'),{recursive:true});await fs.mkdir(path.join(root,'output'),{recursive:true});
 const page=await browser.newPage();await page.setViewport({width:1920,height:1080,deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text());if(m.type()==='warn')warnings.push(m.text());});
 await page.goto(url,{waitUntil:'networkidle0',timeout:120000});await page.waitForFunction(()=>window.__sceneReady||window.__sceneError,{timeout:180000});
 const state=await page.evaluate(()=>({ready:window.__sceneReady,error:window.__sceneError,stats:window.__modelStats}));if(!state.ready)throw new Error(state.error);report.stats=state.stats;
 const cdp=await browser.target().createCDPSession();report.gpu=(await cdp.send('SystemInfo.getInfo')).gpu;
 const times=process.argv.includes('--quick')?[0,10,19,27,40]:[0,4,7.9,8,12,15.9,16,19,23.9,24,27,30.9,31,35.9,36,39.5,40,42,45.9];
 report.frames=[];
 for(const t of times){await page.evaluate(t=>window.renderAt(t),t);const relative=`qa/frames/${String(t).replace('.','_')}s.jpg`;await page.screenshot({path:path.join(root,relative),type:'jpeg',quality:92});report.frames.push({time:t,path:relative});}
 const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 await page.evaluate(()=>window.renderAt(4));const first=hash(await page.screenshot({type:'png'}));
 await page.evaluate(()=>{window.renderAt(40);window.renderAt(4);});const repeated=hash(await page.screenshot({type:'png'}));report.deterministic={first,repeated,pass:first===repeated};assert.equal(first,repeated,'repeat seek drift');
 const fresh=await browser.newPage();await fresh.setViewport({width:1920,height:1080,deviceScaleFactor:1});await fresh.goto(url,{waitUntil:'networkidle0',timeout:120000});await fresh.waitForFunction(()=>window.__sceneReady,{timeout:180000});await fresh.evaluate(()=>window.renderAt(4));report.deterministic.fresh=hash(await fresh.screenshot({type:'png'}));report.deterministic.freshPass=report.deterministic.fresh===first;assert.ok(report.deterministic.freshPass,'fresh page drift');await fresh.close();
 await page.evaluate(()=>window.renderAt(10));await page.screenshot({path:path.join(root,'qa/frames/glass-on.jpg'),type:'jpeg',quality:94});await page.evaluate(()=>window.setGlassReflectionEnabled(false));await page.screenshot({path:path.join(root,'qa/frames/glass-off.jpg'),type:'jpeg',quality:94});await page.evaluate(()=>window.setGlassReflectionEnabled(true));
 report.glass=await page.evaluate(()=>({stats:window.__glassReflectionStats,safety:window.__verifyGlassSafety()}));
 await page.evaluate(()=>window.renderAt(40));report.exploded=await page.evaluate(()=>window.__getExplosionState());
 if(!process.argv.includes('--quick')){
  const base64=await page.evaluate(()=>window.exportGLB());const buffer=Buffer.from(base64,'base64');await fs.writeFile(path.join(root,'output/Shunde3D.glb'),buffer);report.glb=await page.evaluate(()=>window.__glbVerified);report.glb.sha256=hash(buffer);assert.equal(buffer.readUInt32LE(0),0x46546c67);assert.ok(report.glb.meshes>20);assert.ok(report.glb.textures>10);assert.ok(report.glb.normalYPositive);assert.equal(report.glb.instances,report.stats.leafInstances);assert.ok(report.glb.closedAssembly);
  await page.evaluate(()=>{window.renderAt(4);window.renderExportedModel();});await page.screenshot({path:path.join(root,'qa/frames/glb-reloaded.jpg'),type:'jpeg',quality:94});
  await page.evaluate(()=>window.renderAt(46,true));report.closed=await page.evaluate(()=>window.__getExplosionState());assert.ok(report.closed.tiers.every(t=>t.y===0));
 }
 report.errors=errors;report.warnings=warnings;
 const viewer=await browser.newPage();await viewer.setViewport({width:1366,height:900,deviceScaleFactor:1});await viewer.goto(url.replace('index.html','viewer.html'),{waitUntil:'networkidle0'});await viewer.waitForFunction(()=>window.__sceneReady,{timeout:180000});await viewer.click('[data-shot="40"]');report.viewer={exploded:await viewer.evaluate(()=>window.__getExplosionState())};assert.equal(report.viewer.exploded.amount,1);await viewer.screenshot({path:path.join(root,'qa/frames/viewer-exploded.jpg'),type:'jpeg',quality:92});await viewer.click('[data-shot="46"]');assert.equal((await viewer.evaluate(()=>window.__getExplosionState())).amount,0);await viewer.click('#arc-toggle');await viewer.click('#arc-toggle');report.viewer.controlsPassed=true;await viewer.close();
 assert.equal(errors.length,0);report.pass=true;
} catch(e){report.error=String(e.stack||e);report.pass=false;process.exitCode=1;}finally{
 await fs.writeFile(path.join(root,process.argv.includes('--quick')?'qa/quick-check.json':'qa/browser-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,gpu:report.gpu?.devices,glb:report.glb?{...report.glb,namedParts:undefined}:undefined},null,2));await browser.close();await new Promise(r=>server.close(r));
}
