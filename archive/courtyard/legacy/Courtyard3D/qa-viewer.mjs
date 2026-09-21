import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--enable-gpu','--use-angle=metal'],protocolTimeout:120000});
try{
 const page=await browser.newPage();await page.setViewport({width:1400,height:1000});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:8768/viewer.html',{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.__sceneReady);
 const names=[];for(const t of ['0','10','18','25','32']){await page.click(`[data-shot="${t}"]`);names.push(await page.evaluate(()=>window.__lastCamera.shot));}
 await page.screenshot({path:'qa/viewer.png'});
 const before=await page.$eval('canvas',c=>c.toDataURL());await page.mouse.move(670,440);await page.mouse.down();await page.mouse.move(830,460,{steps:6});await page.mouse.up();const after=await page.$eval('canvas',c=>c.toDataURL());
 const result={buttons:names,orbit_changes_view:before!==after,errors};
 if(names.length!==5||errors.length||!result.orbit_changes_view)throw new Error(JSON.stringify(result));
 await fs.writeFile('qa/viewer-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
