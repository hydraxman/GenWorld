import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const HOST=process.env.CDP_HOST || 'http://127.0.0.1:9225';
const PAGE=process.env.TOUR_URL || 'http://127.0.0.1:8768/public/index.html';
const render=process.argv.includes('--render'),fps=24,frameDir=path.join(ROOT,'frames'),qaDir=path.join(ROOT,'qa');
fs.mkdirSync(qaDir,{recursive:true});if(render){fs.rmSync(frameDir,{recursive:true,force:true});fs.mkdirSync(frameDir,{recursive:true});}
const target=await fetch(`${HOST}/json/new?${encodeURIComponent(PAGE)}`,{method:'PUT'}).then(r=>r.json());
const cdpHostname=new URL(HOST).hostname;
const wsUrl=target.webSocketDebuggerUrl.replace('127.0.0.1',cdpHostname).replace('localhost',cdpHostname);
const ws=new WebSocket(wsUrl);let id=0;const pending=new Map(),events=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method&&['Runtime.exceptionThrown','Log.entryAdded'].includes(m.method))events.push(m);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}};
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
const send=(method,params={})=>{const n=++id;ws.send(JSON.stringify({id:n,method,params}));return new Promise((resolve,reject)=>pending.set(n,{resolve,reject}))};const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await send('Page.enable');await send('Runtime.enable');await send('Log.enable');await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:PAGE});
let ready=false;for(let i=0;i<90;i++){await sleep(500);try{const r=await send('Runtime.evaluate',{expression:'Boolean(window.__TOUR_READY__)',returnByValue:true});if(r.result.value){ready=true;break}}catch{}}
if(!ready)throw new Error('Panjin tour page did not become ready');
await send('Runtime.evaluate',{expression:'window.prewarm()',awaitPromise:true,returnByValue:true});
const total=(await send('Runtime.evaluate',{expression:'window.TOTAL_DURATION',returnByValue:true})).result.value;
async function frameAt(t,out){await send('Runtime.evaluate',{expression:`window.renderAt(${t})`,awaitPromise:true,returnByValue:true});const shot=await send('Page.captureScreenshot',{format:'jpeg',quality:94,captureBeyondViewport:false});fs.writeFileSync(out,Buffer.from(shot.data,'base64'));}
const schedule=JSON.parse(fs.readFileSync(path.join(ROOT,'data','narration-schedule.json'),'utf8'));
const sampleTimes=[0,...schedule.segments.map(s=>(s.start_s+s.speech_end_s)/2),Math.max(0,total-.1)];
for(const [i,t] of sampleTimes.entries())await frameAt(t,path.join(qaDir,`panjin-v3-${String(i).padStart(2,'0')}-${t.toFixed(2).replace('.','_')}s.jpg`));
const states=JSON.parse((await send('Runtime.evaluate',{expression:`JSON.stringify(Array.from({length:${Math.round(total*fps)}},(_,n)=>{const t=n/${fps};return {frame:n,t,camera:window.cameraAt(t),progress:window.progressAt(t)}}))`,returnByValue:true})).result.value);
fs.writeFileSync(path.join(qaDir,'camera-states.json'),JSON.stringify(states,null,2)+'\n');
if(render){const count=Math.round(total*fps);for(let n=0;n<count;n++){await frameAt(n/fps,path.join(frameDir,`frame-${String(n).padStart(5,'0')}.jpg`));if(n%120===0)console.log(`rendered ${n}/${count}`)}}
const state=await send('Runtime.evaluate',{expression:`JSON.stringify({title:document.title,url:location.href,ready:window.__TOUR_READY__,duration:window.TOTAL_DURATION})`,returnByValue:true});
fs.writeFileSync(path.join(qaDir,'browser-events.json'),JSON.stringify(events,null,2)+'\n');console.log(JSON.stringify({page:JSON.parse(state.result.value),events:events.length,rendered:render?Math.round(total*fps):0,states:states.length}));ws.close();await fetch(`${HOST}/json/close/${target.id}`).catch(()=>{});
