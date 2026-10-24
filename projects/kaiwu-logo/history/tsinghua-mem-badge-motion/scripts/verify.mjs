import puppeteer from '/Users/bryannathan/.npm/_npx/1ffad89372cbc1db/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const project=fileURLToPath(new URL('../',import.meta.url));
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/Users/bryannathan/.cache/puppeteer/chrome-headless-shell/mac_arm-150.0.7871.24/chrome-headless-shell-mac-arm64/chrome-headless-shell',headless:true,args:['--allow-file-access-from-files']});
const hash=x=>createHash('sha256').update(x).digest('hex');
const report={source_sha256:hash(readFileSync(project+'inputs/Tsinghua-MEM-2023-Transparent.svg')),errors:[],seek_checks:[],static_geometry_checks:[],fresh_reload_checks:[]};
try{
 assert.equal(report.source_sha256,'89bdad7d41062bf6b2cf4ed340d79ba62499126fb1f785b725ed4c76813c038c');
 const page=await browser.newPage();await page.setViewport({width:960,height:960,deviceScaleFactor:1});page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto(new URL('../index.html',import.meta.url).href);await page.waitForFunction(()=>window.animationReady&&window.renderAt,{timeout:3000});
 const seek=async(t)=>{await page.evaluate(t=>window.renderAt(t),t);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
 const expected=readFileSync(project+'inputs/Tsinghua-MEM-2023-Transparent.svg','utf8').match(/<path d="([^"]+)"/g).map(s=>s.slice(9,-1));
 const paths=await page.evaluate(()=>[...document.querySelectorAll('#source-geometry path')].map(p=>p.getAttribute('d')));assert.deepEqual(paths,expected);report.original_path_count=paths.length;
 const times=[0,0.7,2.6,4.9,5.966667,6,6.8,8.8,11.966667,12,13.3,15,17.966667,18];const shots=new Map();let baseline;
 for(const t of times){await seek(t);const geo=await page.evaluate(()=>{const p=document.querySelector('#logo-static');const m=p.getCTM();return {matrix:[m.a,m.b,m.c,m.d,m.e,m.f],opacity:getComputedStyle(p).opacity,fill:p.getAttribute('fill')};});baseline??=geo;assert.deepEqual(geo,baseline);report.static_geometry_checks.push({t,pass:true});if(t===17.966667)writeFileSync(project+'qa/forward-state.json',JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('[id]')].map(e=>({id:e.id,style:e.getAttribute('style'),transform:e.getAttribute('transform')}))),null,2));const b=await page.screenshot({omitBackground:true});shots.set(t,hash(b));writeFileSync(project+'qa/frame-'+String(t).replace('.','p')+'.png',b);}
 for(const t of [...times].reverse()){await seek(t);const reverseShot=await page.screenshot({omitBackground:true});const h=hash(reverseShot);if(h!==shots.get(t)){writeFileSync(project+'qa/seek-mismatch-'+t+'.png',reverseShot);writeFileSync(project+'qa/reverse-state.json',JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('[id]')].map(e=>({id:e.id,style:e.getAttribute('style'),transform:e.getAttribute('transform')}))),null,2));}assert.equal(h,shots.get(t),'seek mismatch '+t);report.seek_checks.push({t,sha256:h,pass:true});}
 for(const t of [8.8,15]){await page.reload();await page.waitForFunction(()=>window.animationReady);await page.evaluate(t=>window.renderAt(t),t);assert.equal(hash(await page.screenshot({omitBackground:true})),shots.get(t));report.fresh_reload_checks.push({t,pass:true});}
 await page.evaluate(()=>window.renderAt(17.966667));await page.addStyleTag({content:'.light-layer,.caption,.backdrop{opacity:0!important}'});await page.screenshot({path:project+'qa/stencil-actual.png',omitBackground:true});
 const original=readFileSync(project+'inputs/Tsinghua-MEM-2023-Transparent.svg','utf8').replace(/<\?xml[^>]*>/,'');
 const reference=await browser.newPage();await reference.setViewport({width:960,height:960,deviceScaleFactor:1});await reference.setContent('<style>html,body{margin:0;background:transparent}svg{position:absolute;left:96px;top:60px;width:768px;height:768px}</style>'+original);await reference.screenshot({path:project+'qa/stencil-reference.png',omitBackground:true});await reference.close();
 await page.goto(new URL('../deliverables/Tsinghua-MEM-Light-Studies.html',import.meta.url).href);await page.waitForFunction(()=>window.animationReady);await page.click('[data-variant="B"]');assert.equal(await page.evaluate(()=>window.__timelines['tsinghua-mem-badge'].time()),6);await page.click('#play');await new Promise(r=>setTimeout(r,300));assert.ok(await page.evaluate(()=>window.__timelines['tsinghua-mem-badge'].time())>6.05);await page.click('#play');await page.click('[data-variant="C"]');assert.equal(await page.evaluate(()=>window.__timelines['tsinghua-mem-badge'].time()),12);report.offline_selector_playback=true;
 assert.deepEqual(report.errors,[]);report.passed=true;writeFileSync(project+'qa/browser-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
