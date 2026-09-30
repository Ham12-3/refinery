import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Kit } from './kit.js';
import { UNITS, buildSite, tickFlames } from './units.js';
import { createEnvironment } from './env.js';

const gsap = window.gsap;
const $ = (s) => document.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 760px)').matches;
const instant = new URLSearchParams(location.search).has('instant'); // test aid: skip camera flights

/* ------------------------------------------------------------------ renderer, camera, post */
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const PR = Math.min(devicePixelRatio, mobile ? 1.5 : 1.75);
renderer.setPixelRatio(PR);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.8, 16000);
const OVERVIEW = { target: new THREE.Vector3(10, 0, -70), dir: new THREE.Vector3(0.62, 0.52, 0.78).normalize(), dist: mobile ? 1150 : 820 };
camera.position.copy(OVERVIEW.target).addScaledVector(OVERVIEW.dir, OVERVIEW.dist * 1.6);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.maxPolarAngle = Math.PI * 0.475;
controls.minDistance = 6;
controls.maxDistance = 1600;
controls.zoomSpeed = 0.9;
controls.target.copy(OVERVIEW.target);
controls.autoRotateSpeed = 0.35;

const env = createEnvironment(renderer, scene);
env.setMode('day');

const rt = new THREE.WebGLRenderTarget(innerWidth * PR, innerHeight * PR, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(PR);
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.5, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ------------------------------------------------------------------ build the plant */
const lampPositions = [];
const emitters = [];
const spinners = [];
const flickers = [];
const glassMats = [];
const pickables = [];

function absorb(kit, group) {
  group.updateMatrixWorld(true);
  const o = group.position;
  kit.lamps.forEach((p) => lampPositions.push(p.clone().add(o)));
  kit.emitters.forEach((e) => emitters.push({ ...e, p: e.p.clone().add(o) }));
  kit.dynamic.forEach((d) => {
    if (d.userData.spin) spinners.push(d);
    if (d.isPointLight && d.userData.flicker) flickers.push(d);
  });
  if (kit.mats.glass) glassMats.push(kit.mats.glass);
}

async function build() {
  const steps = UNITS.length + 1;
  let done = 0;
  const tick = async (label) => {
    done++;
    $('#loader-fill').style.width = `${(done / steps) * 100}%`;
    $('#loader-label').textContent = label;
    await new Promise((r) => setTimeout(r, 16));
  };
  const site = new Kit('site');
  buildSite(site);
  const sg = site.build();
  scene.add(sg);
  absorb(site, sg);
  await tick('Site and roads');

  for (const u of UNITS) {
    const k = new Kit(u.id);
    u.build(k);
    const g = k.build();
    g.position.set(...u.origin);
    scene.add(g);
    absorb(k, g);
    u.group = g;
    u.mats = Object.entries(k.mats).filter(([key]) => !['glass', 'glow', 'redLight'].includes(key)).map(([, m]) => m);
    u.meshes = g.children.filter((c) => c.isMesh);
    pickables.push(...u.meshes);
    const box = new THREE.Box3();
    u.meshes.forEach((m) => { m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)); });
    u.box = u.id === 'rack' ? new THREE.Box3(new THREE.Vector3(-252, 0, -5), new THREE.Vector3(254, 13.5, 5)) : box;
    u.anchorW = new THREE.Vector3(...u.anchor).add(g.position);
    u.parts.forEach((p) => { p.w = new THREE.Vector3(...p.p).add(g.position); });
    await tick(u.name);
  }

  // lamps: small fixtures by day, bright points at night
  const lampGeo = new THREE.SphereGeometry(0.3, 10, 8);
  lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.55, 0.5) });
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, lampPositions.length);
  const m = new THREE.Matrix4();
  lampPositions.forEach((p, i) => lamps.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z)));
  scene.add(lamps);

  buildParticles();
}
let lampMat;

