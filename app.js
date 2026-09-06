import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// 00. UI + device
const viewer = document.querySelector("#viewer");
const loadingPanel = document.querySelector("#loadingPanel");
const progressText = document.querySelector("#progressText");
const progressBar = document.querySelector("#progressBar");
const loadingDetail = document.querySelector("#loadingDetail");
const errorPanel = document.querySelector("#errorPanel");
const errorMessage = document.querySelector("#errorMessage");
const controlHint = document.querySelector("#controlHint");
const mobileLike = window.matchMedia("(pointer: coarse)").matches || Math.min(innerWidth, innerHeight) < 800;

// 01. Renderer / camera / controls
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x161211);
scene.fog = new THREE.FogExp2(0x161211, 0.006);
const renderer = new THREE.WebGLRenderer({ antialias: !mobileLike, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobileLike ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewer.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(58, 1, 0.05, 120);
camera.position.set(0, 2.25, 3.2);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 3, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.enablePan = true;
controls.screenSpacePanning = true;
controls.minDistance = 1.1;
controls.maxDistance = 5.8;
controls.minPolarAngle = THREE.MathUtils.degToRad(12);
controls.maxPolarAngle = THREE.MathUtils.degToRad(168);
controls.addEventListener("change", () => {
  controls.target.x = THREE.MathUtils.clamp(controls.target.x, -4.5, 4.5);
  controls.target.y = THREE.MathUtils.clamp(controls.target.y, 1.2, 7.8);
  controls.target.z = THREE.MathUtils.clamp(controls.target.z, -7, 7);
});
controls.update();

// 02. Free CC0 assets from Poly Haven
const PH = "https://dl.polyhaven.org/file/ph-assets/";
const A = {
  frame1: `${PH}Models/gltf/1k/fancy_picture_frame_01/fancy_picture_frame_01_1k.gltf`,
  frame2: `${PH}Models/gltf/1k/fancy_picture_frame_02/fancy_picture_frame_02_1k.gltf`,
  bust: `${PH}Models/gltf/1k/marble_bust_01/marble_bust_01_1k.gltf`,
  floorD: `${PH}Textures/jpg/1k/herringbone_parquet/herringbone_parquet_diff_1k.jpg`,
  floorN: `${PH}Textures/jpg/1k/herringbone_parquet/herringbone_parquet_nor_gl_1k.jpg`,
  floorR: `${PH}Textures/jpg/1k/herringbone_parquet/herringbone_parquet_rough_1k.jpg`,
  wallD: `${PH}Textures/jpg/1k/quatrefoil_jacquard_fabric/quatrefoil_jacquard_fabric_diff_1k.jpg`,
  wallN: `${PH}Textures/jpg/1k/quatrefoil_jacquard_fabric/quatrefoil_jacquard_fabric_nor_gl_1k.jpg`,
  wallR: `${PH}Textures/jpg/1k/quatrefoil_jacquard_fabric/quatrefoil_jacquard_fabric_rough_1k.jpg`,
  hdri: `${PH}HDRIs/hdr/1k/studio_small_09_1k.hdr`
};
const textures = new THREE.TextureLoader();
textures.setCrossOrigin("anonymous");
const gltf = new GLTFLoader();

// 03. Materials
const gold = new THREE.MeshStandardMaterial({ color: 0xb98a38, metalness: 0.82, roughness: 0.28 });
const stone = new THREE.MeshStandardMaterial({ color: 0xeee4d3, roughness: 0.55 });
const marble = new THREE.MeshStandardMaterial({ color: 0x181518, roughness: 0.3, map: marbleTexture() });
const velvet = new THREE.MeshStandardMaterial({ color: 0x6e0f1f, roughness: 0.82 });
const wallMat = new THREE.MeshStandardMaterial({ color: 0x791721, roughness: 0.82 });
const floorMat = new THREE.MeshStandardMaterial({ color: 0x9a5f2d, roughness: 0.3 });
const glass = new THREE.MeshPhysicalMaterial({ color: 0xdbeeff, transparent: true, opacity: 0.23, roughness: 0.12, side: THREE.DoubleSide, depthWrite: false });
loadPBR([A.floorD, A.floorN, A.floorR], 5.2, 7.2, floorMat);
loadPBR([A.wallD, A.wallN, A.wallR], 5, 8, wallMat);

// 04. Exact rectangular room: 4 flat walls, 4 90-degree corners
const R = { w: 18, l: 26, h: 12, t: 0.22 };
const room = new THREE.Group();
scene.add(room);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(R.w, R.l), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
room.add(floor);
const back = box(R.w, R.h, R.t, wallMat, 0, R.h / 2, -R.l / 2);
const front = box(R.w, R.h, R.t, wallMat, 0, R.h / 2, R.l / 2);
const left = box(R.t, R.h, R.l, wallMat, -R.w / 2, R.h / 2, 0);
const right = box(R.t, R.h, R.l, wallMat, R.w / 2, R.h / 2, 0);
room.add(back, front, left, right);

// 05. Marble dado + gilded rail
for (const z of [-R.l / 2 + .13, R.l / 2 - .13]) {
  room.add(box(R.w, 1.05, .14, marble, 0, .525, z), box(R.w, .09, .1, gold, 0, 1.18, z));
}
for (const x of [-R.w / 2 + .13, R.w / 2 - .13]) {
  room.add(box(.14, 1.05, R.l, marble, x, .525, 0), box(.1, .09, R.l, gold, x, 1.18, 0));
}

// 06. Pilasters and cornice
[-9.2, -4.6, 0, 4.6, 9.2].forEach(z => { pilaster(-R.w / 2 + .28, z, Math.PI / 2); pilaster(R.w / 2 - .28, z, -Math.PI / 2); });
[-5.4, 0, 5.4].forEach(x => { pilaster(x, -R.l / 2 + .28, 0); pilaster(x, R.l / 2 - .28, Math.PI); });
for (const [s, o, y, m] of [[.16,.22,11.05,gold],[.24,.32,11.23,stone],[.12,.46,11.41,gold]]) {
  room.add(box(R.w, s, s, m, 0, y, -R.l/2+o), box(R.w, s, s, m, 0, y, R.l/2-o));
  room.add(box(s, s, R.l, m, -R.w/2+o, y, 0), box(s, s, R.l, m, R.w/2-o, y, 0));
}
door(0, -R.l / 2 + .12, 0);
door(0, R.l / 2 - .12, Math.PI);

// 07. Large glazed skylight with straight grid members
const sw = R.w - 4, sl = R.l - 5, sy = R.h - .16;
const skylight = new THREE.Mesh(new THREE.PlaneGeometry(sw, sl), glass);
skylight.rotation.x = Math.PI / 2;
skylight.position.y = sy;
room.add(skylight);
for (let x = -sw/2; x <= sw/2 + .01; x += 1.35) room.add(box(.055, .12, sl, gold, x, sy-.08, 0));
for (let z = -sl/2; z <= sl/2 + .01; z += 1.55) room.add(box(sw, .12, .055, gold, 0, sy-.075, z));
room.add(box(sw+1.1,.22,.55,stone,0,sy-.12,-sl/2-.3), box(sw+1.1,.22,.55,stone,0,sy-.12,sl/2+.3));
room.add(box(.55,.22,sl,stone,-sw/2-.3,sy-.12,0), box(.55,.22,sl,stone,sw/2+.3,sy-.12,0));

// 08. Benches + plinths
bench(0, 2.4, 0); bench(-3.7, -5.2, Math.PI/2); bench(3.7, 6.0, -Math.PI/2);
const plinths = [[-6.9,-8.1],[6.9,-8.1],[-6.9,7.8],[6.9,7.8]];
plinths.forEach(([x,z]) => {
  room.add(box(1.05,.18,1.05,marble,x,.09,z), box(.76,1.22,.76,stone,x,.79,z), box(.94,.14,.94,gold,x,1.47,z));
});

// 09. Lighting
scene.add(new THREE.HemisphereLight(0xeaf2ff, 0x3a2118, 1.45));
const sun = new THREE.DirectionalLight(0xfff1d5, 4);
sun.position.set(-7,18,6); sun.target.position.set(0,1.5,-2); sun.castShadow = true;
sun.shadow.mapSize.set(mobileLike ? 1024 : 2048, mobileLike ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left:-12, right:12, top:16, bottom:-16, near:1, far:45 });
sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
scene.add(sun, sun.target);
const fill = new THREE.PointLight(0xffc27e, 35, 22, 2); fill.position.set(0,7.5,-2); scene.add(fill);
new RGBELoader().load(A.hdri, t => { t.mapping = THREE.EquirectangularReflectionMapping; scene.environment = t; }, undefined, () => {});

// 10. Detailed CC0 models
progressBar.classList.add("indeterminate");
progressText.textContent = "";
loadingDetail.textContent = "Building room and loading detailed CC0 assets…";
Promise.allSettled([addFrames(), addBusts()]).then(results => {
  const ok = results.filter(r => r.status === "fulfilled").length;
  progressBar.classList.remove("indeterminate"); progressBar.style.width = "100%"; progressText.textContent = "100%";
  loadingDetail.textContent = ok === 2 ? "Gallery ready" : `Gallery ready · ${ok}/2 detail packs loaded`;
  setTimeout(() => { loadingPanel.hidden = true; controlHint.hidden = false; }, 250);
});

async function addFrames() {
  const small = (await gltf.loadAsync(A.frame1)).scene; prep(small);
  const hero = (await gltf.loadAsync(A.frame2).catch(() => ({ scene: small.clone(true) }))).scene; prep(hero);
  const sides = [{z:-8.5,y:5.7,s:4.2},{z:-3.2,y:4.7,s:3.1},{z:2,y:5.5,s:4.5},{z:7.2,y:4.6,s:3}];
  sides.forEach((p,i) => {
    const l=small.clone(true); l.scale.setScalar(p.s); l.position.set(-R.w/2+.38,p.y,p.z); l.rotation.y=Math.PI/2; room.add(l);
    const r=small.clone(true); r.scale.setScalar(p.s*(i%2?1.08:.94)); r.position.set(R.w/2-.38,p.y+(i%2?.25:-.1),-p.z*.92); r.rotation.y=-Math.PI/2; room.add(r);
  });
  hero.scale.setScalar(hero === small ? 6.3 : 5.3); hero.position.set(0,5.7,-R.l/2+.38); room.add(hero);
  for (const x of [-4.7,4.7]) { const f=small.clone(true); f.scale.setScalar(3.3); f.position.set(x,4.8,-R.l/2+.38); room.add(f); }
  for (const x of [-4.8,4.8]) { const f=small.clone(true); f.scale.setScalar(3.6); f.position.set(x,5.1,R.l/2-.38); f.rotation.y=Math.PI; room.add(f); }
}

async function addBusts() {
  const b=(await gltf.loadAsync(A.bust)).scene; prep(b);
  [[-6.9,-8.1,.35],[6.9,-8.1,-.35],[-6.9,7.8,2.65],[6.9,7.8,-2.65]].forEach(([x,z,ry]) => {
    const c=b.clone(true); c.scale.setScalar(2); c.position.set(x,1.52,z); c.rotation.y=ry; room.add(c);
  });
}

// 11. Helpers
function box(x,y,z,mat,px=0,py=0,pz=0) { const m=new THREE.Mesh(new THREE.BoxGeometry(x,y,z),mat); m.position.set(px,py,pz); m.castShadow=true; m.receiveShadow=true; return m; }
function pilaster(x,z,ry) {
  const g=new THREE.Group(); g.add(box(.48,8.25,.28,stone,0,5.18,0),box(.72,.2,.42,gold,0,1.15,0),box(.62,.26,.36,stone,0,1.38,0),box(.82,.18,.45,gold,0,9.33,0),box(.68,.26,.39,stone,0,9.56,0));
  for(const sx of [-.24,.24]) { const o=new THREE.Mesh(new THREE.CylinderGeometry(.11,.16,.22,12),gold); o.rotation.x=Math.PI/2; o.position.set(sx,9.71,.17); o.castShadow=true; g.add(o); }
  g.position.set(x,0,z); g.rotation.y=ry; room.add(g);
}
function door(x,z,ry) {
  const g=new THREE.Group(); const dm=new THREE.MeshStandardMaterial({color:0x17100d,roughness:.48});
  g.add(box(2.45,4.3,.08,dm,0,3.12,0),box(.28,4.65,.22,marble,-1.38,3.12,0),box(.28,4.65,.22,marble,1.38,3.12,0),box(3.1,.34,.24,gold,0,5.47,0));
  g.position.set(x,0,z); g.rotation.y=ry; room.add(g);
}
function bench(x,z,ry) {
  const g=new THREE.Group(); const c=new THREE.Mesh(new RoundedBoxGeometry(3,.42,1.05,5,.12),velvet); c.position.y=.93; c.castShadow=true; g.add(c,box(2.75,.18,.82,gold,0,.63,0));
  for(const sx of [-1.23,1.23]) for(const sz of [-.35,.35]) { const l=new THREE.Mesh(new THREE.CylinderGeometry(.07,.11,.52,12),gold); l.position.set(sx,.35,sz); l.castShadow=true; g.add(l); }
  for(const bx of [-1,-.5,0,.5,1]) for(const bz of [-.25,0,.25]) { const b=new THREE.Mesh(new THREE.SphereGeometry(.035,10,6),gold); b.scale.y=.35; b.position.set(bx,1.15,bz); g.add(b); }
  g.position.set(x,0,z); g.rotation.y=ry; room.add(g);
}
function prep(root) { root.traverse(o => { if(!o.isMesh) return; o.castShadow=true; o.receiveShadow=true; const ms=Array.isArray(o.material)?o.material:[o.material]; ms.forEach(m=>{ if(m?.map)m.map.colorSpace=THREE.SRGBColorSpace; }); }); }
async function loadPBR(urls,rx,ry,mat) {
  try { const [d,n,r]=await Promise.all(urls.map(u=>textures.loadAsync(u))); for(const t of [d,n,r]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);} d.colorSpace=THREE.SRGBColorSpace; mat.map=d;mat.normalMap=n;mat.roughnessMap=r;mat.needsUpdate=true; } catch(e){ console.warn("Using fallback material",e); }
}
function marbleTexture() {
  const c=document.createElement("canvas");c.width=c.height=512;const x=c.getContext("2d");x.fillStyle="#171518";x.fillRect(0,0,512,512);let s=43871;const rnd=()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  for(let i=0;i<65;i++){x.beginPath();let y=rnd()*512;x.moveTo(-20,y);for(let px=0;px<=552;px+=28){y+=(rnd()-.5)*26;x.lineTo(px,y)}x.strokeStyle=`rgba(235,225,210,${.025+rnd()*.065})`;x.lineWidth=.6+rnd()*2.2;x.stroke();}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2.6,2.6);t.colorSpace=THREE.SRGBColorSpace;return t;
}

// 12. Resize / render
function resize(){const w=Math.max(viewer.clientWidth,1),h=Math.max(viewer.clientHeight,1);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
addEventListener("resize",resize,{passive:true});resize();
function fail(message,error){console.error(message,error);errorMessage.textContent=message;errorPanel.hidden=false;loadingPanel.hidden=true;}
window.addEventListener("error",e=>{if(!renderer)fail("The gallery could not initialise.",e.error)});
function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera)}
animate();
