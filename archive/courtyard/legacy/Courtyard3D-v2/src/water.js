export const WATER_COLOR='#4d8586';
export const WATER_OPACITY=1;
export function createWater(THREE){
 const group=new THREE.Group();group.name='Three pale blue-green pool surfaces';
 const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');const image=ctx.createImageData(256,256);
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){
  const u=x/256*Math.PI*2,v=y/256*Math.PI*2;
  const dx=.22*Math.cos(u*4+v*2)+.10*Math.cos(u*9-v*5),dy=.18*Math.cos(u*4+v*2)-.09*Math.cos(u*9-v*5);
  const normal=new THREE.Vector3(-dx,dy,1).normalize(),i=(y*256+x)*4;image.data[i]=(normal.x*.5+.5)*255;image.data[i+1]=(normal.y*.5+.5)*255;image.data[i+2]=(normal.z*.5+.5)*255;image.data[i+3]=255;
 }
 ctx.putImageData(image,0,0);const normals=new THREE.CanvasTexture(c);normals.wrapS=normals.wrapT=THREE.RepeatWrapping;normals.repeat.set(2,3);normals.anisotropy=8;
 const mat=new THREE.MeshPhysicalMaterial({name:'Unified softly rippled blue-green water',color:WATER_COLOR,roughness:.22,metalness:.26,normalMap:normals,normalScale:new THREE.Vector2(.2,.2),clearcoat:.75,clearcoatRoughness:.22,opacity:WATER_OPACITY,transparent:false,transmission:0,envMapIntensity:1.05});
 const pools=[{z:12.8,w:5.1,d:5,floor:1.02},{z:19.25,w:6.45,d:7.35,floor:.57},{z:27.7,w:8.1,d:9.1,floor:.14}];
 for(const pool of pools){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(pool.w-.025,pool.d-.025),mat);mesh.rotation.x=-Math.PI/2;mesh.position.set(0,pool.floor+.53,pool.z);mesh.receiveShadow=true;mesh.name='Blue-green water pool';group.add(mesh);}
 return {group,stats:{waterSurfaces:3,waterColor:WATER_COLOR,waterOpacity:WATER_OPACITY}};
}
