import outline from '../assets/leaves/outline.json' with {type:'json'};
let textures;
export async function loadLeafTextures(THREE){
 const loader=new THREE.TextureLoader();
 const [map,normalMap,roughnessMap]=await Promise.all(['maple-color.png','Normal.png','Roughness.png'].map(n=>loader.loadAsync('./assets/leaves/'+n)));
 map.colorSpace=THREE.SRGBColorSpace;
 for(const t of [map,normalMap,roughnessMap]){t.anisotropy=8;t.needsUpdate=true;}
 textures={map,normalMap,roughnessMap};
}
export function createLeafGeometry(THREE,scale=1){
 const points=outline.map(([u,v])=>new THREE.Vector2(u,v));
 const indices=THREE.ShapeUtils.triangulateShape(points,[]).flat();const pos=[],uv=[];
 for(const [u,v] of outline){const x=u-.44,y=v-.08;pos.push(x*scale,y*scale,(.075*Math.sin(v*Math.PI)*(1-2*Math.abs(x))+.035*x*x)*scale);uv.push(u,v);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.name='Photographed maple outline with lobes and curved blade';return g;
}
export function createLeafMaterial(THREE,name){
 if(!textures)throw new Error('Leaf textures must finish loading before scene creation');
 return new THREE.MeshStandardMaterial({name,...textures,color:0xffffff,roughness:1,metalness:0,normalScale:new THREE.Vector2(.3,-.3),side:THREE.DoubleSide,alphaTest:.45});
}