/* ------------------------------------------------------------------ steam and smoke */
let particleMat;
function buildParticles() {
  const per = { steam: mobile ? 40 : 70, smoke: mobile ? 18 : 30 };
  const pos = [], seed = [], kind = [];
  emitters.forEach((e) => {
    const n = per[e.kind];
    for (let i = 0; i < n; i++) {
      pos.push(e.p.x + (Math.random() - 0.5) * (e.kind === 'steam' ? 6 : 1.5), e.p.y, e.p.z + (Math.random() - 0.5) * (e.kind === 'steam' ? 6 : 1.5));
      seed.push(Math.random());
      kind.push(e.kind === 'smoke' ? 1 : 0);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  g.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  particleMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uScale: { value: 1 }, uWind: { value: new THREE.Vector3(0.8, 0, 0.35) }, uLight: { value: new THREE.Color(1.0, 0.86, 0.72) } },
    vertexShader: /* glsl */`
      attribute float aSeed; attribute float aKind;
      uniform float uTime, uScale; uniform vec3 uWind;
      varying float vA; varying float vKind;
      void main(){
        float age = fract(uTime * mix(0.085, 0.05, aKind) + aSeed);
        vec3 p = position;
        p.y += age * mix(20.0, 34.0, aKind);
        p += uWind * age * age * mix(16.0, 30.0, aKind);
        p.x += sin(aSeed * 91.0 + uTime * 0.4) * age * 3.0;
        p.z += cos(aSeed * 47.0 + uTime * 0.3) * age * 3.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = mix(3.5, 15.0, age) * mix(1.0, 0.8, aKind) * uScale / -mv.z;
        vA = smoothstep(0.0, 0.12, age) * (1.0 - age) * mix(0.5, 0.2, aKind);
        vKind = aKind;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uLight; varying float vA; varying float vKind;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vA;
        vec3 col = mix(vec3(0.95, 0.93, 0.9), vec3(0.55, 0.53, 0.5), vKind) * uLight;
        gl_FragColor = vec4(col, a);
      }`,
  });
  const pts = new THREE.Points(g, particleMat);
  pts.frustumCulled = false;
  pts.renderOrder = 30;
  scene.add(pts);
  updateParticleScale();
}
function updateParticleScale() {
  if (particleMat) particleMat.uniforms.uScale.value = (innerHeight * PR) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
}

/* ------------------------------------------------------------------ markers */
const markerLayer = $('#markers');
UNITS.forEach((u, i) => {
  u.idx = String(i + 1).padStart(2, '0');
  const el = document.createElement('button');
  el.className = 'marker';
  el.innerHTML = `<span class="dot">${u.idx}</span><span class="name">${u.short}</span>`;
  el.setAttribute('aria-label', `${u.name}: fly in`);
  el.addEventListener('click', () => focusUnit(u));
  el.addEventListener('mouseenter', () => setHover(u));
  el.addEventListener('mouseleave', () => setHover(null));
  markerLayer.appendChild(el);
  u.el = el;
});
let partEls = [];

