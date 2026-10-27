// Builds the "3D organ views" models in public/organs/*.glb.
//
// Sources
//  - Human Reference Atlas 3D Reference Object Library (HuBMAP consortium), CC BY 4.0.
//    Get it with:  git clone --filter=blob:none https://github.com/hubmapconsortium/ccf-releases
//    then pass the checkout path as the first argument (the needed .glb files are fetched on demand by git).
//  - The heart is assembled from this atlas' own BodyParts3D geometry (public/models), CC BY 4.0,
//    because it includes the coronary vessels and great vessels that the HuBMAP heart lacks.
//
// Every organ is flattened (one node per anatomical structure, transforms baked), cleaned of
// textures/UVs/materials (the viewer shades by structure), centred, scaled to fit a unit cube,
// simplified to a triangle budget, quantized and meshopt-compressed.
//
// Usage: node scripts/build-organs.mjs <path-to-ccf-releases> [organ-id ...]
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {Document,NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTMeshoptCompression,KHRMeshQuantization} from '@gltf-transform/extensions';
import {clearNodeTransform,dedup,flatten,getBounds,meshopt,prune,simplify,transformPrimitive,weld} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptSimplifier} from 'meshoptimizer';

const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const HUBMAP=process.argv[2];
const ONLY=new Set(process.argv.slice(3));
const OUT=path.join(ROOT,'public/organs');
if(!HUBMAP){console.error('Usage: node scripts/build-organs.mjs <path-to-ccf-releases> [organ-id ...]');process.exit(1);}

/** Triangle budgets keep each organ light enough for phones (a few hundred KB to ~2 MB). */
const ORGANS=[
 {id:'heart',bp3d:{
  concepts:['heart'],
  names:[/^wall of ventricle$/i,/^(anterior interventricular|middle cardiac|left marginal|anterior cardiac) vein$/i,/^posterior vein of left ventricle$/i,/^septal branch of anterior interventricular artery$/i,/septal branch of right posterior interventricular artery$/i,
   /^(ascending aorta|arch of aorta|descending aorta|pulmonary trunk|superior vena cava|inferior vena cava|brachiocephalic artery|left common carotid artery)$/i,/^(left|right) pulmonary artery$/i,/^(left|right) (superior|inferior) pulmonary vein$/i],
  exclude:[/^cavity of/i],clipY:[1.25,1.418]},budget:70000},
 {id:'brain',file:'v2.0/models/3d-vh-m-allen-brain.glb',budget:170000,error:.012,mirrorX:true},
 {id:'lungs',file:'v1.4/models/3d-vh-m-lung.glb',budget:110000},
 {id:'liver',file:'v1.3/models/VH_M_Liver.glb',budget:60000},
 {id:'pancreas',file:'v1.3/models/VH_M_Pancreas.glb',budget:24000},
 {id:'small-intestine',file:'v1.3/models/VH_M_Small_Intestine.glb',budget:36000},
 {id:'large-intestine',file:'v1.3/models/SBU_M_Intestine_Large.glb',budget:36000},
 {id:'kidney',file:'v1.3/models/VH_M_Kidney_L.glb',budget:60000,dropSide:true},
 {id:'eye',file:'v1.4/models/3d-vh-m-eye-l.glb',budget:90000,dropSide:true},
 {id:'skin',procedural:true,budget:Infinity},
];

const FIXES=[[/posetrior/g,'posterior'],[/hepataduodenal/g,'hepatoduodenal'],[/horizonal/g,'horizontal'],[/^ingulo /,'cingulo-'],[/superiomedial/g,'superomedial'],[/ of HTH$/,' of hypothalamus'],[/ HTH$/,' hypothalamus'],[/Heschls/g,"Heschl's"],[/ rostral part of FuGt$/,' (rostral part)'],[/ area (Fl|Tl)$/,''],[/schlemms/g,"Schlemm's"],[/^bronchus$/,'trachea and main bronchi'],[/^(right|left) posterior basal$/,'$1 posterior basal bronchus'],[/ the pancreas$/,' pancreas'],[/palpebral conjunctiva of /,'palpebral conjunctiva, '],[/ accessory basal nucleus$/,''],[/ basal nucleus$/,'']];
function cleanName(raw,dropSide){
 let n=raw.replace(/FBXASC032/g,' ').replace(/^(VH_[MF]_|Allen_|SBU_[MF]_)/,'').replace(/_([LR])_[a-z]$/,'_$1');
 let side='';const m=n.match(/_(L|R)$/);if(m){side=m[1]==='L'?'left':'right';n=n.slice(0,-2);}
 n=n.replace(/_/g,' ').replace(/\s+/g,' ').trim();
 for(const [re,to] of FIXES)n=n.replace(re,to);
 n=n.charAt(0).toUpperCase()+n.slice(1);
 return side&&!dropSide?`${n} (${side})`:n;
}

