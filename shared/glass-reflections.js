/** Local scene cubemap, not the synthetic sky IBL. See API.md for parallax limits. */
export function installGlassReflections(THREE,renderer,scene,root,options={}){
 const isGlass=options.isGlass||((m)=>/glass|glazing|玻璃/i.test(m.name||''));
 const entries=[],materials=new Map(),bounds=new THREE.Box3();
 root.updateMatrixWorld(true);
 root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const list=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  if(!list.some(m=>isGlass(m,mesh)))return;
  bounds.expandByObject(mesh);
  entries.push({mesh,original:mesh.material,list});
 });
 const resolution=options.resolution??256;
 const target=new THREE.WebGLCubeRenderTarget(resolution,{type:THREE.HalfFloatType,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
 target.texture.name='Local captured campus sky trees and architecture';
 const probe=new THREE.CubeCamera(.15,options.far??300,target);
 const center=bounds.isEmpty()?new THREE.Vector3():bounds.getCenter(new THREE.Vector3());
 probe.position.fromArray(options.position??[center.x,center.y,bounds.isEmpty()?1:bounds.max.z+.75]);
 for(const e of entries){
  e.live=e.list.map(m=>{
   if(!isGlass(m,e.mesh))return m;
   if(!materials.has(m)){
    const live=m.clone();live.name=m.name+' — local scene reflection';
    live.envMap=target.texture;live.envMapIntensity=options.intensity??1.1;
    live.roughness=options.roughness??.1;live.metalness=options.metalness??.5;
    live.userData={...m.userData,liveReflection:'Local scene probe; export restores original PBR fallback'};
    materials.set(m,live);
   }
   return materials.get(m);
  });
  if(!Array.isArray(e.original))e.live=e.live[0];
 }
 let enabled=true,capturing=false,valid=false,lastRevision,exports=0;
 const stats={mode:'local-scene-cubemap',probes:entries.length?1:0,resolution,glassMeshes:entries.length,glassMaterials:materials.size,captures:0,capturePasses:0,lastCaptureDrawCalls:0,position:probe.position.toArray(),enabled:true};
 function apply(){for(const e of entries)e.mesh.material=enabled&&valid&&!exports?e.live:e.original;}
 return {
  stats,
  update(camera){
   if(!enabled||exports||capturing||scene.overrideMaterial||!entries.length)return;
   const revision=options.getRevision?.()??0;
   if(valid&&Object.is(lastRevision,revision))return;
   const hidden=new Map(entries.map(e=>[e.mesh,e.mesh.visible]));
   scene.traverse(o=>{if(o.isReflector)hidden.set(o,o.visible);});
   const shadowAuto=renderer.shadowMap.autoUpdate,shadowNeeds=renderer.shadowMap.needsUpdate,shadowEnabled=renderer.shadowMap.enabled;
   const autoReset=renderer.info.autoReset,oldCalls=renderer.info.render.calls;
   const renderTarget=renderer.getRenderTarget(),xrEnabled=renderer.xr.enabled;
   capturing=true;
   try{
    hidden.forEach((_,o)=>{o.visible=false;});
    // An unshadowed probe avoids stale prior-frame shadows on absolute-time seeks.
    // The beauty render still uses the complete V6 shadow rig.
    renderer.shadowMap.enabled=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;
    renderer.info.autoReset=false;scene.updateMatrixWorld(true);
    probe.update(renderer,scene);
    stats.lastCaptureDrawCalls=renderer.info.render.calls-oldCalls;
    stats.captures++;stats.capturePasses+=6;lastRevision=revision;valid=true;apply();
   }finally{
    hidden.forEach((visible,o)=>{o.visible=visible;});
    renderer.shadowMap.enabled=shadowEnabled;renderer.shadowMap.autoUpdate=shadowAuto;renderer.shadowMap.needsUpdate=shadowNeeds;
    renderer.info.autoReset=autoReset;renderer.xr.enabled=xrEnabled;renderer.setRenderTarget(renderTarget);capturing=false;
   }
  },
  setEnabled(value){enabled=!!value;stats.enabled=enabled;apply();},
  beginExport(){exports++;apply();let restored=false;return ()=>{if(restored)return;restored=true;exports--;apply();};}
 };
}