const v3 = new THREE.Vector3();
function place(el, world, W, H) {
  v3.copy(world).project(camera);
  const behind = v3.z > 1 || v3.z < -1;
  const x = (v3.x * 0.5 + 0.5) * W, y = (-v3.y * 0.5 + 0.5) * H;
  const off = behind || x < -40 || x > W + 40 || y < -40 || y > H + 40;
  el.classList.toggle('hidden', off);
  if (!off) el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-13px, -50%)`;
}

/* ------------------------------------------------------------------ hover + picking */
let hovered = null;
function setHover(u) {
  if (hovered === u) return;
  if (hovered) hovered.mats.forEach((m) => m.emissive && m.emissive.copy(m.userData.base.emissive));
  hovered = u;
  if (u) u.mats.forEach((m) => m.emissive && m.emissive.setRGB(0.05, 0.028, 0.008));
  UNITS.forEach((x) => x.el.classList.toggle('hot', x === u));
  document.body.classList.toggle('hovering', !!u);
}
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pick(clientX, clientY) {
  ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  // cheap box pre-pass, then exact triangles only on candidates
  const candidates = UNITS.filter((u) => u.box && raycaster.ray.intersectsBox(u.box));
  let best = null, bestD = Infinity;
  for (const u of candidates) {
    const hit = raycaster.intersectObjects(u.meshes, false)[0];
    if (hit && hit.distance < bestD) { bestD = hit.distance; best = u; }
  }
  return best;
}
let pointer = { x: 0, y: 0, down: null, moved: false }, lastHover = 0;
canvas.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; if (pointer.down && Math.hypot(e.clientX - pointer.down.x, e.clientY - pointer.down.y) > 5) pointer.moved = true; });
canvas.addEventListener('pointerdown', (e) => { pointer.down = { x: e.clientX, y: e.clientY, t: performance.now() }; pointer.moved = false; userActed(); });
canvas.addEventListener('pointerup', (e) => {
  if (pointer.down && !pointer.moved && e.button === 0) {
    const u = pick(e.clientX, e.clientY);
    if (u && u !== focused) focusUnit(u);
  }
  pointer.down = null;
});
canvas.addEventListener('wheel', userActed, { passive: true });

/* ------------------------------------------------------------------ camera flights */
let flight = null;
function flyTo(target, dir, dist, duration = 2.4) {
  if (flight) flight.kill();
  const startPos = camera.position.clone(), startT = controls.target.clone();
  const endPos = target.clone().addScaledVector(dir.clone().normalize(), dist);
  const span = startPos.distanceTo(endPos);
  const lift = Math.min(span * 0.22, 220);
  const d = reduced || instant ? 0 : Math.min(duration, 1.2 + span / 400);
  controls.enabled = false;
  const o = { t: 0 };
  flight = gsap.to(o, {
    t: 1, duration: d, ease: 'power2.inOut',
    onUpdate: () => {
      camera.position.lerpVectors(startPos, endPos, o.t);
      camera.position.y += Math.sin(Math.PI * o.t) * lift;
      controls.target.lerpVectors(startT, target, o.t);
    },
    onComplete: () => { controls.enabled = true; flight = null; },
  });
}

/* ------------------------------------------------------------------ focus state + panel */
let focused = null, focusedPart = -1;
const panel = $('#panel');
function unitTarget(u) {
  const c = u.box.getCenter(new THREE.Vector3());
  if (u.id === 'rack') c.set(10, 7, 0);
  c.y = Math.min(c.y * 0.75, 30);
  return c;
}
function focusUnit(u) {
  focused = u;
  focusedPart = -1;
  controls.autoRotate = false;
  flyTo(unitTarget(u), new THREE.Vector3(...u.view.dir), u.view.dist * (mobile ? 1.35 : 1));
  $('#p-num').textContent = `${u.idx} / 12`;
  $('#p-title').textContent = u.name;
  $('#p-kicker').textContent = u.kicker;
  $('#p-desc').textContent = u.desc;
  $('#p-stats').innerHTML = u.stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  $('#p-parts').innerHTML = u.parts.map((p, i) => `<li><button data-i="${i}"><span class="n">${String(i + 1).padStart(2, '0')}</span><span class="t">${p.name}</span><span class="d">${p.d}</span></button></li>`).join('');
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  panel.scrollTop = 0;
  partEls.forEach((e) => e.remove());
  partEls = u.parts.map((p, i) => {
    const el = document.createElement('button');
    el.className = 'marker part';
    el.innerHTML = `<span class="dot"></span><span class="name">${p.name}</span>`;
    el.addEventListener('click', () => focusPart(i));
    markerLayer.appendChild(el);
    return el;
  });
  UNITS.forEach((x) => x.el.classList.add('hidden'));
  setCrumb();
  closeUnits();
  setHover(null);
}
function focusPart(i) {
  if (!focused) return;
  const p = focused.parts[i];
  focusedPart = i;
  const dir = camera.position.clone().sub(p.w);
  dir.y = Math.max(dir.y, dir.length() * 0.3);
  flyTo(p.w.clone(), dir, (p.dist || 24) * (mobile ? 1.4 : 1), 1.8);
  document.querySelectorAll('#p-parts button').forEach((b) => b.classList.toggle('on', +b.dataset.i === i));
  partEls.forEach((e, j) => e.classList.toggle('hot', j === i));
  setCrumb();
}
function overview() {
  focused = null;
  focusedPart = -1;
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  partEls.forEach((e) => e.remove());
  partEls = [];
  flyTo(OVERVIEW.target, OVERVIEW.dir, OVERVIEW.dist);
  setCrumb();
}
function step(d) {
  const i = focused ? UNITS.indexOf(focused) : -1;
  focusUnit(UNITS[(i + d + UNITS.length) % UNITS.length]);
}
function syncHash() {
  const h = focused ? `#${focused.id}${focusedPart >= 0 ? `/${focusedPart + 1}` : ''}` : ' ';
  if (location.hash !== h.trim()) history.replaceState(null, '', h === ' ' ? location.pathname + location.search : h);
}
function fromHash() {
  const [id, part] = location.hash.slice(1).split('/');
  const u = UNITS.find((x) => x.id === id);
  if (!u) return false;
  focusUnit(u);
  if (part) focusPart(Math.min(u.parts.length, +part) - 1);
  return true;
}
function setCrumb() {
  syncHash();
  const c = $('#crumb');
  if (!focused) { c.hidden = true; return; }
  c.hidden = false;
  c.innerHTML = `<button id="crumb-home">Overview</button> / <span>${focused.short}</span>${focusedPart >= 0 ? ` / <b>${focused.parts[focusedPart].name}</b>` : ''}`;
  $('#crumb-home').onclick = overview;
}
$('#p-parts').addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (b) focusPart(+b.dataset.i); });
$('#p-close').addEventListener('click', overview);
$('#p-prev').addEventListener('click', () => step(-1));
$('#p-next').addEventListener('click', () => step(1));

