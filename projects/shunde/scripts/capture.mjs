import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {projectRenderInputs,verifyFingerprint} from './render-inputs.mjs';
const out=path.resolve(process.env.SHUNDE_OUTPUT||path.join(os.homedir(),'.hermes/outputs/shunde-courtyard-rebuild/delivery'));
const render=process.argv.includes('--render'),exportModel=process.argv.includes('--export');
await fs.mkdir(out,{recursive:true});
const inputs=render?await projectRenderInputs():null;
if(inputs)await fs.writeFile(path.join(out,'render-inputs.json'),JSON.stringify({status:'authoring-frozen',inputs},null,2));
const chrome=process.env.CHROME_PATH||path.join(os.homedir(),'.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--enable-gpu','--use-angle=metal','--hide-scrollbars'],defaultViewport:{width:1920,height:1080,deviceScaleFactor:1},protocolTimeout:300000});
const errors=[];let ff;
const cdp=await browser.target().createCDPSession();
const gpu=await cdp.send('SystemInfo.getInfo');await fs.writeFile(path.join(out,'gpu-system-info.json'),JSON.stringify(gpu,null,2));
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(process.env.SHUNDE_URL||'http://127.0.0.1:8778/index.html',{waitUntil:'networkidle0',timeout:120000});
 await page.waitForFunction(()=>window.__sceneReady||window.__sceneError,{timeout:120000});
 const error=await page.evaluate(()=>window.__sceneError);if(error)throw new Error(error);
 const stats=await page.evaluate(()=>window.__modelStats);console.log(JSON.stringify(stats,null,2));
 for(const [name,t] of [['north',3],['elevated',11],['court',20]]){await page.evaluate(t=>window.renderAt(t),t);await page.screenshot({path:path.join(out,`preview-${name}.png`)});}
 const top=await page.evaluate(()=>window.captureTop());await fs.writeFile(path.join(out,'preview-top.png'),Buffer.from(top.data.split(',')[1],'base64'));delete top.data;
 if(exportModel){
  console.log('Exporting textured GLB and reloading with GLTFLoader');
  const data=await page.evaluate(()=>window.exportGLB());await fs.writeFile(path.join(out,'Shunde-courtyard-context.glb'),Buffer.from(data,'base64'));
  const verify=await page.evaluate(()=>({glb:window.__glbVerified,topology:window.verifyExportTopology()}));
  if(verify.topology.northGap.length||verify.topology.court.length||!verify.topology.cylinder.length||!verify.topology.south.length||!verify.topology.east.length)throw new Error('Reloaded GLB topology failed');
  await fs.writeFile(path.join(out,'glb-verification.json'),JSON.stringify(verify,null,2));
  const image=await page.evaluate(()=>window.renderExportedModel());await fs.writeFile(path.join(out,'preview-glb-reloaded.png'),Buffer.from(image.split(',')[1],'base64'));
 }
 // Regression: seek away/back and capture/export helpers must not alter pixels.
 await page.evaluate(()=>window.renderAt(20));const before=await page.screenshot();
 await page.evaluate(()=>{window.renderAt(3);window.renderAt(20);window.captureTop();});const after=await page.screenshot();
 if(!before.equals(after))throw new Error('Seek / capture helper pixel determinism failed');
 if(errors.length)throw new Error(errors.join('\n'));
 await fs.writeFile(path.join(out,'browser-verification.json'),JSON.stringify({stats,top,errors,gpu:gpu.gpu,deterministicSeekAndCapture:true},null,2));
 if(render){
  // The composition's synchronous paused HyperFrames timeline is the time source.
  const frames=24*24;ff=spawn('ffmpeg',['-y','-f','image2pipe','-vcodec','mjpeg','-framerate','24','-i','pipe:0','-an','-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,'Shunde-courtyard-24s-1080p.mp4')],{stdio:['pipe','ignore','pipe']});
  const log=[];ff.stderr.on('data',b=>log.push(b));
  for(let n=0;n<frames;n++){
   await page.evaluate(t=>{window.__timelines.shunde.seek(t);window.renderAt(t);},n/24);
   const frame=await page.screenshot({type:'jpeg',quality:96});if(!ff.stdin.write(frame))await once(ff.stdin,'drain');
   if(n%48===0)console.log(`Captured ${n}/${frames}`);
  }
  ff.stdin.end();const [code]=await once(ff,'close');await fs.writeFile(path.join(out,'ffmpeg-render.log'),Buffer.concat(log));if(code!==0)throw new Error(`ffmpeg exited ${code}`);
  if(errors.length)throw new Error(errors.join('\n'));
  await verifyFingerprint(inputs);await fs.writeFile(path.join(out,'render-inputs-after.json'),JSON.stringify({unchanged:true,inputs:await projectRenderInputs()},null,2));
  console.log(`Rendered ${frames} real Three.js browser-GPU frames; input SHA256s unchanged`);
 }
}finally{if(ff&&ff.exitCode===null)ff.kill('SIGTERM');await browser.close();}
