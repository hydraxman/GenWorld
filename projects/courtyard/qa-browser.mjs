import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const executablePath=process.env.CHROME_PATH;
if(!executablePath)throw new Error('Set CHROME_PATH to a local Chromium executable');
const browser=await puppeteer.launch({executablePath,headless:true,args:['--enable-gpu','--use-angle=metal','--hide-scrollbars','--force-color-profile=srgb'],protocolTimeout:180000});
try{
 const page=await browser.newPage();await page.setViewport({width:1920,height:1080,deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
 await page.goto('http://127.0.0.1:8772/index.html',{waitUntil:'networkidle0',timeout:120000});
 await page.waitForFunction(()=>window.__sceneReady||window.__sceneError,{timeout:120000});
 const status=await page.evaluate(()=>({ready:window.__sceneReady,error:window.__sceneError,stats:window.__modelStats}));
 if(!status.ready)throw new Error(status.error);
 const times=[0,4,7.9,8,11.5,14.9,15,18.5,21.9,22,25,27.9,28,32,35.9];
 await fs.mkdir('qa/frames',{recursive:true});
 for(let i=0;i<times.length;i++){
  await page.evaluate(t=>window.renderAt(t),times[i]);
  await page.screenshot({path:`qa/frames/${String(i).padStart(2,'0')}-${times[i]}.jpg`,type:'jpeg',quality:88});
 }
 await page.evaluate(()=>window.renderAt(4));let first=await page.screenshot({type:'png'});
 await page.evaluate(()=>{window.renderAt(30);window.renderAt(4)});let again=await page.screenshot({type:'png'});
 status.deterministic=crypto.createHash('sha256').update(first).digest('hex')===crypto.createHash('sha256').update(again).digest('hex');status.console_errors=errors;
 if(process.argv.includes('--export')){
  const b64=await page.evaluate(()=>window.exportGLB());await fs.writeFile('output/Courtyard3D.glb',Buffer.from(b64,'base64'));
  status.glb=await page.evaluate(()=>window.__glbVerified);
 }
 await fs.writeFile('qa/browser-check.json',JSON.stringify(status,null,2));console.log(JSON.stringify(status,null,2));
 if(errors.length||!status.deterministic)process.exitCode=1;
}finally{await browser.close();}
