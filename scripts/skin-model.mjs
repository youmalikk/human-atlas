// Procedural skin cross-section block (original geometry, schematic but anatomically ordered):
// epidermis, dermis (papillary ridges), hypodermis with fat lobules, hair follicles with sebaceous glands and
// arrector pili, eccrine sweat glands, deep and superficial vascular plexuses, nerves and two mechanoreceptors.
// Organ space: x across (-0.5..0.5), y up (skin surface at the top), z towards the viewer (front cut face at +D/2).
import * as T from 'three';
import {mergeGeometries,mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const W=1,D=.62,X0=-W/2,X1=W/2,Z0=-D/2,Z1=D/2;
const TOP=(x,z)=>.30+.003*Math.sin(x*41+1.3)*Math.sin(z*37+.4)+.002*Math.sin((x+z)*90);
const RIDGE=(x,z)=>.245+.016*Math.pow(.5+.5*Math.sin(x*46+.6)*Math.cos(z*43),1.6)-.006;
const DEEP=(x,z)=>-.005+.012*Math.sin(x*8+1)*Math.sin(z*7+.5);
const BOTTOM=()=>-.31;

/** Solid between two height fields over the block footprint; each face has its own vertices (crisp edges). */
function slab(upper,lower,nx=90,nz=56){
 const faces=[];
 const surface=(f,flip)=>{const g=new T.PlaneGeometry(W,D,nx,nz);g.rotateX(-Math.PI/2);const p=g.getAttribute('position');for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,f(x,z));}if(flip){const idx=g.getIndex().array;for(let i=0;i<idx.length;i+=3){const t=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=t;}}g.computeVertexNormals();return g;};
 faces.push(surface(upper,false),surface(lower,true));
 // Four side walls, sampled along the edge so they follow both height fields.
 const wall=(n,pt)=>{const pos=[],idx=[];for(let i=0;i<=n;i++){const [x,z]=pt(i/n);pos.push(x,upper(x,z),z,x,lower(x,z),z);}for(let i=0;i<n;i++){const a=i*2,b=a+1,c=a+2,d=a+3;idx.push(a,b,c,c,b,d);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);return g;};
 const orient=(g,expect)=>{g.computeVertexNormals();const n=new T.Vector3().fromBufferAttribute(g.getAttribute('normal'),0);if(n.dot(expect)<0){const idx=g.getIndex().array;for(let i=0;i<idx.length;i+=3){const t=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=t;}g.computeVertexNormals();}return g;};
 faces.push(orient(wall(nx*2,t=>[X0+t*W,Z1]),new T.Vector3(0,0,1)),orient(wall(nx*2,t=>[X0+t*W,Z0]),new T.Vector3(0,0,-1)),orient(wall(nz*2,t=>[X1,Z0+t*D]),new T.Vector3(1,0,0)),orient(wall(nz*2,t=>[X0,Z0+t*D]),new T.Vector3(-1,0,0)));
 return mergeGeometries(faces.map(f=>{f.deleteAttribute('uv');return f.toNonIndexed();}),false);
}
const tube=(points,radius,seg=64,radial=14)=>new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),seg,radius,radial,false);
const sphere=(c,r,sx=1,sy=1,sz=1)=>{const g=new T.SphereGeometry(r,20,14);g.scale(sx,sy,sz);g.translate(...c);return g;};
const merge=list=>mergeGeometries(list.map(g=>{g.deleteAttribute('uv');return g.index?g.toNonIndexed():g;}),false);
/** Point along a tilted hair axis: base at the bulb, rising at `tilt` radians from vertical towards +x. */
const along=(base,tilt,len)=>[base[0]+Math.sin(tilt)*len,base[1]+Math.cos(tilt)*len,base[2]];