/** Clip an indexed triangle mesh to y0 <= y <= y1, splitting triangles that cross either plane. */
function clipBand(pos,nor,idx,y0,y1){
 const P=[],N=[],I=[];
 const vert=i=>({p:[pos[i*3],pos[i*3+1],pos[i*3+2]],n:[nor[i*3],nor[i*3+1],nor[i*3+2]]});
 const lerp=(a,b,t)=>({p:a.p.map((v,k)=>v+(b.p[k]-v)*t),n:a.n.map((v,k)=>v+(b.n[k]-v)*t)});
 const clipPoly=(poly,inside,cut)=>{const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ia=inside(a),ib=inside(b);if(ia)out.push(a);if(ia!==ib){const t=(cut-a.p[1])/(b.p[1]-a.p[1]);out.push(lerp(a,b,t));}}return out;};
 for(let t=0;t<idx.length;t+=3){
  let poly=[vert(idx[t]),vert(idx[t+1]),vert(idx[t+2])];
  poly=clipPoly(poly,v=>v.p[1]>=y0,y0);if(poly.length<3)continue;poly=clipPoly(poly,v=>v.p[1]<=y1,y1);if(poly.length<3)continue;
  const base=P.length/3;for(const v of poly){P.push(...v.p);const l=Math.hypot(...v.n)||1;N.push(...v.n.map(x=>x/l));}
  for(let k=1;k<poly.length-1;k++)I.push(base,base+k,base+k+1);
 }
 return {pos:Float32Array.from(P),nor:Float32Array.from(N),idx:Uint32Array.from(I)};
}

/** Build a document from this atlas' BodyParts3D parts (one node per part). */
function bp3dDocument(cfg){
 const dir=path.join(ROOT,'public/models'),atlas=JSON.parse(fs.readFileSync(path.join(dir,'atlas.json'),'utf8'));
 const ids=new Set(),core=new Set();
 for(const name of cfg.concepts){const c=atlas.concepts.find(x=>x.name.toLowerCase()===name);if(!c)throw new Error(`Missing concept ${name}`);c.elements.forEach(e=>{ids.add(e);core.add(e);});}
 atlas.parts.forEach(p=>{if(cfg.names.some(r=>r.test(p.name)))ids.add(p.id);});
 const cache=new Map(),chunk=i=>{if(!cache.has(i)){const b=fs.readFileSync(path.join(dir,`body-${i}.bin`));cache.set(i,b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));}return cache.get(i);};
 const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene();
 const [y0,y1]=cfg.clipY;
 for(const p of atlas.parts.filter(p=>ids.has(p.id)&&!(cfg.exclude??[]).some(r=>r.test(p.name)))){
  const ab=chunk(p.chunk),pos=new Float32Array(ab,p.positions,p.vertexCount*3),n16=new Int16Array(ab,p.normals,p.vertexCount*3),idx=new Uint32Array(ab,p.indices,p.indexCount);
  // Organ parts are kept whole; attached vessels are cut cleanly at the clip band (triangles split at the planes).
  const nor=Float32Array.from(n16,v=>Math.max(v/32767,-1));
  const geo=core.has(p.id)?{pos:pos.slice(),nor,idx:idx.slice()}:clipBand(pos,nor,idx,y0,y1);
  if(geo.idx.length<9)continue;
  const prim=doc.createPrimitive()
   .setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(geo.pos).setBuffer(buffer))
   .setAttribute('NORMAL',doc.createAccessor().setType('VEC3').setArray(geo.nor).setBuffer(buffer))
   .setIndices(doc.createAccessor().setType('SCALAR').setArray(geo.idx).setBuffer(buffer));
  scene.addChild(doc.createNode(p.name).setMesh(doc.createMesh(p.name).addPrimitive(prim)));
 }
 return doc;
}

async function hubmapDocument(io,file){
 const full=path.join(HUBMAP,file);
 if(!fs.existsSync(full)||fs.statSync(full).size===0)execFileSync('git',['-C',HUBMAP,'checkout','HEAD','--',file],{stdio:'inherit'});
 return io.read(full);
}

/** The skin block is generated (scripts/skin-model.mjs): crisp face normals are kept, no welding or simplification. */
async function skinDocument(){
 const {buildSkin}=await import('./skin-model.mjs');
 const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene();
 for(const {name,geometry} of buildSkin()){
  const prim=doc.createPrimitive()
   .setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(Float32Array.from(geometry.getAttribute('position').array)).setBuffer(buffer))
   .setAttribute('NORMAL',doc.createAccessor().setType('VEC3').setArray(Float32Array.from(geometry.getAttribute('normal').array)).setBuffer(buffer))
   .setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint32Array.from(geometry.getIndex().array)).setBuffer(buffer));
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
 }
 return doc;
}

