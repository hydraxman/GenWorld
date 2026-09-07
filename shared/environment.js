export function makeEnvironment(THREE,renderer){
 const c=document.createElement('canvas');c.width=1024;c.height=512;
 const ctx=c.getContext('2d');
 const g=ctx.createLinearGradient(0,0,0,512);
 g.addColorStop(0,'#8eb8d3');g.addColorStop(0.38,'#c8dbe2');g.addColorStop(0.52,'#e8e8df');g.addColorStop(0.65,'#92987e');g.addColorStop(1,'#535a44');
 ctx.fillStyle=g;ctx.fillRect(0,0,1024,512);
 for(let i=0;i<15;i++){
  const x=(i*181+80)%1024,y=60+(i*43)%155;
  const cloud=ctx.createRadialGradient(x,y,4,x,y,110);cloud.addColorStop(0,'rgba(255,255,250,.22)');cloud.addColorStop(1,'rgba(255,255,250,0)');ctx.fillStyle=cloud;ctx.fillRect(x-110,y-110,220,220);
 }
 const tex=new THREE.CanvasTexture(c);tex.mapping=THREE.EquirectangularReflectionMapping;tex.colorSpace=THREE.SRGBColorSpace;
 const pmrem=new THREE.PMREMGenerator(renderer);pmrem.compileEquirectangularShader();const env=pmrem.fromEquirectangular(tex).texture;pmrem.dispose();
 return {background:tex,environment:env};
}
export function addCampusLights(THREE,scene){
 const hemi=new THREE.HemisphereLight('#d8e8fa','#89916d',.9);scene.add(hemi);
 const sun=new THREE.DirectionalLight('#fff2da',2.8);sun.position.set(-24,43,32);sun.target.position.set(0,1,9);scene.add(sun,sun.target);
 sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);sun.shadow.camera.left=-46;sun.shadow.camera.right=46;sun.shadow.camera.top=50;sun.shadow.camera.bottom=-46;sun.shadow.camera.near=1;sun.shadow.camera.far=130;sun.shadow.bias=-0.00006;sun.shadow.normalBias=0.035;sun.shadow.radius=4;
 const fill=new THREE.DirectionalLight('#d4e5f5',.28);fill.position.set(25,16,-12);scene.add(fill);
 return {hemi,sun,fill};
}
