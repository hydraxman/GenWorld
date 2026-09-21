export const CAMPUS_SIZE=360;
export function groundHeight(z){
 const u=Math.max(0,Math.min(1,(z-35)/4));
 return -0.065-0.54*u*u*(3-2*u);
}
export function walkwayAt(x,z){
 return (Math.abs(x)<4.7&&z>46)||(Math.abs(Math.abs(x)-34)<1.9&&z>-52&&z<82)||(Math.abs(z-53)<2.3&&Math.abs(x)<92)||(Math.abs(z+27)<2.0&&Math.abs(x)<82);
}
export function createCampus(THREE){
 const group=new THREE.Group();group.name='Continuous campus lawns, planting and walks';
 let seed=90626;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const range=(a,b)=>a+rand()*(b-a);
 function tex(c){const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;return t;}
 const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');ctx.fillStyle='#637847';ctx.fillRect(0,0,1024,1024);
 for(let i=0;i<90000;i++){const x=rand()*1024,y=rand()*1024;ctx.strokeStyle=rand()>.5?'rgba(174,184,105,.16)':'rgba(25,55,23,.16)';ctx.lineWidth=range(.5,1.7);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+range(-3,3),y-range(2,7));ctx.stroke();}
 const lawnMap=tex(c);lawnMap.repeat.set(60,60);
 const lawn=new THREE.MeshStandardMaterial({name:'Continuous fine textured campus lawn',map:lawnMap,roughness:1});
 const terrain=new THREE.PlaneGeometry(CAMPUS_SIZE,CAMPUS_SIZE,120,120);terrain.rotateX(-Math.PI/2);
 const p=terrain.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,groundHeight(p.getZ(i)));terrain.computeVertexNormals();
 const ground=new THREE.Mesh(terrain,lawn);ground.name='Continuous ground under the entire courtyard';ground.receiveShadow=true;group.add(ground);
 const pc=document.createElement('canvas');pc.width=pc.height=512;const px=pc.getContext('2d');px.fillStyle='#b5b4a4';px.fillRect(0,0,512,512);
 for(let i=0;i<24000;i++){const v=Math.floor(range(120,210));px.fillStyle=`rgba(${v},${v},${v-12},.25)`;px.fillRect(rand()*512,rand()*512,range(.5,2),range(.5,2));}
 const pathMat=new THREE.MeshStandardMaterial({name:'Campus light aggregate walk',map:tex(pc),roughness:1});
 const edgeMat=new THREE.MeshStandardMaterial({name:'Campus walkway stone edging',color:'#b7b8a5',roughness:.93});
 function ribbon(x0,z0,x1,z1,width,mat,offset=0,lift=.03){
  const len=Math.hypot(x1-x0,z1-z0),nx=-(z1-z0)/len,nz=(x1-x0)/len;const n=Math.max(2,Math.ceil(len));const verts=[],uv=[];
  for(let i=0;i<n;i++){
   const pts=[];for(const u of [i/n,(i+1)/n])for(const side of [-1,1]){const x=x0+(x1-x0)*u+nx*(offset+side*width/2),z=z0+(z1-z0)*u+nz*(offset+side*width/2);pts.push([x,groundHeight(z)+lift,z]);}
   for(const j of [0,1,2,2,1,3]){verts.push(...pts[j]);uv.push(pts[j][0]/2,pts[j][2]/2);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();
  // These ground strips face upward regardless of the path heading.
  const normals=geo.attributes.normal;for(let i=0;i<normals.count;i++)if(normals.getY(i)<0){const a=geo.attributes.position;const u=geo.attributes.uv;for(let k=0;k<a.count;k+=3){const b=[a.getX(k+1),a.getY(k+1),a.getZ(k+1)],v=[u.getX(k+1),u.getY(k+1)];a.setXYZ(k+1,a.getX(k+2),a.getY(k+2),a.getZ(k+2));a.setXYZ(k+2,...b);u.setXY(k+1,u.getX(k+2),u.getY(k+2));u.setXY(k+2,...v);}geo.computeVertexNormals();break;}
  const mesh=new THREE.Mesh(geo,mat);mesh.name='Campus path';mesh.receiveShadow=true;group.add(mesh);
 }
 const paths=[[0,46.8,0,105,8],[-34,-52,-34,82,2.7],[34,-52,34,82,2.7],[-92,53,92,53,3.6],[-82,-27,82,-27,3]];
 for(const [x0,z0,x1,z1,w] of paths){ribbon(x0,z0,x1,z1,w,pathMat);for(const s of [-1,1])ribbon(x0,z0,x1,z1,.16,edgeMat,s*(w/2+.08),.045);}
 const green=new THREE.MeshStandardMaterial({name:'Campus grass blades',color:'#7c9554',roughness:1,side:THREE.DoubleSide});
 const grassGeo=new THREE.BufferGeometry();grassGeo.setAttribute('position',new THREE.Float32BufferAttribute([-.038,0,0,.038,0,0,.025,.43,.025, -.038,0,0,.025,.43,.025,-.015,.19,.01],3));grassGeo.computeVertexNormals();
 const grassTransforms=[],grassColors=[],q=new THREE.Quaternion(),v3=new THREE.Vector3();
 for(let i=0;i<8800;i++){
  const x=range(-58,58),z=range(-36,80);
  // Keep paths and the original architectural/paved footprint unobstructed.
  if((Math.abs(x)<17.2&&z>-11&&z<47)||(Math.abs(x)<20&&z>37&&z<47)||walkwayAt(x,z))continue;
  for(let b=0;b<5;b++){
   const xx=x+range(-.19,.19),zz=z+range(-.19,.19),s=range(.5,1.3);
   q.setFromAxisAngle(new THREE.Vector3(0,1,0),rand()*Math.PI*2);grassTransforms.push(new THREE.Matrix4().compose(new THREE.Vector3(xx,groundHeight(zz)+.012,zz),q,new THREE.Vector3(s,s,s)));
   grassColors.push(new THREE.Color().setHSL(range(.21,.29),range(.28,.45),range(.35,.57)));
  }
 }
 function instances(name,geometry,material,transforms,colors,cast){
  const mesh=new THREE.InstancedMesh(geometry,material,transforms.length);mesh.name=name;
  transforms.forEach((m,i)=>{mesh.setMatrixAt(i,m);if(colors)mesh.setColorAt(i,colors[i]);});mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.castShadow=cast;mesh.receiveShadow=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);return mesh;
 }
 instances('Low campus grass tufts',grassGeo,green,grassTransforms,grassColors,false);
 const bark=new THREE.MeshStandardMaterial({name:'Campus tree trunks',color:'#625b42',roughness:1});
 const foliageMat=new THREE.MeshStandardMaterial({name:'Campus tree and shrub foliage',color:'#697f42',roughness:1,side:THREE.DoubleSide});
 const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-.18,.16,0,-.15,.36,.025,0,0,0,-.15,.36,.025,0,.5,0,0,0,0,0,.5,0,.15,.36,.025,0,0,0,.15,.36,.025,.18,.16,0],3));lg.computeVertexNormals();
 const branches=[],leaves=[],leafColors=[];
 function branch(a,b,r0,r1){
  const aa=new THREE.Vector3(...a),bb=new THREE.Vector3(...b),delta=bb.clone().sub(aa);q.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize());
  branches.push(new THREE.Matrix4().compose(aa.add(bb).multiplyScalar(.5),q,new THREE.Vector3(r0,delta.length(),r1)));
 }
 function leafCloud(x,y,z,rx,ry,rz,count,scale=1){
  for(let i=0;i<count;i++){
   const theta=rand()*Math.PI*2,h=range(-1,1),r=Math.cbrt(rand()),rad=Math.sqrt(1-h*h)*r;
   q.setFromEuler(new THREE.Euler(range(-1,1),rand()*Math.PI*2,rand()*Math.PI*2));const s=scale*range(.75,1.3);
   leaves.push(new THREE.Matrix4().compose(new THREE.Vector3(x+Math.cos(theta)*rad*rx,y+h*r*ry,z+Math.sin(theta)*rad*rz),q,new THREE.Vector3(s,s,s)));
   leafColors.push(new THREE.Color().setHSL(range(.21,.29),range(.28,.46),range(.35,.60)));
  }
 }
 const treePositions=[[-42,-14],[-37,9],[-43,28],[-44,48],[-46,67],[43,-10],[42,10],[44,30],[46,46],[47,70],[-60,-39],[-41,-40],[-21,-41],[1,-43],[23,-41],[42,-41],[61,-41],[-66,20],[65,23]];
 for(const [x,z] of treePositions){
  const base=groundHeight(z),height=range(7.5,11),spread=range(2.5,3.8);branch([x,base,z],[x+.1,base+height*.69,z],.24,.24);
  for(let j=0;j<7;j++){const a=j*Math.PI*2/7,dx=Math.cos(a)*spread*.6,dz=Math.sin(a)*spread*.6,cy=base+height*.66+range(-.5,1);branch([x,base+height*.43,z],[x+dx,cy,z+dz],.085,.085);leafCloud(x+dx,cy+.5,z+dz,spread*.65,spread*.68,spread*.65,160,1.1);}
  leafCloud(x,base+height*.91,z,spread*.65,spread*.5,spread*.65,200,1);
 }
 // Low irregular shrub beds at the outside of the established tree belt.
 for(const side of [-1,1])for(let z=-17;z<62;z+=4.2){
  const x=side*range(26,30.2);if(walkwayAt(x,z))continue;leafCloud(x,groundHeight(z)+.7,z,range(.9,1.5),.65,range(.8,1.4),260,.85);
 }
 instances('Campus tree branch network',new THREE.CylinderGeometry(.75,1,1,7),bark,branches,null,true);
 instances('Campus tree and shrub leaf clusters',lg,foliageMat,leaves,leafColors,true);
 const poleMat=new THREE.MeshStandardMaterial({name:'Campus path lamp metal',color:'#4c5650',roughness:.65,metalness:.2});
 const lampShade=new THREE.MeshStandardMaterial({name:'Frosted campus lamp diffuser',color:'#e4e4d4',roughness:.65});
 for(const x of [-36.2,36.2])for(const z of [-20,4,28,58]){
  const y=groundHeight(z);const pole=new THREE.Mesh(new THREE.CylinderGeometry(.055,.075,3.3,8),poleMat);pole.position.set(x,y+1.65,z);pole.castShadow=true;group.add(pole);
  const diffuser=new THREE.Mesh(new THREE.CylinderGeometry(.22,.19,.42,10),lampShade);diffuser.position.set(x,y+3.38,z);group.add(diffuser);
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(.27,.3,.06,10),poleMat);cap.position.set(x,y+3.61,z);group.add(cap);
 }
 group.updateMatrixWorld(true);
 return {group,stats:{campusTrees:treePositions.length,campusGrassBlades:grassTransforms.length,campusLeafInstances:leaves.length,campusPaths:paths.length,campusGroundSize:CAMPUS_SIZE}};
}
