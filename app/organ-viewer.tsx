import {useEffect,useMemo,useRef,useState} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {ArrowLeft,ChevronDown,ChevronUp,Eye,EyeOff,Focus,Info,Pause,RotateCcw,RotateCw,Scissors,X} from 'lucide-react';
import {Slider} from '@/components/ui/slider';
import {PointerTap} from './pointer-tap';
import type {OrganDef,OrganGroup} from './organs';

/** Engine handle used by the React UI. */
interface Engine {
 select(groupId:string|null,name?:string|null,focus?:boolean):void;
 setExplode(v:number):void;setInside(on:boolean):void;setLabels(on:boolean):void;setRotate(on:boolean):void;setIsolate(on:boolean):void;reset():void;
}
interface Selection {groupId:string;name:string}
interface Props {organ:OrganDef;onClose:()=>void;thumbnail?:boolean;
 /** Open straight into the inside view (deep link ?inside=1). */
 startInside?:boolean}

const BLUE=new T.Color('#1A6BFF');
/** Shader chunk: soft procedural tissue relief + colour mottling in organ space, so untextured meshes read as tissue. */
const NOISE=`
varying vec3 vOrganPos;
uniform float uBump;uniform float uBumpScale;uniform float uMottle;
float oh(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float on(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(oh(i),oh(i+vec3(1,0,0)),f.x),mix(oh(i+vec3(0,1,0)),oh(i+vec3(1,1,0)),f.x),f.y),mix(mix(oh(i+vec3(0,0,1)),oh(i+vec3(1,0,1)),f.x),mix(oh(i+vec3(0,1,1)),oh(i+vec3(1,1,1)),f.x),f.y),f.z);}
float ofbm(vec3 p){return on(p)*.68+on(p*2.37+3.1)*.32;}
`;

