/** V6 PBR extraction: never consume seeded rand during construction. */
export function createPBRTools(THREE,{rand,stats,materials,textureWorld}){
  const between = (a,b) => a + rand() * (b-a);
  const clamp = n => Math.max(0, Math.min(255, n));
  const color = (r,g,b) => `rgb(${clamp(r)|0},${clamp(g)|0},${clamp(b)|0})`;
  function canvas(size) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    return [c, c.getContext('2d', {willReadFrequently:true})];
  }
  function texture(c, srgb = false) {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.name = `Procedural ${stats.textures++}`;
    return t;
  }
  function pbr(name, kind, rgb, world, size = 512) {
    const [c,ctx] = canvas(size), [h,hx] = canvas(size), [r,rx] = canvas(size);
    ctx.fillStyle = color(...rgb); ctx.fillRect(0,0,size,size);
    hx.fillStyle = '#858585'; hx.fillRect(0,0,size,size);
    rx.fillStyle = '#dddddd'; rx.fillRect(0,0,size,size);
    if (kind === 'brick' || kind === 'paving' || kind === 'tile') {
      const cols = kind === 'brick' ? 4 : kind === 'tile' ? 8 : 6;
      const rows = kind === 'brick' ? 16 : kind === 'tile' ? 12 : 12;
      const w = size/cols, ht = size/rows;
      ctx.fillStyle = kind === 'brick' ? '#a39887' : '#77776e'; ctx.fillRect(0,0,size,size);
      hx.fillStyle = '#444444'; hx.fillRect(0,0,size,size);
      for (let y=0; y<rows; y++) for (let x=-1; x<cols+1; x++) {
        const off = y%2 ? w/2 : 0, xx = x*w+off, yy = y*ht;
        const d = between(-15,15), gap = kind === 'brick' ? 2 : 2.5;
        ctx.fillStyle = color(rgb[0]+d,rgb[1]+d,rgb[2]+d);
        ctx.fillRect(xx+gap,yy+gap,w-gap*2,ht-gap*2);
        hx.fillStyle = '#b5b5b5'; hx.fillRect(xx+gap,yy+gap,w-gap*2,ht-gap*2);
        ctx.strokeStyle = 'rgba(255,255,245,.14)'; ctx.lineWidth=1;
        ctx.strokeRect(xx+gap+.5,yy+gap+.5,w-gap*2-1,ht-gap*2-1);
        if (kind==='tile') {
          ctx.strokeStyle='rgba(22,27,27,.3)';ctx.beginPath();ctx.moveTo(xx+w*.8,yy+2);ctx.lineTo(xx+w*.8,yy+ht-2);ctx.stroke();
        }
      }
    }
    // Fine mineral grains: albedo, micro-height, and roughness all remain local.
    for (let i=0;i<size*size*.16;i++) {
      const x=rand()*size,y=rand()*size,s=between(.35,kind==='granite'?2:1.5);
      ctx.fillStyle = rand()>.55 ? 'rgba(255,251,239,.14)' : 'rgba(31,31,25,.16)';ctx.fillRect(x,y,s,s);
      hx.fillStyle = rand()>.5 ? '#939393' : '#a6a6a6';hx.fillRect(x,y,.8,.8);
      const rv = between(170,249);rx.fillStyle=color(rv,rv,rv);rx.fillRect(x,y,2,2);
    }
    // Tileable tangent-space normal map derived from the actual height field.
    const heights=hx.getImageData(0,0,size,size).data;
    const [nc,nx]=canvas(size), normal=nx.createImageData(size,size);
    for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
      const ix=(y*size+x)*4;
      const dx=heights[(y*size+(x+1)%size)*4]-heights[(y*size+(x+size-1)%size)*4];
      const dy=heights[(((y+1)%size)*size+x)*4]-heights[(((y+size-1)%size)*size+x)*4];
      const v=new THREE.Vector3(-dx*.018,dy*.018,1).normalize();
      normal.data[ix]=(v.x*.5+.5)*255;normal.data[ix+1]=(v.y*.5+.5)*255;normal.data[ix+2]=(v.z*.5+.5)*255;normal.data[ix+3]=255;
    }
    nx.putImageData(normal,0,0);
    const mat = new THREE.MeshStandardMaterial({name,map:texture(c,true),normalMap:texture(nc),roughnessMap:texture(r),roughness:1,metalness:0,normalScale:new THREE.Vector2(.5,.5)});
    materials[name]=mat;textureWorld.set(mat,world);return mat;
  }
  function worldUV(geo,mat) {
    if(!textureWorld.has(mat)) return;
    const [sx,sy]=textureWorld.get(mat),p=geo.attributes.position,n=geo.attributes.normal;
    const a=new Float32Array(p.count*2);
    for(let i=0;i<p.count;i++) {
      const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));
      let u,v;
      if(ny>nx&&ny>nz){u=p.getX(i);v=p.getZ(i);}
      else if(nx>nz){u=p.getZ(i);v=p.getY(i);}
      else{u=p.getX(i);v=p.getY(i);}
      a[i*2]=u/sx;a[i*2+1]=v/sy;
    }
    geo.setAttribute('uv',new THREE.BufferAttribute(a,2));
  }
  return {pbr,worldUV,texture};
}
