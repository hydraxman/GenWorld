const tl=gsap.timeline({paused:true});
tl.addLabel('A / BACKLIGHT',0).addLabel('B / TRANSMITTED LIGHT',6).addLabel('C / IRIDESCENT SWEEP',12);
// Only light layers animate. #logo-static and its ancestor transform never change.
tl.fromTo('#a-bloom',{opacity:.46},{opacity:.95,duration:2.8,ease:'sine.inOut',repeat:1,yoyo:true},0);
tl.fromTo('#a-orbit',{rotation:-22,svgOrigin:'320 320'},{rotation:44,svgOrigin:'320 320',duration:6,ease:'sine.inOut'},0);
tl.fromTo('#a-rim',{opacity:.2},{opacity:.6,duration:2.7,ease:'sine.inOut',repeat:1,yoyo:true},.1);
tl.set('#a-light,#caption-a',{opacity:0},6);
tl.set('#b-light,#caption-b',{opacity:1},6);
tl.fromTo('#b-core',{opacity:.3},{opacity:.88,duration:2.65,ease:'sine.inOut',repeat:1,yoyo:true},6.15);
tl.fromTo('#b-aura',{opacity:.2},{opacity:.58,duration:2.65,ease:'sine.inOut',repeat:1,yoyo:true},6.15);
for(let i=0;i<16;i++){
 const low=1+i*.005,high=1+i*.026;
 tl.fromTo('#b-ray-'+i,{scale:low,svgOrigin:'318.5 319',opacity:.028+i*.0011},{scale:high,svgOrigin:'318.5 319',opacity:.060+i*.0018,duration:2.7,ease:'sine.inOut',repeat:1,yoyo:true},6.15);
}
tl.set('#b-light,#caption-b',{opacity:0},12);
tl.set('#c-light,#c-under,#caption-c',{opacity:1},12);
// Adapted from the installed shimmer-sweep primitive; masked to the original SVG paths.
tl.fromTo('#c-band,#c-edge-band',{x:-400},{x:880,duration:4.8,ease:'sine.inOut'},12);
tl.fromTo('#c-orbit',{rotation:0,svgOrigin:'320 320'},{rotation:46,svgOrigin:'320 320',duration:6,ease:'sine.inOut'},12);

window.__timelines=window.__timelines||{};window.__timelines['tsinghua-mem-badge']=tl;
window.renderAt=(t)=>{tl.pause();tl.totalTime(Math.max(0,Math.min(18,Number(t))),true);};
window.renderAt(0);window.animationReady=true;