const unitsPanel = $('#units-panel'), unitsBtn = $('#units-btn');
function closeUnits() { unitsPanel.hidden = true; unitsBtn.setAttribute('aria-expanded', 'false'); }
unitsBtn.addEventListener('click', () => { const open = unitsPanel.hidden; unitsPanel.hidden = !open; unitsBtn.setAttribute('aria-expanded', String(open)); });
$('#units-list').innerHTML = UNITS.map((u, i) => `<li><button data-i="${i}"><span>${String(i + 1).padStart(2, '0')}</span><span>${u.name}</span></button></li>`).join('');
$('#units-list').addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (b) { stopTour(); focusUnit(UNITS[+b.dataset.i]); } });

addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { stopTour(); if (focusedPart >= 0) focusUnit(focused); else if (focused) overview(); closeUnits(); }
  if (e.key === 'ArrowRight') { stopTour(); step(1); }
  if (e.key === 'ArrowLeft') { stopTour(); step(-1); }
});

/* ------------------------------------------------------------------ tour, idle orbit, night */
let tourTimer = null;
const tourBtn = $('#tour-btn');
function stopTour() { if (tourTimer) { clearInterval(tourTimer); tourTimer = null; tourBtn.setAttribute('aria-pressed', 'false'); } }
tourBtn.addEventListener('click', () => {
  if (tourTimer) { stopTour(); return; }
  tourBtn.setAttribute('aria-pressed', 'true');
  step(1);
  tourTimer = setInterval(() => step(1), 9000);
});
let lastAct = performance.now();
function userActed() { lastAct = performance.now(); controls.autoRotate = false; stopTour(); }

let night = false;
$('#mode-btn').addEventListener('click', (e) => {
  night = !night;
  e.currentTarget.setAttribute('aria-pressed', String(night));
  e.currentTarget.textContent = night ? 'Day' : 'Night';
  env.setMode(night ? 'night' : 'day');
  lampMat.color.copy(night ? new THREE.Color(9, 6.5, 3.6) : new THREE.Color(0.55, 0.55, 0.5));
  glassMats.forEach((m) => { m.emissiveIntensity = night ? 1.6 : 0; });
  bloom.strength = night ? 0.9 : 0.45;
  bloom.threshold = night ? 0.8 : 0.92;
  if (particleMat) particleMat.uniforms.uLight.value.set(night ? 0.16 : 1.0, night ? 0.17 : 0.86, night ? 0.2 : 0.72);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bloom.setSize(innerWidth, innerHeight);
  updateParticleScale();
});

/* ------------------------------------------------------------------ loop */
const clock = new THREE.Clock();
let viewShift = 0;
const lerp = (a, b, t) => a + (b - a) * t;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (!focused && !tourTimer && !flight && performance.now() - lastAct > 7000) controls.autoRotate = !reduced;
  controls.update();
  if (controls.target.y < 0) controls.target.y = 0;

  spinners.forEach((f) => { f.rotation.y += f.userData.spin * dt; });
  tickFlames(t);
  flickers.forEach((l) => { l.intensity = l.userData.flicker * (0.85 + 0.15 * Math.sin(t * 13.1) * Math.sin(t * 7.3)); });
  env.water.material.uniforms.uTime.value = t;
  if (particleMat) particleMat.uniforms.uTime.value = t;
  env.updateShadow(controls.target, camera.position.distanceTo(controls.target));

  // hover picking (throttled; skipped while dragging or flying)
  if (!pointer.down && !flight && t - lastHover > 0.1 && !mobile) {
    lastHover = t;
    const over = document.elementFromPoint(pointer.x, pointer.y);
    if (over === canvas) setHover(pick(pointer.x, pointer.y));
  }

  const W = innerWidth, H = innerHeight;
  // keep the focused unit centred in the space left of the panel
  viewShift = lerp(viewShift, focused && !mobile ? Math.min(210, W * 0.15) : 0, 0.08);
  if (Math.abs(viewShift) > 0.5) camera.setViewOffset(W, H, viewShift, 0, W, H);
  else if (camera.view && camera.view.enabled) camera.clearViewOffset();
  if (!focused) UNITS.forEach((u) => u.anchorW && place(u.el, u.anchorW, W, H));
  else partEls.forEach((el, i) => place(el, focused.parts[i].w, W, H));
  $('#hint').style.opacity = focused ? 0 : 1;

  composer.render();
}

/* ------------------------------------------------------------------ boot */
build().then(() => {
  $('#loader').classList.add('done');
  document.body.classList.remove('loading');
  loop();
  if (!fromHash()) flyTo(OVERVIEW.target, OVERVIEW.dir, OVERVIEW.dist, 3.2);
  addEventListener('hashchange', fromHash);
}).catch((err) => {
  $('#loader-label').textContent = `Failed to build: ${err.message}`;
  console.error(err);
});
