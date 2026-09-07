/** Local V2 pine module: reusable curved needle fascicles; no broadleaf assets or crown spheres. */
export function createNeedleShoot(THREE){
 const p=[],uv=[],idx=[];
 for(let n=0;n<34;n++){
  const angle=n*2.39996,base=(n/34-.5)*.28,length=.38+.17*(.5+.5*Math.sin(n*7.3));
  const radial=new THREE.Vector3(Math.cos(angle),.26+Math.sin(n*4.1)*.16,Math.sin(angle)).normalize();
  const side=new THREE.Vector3(-Math.sin(angle),0,Math.cos(angle));
  const start=p.length/3;
  for(let k=0;k<=4;k++){
   const t=k/4,center=radial.clone().multiplyScalar(length*t);center.y+=base+.11*t*t;
   const width=.011*(1-t*.95);
   for(const s of [-1,1]){const v=center.clone().addScaledVector(side,width*s);p.push(v.x,v.y,v.z);uv.push((s+1)/2,t);}
  }
  for(let k=0;k<4;k++){const i=start+k*2;idx.push(i,i+1,i+2,i+1,i+3,i+2);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();g.userData={kind:'curved-needle-fascicles',needlesPerShoot:34,segmentsPerNeedle:4};return g;
}
export function addPines(THREE,B,parent,{textured=true}={}){
 let seed=7174;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const positions=[[-5.8,12.7,.65],[4.4,12,.69],[-17,13,1.07],[17.8,14,1.0],[-32,5,1.2],[32,4,1.15]];
 const bark=textured?B.pbr('Pine ridged gray-brown bark','grain',[73,68,55],[.45,1.6]):new THREE.MeshStandardMaterial({name:'Pine bark',color:'#514b3d',roughness:1});
 const needle=new THREE.MeshStandardMaterial({name:'Pine needle surfaces — dark olive green',color:'#b6c39e',roughness:.79,side:THREE.DoubleSide});
 const shoots=new THREE.InstancedMesh(createNeedleShoot(THREE),needle,positions.length*2160);shoots.name='Instanced curved pine needle fascicles';shoots.castShadow=true;shoots.receiveShadow=true;parent.add(shoots);
 const dummy=new THREE.Object3D(),color=new THREE.Color();let index=0;
 for(const [x,z,s] of positions){
  const tree=new THREE.Group();tree.name='Pine — irregular lateral branch architecture';tree.userData={speciesStatus:'pine-form based on front photo; exact species unverified'};parent.add(tree);
  const top=9.4*s;
  const soil=new THREE.MeshStandardMaterial({name:'Pine tree pit soil',color:'#514c34',roughness:1});
  B.box(tree,'flush square planting pit',x,.021,z,1.7*s,.018,1.7*s,soil);
  B.cylinder(tree,[x,-.1,z],[x+.22*s,top,z-.13*s],.25*s,.025*s,bark,12);
  for(let b=0;b<16;b++){
   const h=(3.1+b*.36+rand()*.48)*s,a=b*2.399+rand()*.35,reach=(3.7-b*.13)*( .77+rand()*.38)*s;
   const direction=new THREE.Vector3(Math.cos(a),0,Math.sin(a));
   const base=new THREE.Vector3(x,h,z),elbow=base.clone().addScaledVector(direction,reach*.53);elbow.y-=.27*s;
   const end=base.clone().addScaledVector(direction,reach);end.y+=.24*s;
   B.cylinder(tree,base.toArray(),elbow.toArray(),.105*s,.048*s,bark,8);B.cylinder(tree,elbow.toArray(),end.toArray(),.048*s,.012*s,bark,7);
   for(let twig=0;twig<3;twig++){
    const side=twig-1,tip=end.clone().add(new THREE.Vector3(-Math.sin(a)*side*.72*s,.18*Math.abs(side)*s,Math.cos(a)*side*.72*s));
    B.cylinder(tree,elbow.toArray(),tip.toArray(),.033*s,.007*s,bark,6);
    for(let j=0;j<45;j++){
     const along=.44+rand()*.67,rad=(rand()-.5)*1.05*s;
     dummy.position.copy(elbow).lerp(tip,along);dummy.position.add(new THREE.Vector3(-Math.sin(a)*rad,(rand()-.5)*.36*s,Math.cos(a)*rad));
     dummy.rotation.set((rand()-.5)*1.2,rand()*Math.PI*2,(rand()-.5)*1.1);dummy.scale.setScalar((.88+rand()*.52)*s);dummy.updateMatrix();shoots.setMatrixAt(index,dummy.matrix);
     color.setHSL(.29+rand()*.035,.23+rand()*.15,.12+rand()*.10);shoots.setColorAt(index++,color);
    }
   }
  }
 }
 shoots.instanceMatrix.needsUpdate=true;shoots.instanceColor.needsUpdate=true;
 Object.assign(B.stats,{trees:positions.length,leafInstances:index,foliageKind:'pine-needle-shoots',needleCount:index*34});
 return shoots;
}