async function build(io,organ){
 const doc=organ.procedural?await skinDocument():organ.bp3d?bp3dDocument(organ.bp3d):await hubmapDocument(io,organ.file);
 const root=doc.getRoot(),scene=root.getDefaultScene()??root.listScenes()[0];
 await doc.transform(flatten());
 for(const node of scene.listChildren()){if(node.getMesh())clearNodeTransform(node);}
 // Drop empty helper nodes, textures, UVs, tangents and vertex colours: the viewer shades each structure itself.
 for(const node of root.listNodes()){if(!node.getMesh()&&node.listChildren().length===0)node.dispose();}
 for(const mesh of root.listMeshes())for(const prim of mesh.listPrimitives()){for(const sem of prim.listSemantics())if(sem!=='POSITION'&&sem!=='NORMAL')prim.setAttribute(sem,null);prim.setMaterial(null);}
 root.listMaterials().forEach(m=>m.dispose());root.listTextures().forEach(t=>t.dispose());
 // Clean structure names (one name per node and its mesh).
 for(const node of root.listNodes()){const mesh=node.getMesh();if(!mesh)continue;const name=organ.bp3d||organ.procedural?node.getName():cleanName(node.getName(),organ.dropSide);node.setName(name);mesh.setName(name);node.setExtras({name});}
 // Centre on the origin and scale so the longest side is 1 unit; keep the real size for the fact card.
 const box=getBounds(scene),size=box.max.map((v,i)=>v-box.min[i]),center=box.max.map((v,i)=>(v+box.min[i])/2),s=1/Math.max(...size);
 // The Allen brain uses RAS axes (left = -x); mirror it so every organ matches the body: patient's left = +x, anterior = +z, superior = +y.
 const sx=organ.mirrorX?-s:s,matrix=[sx,0,0,0, 0,s,0,0, 0,0,s,0, -center[0]*sx,-center[1]*s,-center[2]*s,1];
 for(const mesh of root.listMeshes())for(const prim of mesh.listPrimitives())transformPrimitive(prim,matrix);
 const before=triangles(root);
 // Weld on position only (source normals split vertices at hard edges), simplify, then rebuild smooth normals.
 if(!organ.procedural){
  for(const mesh of root.listMeshes())for(const prim of mesh.listPrimitives())prim.setAttribute('NORMAL',null);
  await doc.transform(weld());
  const ratio=Math.min(1,organ.budget/before);
  if(ratio<1)await doc.transform(simplify({simplifier:MeshoptSimplifier,ratio,error:organ.error??.004,lockBorder:false}));
  for(const mesh of root.listMeshes())for(const prim of mesh.listPrimitives())smoothNormals(doc,prim);
 }
 await doc.transform(dedup(),prune());
 scene.setExtras({organ:organ.id,sizeMeters:size.map(v=>+v.toFixed(4)),source:organ.procedural?'MedSchoolZone procedural model':organ.bp3d?'BodyParts3D':'HuBMAP HRA 3D Reference Object Library',file:organ.file??'public/models'});
 await doc.transform(meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:14,quantizeNormal:10}));
 const out=path.join(OUT,`${organ.id}.glb`);await io.write(out,doc);
 console.log(`${organ.id.padEnd(16)} ${String(root.listNodes().filter(n=>n.getMesh()).length).padStart(4)} structures  ${before.toLocaleString().padStart(9)} -> ${triangles(root).toLocaleString().padStart(8)} tris  ${(fs.statSync(out).size/1024).toFixed(0).padStart(5)} KB  size ${size.map(v=>(v*100).toFixed(1)).join(' x ')} cm`);
}
/** Area-weighted smooth vertex normals on welded, indexed geometry (gltf-transform's normals() would unweld). */
function smoothNormals(doc,prim){
 const pos=prim.getAttribute('POSITION').getArray(),idx=prim.getIndices().getArray(),n=new Float32Array(pos.length);
 for(let t=0;t<idx.length;t+=3){const a=idx[t]*3,b=idx[t+1]*3,c=idx[t+2]*3;
  const ux=pos[b]-pos[a],uy=pos[b+1]-pos[a+1],uz=pos[b+2]-pos[a+2],vx=pos[c]-pos[a],vy=pos[c+1]-pos[a+1],vz=pos[c+2]-pos[a+2];
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;for(const k of [a,b,c]){n[k]+=nx;n[k+1]+=ny;n[k+2]+=nz;}}
 for(let i=0;i<n.length;i+=3){const l=Math.hypot(n[i],n[i+1],n[i+2])||1;n[i]/=l;n[i+1]/=l;n[i+2]/=l;}
 prim.setAttribute('NORMAL',doc.createAccessor().setType('VEC3').setArray(n).setBuffer(prim.getAttribute('POSITION').getBuffer()));
}
function triangles(root){let n=0;for(const m of root.listMeshes())for(const p of m.listPrimitives()){const i=p.getIndices();n+=(i?i.getCount():p.getAttribute('POSITION').getCount())/3;}return Math.round(n);}

await MeshoptEncoder.ready;await MeshoptSimplifier.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder});
fs.mkdirSync(OUT,{recursive:true});
for(const organ of ORGANS){if(ONLY.size&&!ONLY.has(organ.id))continue;await build(io,organ);}
