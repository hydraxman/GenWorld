import puppeteer from 'puppeteer-core';import fs from 'node:fs/promises';import crypto from 'node:crypto';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--enable-gpu','--use-angle=metal','--hide-scrollbars','--force-color-profile=srgb'],protocolTimeout:180000});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
try{
 const page=await browser.newPage();await page.setViewport({width:1920,height:1080,deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:8772/index.html',{waitUntil:'networkidle0',timeout:120000});await page.waitForFunction(()=>window.__sceneReady||window.__sceneError,{timeout:120000});
 const fail=await page.evaluate(()=>window.__sceneError);if(fail)throw Error(fail);
 await fs.mkdir('qa/ending',{recursive:true});await page.evaluate(()=>window.renderAt(0,true));const prefix=hash(await page.screenshot());
 const states=[];let closed,opened,restored;
 for(const t of [36,37.2,38.5,40.5,42,43.5,45.5]){await page.evaluate(t=>window.renderAt(t,true),t);const shot=await page.screenshot({path:`qa/ending/${t}.png`});states.push({t,state:await page.evaluate(()=>window.__getExplosionState())});if(t===36)closed=hash(await page.screenshot({clip:{x:0,y:0,width:1920,height:850}}));if(t===40.5)opened=hash(shot);if(t===45.5)restored=hash(await page.screenshot({clip:{x:0,y:0,width:1920,height:850}}));}
 if(!states.find(s=>s.t===40.5).state.tiers.some(g=>g.y>5))throw Error('No vertical explosion');if(closed!==restored)throw Error('Reassembly does not restore building frame');
 await page.evaluate(()=>window.renderAt(0,true));if(prefix!==hash(await page.screenshot()))throw Error('Original scene failed seek restoration');
 await page.evaluate(()=>window.renderAt(40.5,true));if(opened!==hash(await page.screenshot()))throw Error('Open frame non-deterministic');
 const result={errors,stats:await page.evaluate(()=>window.__explosionStats),states,building_closed_restored_identical:true,closure_comparison_crop:{x:0,y:0,width:1920,height:850,reason:'Exclude animated foreground water; full-frame difference was confined to x461..795 y860..1079'},prefix_seek_restored_identical:true,open_seek_deterministic:true};
 await fs.writeFile('qa/exploded-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(errors.length)throw Error('Browser errors');
}finally{await browser.close();}
