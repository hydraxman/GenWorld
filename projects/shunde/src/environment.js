export function createReflectionGrove(THREE){
 // Actual distant campus vegetation, not images on glazing. Kept behind all film cameras.
 const group=new THREE.Group();group.name='Distant campus reflection grove — illustrative environment';
 let seed=941;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const geometry=new THREE.IcosahedronGeometry(1,1),positions=geometry.attributes.position;
 for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),r=1+.13*Math.sin(x*17+y*13+z*21);positions.setXYZ(i,x*r,y*r,z*r);}geometry.computeVertexNormals();
 const foliage=new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial({name:'Distant leafy crowns',color:'#526443',roughness:1}),28*27);
 const dummy=new THREE.Object3D(),color=new THREE.Color();let n=0;
 for(let tree=0;tree<28;tree++){
  const x=-130+tree*9.6,z=108+rand()*16,top=20+rand()*10;
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.48,top*.8,6),new THREE.MeshStandardMaterial({color:'#645d4e',roughness:1}));trunk.position.set(x,top*.4,z);group.add(trunk);
  for(let j=0;j<27;j++){
   const a=rand()*Math.PI*2,r=Math.sqrt(rand())*5.6;
   dummy.position.set(x+Math.cos(a)*r,top-4+rand()*6-r*.22,z+Math.sin(a)*r);
   dummy.rotation.set(rand(),rand()*6,rand());dummy.scale.set(1.8+rand()*2.1,1.2+rand()*2.3,1.8+rand()*2.1);dummy.updateMatrix();foliage.setMatrixAt(n,dummy.matrix);
   color.setHSL(.24+rand()*.08,.22+rand()*.2,.12+rand()*.14);foliage.setColorAt(n++,color);
  }
 }
 foliage.instanceMatrix.needsUpdate=true;foliage.instanceColor.needsUpdate=true;group.add(foliage);group.updateMatrixWorld(true);return group;
}
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
function noise(x,y){
 const hash=(x,y)=>{const n=Math.sin(((x%128)+128)%128*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
 const ix=Math.floor(x),iy=Math.floor(y),u=smooth(0,1,x-ix),v=smooth(0,1,y-iy);
 return (hash(ix,iy)*(1-u)+hash(ix+1,iy)*u)*(1-v)+(hash(ix,iy+1)*(1-u)+hash(ix+1,iy+1)*u)*v;
}
export function skyRGB(u,v){
 if(v>.51){const t=smooth(.51,1,v);return [141-64*t,153-65*t,126-62*t];}
 const haze=smooth(.25,.52,v),blue=[57+78*haze,117+53*haze,179+22*haze];
 // Domain-warped multi-scale density gives connected cumulus masses with crisp wispy edges.
 // Clouds extend down to the horizon: that is the field a near-level facade actually reflects.
 const x=u*64,y=v*24,warp=noise(x*.5,y*.5)*1.7;
 const n=noise(x+warp,y)*.59+noise(x*2+warp,y*2)*.27+noise(x*4,y*4)*.10+noise(x*8,y*8)*.04;
 const coverage=smooth(.48,.59,n)*smooth(.08,.19,v)*(1-smooth(.485,.515,v));
 const shade=228+25*smooth(.52,.72,n);
 return blue.map((b,i)=>b*(1-coverage)+(shade+(i===2?1:0))*coverage);
}
export function makeEnvironment(THREE,renderer){
 const c=document.createElement('canvas');c.width=2048;c.height=1024;
 const ctx=c.getContext('2d'),image=ctx.createImageData(c.width,c.height);
 for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
  const i=(y*c.width+x)*4,rgb=skyRGB(x/c.width,y/c.height);image.data.set([...rgb,255],i);
 }
 ctx.putImageData(image,0,0);
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