export default function OrganViewer({organ,onClose,thumbnail=false,startInside=false}:Props){
 const host=useRef<HTMLDivElement>(null),pinLayer=useRef<HTMLDivElement>(null),engine=useRef<Engine|null>(null);
 const [progress,setProgress]=useState(0),[error,setError]=useState(''),[ready,setReady]=useState(false);
 const [selected,setSelected]=useState<Selection|null>(null),[explode,setExplode]=useState(0),[inside,setInside]=useState(false),[labels,setLabels]=useState(true),[rotate,setRotate]=useState(false),[isolate,setIsolate]=useState(false),[cardOpen,setCardOpen]=useState(false);
 const groups=useMemo(()=>organ.groups.filter(g=>!g.hidden),[organ]);
 const visibleGroups=useMemo(()=>groups.filter(g=>{if(explode>=.5&&organ.shells?.includes(g.id))return false;if(explode>.02&&organ.explodeReveal?.includes(g.id))return true;if(!organ.inside||organ.inside.mode!=='hide')return true;if(inside)return !organ.inside.hide?.includes(g.id);return !organ.inside.show?.includes(g.id);}),[groups,organ,inside,explode]);
 const selectedGroup=groups.find(g=>g.id===selected?.groupId);

 useEffect(()=>{
  const el=host.current!,layer=pinLayer.current;let disposed=false,frame=0,dirty=true;
  setProgress(0);setError('');setReady(false);setSelected(null);setExplode(0);setInside(false);setIsolate(false);setRotate(false);
  let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:thumbnail,powerPreference:'high-performance'});}catch{setError('This browser could not start the 3D viewer. Please try a browser with WebGL enabled.');return;}
  renderer.setClearColor(0x000000,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;renderer.localClippingEnabled=true;
  el.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label',`Interactive 3D ${organ.name.toLowerCase()}. Drag to rotate, pinch or scroll to zoom, tap a structure to identify it.`);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(30,1,.01,60),controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=.25;controls.maxDistance=8;controls.rotateSpeed=.8;controls.addEventListener('change',()=>{dirty=true;lastMove=performance.now();});
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight(0xffffff,0x8d939b,.55));scene.add(camera);
  const key=new T.DirectionalLight(0xfff3ea,2.1);key.position.set(-1.6,2.2,2.4);camera.add(key);
  const fill=new T.DirectionalLight(0xffe9e2,.55);fill.position.set(2,-1.2,1.5);camera.add(fill);
  const rim=new T.DirectionalLight(0xe6eeff,1.25);rim.position.set(1.5,1.4,-2.6);scene.add(rim);
  const root=new T.Group();scene.add(root);
  const clip=new T.Plane(new T.Vector3(...(organ.inside?.normal??[0,0,-1])),organ.inside?.constant??0);

  // ---------- state mirrored from React ----------
  let explodeTarget=0,explodeNow=0,insideOn=false,labelsOn=true,isolateOn=false,selectedGroupId:string|null=null,lastMove=0;
  type Part={mesh:T.Mesh;name:string;group:OrganGroup;center:T.Vector3;radius:number;box:T.Box3;dir:T.Vector3;reach:number};
  const parts:Part[]=[],materials=new Map<string,T.MeshPhysicalMaterial>(),groupParts=new Map<string,Part[]>(),groupById=new Map<string,OrganGroup>(organ.groups.map(g=>[g.id,g]));
  const baseOpacity=(g:OrganGroup)=>g.opacity??1;
  const shells=new Set(organ.shells??[]),reveal=new Set(organ.explodeReveal??[]);
  /** Shells fade out over the first half of the explode slider. */
  const shellFade=()=>1-T.MathUtils.smoothstep(explodeNow,.06,.5);
  const opacityFor=(g:OrganGroup)=>{let o=baseOpacity(g);if(shells.has(g.id))o*=shellFade();if(isolateOn&&selectedGroupId!==null&&g.id!==selectedGroupId)o=Math.min(o,.07);return o;};

  const materialFor=(g:OrganGroup)=>{
   let m=materials.get(g.id);if(m)return m;
   const color=new T.Color(g.color),opacity=baseOpacity(g),glassy=opacity<.5;
   m=new T.MeshPhysicalMaterial({color,roughness:glassy?.08:.5,metalness:0,clearcoat:glassy?1:.35,clearcoatRoughness:glassy?.05:.35,sheen:glassy?0:.3,sheenRoughness:.6,sheenColor:color.clone().lerp(new T.Color('#ffffff'),.5),side:T.DoubleSide,transparent:opacity<1,opacity,depthWrite:opacity>=.5,envMapIntensity:.72,emissive:BLUE,emissiveIntensity:0});
   const strong=/vein|arter|aorta|vena|trunk|tract|ligament|valve|cusp|leaflet|lens|cornea|humor|vitreous|bronch|trachea|cartilage/i.test(g.label)||glassy;
   const uniforms={uBump:{value:strong?.0004:.0016},uBumpScale:{value:organ.id==='brain'?52:organ.id==='liver'?34:44},uMottle:{value:glassy?0:.14}};
   m.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='varying vec3 vOrganPos;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvOrganPos=position;');
    shader.fragmentShader=NOISE+shader.fragmentShader
     .replace('#include <color_fragment>','#include <color_fragment>\nfloat mott=on(vOrganPos*uBumpScale*.22);diffuseColor.rgb*=1.0+uMottle*(mott-.5);')
     .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n{float h=ofbm(vOrganPos*uBumpScale)*uBump;vec3 dpx=dFdx(-vViewPosition),dpy=dFdy(-vViewPosition);float dhx=dFdx(h),dhy=dFdy(h);vec3 r1=cross(dpy,normal),r2=cross(normal,dpx);float det=dot(dpx,r1);vec3 grad=sign(det)*(dhx*r1+dhy*r2);normal=normalize(abs(det)*normal-grad);}');
   };
   m.customProgramCacheKey=()=>`organ-${strong}-${glassy}`;
   materials.set(g.id,m);groupById.set(g.id,g);return m;
  };

  // ---------- pins ----------
  interface Pin {group:OrganGroup;part:Part;local:T.Vector3;el:HTMLButtonElement;visible:boolean}
  const pins:Pin[]=[];
  const dirFromView=(v:{az:number;el:number})=>{const a=T.MathUtils.degToRad(v.az),e=T.MathUtils.degToRad(v.el);return new T.Vector3(Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)).normalize();};
  /** Front-most vertex near the middle of a structure, seen from a view direction (and on the kept side of the cut). */
  const anchorFor=(part:Part,view:T.Vector3,plane:T.Plane|null)=>{
   const pos=part.mesh.geometry.getAttribute('position') as T.BufferAttribute,v=new T.Vector3(),best=new T.Vector3(),c=part.center;let score=-Infinity;
   const step=Math.max(1,Math.floor(pos.count/4000));
   for(let i=0;i<pos.count;i+=step){v.fromBufferAttribute(pos,i);if(plane&&plane.distanceToPoint(v)<.004)continue;const d=v.clone().sub(c),along=d.dot(view),perp=d.clone().addScaledVector(view,-along).length();const s=along-perp*1.6;if(s>score){score=s;best.copy(v);}}
   return score===-Infinity?c.clone():best;
  };
  const placeAnchors=()=>{const view=dirFromView(insideOn&&organ.inside?.view?organ.inside.view:organ.view),plane=insideOn&&organ.inside?.mode==='clip'?clip:null;for(const p of pins)p.local.copy(anchorFor(p.part,view,plane));};

  // ---------- visibility and materials ----------
  const groupShown=(g:OrganGroup)=>{if(g.hidden)return false;if(reveal.has(g.id)&&explodeNow>.02)return true;const ins=organ.inside;if(!ins||ins.mode!=='hide')return true;return insideOn?!ins.hide?.includes(g.id):!ins.show?.includes(g.id);};
  const applyState=()=>{
   for(const [id,m] of materials){
    const g=groupById.get(id)!,opacity=opacityFor(g);
    const transparent=opacity<1;if(m.transparent!==transparent){m.transparent=transparent;m.needsUpdate=true;}
    m.opacity=opacity;m.depthWrite=opacity>=.5;m.emissiveIntensity=id===selectedGroupId?.28:0;
    const planes=insideOn&&organ.inside?.mode==='clip'?[clip]:[];if((m.clippingPlanes?.length??0)!==planes.length){m.clippingPlanes=planes;m.needsUpdate=true;}
   }
   for(const p of parts)p.mesh.visible=groupShown(p.group)&&opacityFor(p.group)>.01;
   for(const pin of pins){pin.el.classList.toggle('selected',pin.group.id===selectedGroupId);}
   occlusionDue=0;pinCheckPending=true;dirty=true;
  };

  // ---------- camera ----------
  let fitRadius=.6;const goal={active:false,target:new T.Vector3(),position:new T.Vector3()};
  // A touch or drag always wins over the automatic framing.
  let dragging=false;controls.addEventListener('start',()=>{dragging=true;goal.active=false;});controls.addEventListener('end',()=>{dragging=false;});
  const layout=()=>{const w=el.clientWidth,h=el.clientHeight,mobile=w<768;return mobile?{left:12,right:w-12,top:118,bottom:h-196}:{left:24,right:w-392,top:96,bottom:h-128};};
  const applyViewOffset=()=>{const w=el.clientWidth,h=el.clientHeight,r=layout();if(thumbnail){camera.clearViewOffset();return;}camera.setViewOffset(w,h,w/2-(r.left+r.right)/2,h/2-(r.top+r.bottom)/2,w,h);};
  const distanceFor=(radius:number)=>{const w=el.clientWidth,h=el.clientHeight,r=thumbnail?{left:0,right:w,top:0,bottom:h}:layout(),availW=Math.max(140,r.right-r.left),availH=Math.max(140,r.bottom-r.top);const fovV=T.MathUtils.degToRad(camera.fov),fovH=2*Math.atan(Math.tan(fovV/2)*camera.aspect);const fv=radius/Math.sin(fovV/2)*h/availH,fh=radius/Math.sin(fovH/2)*w/availW;return Math.max(fv,fh)*(thumbnail?.96:1.02);};
  const flyTo=(target:T.Vector3,radius:number,view?:{az:number;el:number},instant=false)=>{
   const dir=view?dirFromView(view):camera.position.clone().sub(controls.target).normalize();
   goal.target.copy(target);goal.position.copy(target).addScaledVector(dir,distanceFor(radius));
   if(instant){controls.target.copy(goal.target);camera.position.copy(goal.position);controls.update();goal.active=false;}else goal.active=true;dirty=true;
  };
  const home=(instant=false)=>flyTo(new T.Vector3(),fitRadius,insideOn&&organ.inside?.view?organ.inside.view:organ.view,instant);
  const resize=()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;renderer.setPixelRatio(Math.min(devicePixelRatio,w<768?1.75:2));renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();applyViewOffset();if(!goal.active)home(true);dirty=true;};
  const observer=new ResizeObserver(resize);observer.observe(el);

  // ---------- load ----------
  const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(`/organs/${organ.id}.glb`,gltf=>{
   if(disposed)return;
   gltf.scene.traverse(o=>{
    if(!(o instanceof T.Mesh))return;
    const name=(o.userData?.name as string|undefined)??o.name.replace(/_\d+$/,'').replace(/_/g,' ');
    const group=organ.groups.find(g=>g.match.test(name))??{id:'other',label:'Other structures',match:/./,color:'#c9a99a'};
    // Bake the node transform (KHR_mesh_quantization stores a dequantizing matrix per node) into float geometry,
    // so every part lives in organ space with an identity transform; explode offsets then become plain positions.
    o.updateWorldMatrix(true,false);const mw=o.matrixWorld.clone(),nm=new T.Matrix3().getNormalMatrix(mw),v=new T.Vector3();
    const src=o.geometry.getAttribute('position') as T.BufferAttribute,P=new Float32Array(src.count*3);for(let i=0;i<src.count;i++){v.fromBufferAttribute(src,i).applyMatrix4(mw);P[i*3]=v.x;P[i*3+1]=v.y;P[i*3+2]=v.z;}
    o.geometry.setAttribute('position',new T.BufferAttribute(P,3));
    const sn=o.geometry.getAttribute('normal') as T.BufferAttribute|undefined;if(sn){const N=new Float32Array(sn.count*3);for(let i=0;i<sn.count;i++){v.fromBufferAttribute(sn,i).applyMatrix3(nm).normalize();N[i*3]=v.x;N[i*3+1]=v.y;N[i*3+2]=v.z;}o.geometry.setAttribute('normal',new T.BufferAttribute(N,3));}
    o.position.set(0,0,0);o.quaternion.identity();o.scale.set(1,1,1);o.updateMatrix();
    o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();
    const center=o.geometry.boundingBox!.getCenter(new T.Vector3()),radius=o.geometry.boundingSphere!.radius;
    o.material=materialFor(group);o.renderOrder=baseOpacity(group)<1?2:0;
    const part={mesh:o,name,group,center,radius,box:o.geometry.boundingBox!.clone(),dir:new T.Vector3(),reach:0};parts.push(part);groupParts.set(group.id,[...(groupParts.get(group.id)??[]),part]);
   });
   for(const p of parts)root.add(p.mesh);
   // Explode directions: straight out from the organ centre; pieces sitting at the centre get evenly spread directions.
   parts.forEach((p,i)=>{const len=p.center.length();if(len>.03)p.dir.copy(p.center).divideScalar(len);else{const y=1-2*(i+.5)/parts.length,r=Math.sqrt(1-y*y),a=i*2.39996;p.dir.set(Math.cos(a)*r,y,Math.sin(a)*r);}
    p.reach=len*1.15+.24;});
   const box=new T.Box3();for(const p of parts)if(!p.group.hidden)box.expandByObject(p.mesh);
   fitRadius=box.getBoundingSphere(new T.Sphere()).radius*.84;
   // Pins (not in thumbnails).
   if(!thumbnail&&layer){for(const g of organ.groups){if(!g.pin||g.hidden)continue;const candidates=(groupParts.get(g.id)??[]).filter(p=>g.pin!.test(p.name)).sort((a,b)=>b.radius-a.radius);const part=candidates[0];if(!part)continue;
    const b=document.createElement('button');b.type='button';b.className='organ-pin';b.style.setProperty('--pin',g.color);b.setAttribute('aria-label',g.label);b.innerHTML='<span class="organ-pin-dot"></span><span class="organ-pin-label"></span>';(b.querySelector('.organ-pin-label') as HTMLElement).textContent=g.label;
    b.addEventListener('click',e=>{e.stopPropagation();api.select(g.id,null,false);});layer.appendChild(b);pins.push({group:g,part,local:new T.Vector3(),el:b,visible:false});}}
   if(startInside&&organ.inside){insideOn=true;setInside(true);}
   placeAnchors();applyState();resize();home(true);setProgress(100);setReady(true);dirty=true;
   if(thumbnail)requestAnimationFrame(()=>requestAnimationFrame(()=>{document.body.dataset.organReady='1';}));
  },e=>{if(e.total)setProgress(Math.round(e.loaded/e.total*95));},()=>{if(!disposed)setError(`The ${organ.name.toLowerCase()} model could not be loaded. Please check your connection and try again.`);});

  // ---------- picking and hover ----------
  const raycaster=new T.Raycaster(),pointer=new T.Vector2(),tap=new PointerTap();
  const hover=document.createElement('div');hover.className='part-hover organ-hover';hover.hidden=true;el.appendChild(hover);
  const pick=(x:number,y:number)=>{
   const rect=renderer.domElement.getBoundingClientRect();pointer.set((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
   const hits=raycaster.intersectObjects(parts.filter(p=>p.mesh.visible).map(p=>p.mesh),false).filter(h=>!(insideOn&&organ.inside?.mode==='clip'&&clip.distanceToPoint(h.point)<0));
   const solid=hits.find(h=>{const m=(h.object as T.Mesh).material as T.Material;return m.opacity>.3;});return (solid??hits[0])?.object as T.Mesh|undefined;
  };
  const partOf=(mesh?:T.Mesh)=>parts.find(p=>p.mesh===mesh);
  const down=(e:PointerEvent)=>{hover.hidden=true;tap.down(e.pointerId,e.clientX,e.clientY,e.pointerType==='touch'?12:5);};
  let hoverAt=0;
  const move=(e:PointerEvent)=>{tap.move(e.pointerId,e.clientX,e.clientY);if(e.buttons||e.pointerType==='touch'||!ready2)return;const now=performance.now();if(now-hoverAt<45)return;hoverAt=now;const p=partOf(pick(e.clientX,e.clientY)),rect=el.getBoundingClientRect();hover.hidden=!p;renderer.domElement.style.cursor=p?'pointer':'grab';if(p){hover.textContent=p.name;const x=e.clientX-rect.left,y=e.clientY-rect.top;hover.style.left=`${Math.max(8,Math.min(x+14,el.clientWidth-260))}px`;hover.style.top=`${Math.max(8,Math.min(y+18,el.clientHeight-55))}px`;}};
  const up=(e:PointerEvent)=>{if(!tap.up(e.pointerId,e.clientX,e.clientY)||!ready2)return;const p=partOf(pick(e.clientX,e.clientY));if(p)api.select(p.group.id,p.name,false);else api.select(null);};
  const cancel=(e:PointerEvent)=>tap.cancel(e.pointerId);const leave=()=>{hover.hidden=true;};
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',cancel);renderer.domElement.addEventListener('pointerleave',leave);
  let ready2=false;

  // ---------- API ----------
  const groupBounds=(id:string)=>{const box=new T.Box3();for(const p of groupParts.get(id)??[])if(p.mesh.visible)box.expandByObject(p.mesh);return box;};
  const api:Engine={
   select(groupId,name,focus){selectedGroupId=groupId;if(!groupId){isolateOn=false;setIsolate(false);}const g=organ.groups.find(x=>x.id===groupId);setSelected(g?{groupId:g.id,name:name??g.label}:null);applyState();
    if(focus&&g){const box=groupBounds(g.id);if(!box.isEmpty()){const s=box.getBoundingSphere(new T.Sphere());flyTo(s.center,Math.max(s.radius,.14));}}},
   setExplode(v){explodeTarget=v;dirty=true;},
   setInside(on){insideOn=on;applyState();placeAnchors();home();},
   setLabels(on){labelsOn=on;layer?.classList.toggle('hidden',!on);dirty=true;},
   setRotate(on){controls.autoRotate=on;controls.autoRotateSpeed=1.1;dirty=true;},
   setIsolate(on){isolateOn=on;applyState();},
   reset(){selectedGroupId=null;isolateOn=false;insideOn=false;explodeTarget=0;controls.autoRotate=false;applyState();placeAnchors();home();},
  };
  engine.current=api;

  // ---------- render loop ----------
  const clock=new T.Clock(),tmp=new T.Vector3(),proj=new T.Vector3();let occlusionDue=0;
  let pinCheckPending=true;
  const updatePins=(now:number,canCheck:boolean)=>{
   if(!layer||!pins.length)return;
   const w=el.clientWidth,h=el.clientHeight,checkOcclusion=canCheck&&now>=occlusionDue;if(!checkOcclusion)pinCheckPending=true;
   const visibleMeshes=checkOcclusion?parts.filter(p=>p.mesh.visible&&(p.mesh.material as T.Material).opacity>.3).map(p=>p.mesh):[];
   for(const pin of pins){
    tmp.copy(pin.local).add(pin.part.mesh.position);
    let show=labelsOn&&pin.part.mesh.visible&&!(insideOn&&organ.inside?.mode==='clip'&&clip.distanceToPoint(tmp)<-.002);
    if(show&&isolateOn&&selectedGroupId&&pin.group.id!==selectedGroupId)show=false;
    if(show&&checkOcclusion){const dir=tmp.clone().sub(camera.position),dist=dir.length();raycaster.set(camera.position,dir.normalize());raycaster.far=dist;
     const hit=raycaster.intersectObjects(visibleMeshes,false).find(x=>!(insideOn&&organ.inside?.mode==='clip'&&clip.distanceToPoint(x.point)<0));raycaster.far=Infinity;
     pin.visible=!hit||hit.distance>dist-fitRadius*.035||(hit.object===pin.part.mesh);}
    show=show&&pin.visible;
    proj.copy(tmp).project(camera);const x=(proj.x+1)/2*w,y=(1-proj.y)/2*h;
    pin.el.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;pin.el.classList.toggle('shown',show&&proj.z<1);
   }
   if(checkOcclusion){occlusionDue=now+180;pinCheckPending=false;}
  };
  const animate=()=>{
   if(disposed)return;frame=requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05),now=performance.now();
   if(Math.abs(explodeNow-explodeTarget)>.0005){explodeNow=T.MathUtils.damp(explodeNow,explodeTarget,7,dt);if(Math.abs(explodeNow-explodeTarget)<.0005)explodeNow=explodeTarget;
    // Full separation: each piece travels out along its direction by more than its distance from the centre (plus a fixed gap),
    // so neighbours spread apart and central pieces leave the middle too.
    const k=explodeNow*organ.explode;
    for(const p of parts)p.mesh.position.copy(p.dir).multiplyScalar(p.reach*k);
    applyState();
    // Keep every piece in frame: aim at the middle of the exploded set and back off to fit its bounds.
    const bounds=new T.Box3();for(const p of parts)if(p.mesh.visible)bounds.union(p.box.clone().translate(p.mesh.position));
    const sphere=bounds.isEmpty()?new T.Sphere(new T.Vector3(),fitRadius):bounds.getBoundingSphere(new T.Sphere());
    const blend=T.MathUtils.smoothstep(explodeNow,0,.25),aim=sphere.center.clone().multiplyScalar(blend),radius=T.MathUtils.lerp(fitRadius,Math.max(fitRadius,sphere.radius*1.02),blend);
    const dir=camera.position.clone().sub(controls.target).normalize(),distance=distanceFor(radius);
    // The zoom-out limit grows with the spread, so the camera can always reach the framing it aims for.
    controls.maxDistance=Math.max(8,distance*1.25);
    if(!dragging){goal.target.copy(aim);goal.position.copy(aim).addScaledVector(dir,distance);goal.active=true;}
    occlusionDue=0;dirty=true;}
   if(goal.active){controls.target.lerp(goal.target,1-Math.exp(-dt*7));camera.position.lerp(goal.position,1-Math.exp(-dt*7));if(camera.position.distanceTo(goal.position)<.002&&controls.target.distanceTo(goal.target)<.002)goal.active=false;dirty=true;lastMove=now;}
   controls.update();if(controls.autoRotate)dirty=true;
   const moving=now<lastMove+150;
   if(dirty){renderer.render(scene,camera);dirty=false;updatePins(now,!moving);}
   else if(pinCheckPending&&!moving&&now>=occlusionDue)updatePins(now,true);
  };
  animate();
  ready2=true;
  const lost=(e:Event)=>{e.preventDefault();setError('The 3D view was paused by your device. Go back and reopen the organ to continue.');};renderer.domElement.addEventListener('webglcontextlost',lost);
  return()=>{disposed=true;engine.current=null;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();
   for(const p of parts)p.mesh.geometry.dispose();materials.forEach(m=>m.dispose());env.dispose();pins.forEach(p=>p.el.remove());hover.remove();renderer.dispose();renderer.domElement.remove();};
 },[organ,thumbnail,startInside]);

 useEffect(()=>{engine.current?.setExplode(explode);},[explode]);
 useEffect(()=>{if(thumbnail)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(selected)engine.current?.select(null);else onClose();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[selected,onClose,thumbnail]);

 if(thumbnail)return <div className="organ-view organ-thumb"><div className="organ-canvas" ref={host}/><div ref={pinLayer} hidden/></div>;
 const toggleInside=()=>{const next=!inside;setInside(next);engine.current?.setInside(next);if(selected&&organ.inside?.mode==='hide'){const g=organ.groups.find(x=>x.id===selected.groupId);if(g&&(next?organ.inside.hide?.includes(g.id):organ.inside.show?.includes(g.id)))engine.current?.select(null);}};
 const reset=()=>{setExplode(0);setInside(false);setIsolate(false);setRotate(false);setSelected(null);engine.current?.reset();};
 return <div className="organ-view" role="dialog" aria-modal="true" aria-label={`3D ${organ.name}`}>
  <div className="organ-canvas" ref={host}/>
  <div className={`organ-pins ${labels?'':'hidden'}`} ref={pinLayer}/>
  <header className="organ-top">
   <button type="button" className="organ-back" onClick={onClose} aria-label="Back to the full body"><ArrowLeft size={18}/><span>Back to body</span></button>
   <div className="organ-heading"><span className="eyebrow"><span className="status-dot"/> 3D ORGAN VIEW</span><h2>{organ.name}</h2></div>
  </header>
  <aside className={`organ-card glass ${cardOpen?'open':''}`} aria-label={`${organ.name} facts and structures`}>
   <button type="button" className="organ-card-handle" onClick={()=>setCardOpen(o=>!o)} aria-expanded={cardOpen}>
    <span className="organ-card-handle-text"><strong>{selected?selected.name:organ.name}</strong><span>{selected?selectedGroup?.label!==selected.name?selectedGroup?.label:'Structure':`${organ.latin} · facts & structures`}</span></span>{cardOpen?<ChevronDown size={18}/>:<ChevronUp size={18}/>}
   </button>
   <div className="organ-card-body">
    {selected&&selectedGroup?<section className="organ-selected">
     <div className="organ-selected-head"><span className="organ-swatch" style={{background:selectedGroup.color}}/><div><div className="eyebrow">STRUCTURE</div><h3>{selected.name}</h3>{selected.name!==selectedGroup.label&&<p className="organ-selected-group">{selectedGroup.label}</p>}</div><button type="button" className="organ-icon-btn" aria-label="Clear selection" onClick={()=>engine.current?.select(null)}><X size={16}/></button></div>
     {selectedGroup.description&&<p className="organ-selected-desc">{selectedGroup.description}</p>}
     <div className="organ-selected-actions"><button type="button" className={`organ-chip ${isolate?'active':''}`} onClick={()=>{const n=!isolate;setIsolate(n);engine.current?.setIsolate(n);}}><Focus size={14}/>{isolate?'Show everything':'Isolate'}</button><button type="button" className="organ-chip" onClick={()=>engine.current?.select(selectedGroup.id,selected.name,true)}><Eye size={14}/>Zoom to it</button></div>
    </section>:<section className="organ-intro">
     <div className="organ-title-row"><img className="organ-title-thumb" src={`/organs/thumbs/${organ.id}.webp`} alt="" width="52" height="52"/><div><h3>{organ.name}</h3><span className="organ-latin">{organ.latin}</span></div></div>
     <p className="organ-summary">{organ.summary}</p>
     <dl className="organ-facts">{organ.facts.map(f=><div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>
     <p className="organ-note"><Info size={15}/><span><strong>High yield · </strong>{organ.note}</span></p>
    </section>}
    <section className="organ-structures"><h4>Structures <span>{visibleGroups.length}</span></h4>
     <ul>{visibleGroups.map(g=><li key={g.id}><button type="button" className={selected?.groupId===g.id?'active':''} onClick={()=>engine.current?.select(selected?.groupId===g.id?null:g.id,null,selected?.groupId!==g.id)}><span className="organ-swatch" style={{background:g.color}}/><span className="organ-structure-name">{g.label}</span></button></li>)}</ul>
    </section>
    <p className="organ-source">{organ.source}</p>
   </div>
  </aside>
  <div className="organ-dock glass">
   <div className="explode-control"><div className="explode-label"><label id="organ-explode-label">Explode</label><output>{Math.round(explode*100)}<span>%</span></output></div><Slider aria-labelledby="organ-explode-label" min={0} max={100} step={1} value={[explode*100]} onValueChange={v=>setExplode((Array.isArray(v)?v[0]:v)/100)}/></div>
   <div className="organ-tools">
    {organ.inside&&<button type="button" className={`organ-tool ${inside?'active':''}`} onClick={toggleInside} aria-pressed={inside}><Scissors size={17}/><span>{inside?organ.inside.offLabel:organ.inside.label}</span></button>}
    <button type="button" className={`organ-tool ${labels?'active':''}`} onClick={()=>{const n=!labels;setLabels(n);engine.current?.setLabels(n);}} aria-pressed={labels} aria-label={labels?'Hide labels':'Show labels'}>{labels?<Eye size={17}/>:<EyeOff size={17}/>}<span>Labels</span></button>
    <button type="button" className={`organ-tool ${rotate?'active':''}`} onClick={()=>{const n=!rotate;setRotate(n);engine.current?.setRotate(n);}} aria-pressed={rotate} aria-label={rotate?'Stop rotating':'Rotate'}>{rotate?<Pause size={17}/>:<RotateCw size={17}/>}<span>Rotate</span></button>
    <button type="button" className="organ-tool" onClick={reset} aria-label="Reset view"><RotateCcw size={17}/><span>Reset</span></button>
   </div>
  </div>
  {!ready&&!error&&<div className="loading glass organ-loading" role="status"><div><strong>Loading the {organ.name.toLowerCase()}</strong><span>{progress}%</span><div className="loading-track"><i style={{width:`${progress}%`}}/></div></div></div>}
  {error&&<div className="loading glass error organ-loading" role="alert"><p>{error}</p><button type="button" className="organ-chip" onClick={onClose}>Back to body</button></div>}
 </div>;
}