export function buildSkin(){
 const parts=[];const add=(name,geometry)=>parts.push({name,geometry});
 add('Epidermis',slab(TOP,RIDGE));
 add('Dermis',slab(RIDGE,DEEP));
 add('Hypodermis (subcutaneous fat)',slab(DEEP,BOTTOM));
 // Fat lobules bulging on the cut faces of the hypodermis.
 const lobules=[];let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
 for(let i=0;i<46;i++){const x=X0+.05+rnd()*(W-.1),y=-.27+rnd()*.22,r=.028+rnd()*.022;lobules.push(sphere([x,y,Z1-r*.45],r,1,.85,1));}
 for(let i=0;i<22;i++){const z=Z0+.05+rnd()*(D-.1),y=-.27+rnd()*.22,r=.026+rnd()*.02;lobules.push(sphere([X1-r*.45,y,z],r,1,.85,1));}
 add('Fat lobules',merge(lobules));
 // Hair follicles: bulb in the upper hypodermis, follicle through the dermis, shaft out through the surface.
 const hairs=[{base:[-.26,-.07,Z1-.012],tilt:.42},{base:[.08,-.05,Z1-.012],tilt:.36},{base:[.33,-.09,.02],tilt:.4}];
 const shafts=[],follicles=[],bulbs=[],papillae=[],glands=[],arrectors=[];
 hairs.forEach(({base,tilt},i)=>{
  const toSurface=(TOP(base[0],base[2])-base[1])/Math.cos(tilt);
  follicles.push(tube([base,along(base,tilt,toSurface*.5),along(base,tilt,toSurface+.004)],.024,32,16));
  shafts.push(tube([along(base,tilt,.02),along(base,tilt,toSurface*.6),along(base,tilt,toSurface+.14),along([base[0]+.02,base[1],base[2]],tilt+.12,toSurface+.3)],.0115,48,10));
  bulbs.push(sphere(along(base,tilt,.012),.036,1,1.1,1));
  papillae.push(sphere(along(base,tilt,-.004),.017,1,1.2,1));
  // Sebaceous gland: a lobulated cluster on the downhill side of the follicle, in the upper dermis.
  const g0=along(base,tilt,toSurface*.66);for(const [dx,dy,r] of [[-.038,.0,.024],[-.055,-.022,.02],[-.032,-.03,.022],[-.06,.012,.017]])glands.push(sphere([g0[0]+dx,g0[1]+dy,g0[2]],r));
  // Arrector pili: from the follicle (below the gland) up to the papillary dermis on the obtuse side.
  const a0=along(base,tilt,toSurface*.42);arrectors.push(tube([a0,[a0[0]+.06,a0[1]+.09,a0[2]],[a0[0]+.11,RIDGE(a0[0]+.11,a0[2])-.012,a0[2]]],.0075,24,8));
  if(i===2)return;
 });
 add('Hair shaft',merge(shafts));add('Hair follicle',merge(follicles));add('Hair bulb',merge(bulbs));add('Dermal papilla of hair',merge(papillae));add('Sebaceous gland',merge(glands));add('Arrector pili muscle',merge(arrectors));
 // Eccrine sweat glands: a coil at the dermis-hypodermis border with a spiral duct up to a surface pore.
 const coils=[],ducts=[];
 for(const [x,z] of [[-.08,Z1-.012],[.21,Z1-.012]]){
  const coil=new T.TorusKnotGeometry(.026,.0085,90,10,3,5);coil.rotateX(Math.PI/2);coil.translate(x,-.03,z);coils.push(coil);
  const pts=[];for(let k=0;k<=24;k++){const t=k/24,y=-.005+t*(TOP(x,z)-(-.005)),wob=t>.8?.012:.006;pts.push([x+Math.sin(t*22)*wob,y,z+Math.cos(t*22)*wob*.4]);}
  ducts.push(tube(pts,.0065,120,8));
 }
 add('Sweat gland (eccrine coil)',merge(coils));add('Sweat duct and pore',merge(ducts));
 // Vascular plexuses: deep (dermis-hypodermis junction) and superficial (papillary dermis) with connecting vessels.
 const wave=(y,z,amp,ph)=>Array.from({length:12},(_,k)=>{const x=X0+k/11*W;return [x,y+amp*Math.sin(k*1.3+ph),z];});
 const arteries=[tube(wave(.03,Z1-.006,.008,0),.017,90,14),tube(wave(.2,Z1-.003,.005,1.2),.0075,90,10)];
 const veins=[tube(wave(-.025,Z1-.007,.008,2),.021,90,14),tube(wave(.172,Z1-.003,.005,2.6),.009,90,10)];
 for(const x of [-.36,.0,.4]){arteries.push(tube([[x,.03,Z1-.004],[x+.02,.12,Z1-.003],[x+.01,.2,Z1-.003]],.006,20,8));veins.push(tube([[x+.06,-.025,Z1-.004],[x+.07,.08,Z1-.003],[x+.06,.172,Z1-.003]],.007,20,8));}
 add('Arteries (cutaneous plexus)',merge(arteries));add('Veins (cutaneous plexus)',merge(veins));
 // Nerve with a Pacinian corpuscle (deep pressure, hypodermis) and Meissner corpuscles (light touch, dermal papillae).
 add('Cutaneous nerve',merge([tube([[X0,-.075,Z1-.004],[-.2,-.085,Z1-.004],[.05,-.068,Z1-.004],[X1,-.08,Z1-.004]],.011,90,10),tube([[-.12,-.075,Z1-.004],[-.13,-.12,Z1-.004],[-.14,-.155,Z1-.004]],.006,20,8),tube([[.15,-.07,Z1-.003],[.16,.08,Z1-.003],[.17,.225,Z1-.004]],.0045,30,8),tube([[-.3,-.078,Z1-.003],[-.31,.08,Z1-.003],[-.32,.226,Z1-.004]],.0045,30,8)]));
 add('Pacinian corpuscle',merge([sphere([-.145,-.195,Z1-.008],.042,.75,1.15,.75)]));
 add('Meissner corpuscle',merge([sphere([.17,.232,Z1-.004],.011,.8,1.4,.8),sphere([-.32,.233,Z1-.004],.011,.8,1.4,.8)]));
 return parts.map(p=>{let g=p.geometry;g.deleteAttribute('uv');if(!g.getAttribute('normal'))g.computeVertexNormals();g=mergeVertices(g,1e-5);return {name:p.name,geometry:g};});
}
