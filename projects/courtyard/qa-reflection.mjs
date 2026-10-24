import puppeteer from 'puppeteer-core';import fs from 'node:fs/promises';import crypto from 'node:crypto';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--enable-gpu','--use-angle=metal','--force-color-profile=srgb'],protocolTimeout:180000});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
try{
 const page=await browser.newPage();await page.setViewport({width:1920,height:1080,deviceScaleFactor:1});
 await page.goto('http://127.0.0.1:8772/index.html',{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.__sceneReady);
 await page.evaluate(()=>window.renderAt(0,true));const on=await page.screenshot({path:'qa/reflection-on.png'});
 const passes=await page.evaluate(()=>window.getReflectionPasses());
 await page.evaluate(()=>window.setReflectionEnabled(false));const off=await page.screenshot({path:'qa/reflection-off.png'});
 await page.evaluate(()=>window.setReflectionEnabled(true));const restored=await page.screenshot({path:'qa/reflection-restored.png'});
 await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>window.__sceneReady);await page.evaluate(()=>window.renderAt(0,true));const fresh=await page.screenshot({path:'qa/reflection-fresh-page.png'});
 const result={actual_reflection_passes:passes,on_off_different:hash(on)!==hash(off),toggle_roundtrip_identical:hash(on)===hash(restored),fresh_page_deterministic:hash(on)===hash(fresh),first_frame_sha256:hash(on)};
 await fs.writeFile('qa/reflection-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 if(!result.on_off_different||!result.toggle_roundtrip_identical||!result.fresh_page_deterministic||!passes.every(x=>x>0))throw new Error('Reflection validation failed');
}finally{await browser.close();}
