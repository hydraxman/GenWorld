import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const executablePath=process.env.CHROME_PATH||'/Users/bryannathan/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser=await puppeteer.launch({executablePath,headless:true,args:['--enable-gpu','--use-angle=metal','--hide-scrollbars','--force-color-profile=srgb'],protocolTimeout:240000});
try{
 const page=await browser.newPage();await page.setViewport({width:1920,height:1080,deviceScaleFactor:1});const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon'))errors.push(m.text());});
 await page.goto(process.env.QA_URL||'http://127.0.0.1:8773/projects/courtyard/index.html',{waitUntil:'networkidle0',timeout:180000});
 await page.waitForFunction(()=>window.__sceneReady||window.__sceneError,{timeout:180000});
 const status=await page.evaluate(()=>({ready:window.__sceneReady,error:window.__sceneError,api:typeof window.setGlassReflectionEnabled,stats:window.__modelStats}));
 assert.ok(status.ready,status.error);assert.equal(status.api,'function','real viewer must expose glass A/B switch');
 await fs.mkdir('qa/glass',{recursive:true});
 for(const time of [18.5,36,40.5]){
  await page.evaluate(t=>window.renderAt(t),time);
  await page.evaluate(()=>window.setGlassReflectionEnabled(false));
  await page.screenshot({path:`qa/glass/${time}-off.png`});
  await page.evaluate(()=>window.setGlassReflectionEnabled(true));
  await page.screenshot({path:`qa/glass/${time}-on.png`});
 }
 status.glass=await page.evaluate(()=>window.__glassReflectionStats);
 const before=status.glass.capturePasses;
 await page.evaluate(()=>{window.renderAt(40.5);window.setGlassReflectionEnabled(true);});
 assert.equal(await page.evaluate(()=>window.__glassReflectionStats.capturePasses),before,'same geometry revision must not recapture');
 await page.evaluate(()=>window.renderAt(18.5));const first=await page.screenshot();
 await page.evaluate(()=>{window.renderAt(40.5);window.renderAt(18.5);});const again=await page.screenshot();
 const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 status.deterministic=hash(first)===hash(again);assert.ok(status.deterministic,'reflection must survive non-sequential absolute-time seeks');
 status.safety=await page.evaluate(()=>window.__verifyGlassSafety());
 assert.ok(status.safety.overrideSkipped);assert.ok(status.safety.pbrExport);assert.ok(status.safety.waterStable);
 status.errors=errors.filter(s=>!s.includes('404'));assert.deepEqual(status.errors,[]);
 if(process.argv.includes('--export')){
  await page.evaluate(()=>window.renderAt(40.5));
  const b64=await page.evaluate(()=>window.exportGLB());await fs.mkdir('output',{recursive:true});
  await fs.writeFile('output/Courtyard-shared.glb',Buffer.from(b64,'base64'));
  status.glb=await page.evaluate(()=>window.__glbVerified);assert.ok(status.glb.meshes>90);
 }
 await fs.writeFile('qa/glass/browser-check.json',JSON.stringify(status,null,2));console.log(JSON.stringify(status,null,2));
}finally{await browser.close();}
