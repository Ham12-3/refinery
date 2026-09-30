import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BASE } from './kit.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/* ================================================================== shared equipment */

/** Rotating fan blades (unmerged so they can spin). */
function makeFan(r, blades = 6) {
  const geos = [];
  for (let i = 0; i < blades; i++) {
    const g = new THREE.BoxGeometry(r * 0.86, 0.06, r * 0.2);
    g.translate(r * 0.5, 0, 0);
    g.rotateX(0.22);
    g.rotateY((i * TAU) / blades);
    geos.push(g);
  }
  geos.push(new THREE.CylinderGeometry(r * 0.12, r * 0.12, 0.5, 16));
  const mesh = new THREE.Mesh(mergeGeometries(geos), BASE.darksteel);
  mesh.castShadow = true;
  mesh.userData.spin = 2.2 + Math.random() * 1.2;
  return mesh;
}

/** Fin-fan air cooler bank on a frame (induced draft, fans on top). */
function airCooler(k, cx, cz, y, bays, { bw = 6, bd = 9, ry = 0 } = {}) {
  const w = bays * bw;
  const rot = new THREE.Matrix4().makeRotationY(ry);
  const T = (x, yy, z) => V(x, yy, z).applyMatrix4(rot).add(V(cx, 0, cz));
  for (let i = 0; i <= bays; i++) for (const sz of [-1, 1]) {
    const p = T(-w / 2 + i * bw, 0, (sz * bd) / 2);
    k.box(0.4, y, 0.4, p.x, 0, p.z, 'structure');
    k.box(0.9, 0.4, 0.9, p.x, 0, p.z, 'concrete');
  }
  for (let i = 0; i < bays; i++) {
    const c = T(-w / 2 + (i + 0.5) * bw, 0, 0);
    k.box(bw - 0.3, 0.7, bd - 0.3, c.x, y, c.z, 'pipeGrey', ry);     // tube bundle
    k.box(bw - 0.3, 1.6, bd - 0.3, c.x, y + 0.7, c.z, 'panel', ry);  // plenum
    for (const f of [-0.25, 0.25]) {
      const p = T(-w / 2 + (i + 0.5) * bw, 0, f * bd);
      k.cyl(bw * 0.36, 0.9, p.x, y + 2.3, p.z, 'panelDS', 28, bw * 0.38, true);
      const fan = makeFan(bw * 0.33, 4);
      fan.position.set(p.x, y + 2.5, p.z);
      k.dynamic.push(fan);
    }
  }
  const a = T(-w / 2, 0, -bd / 2), b = T(w / 2, 0, -bd / 2), c = T(-w / 2, 0, bd / 2), d = T(w / 2, 0, bd / 2);
  k.railing([a.x, a.z], [b.x, b.z], y + 2.3);
  k.railing([c.x, c.z], [d.x, d.z], y + 2.3);
  // headers
  const h1 = T(-w / 2 - 0.3, y + 0.35, -bd / 2 + 0.4), h2 = T(w / 2 + 0.3, y + 0.35, -bd / 2 + 0.4);
  k.pipe([h1, h2], 0.35, 'steel');
  const h3 = T(-w / 2 - 0.3, y + 0.35, bd / 2 - 0.4), h4 = T(w / 2 + 0.3, y + 0.35, bd / 2 - 0.4);
  k.pipe([h3, h4], 0.35, 'steel');
}

/** Tall stack with platform, ladder and aviation lights. */
function stack(k, x, z, y0, r, h, { key = 'casing', lights = true } = {}) {
  k.cyl(r * 1.1, h * 0.12, x, y0, z, key, 24, r);
  k.cyl(r, h, x, y0, z, key, 24);
  k.torus(r + 0.02, 0.06, x, y0 + h - 0.4, z, 'darksteel', 32);
  k.circPlatform(x, z, y0 + h - 3, r, 1.1, 0, TAU, false);
  k.ladder(x, z, r, y0 + h * 0.12, y0 + h - 3, Math.PI * 0.5, true);
  if (lights) {
    for (const a of [0, Math.PI]) {
      k.sphere(0.22, x + Math.sin(a) * (r + 0.2), y0 + h - 1, z + Math.cos(a) * (r + 0.2), 'redLight', 8);
      k.sphere(0.2, x + Math.sin(a + 1.5) * (r + 0.2), y0 + h * 0.55, z + Math.cos(a + 1.5) * (r + 0.2), 'redLight', 8);
    }
  }
}

/** Box-type fired heater: radiant box on legs, convection section, stack. */
function heaterBox(k, cx, cz, { w = 26, d = 12, h = 14, legs = 4, cells = 1, stackH = 36, stackR = 1.8 } = {}) {
  const y0 = legs, y1 = legs + h;
  // legs
  for (let x = -w / 2; x <= w / 2 + 0.01; x += w / Math.round(w / 4)) for (const z of [-d / 2, d / 2]) {
    k.box(0.6, legs, 0.6, cx + x, 0, cz + z, 'darksteel');
  }
  // floor + burners with glowing throats
  k.box(w, 0.5, d, cx, y0 - 0.5, cz, 'casing');
  const nb = Math.round(w / 3.5);
  for (let i = 0; i < nb; i++) for (const z of [-d / 4, d / 4]) {
    const x = cx - w / 2 + (i + 0.5) * (w / nb);
    k.cyl(0.55, 1.1, x, y0 - 1.6, cz + z, 'darksteel', 14);
    k.add(new THREE.CircleGeometry(0.42, 16), 'glow', k.at(x, y0 - 1.62, cz + z, Math.PI / 2, 0, 0));
  }
  // radiant casing with stiffeners and sight ports
  k.box(w, h, d, cx, y0, cz, 'casing');
  for (let x = -w / 2 + 1; x < w / 2; x += 2) for (const s of [-1, 1]) k.box(0.2, h, 0.25, cx + x, y0, cz + s * (d / 2 + 0.12), 'darksteel');
  for (let y = y0 + 3; y < y1 - 1; y += 5) for (const s of [-1, 1]) k.box(w + 0.3, 0.3, 0.3, cx, y, cz + s * (d / 2 + 0.2), 'darksteel');
  for (let x = -w / 2 + 2.5; x < w / 2 - 1; x += 3.5) for (const s of [-1, 1]) for (const y of [y0 + 2.2, y0 + 7.5]) {
    k.box(0.45, 0.45, 0.1, cx + x, y, cz + s * (d / 2 + 0.26), 'glow');
  }
  if (cells > 1) for (let i = 1; i < cells; i++) k.box(0.5, h + 0.2, d + 0.6, cx - w / 2 + (i * w) / cells, y0, cz, 'darksteel');
  // arch + convection section
  k.box(w * 0.92, 1.4, d * 0.75, cx, y1, cz, 'casing');
  k.box(w * 0.86, 7, d * 0.46, cx, y1 + 1.4, cz, 'casing');
  for (let x = -w * 0.43 + 1; x < w * 0.43; x += 2.4) for (const s of [-1, 1]) k.box(0.18, 7, 0.2, cx + x, y1 + 1.4, cz + s * (d * 0.23 + 0.1), 'darksteel');
  // U-bend headers on end walls
  for (let i = 0; i < 8; i++) for (const s of [-1, 1]) {
    k.cyl(0.14, h - 2, cx + s * (w / 2 + 0.35), y0 + 1, cz - d / 2 + 1.5 + i * ((d - 3) / 7), 'steel', 8);
  }
  k.box(1.2, h + 8, d * 0.9, cx - w / 2 - 0.9, y0, cz, 'darksteel');
  // breeching + stack
  k.box(4, 3, 4, cx, y1 + 8.4, cz, 'casing');
  stack(k, cx, cz, y1 + 11.4, stackR, stackH);
  // platforms along both sides at mid height, stairs
  for (const s of [-1, 1]) {
    const z = cz + s * (d / 2 + 1.1);
    k.box(w + 2, 0.12, 1.8, cx, y0 + 6, z, 'grating');
    k.railing([cx - w / 2 - 1, z + s * 0.9], [cx + w / 2 + 1, z + s * 0.9], y0 + 6.1);
    k.lamp(cx, y0 + 8.5, z + s * 0.8);
  }
  k.box(w * 0.86 + 2, 0.12, 1.6, cx, y1 + 1.4, cz + d * 0.23 + 1.0, 'grating');
  k.railing([cx - w * 0.43 - 1, cz + d * 0.23 + 1.8], [cx + w * 0.43 + 1, cz + d * 0.23 + 1.8], y1 + 1.5);
  k.stair([cx + w / 2 + 1.2, 0, cz + d / 2 + 5], [cx + w / 2 + 1.2, y0 + 6, cz + d / 2 + 1.2]);
  k.stair([cx - w / 2 + 3, y0 + 6, cz + d / 2 + 1.1], [cx - w / 2 + 3 + 8, y1 + 1.4, cz + d * 0.23 + 1.0]);
  k.emitters.push({ p: V(cx, y1 + 11.4 + stackH + 1, cz), kind: 'smoke' });
  const light = new THREE.PointLight(0xff8a3d, 260, 45, 2);
  light.position.set(cx, y0 - 2.5, cz);
  k.dynamic.push(light);
}

/** Vertical cylindrical fired heater. */
function heaterCyl(k, cx, cz, { r = 4, h = 12, legs = 4, stackH = 16 } = {}) {
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    k.box(0.5, legs, 0.5, cx + Math.sin(a) * (r - 0.3), 0, cz + Math.cos(a) * (r - 0.3), 'darksteel');
  }
  k.cyl(r, 0.5, cx, legs - 0.5, cz, 'casing', 32);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    const x = cx + Math.sin(a) * r * 0.45, z = cz + Math.cos(a) * r * 0.45;
    k.cyl(0.45, 1, x, legs - 1.5, z, 'darksteel', 12);
    k.add(new THREE.CircleGeometry(0.35, 14), 'glow', k.at(x, legs - 1.52, z, Math.PI / 2, 0, 0));
  }
  k.cyl(r, h, cx, legs, cz, 'casing', 36);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    k.box(0.2, h, 0.2, cx + Math.sin(a) * (r + 0.08), legs, cz + Math.cos(a) * (r + 0.08), 'darksteel');
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.3;
    k.box(0.4, 0.4, 0.4, cx + Math.sin(a) * (r + 0.1), legs + 2, cz + Math.cos(a) * (r + 0.1), 'glow');
  }
  k.add(new THREE.CylinderGeometry(1.4, r, 3, 36, 1), 'casing', k.at(cx, legs + h + 1.5, cz));
  k.box(3.2, 5, 3.2, cx, legs + h + 3, cz, 'casing');
  stack(k, cx, cz, legs + h + 8, 1.0, stackH, { lights: false });
  k.circPlatform(cx, cz, legs + h * 0.5, r, 1.2, 0, Math.PI * 1.2);
  k.emitters.push({ p: V(cx, legs + h + 8 + stackH + 1, cz), kind: 'smoke' });
  const light = new THREE.PointLight(0xff8a3d, 140, 30, 2);
  light.position.set(cx, legs - 2, cz);
  k.dynamic.push(light);
}

/** Pipe on T-supports along a straight run (branch lines to the rack). */
function supportedRun(k, a, b, y, pipes) {
  const A = V(a[0], 0, a[1]), B = V(b[0], 0, b[1]);
  const len = A.distanceTo(B);
  const dir = B.clone().sub(A).normalize();
  const side = V(-dir.z, 0, dir.x);
  const w = pipes.length * 0.9 + 0.6;
  for (let t = 0; t <= len; t += 6) {
    const p = A.clone().addScaledVector(dir, t);
    k.box(0.35, y - 0.3, 0.35, p.x, 0, p.z, 'structure');
    const e1 = p.clone().addScaledVector(side, -w / 2).setY(y - 0.2), e2 = p.clone().addScaledVector(side, w / 2).setY(y - 0.2);
    k.beam(e1, e2, 0.3, 'structure');
  }
  pipes.forEach(([r, key], i) => {
    const off = -w / 2 + 0.6 + i * 0.9;
    k.pipe([A.clone().addScaledVector(side, off).setY(y + r), B.clone().addScaledVector(side, off).setY(y + r)], r, key, 10);
  });
}

/* ================================================================== flame */
const flameUniforms = { uTime: { value: 0 } };
const flameMat = new THREE.ShaderMaterial({
  uniforms: flameUniforms,
  transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
    uniform float uTime; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
    float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=.5; } return v; }
    void main(){
      float y = vUv.y, x = (vUv.x - .5) * 2.;
      float n = fbm(vec2(vUv.x * 3.2, y * 2.6 - uTime * 2.4));
      float sway = (fbm(vec2(y * 1.4 - uTime * .6, 3.1)) - .5) * .9 * y;
      float width = mix(.62, .06, pow(y, .75)) * (.75 + .6 * n);
      float d = abs(x - sway) / max(width, .001);
      float body = smoothstep(1., .15, d) * smoothstep(1., .5, y + n * .3) * smoothstep(0., .06, y);
      float core = smoothstep(.55, 0., d) * smoothstep(.6, .05, y);
      vec3 col = mix(vec3(.95,.22,.03), vec3(1.,.58,.14), body);
      col = mix(col, vec3(1.,.93,.72), core);
      gl_FragColor = vec4(col * (2.2 + core * 5.) * body, body);
    }`,
});
export function tickFlames(t) { flameUniforms.uTime.value = t; }

function flame(k, x, y, z, w = 9, h = 20) {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(w, h);
  geo.translate(0, h / 2, 0);
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(geo, flameMat);
    m.rotation.y = (i * Math.PI) / 3;
    m.renderOrder = 20;
    g.add(m);
  }
  g.position.set(x, y, z);
  g.rotation.z = -0.12;
  g.userData.flame = true;
  k.dynamic.push(g);
  const light = new THREE.PointLight(0xff9a4a, 2400, 260, 2);
  light.position.set(x, y + 6, z);
  light.userData.flicker = 2400;
  k.dynamic.push(light);
}

/* ================================================================== storage */

function floatingTank(k, cx, cz, R, H, level, a0 = 0.4) {
  k.cyl(R + 0.8, 0.6, cx, 0, cz, 'concrete', 64);
  k.add(new THREE.CylinderGeometry(R, R, H, 96, 1, true), 'whiteDS', k.at(cx, 0.6 + H / 2, cz));
  const top = 0.6 + H;
  for (let y = 0.6 + 2.4; y < top - 0.5; y += 2.4) k.torus(R + 0.015, 0.035, cx, y, cz, 'steel', 120);
  k.torus(R + 0.04, 0.09, cx, top, cz, 'steel', 120);
  // wind girder walkway with handrail
  k.ring(R, R + 1.1, 0.12, cx, top - 1.1, cz, 'white', 120);
  k.torus(R + 1.05, 0.03, cx, top, cz, 'yellow', 120);
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * TAU;
    k.rod([cx + Math.sin(a) * (R + 1.05), top - 1.0, cz + Math.cos(a) * (R + 1.05)], [cx + Math.sin(a) * (R + 1.05), top, cz + Math.cos(a) * (R + 1.05)], 0.025, 'yellow', 4);
  }
  // floating roof: deck, pontoon ring, rim seal, drain sump, vents
  const ly = 0.6 + level;
  k.cyl(R - 0.3, 0.35, cx, ly - 0.35, cz, 'steel', 96);
  k.ring(R - 3.2, R - 0.3, 0.9, cx, ly - 0.35, cz, 'steel', 96);
  k.torus(R - 0.28, 0.16, cx, ly + 0.55, cz, 'darksteel', 120);
  k.cyl(0.9, 0.2, cx, ly, cz, 'darksteel', 16);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    k.cyl(0.25, 0.6, cx + Math.sin(a) * (R - 1.8), ly + 0.55, cz + Math.cos(a) * (R - 1.8), 'darksteel', 8);
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.4;
    k.cyl(0.3, 0.9, cx + Math.sin(a) * R * 0.4, ly, cz + Math.cos(a) * R * 0.4, 'steel', 10);
  }
  // spiral stair up the shell to the gauger's platform
  const sweep = (H * 1.7) / R;
  k.spiralStair(cx, cz, R, 0.6, top, a0, sweep);
  const aTop = a0 + sweep;
  const gx = cx + Math.sin(aTop) * (R + 0.2), gz = cz + Math.cos(aTop) * (R + 0.2);
  k.box(3.2, 0.14, 3.2, gx, top, gz, 'grating', aTop);
  k.lamp(gx, top + 2.5, gz);
  // rolling ladder from the gauger's platform down to the roof, on its runway
  const inward = V(-Math.sin(aTop), 0, -Math.cos(aTop));
  const tang = V(Math.cos(aTop), 0, -Math.sin(aTop));
  const topP = V(gx, top + 0.1, gz).addScaledVector(inward, 1.2);
  const reach = Math.max(4, Math.sqrt(Math.max(0, 16 * 16 - (top - ly) ** 2)) + 2);
  const botP = V(cx + Math.sin(aTop) * (R - reach), ly + 0.5, cz + Math.cos(aTop) * (R - reach));
  for (const s of [-0.45, 0.45]) {
    k.rod(topP.clone().addScaledVector(tang, s), botP.clone().addScaledVector(tang, s), 0.05, 'yellow', 5);
    k.rod(topP.clone().addScaledVector(tang, s).setY(topP.y + 1), botP.clone().addScaledVector(tang, s).setY(botP.y + 1), 0.03, 'yellow', 4);
  }
  const steps = Math.round(topP.distanceTo(botP) / 0.35);
  for (let i = 1; i < steps; i++) {
    const p = topP.clone().lerp(botP, i / steps);
    k.rod(p.clone().addScaledVector(tang, -0.45), p.clone().addScaledVector(tang, 0.45), 0.03, 'yellow', 4);
  }
  const runA = V(cx + Math.sin(aTop) * (R - 4), ly + 0.4, cz + Math.cos(aTop) * (R - 4));
  const runB = V(cx + Math.sin(aTop) * (R * 0.25), ly + 0.4, cz + Math.cos(aTop) * (R * 0.25));
  for (const s of [-0.6, 0.6]) k.beam(runA.clone().addScaledVector(tang, s), runB.clone().addScaledVector(tang, s), 0.12, 'darksteel');
  // foam chambers and risers
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    const x = cx + Math.sin(a) * (R + 0.45), z = cz + Math.cos(a) * (R + 0.45);
    k.box(0.7, 0.9, 0.7, x, top - 2.2, z, 'pipeRed', a);
    k.rod([x, 0.6, z], [x, top - 2.2, z], 0.08, 'pipeRed', 6);
  }
  // shell nozzles at the base
  for (const a of [a0 - 0.5, a0 - 0.8]) {
    const x = cx + Math.sin(a) * R, z = cz + Math.cos(a) * R;
    k.pipe([[x, 1.6, z], [cx + Math.sin(a) * (R + 5), 1.6, cz + Math.cos(a) * (R + 5)], [cx + Math.sin(a) * (R + 5), 0.8, cz + Math.cos(a) * (R + 5)]], 0.35, 'pipeGrey');
  }
}

function coneTank(k, cx, cz, R, H, a0 = 0) {
  k.cyl(R + 0.6, 0.5, cx, 0, cz, 'concrete', 48);
  k.cyl(R, H, cx, 0.5, cz, 'white', 64);
  for (let y = 2.9; y < H; y += 2.4) k.torus(R + 0.015, 0.03, cx, y, cz, 'steel', 80);
  const top = 0.5 + H;
  k.add(new THREE.CylinderGeometry(0.6, R + 0.1, R * 0.18, 64, 1), 'white', k.at(cx, top + R * 0.09, cz));
  k.torus(R + 0.05, 0.03, cx, top + 1.05, cz, 'yellow', 80, Math.PI * 0.6, a0 + 0.8);
  for (let i = 0; i < 3; i++) k.cyl(0.25, 0.9, cx + Math.sin(i * 2.1) * R * 0.5, top + R * 0.09, cz + Math.cos(i * 2.1) * R * 0.5, 'steel', 10);
  k.spiralStair(cx, cz, R, 0.5, top, a0, (H * 1.7) / R);
  k.lamp(cx + Math.sin(a0 + (H * 1.7) / R) * R, top + 2.4, cz + Math.cos(a0 + (H * 1.7) / R) * R);
}

function sphere(k, cx, cz, R, cy) {
  k.sphere(R, cx, cy, cz, 'white', 64);
  k.torus(R + 0.02, 0.05, cx, cy, cz, 'steel', 96);
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const x = cx + Math.sin(a) * R, z = cz + Math.cos(a) * R;
    k.cyl(0.42, cy, x, 0, z, 'white', 12);
    k.box(1.4, 0.6, 1.4, x, 0, z, 'concrete');
    const b = ((i + 1) / n) * TAU;
    const x2 = cx + Math.sin(b) * R, z2 = cz + Math.cos(b) * R;
    k.rod([x, 1.2, z], [x2, cy - 3.5, z2], 0.07, 'structure', 5);
    k.rod([x2, 1.2, z2], [x, cy - 3.5, z], 0.07, 'structure', 5);
  }
  // top platform with relief valves
  k.circPlatform(cx, cz, cy + R - 0.2, 0.01, 2.4, 0, TAU, true);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    k.cyl(0.22, 1.3, cx + Math.sin(a) * 1.1, cy + R - 0.2, cz + Math.cos(a) * 1.1, 'pipeRed', 10);
  }
  // deluge ring
  k.torus(R * 0.62, 0.09, cx, cy + R * 0.78, cz, 'pipeRed', 64);
  // stairway: stair tower to the equator, then steps up the meridian to the top
  const a = Math.PI * 0.75;
  const sx = Math.sin(a), sz = Math.cos(a);
  k.stair([cx + sx * (R + 9), 0, cz + sz * (R + 9)], [cx + sx * (R + 1.2), cy, cz + sz * (R + 1.2)], 1.0);
  const pts = [];
  for (let t = 0; t <= 1.0001; t += 1 / 40) {
    const th = (Math.PI / 2) * (1 - t) + 0.12 * t;
    const rr = (R + 0.7) * Math.sin(th), yy = cy + (R + 0.7) * Math.cos(th);
    k.box(1.0, 0.05, 0.3, cx + sx * rr, yy, cz + sz * rr, 'grating', a + Math.PI / 2);
    pts.push(V(cx + sx * rr, yy, cz + sz * rr));
  }
  const tang = V(Math.cos(a), 0, -Math.sin(a));
  for (const s of [-0.55, 0.55]) {
    for (let i = 0; i < pts.length - 1; i++) {
      k.rod(pts[i].clone().addScaledVector(tang, s).setY(pts[i].y + 1), pts[i + 1].clone().addScaledVector(tang, s).setY(pts[i + 1].y + 1), 0.03, 'yellow', 4);
    }
  }
  k.lamp(cx, cy + R + 2.5, cz);
}

/* ================================================================== units */

export const UNITS = [
  /* ---------------------------------------------------------------- 01 CDU */
  {
    id: 'cdu', name: 'Crude distillation unit', short: 'Crude distillation', kicker: 'Atmospheric column · CDU',
    origin: [-165, 0, -48], anchor: [0, 56, -4], view: { dir: [0.75, 0.42, 0.95], dist: 105 },
    desc: 'The first step for every barrel. Desalted, heated crude flashes into the base of a 50 m column. Vapour rises through the trays and cools; each fraction condenses at its own height and is drawn off as a side stream, from LPG and naphtha at the top down to atmospheric residue at the bottom.',
    stats: [['Column height', '≈ 50 m'], ['Diameter', '5.6–6.8 m'], ['Trays', '30–50'], ['Top pressure', '≈ 1–2 bar g']],
    parts: [
      { name: 'Overhead vapour line', p: [-4, 53, -4], d: 'Carries the lightest vapours (LPG and naphtha) from the top of the column to the condensers.' },
      { name: 'Trays and side draws', p: [0, 34, -1], d: 'Kerosene, diesel and gas oil are drawn off through nozzles at different tray heights.' },
      { name: 'Flash zone', p: [0, 12, -1], d: 'Hot crude from the fired heater enters here; the vapour rises and the liquid falls to the bottom.' },
      { name: 'Side strippers', p: [9, 12, -4], d: 'Small columns that use steam to strip light ends back out of each side-draw product.' },
      { name: 'Air-cooled condensers', p: [-18, 15, -2], d: 'Fin-fan coolers condense the overhead vapour; the fans pull air up through the tube bundles.' },
      { name: 'Reflux drum', p: [-18, 3.5, 12], d: 'Collects the condensed overhead liquid. Part returns to the column as reflux, the rest is product.' },
      { name: 'Desalter', p: [20, 3, 12], d: 'An electrostatic vessel that washes salt and water out of the crude before it is heated.' },
      { name: 'Preheat exchangers', p: [21, 3, -15], d: 'Shell-and-tube exchangers recover heat from hot products into the incoming crude.' },
      { name: 'Charge pumps', p: [4, 1.2, 15], d: 'Centrifugal pumps move crude and products through the unit.' },
    ],
    build(k) {
      k.box(60, 0.3, 46, 0, 0, 0, 'concrete');
      const col = k.column(0, -4, {
        skirt: 5, sections: [{ r: 3.4, h: 14 }, { r: 2.8, h: 30 }], platforms: [9, 15, 21, 27, 33, 39, 45, 50.2], ladderAngle: Math.PI / 2,
        nozzles: [{ y: 24, a: Math.PI / 2 }, { y: 29, a: Math.PI / 2 }, { y: 34, a: Math.PI / 2 }, { y: 12, a: 0, len: 1.6, r: 0.45 }, { y: 40, a: -Math.PI / 2 }, { y: 7, a: Math.PI }],
      });
      // side strippers fed from the side draws
      [-10, -4, 2].forEach((z, i) => {
        k.column(9, z, { skirt: 3, sections: [{ r: 0.9, h: 12 }], platforms: [8, 15.6], ladderAngle: Math.PI / 2, bands: false });
        const y = 24 + i * 5;
        k.pipe([[4.0, y, -4], [6.2, y, -4], [6.2, y, z], [6.2, 13.5, z], [8.1, 13.5, z]], 0.16, 'steel');
      });
      // overhead lines to the fin-fan condensers
      for (const dz of [-0.9, 0.9]) k.pipe([[0, col.topY - 0.2, -4 + dz], [0, col.topY + 2, -4 + dz], [-9, col.topY + 2, -4 + dz], [-9, 16.4, -4 + dz], [-18, 16.4, -4 + dz]], 0.5, 'cladding');
      airCooler(k, -18, -2, 12, 3, { bw: 5, bd: 10 });
      k.drum(-18, 3.4, 12, 1.5, 10, 0);
      k.cyl(0.45, 1.6, -15, 0.3, 12, 'cladding', 12);
      k.pipe([[-14, 12, 3], [-14, 5, 3], [-14, 5, 10.5]], 0.3, 'steel');
      k.pipe([[-22, 3.4, 12], [-26, 3.4, 12], [-26, 3.4, 16], [-4, 3.4, 16]], 0.2, 'steel');
      for (let x = -6; x <= 14; x += 4) k.pump(x, 15, 0);
      k.drum(20, 2.8, 12, 1.8, 14, 0);
      k.box(4, 2.2, 3, 20, 4.6, 12, 'darksteel');
      for (const x of [15, 26]) for (const z of [-12, -19]) k.exchanger(x, z, 7, 0.7);
      k.pipe([[2.5, 12, -1.2], [2.5, 12, 6], [2.5, 7.8, 6], [2.5, 7.8, 46]], 0.55, 'cladding');
      supportedRun(k, [7, 4], [7, 46], 6.5, [[0.3, 'steel'], [0.25, 'pipeGreen'], [0.35, 'steel'], [0.2, 'pipeYellow']]);
      k.pipe([[0, 6, -4], [0, 2, -4], [0, 2, 8], [7, 2, 8]], 0.35, 'steel');
    },
  },
  /* ---------------------------------------------------------------- 02 Crude heater */
  {
    id: 'heater', name: 'Crude charge heater', short: 'Fired heater', kicker: 'Box-type furnace',
    origin: [-165, 0, 44], anchor: [0, 30, 0], view: { dir: [0.8, 0.35, 0.75], dist: 80 },
    desc: 'Burners in the floor fire upward into a refractory-lined box. Crude flows through horizontal tubes along the walls, picking up radiant heat, and leaves at about 370 °C, partly vaporised, for the distillation column. Hot flue gas then passes a convection bank to recover more heat before the stack.',
    stats: [['Outlet temperature', '350–390 °C'], ['Heat duty', '60–150 MW'], ['Burners', '10–30'], ['Efficiency', '85–92 %']],
    parts: [
      { name: 'Radiant section', p: [0, 11, 6.3], d: 'The firebox. Tubes on the walls see the flames directly; this is where most of the heat is absorbed.' },
      { name: 'Burners', p: [0, 2.3, 0], d: 'Floor-mounted gas burners fire vertically upward. The glow is visible through the burner throats.' },
      { name: 'Sight ports', p: [-6, 6.2, 6.4], d: 'Peep doors let operators check flame shape and tube colour.' },
      { name: 'Convection section', p: [0, 22, 3], d: 'Flue gas leaving the firebox passes over finned tubes that preheat the feed.' },
      { name: 'U-bend headers', p: [13.5, 10, 0], d: 'Return bends outside the firebox connect the tube passes.' },
      { name: 'Stack', p: [0, 52, 0], d: 'Discharges flue gas at height; the aviation lights mark it for aircraft.' },
      { name: 'Transfer line', p: [-4, 12, -10], d: 'Hot, partly vaporised crude flows to the flash zone of the column.' },
    ],
    build(k) {
      k.box(44, 0.3, 28, 0, 0, 0, 'concrete');
      heaterBox(k, 0, 0, { w: 26, d: 12, h: 14, legs: 4, stackH: 34 });
      k.pipe([[-10, 12, -6.2], [-10, 12, -12], [-4, 12, -12], [-4, 7.8, -12], [-4, 7.8, -40]], 0.55, 'cladding');
      k.box(5, 5, 5, 18, 0, -4, 'panel');
      k.hcyl(1.2, 4, 18, 3, 2, 'panel', Math.PI / 2, 20);
      k.pipe([[18, 5, -4], [18, 8, -4], [13, 8, -4], [13, 8, 0]], 0.9, 'casing');
    },
  },
  /* ---------------------------------------------------------------- 03 VDU */
  {
    id: 'vdu', name: 'Vacuum distillation unit', short: 'Vacuum column', kicker: 'Swaged column · VDU',
    origin: [-108, 0, -48], anchor: [0, 49, -4], view: { dir: [0.7, 0.4, 1.0], dist: 95 },
    desc: 'Atmospheric residue is too heavy to boil at normal pressure without cracking. Here it is distilled under deep vacuum, created by steam ejectors on top of the structure. The column is swaged: much wider in the middle because vapour volumes are huge at low pressure.',
    stats: [['Pressure', '8–40 mmHg abs'], ['Max diameter', '≈ 10–14 m'], ['Ejector stages', '2–4'], ['Products', 'Vacuum gas oils, residue']],
    parts: [
      { name: 'Wide wash & packed section', p: [0, 26, 1.4], d: 'The swaged middle holds packed beds; the extra diameter keeps vapour velocity down.' },
      { name: 'Steam ejectors', p: [14, 36.2, -4], d: 'Jets of steam entrain vapour and create the vacuum. Several stages are used in series.' },
      { name: 'Inter-condensers', p: [14, 26, -4], d: 'Condense steam and hydrocarbons between ejector stages so the next stage has less load.' },
      { name: 'Hotwell', p: [14, 2, 10], d: 'Collects condensate falling down the barometric legs from the condensers.' },
      { name: 'Vacuum residue outlet', p: [0, 5, -1], d: 'The heaviest bottoms leave here for the coker, asphalt or fuel oil.' },
    ],
    build(k) {
      k.box(44, 0.3, 42, 0, 0, 0, 'concrete');
      const col = k.column(0, -4, { skirt: 6, sections: [{ r: 2.8, h: 10 }, { r: 5.2, h: 14 }, { r: 2.4, h: 8 }], platforms: [11, 21, 27, 33, 39, 44.8], ladderAngle: Math.PI / 2, nozzles: [{ y: 10, a: 0, len: 2, r: 0.6 }, { y: 24, a: 0 }, { y: 29, a: 0 }] });
      k.frame(14, -4, 8, 8, [8, 16, 25, 34], { bays: [1, 1] });
      for (let i = 0; i < 3; i++) {
        k.hcyl(0.35, 5, 14, 35.2 + i * 0.9, -6 + i * 2, 'steel', 0, 14);
        k.add(new THREE.CylinderGeometry(0.35, 0.8, 1.8, 14), 'steel', k.at(16.9, 35.2 + i * 0.9, -6 + i * 2, 0, 0, -Math.PI / 2));
      }
      k.drum(14, 26.4, -4, 0.9, 6, 0, 'cladding', false);
      k.drum(14, 17.4, -4, 0.7, 5, 0, 'cladding', false);
      k.pipe([[0, col.topY - 0.2, -4], [0, col.topY + 2, -4], [11, col.topY + 2, -4], [11, 35.2, -4], [11.5, 35.2, -6]], 0.9, 'cladding');
      k.drum(14, 1.6, 10, 1.2, 7, 0);
      for (const x of [12.5, 15.5]) k.pipe([[x, 25.5, -3], [x, 25.5, 8], [x, 2.8, 8]], 0.18, 'steel');
      k.pipe([[1.8, 10, -1], [1.8, 10, 4], [1.8, 7.8, 4], [1.8, 7.8, 46]], 0.6, 'cladding');
      supportedRun(k, [-6, 4], [-6, 46], 6.5, [[0.3, 'steel'], [0.4, 'cladding'], [0.2, 'pipeGreen']]);
      for (let x = -8; x <= 4; x += 4) k.pump(x, 15);
    },
  },
  /* ---------------------------------------------------------------- 04 Hydrotreater */
  {
    id: 'hdt', name: 'Diesel hydrotreater', short: 'Hydrotreater', kicker: 'Catalytic desulphurisation',
    origin: [-35, 0, -52], anchor: [-8, 26, -8], view: { dir: [0.6, 0.45, 1.0], dist: 95 },
    desc: 'Diesel from the crude unit is mixed with hydrogen, heated in a vertical charge heater and passed down through two catalyst-filled reactors. Sulphur and nitrogen leave as H₂S and ammonia. A high-pressure separator splits off the hydrogen, which a compressor recycles back to the reactors.',
    stats: [['Reactor temperature', '320–400 °C'], ['Pressure', '40–90 bar'], ['Sulphur out', '< 10 ppm'], ['Catalyst', 'CoMo / NiMo']],
    parts: [
      { name: 'Reactors', p: [-8, 13, -5.8], d: 'Thick-walled vessels holding fixed catalyst beds. Feed and hydrogen flow downward through them.' },
      { name: 'Charge heater', p: [14, 8, -5.8], d: 'A vertical cylindrical heater brings the feed and hydrogen to reaction temperature.' },
      { name: 'High-pressure separator', p: [0, 4, 14], d: 'Separates hydrogen-rich gas from the liquid product after cooling.' },
      { name: 'Recycle gas compressor', p: [14, 4, 12], d: 'Pushes unreacted hydrogen back to the reactor inlet.' },
      { name: 'Product stripper', p: [-22, 16, -10.6], d: 'Removes H₂S and light ends from the treated diesel.' },
      { name: 'Effluent air cooler', p: [-2, 11.5, -20], d: 'Cools the reactor effluent before the separator.' },
    ],
    build(k) {
      k.box(56, 0.3, 48, 0, 0, 0, 'concrete');
      for (const x of [-12, -4]) k.column(x, -8, { skirt: 4, sections: [{ r: 2.1, h: 16 }], top: 'hemi', key: 'steel', platforms: [11, 20.5], ladderAngle: Math.PI, bands: false, nozzles: [{ y: 6, a: 0, r: 0.4 }] });
      heaterCyl(k, 14, -10, { r: 4, h: 12, legs: 4, stackH: 14 });
      k.pipe([[14, 18, -6], [14, 25, -6], [-12, 25, -6], [-12, 25, -8], [-12, 22.5, -8]], 0.4, 'steel');
      k.pipe([[-12, 5, -5.8], [-8, 3, -5.8], [-8, 24, -5.2], [-4, 24, -5.2], [-4, 22.5, -8]], 0.38, 'steel');
      k.drum(0, 4, 14, 1.6, 10, 0);
      airCooler(k, -2, -20, 9, 2, { bw: 6, bd: 8 });
      k.frame(14, 12, 14, 10, [9], { bays: [2, 1], floors: false, rails: false, brace: false });
      k.box(14.6, 0.4, 10.6, 14, 9, 12, 'panel');
      k.box(6, 2.2, 2.4, 13, 0.3, 12, 'pipeBlue');
      k.hcyl(1.0, 3, 18, 1.5, 12, 'pipeGreen', 0, 16);
      k.box(14, 0.5, 0.4, 14, 8, 12, 'yellow');
      k.column(-22, -12, { skirt: 4, sections: [{ r: 1.4, h: 26 }], platforms: [10, 18, 26, 30.6], ladderAngle: Math.PI / 2 });
      for (const z of [8, 16]) k.exchanger(-16, z, 8, 0.8);
      k.pipe([[-4, 3, -4], [-4, 3, 8], [-4, 7.8, 8], [-4, 7.8, 50]], 0.3, 'steel');
      supportedRun(k, [6, 20], [6, 50], 6.5, [[0.3, 'steel'], [0.35, 'pipeYellow'], [0.2, 'pipeGreen']]);
      for (let x = -12; x <= 0; x += 4) k.pump(x, 21);
    },
  },
  /* ---------------------------------------------------------------- 05 Reformer */
  {
    id: 'reformer', name: 'Catalytic reformer', short: 'Reformer', kicker: 'Octane upgrade · H₂ production',
    origin: [48, 0, -52], anchor: [-3, 25, -8], view: { dir: [0.55, 0.5, 1.0], dist: 100 },
    desc: 'Heavy naphtha passes through four reactors in series over a platinum catalyst, turning straight-chain molecules into aromatics with a high octane rating. The reactions absorb heat, so the stream goes back through a separate furnace cell before each reactor. The unit is also the refinery’s main source of hydrogen.',
    stats: [['Reactor temperature', '≈ 480–520 °C'], ['Reactors in series', '3–4'], ['Octane (RON)', '95–102'], ['Catalyst', 'Pt / Pt-Re on alumina']],
    parts: [
      { name: 'Reactors R1–R4', p: [-3, 12, -5.8], d: 'Radial-flow reactors in series. Each one cools the stream as the endothermic reactions proceed.' },
      { name: 'Interheater cells', p: [-3, 10, 15.2], d: 'Four furnace cells in one casing, each reheating the stream before the next reactor.' },
      { name: 'Transfer lines', p: [-3, 21, 0], d: 'Large insulated lines carry hot feed between the heater cells and reactors.' },
      { name: 'Stabilizer', p: [22, 16, -8.5], d: 'Strips butane and lighter gases out of the reformate so it can be stored.' },
      { name: 'Product separator', p: [22, 3, 12], d: 'Separates hydrogen-rich gas from the liquid reformate.' },
    ],
    build(k) {
      k.box(60, 0.3, 48, 0, 0, 0, 'concrete');
      const xs = [-15, -7, 1, 9];
      xs.forEach((x) => k.column(x, -8, { skirt: 3.5, sections: [{ r: 1.9, h: 12 }], top: 'hemi', platforms: [9], ladderAngle: Math.PI, bands: true }));
      k.box(30, 0.12, 1.6, -3, 17.8, -5.2, 'grating');
      k.railing([-18, -4.4], [12, -4.4], 17.9);
      for (const x of xs) k.box(0.3, 17.8, 0.3, x, 0, -4.4, 'structure');
      heaterBox(k, -3, 12, { w: 36, d: 10, h: 12, legs: 3.5, cells: 4, stackH: 30, stackR: 1.6 });
      xs.forEach((x) => {
        k.pipe([[x + 2, 16.8, 9], [x + 2, 21, 9], [x + 2, 21, -8], [x, 21, -8], [x, 19.3, -8]], 0.55, 'cladding');
        k.pipe([[x + 1.9, 5, -8], [x + 3.2, 5, -8], [x + 3.2, 2.2, -8], [x + 3.2, 2.2, 6.8]], 0.5, 'cladding');
      });
      k.column(22, -10, { skirt: 4, sections: [{ r: 1.5, h: 28 }], platforms: [10, 18, 26, 32.6], ladderAngle: Math.PI / 2 });
      k.drum(22, 3, 12, 1.6, 9, 0);
      airCooler(k, 22, 0, 8, 1, { bw: 6, bd: 7, ry: Math.PI / 2 });
      supportedRun(k, [26, 18], [26, 50], 6.5, [[0.3, 'steel'], [0.25, 'pipeYellow']]);
    },
  },
  /* ---------------------------------------------------------------- 06 FCC */
  {
    id: 'fcc', name: 'Fluid catalytic cracker', short: 'FCC', kicker: 'Reactor–regenerator · Cracking',
    origin: [142, 0, -56], anchor: [0, 62, -6], view: { dir: [-0.3, 0.42, 1.0], dist: 140 },
    desc: 'The workhorse for turning heavy gas oil into gasoline. Feed meets fine catalyst at over 700 °C at the bottom of the riser and cracks in about two seconds on the way up. The reactor separates catalyst from vapour; the spent catalyst drops into the regenerator, where air burns off its coke and reheats it for the next pass.',
    stats: [['Riser outlet', '≈ 500–540 °C'], ['Regenerator', '≈ 680–730 °C'], ['Catalyst circulation', '≈ 20–60 t/min'], ['Main products', 'Gasoline, LPG, LCO']],
    parts: [
      { name: 'Regenerator', p: [-8, 26, 1.2], d: 'Air from the blower fluidises the catalyst bed and burns off the coke laid down in the reactor.' },
      { name: 'Reactor / disengager', p: [8, 48, -1.6], d: 'Separates cracked vapour from catalyst using cyclones before the vapour goes to the fractionator.' },
      { name: 'Riser', p: [14.2, 26, -6], d: 'The pipe where cracking happens: feed and hot catalyst travel up together in a couple of seconds.' },
      { name: 'Standpipes & slide valves', p: [2, 7.5, -6], d: 'Catalyst flows between vessels through standpipes; slide valves control the circulation rate.' },
      { name: 'Main air blower', p: [-8, 6, 18], d: 'Supplies the combustion air that fluidises and regenerates the catalyst.' },
      { name: 'Flue gas stack', p: [-44, 62, -6], d: 'Releases regenerator flue gas after heat recovery and particulate removal.' },
      { name: 'Main fractionator', p: [26, 26, -2.6], d: 'Separates the cracked vapour into gas, gasoline, light cycle oil and slurry.' },
    ],
    build(k) {
      k.box(84, 0.3, 54, -8, 0, 0, 'concrete');
      k.frame(-2, -6, 34, 22, [10, 20, 30, 42], { bays: [3, 2] });
      // regenerator
      k.head(7, -8, 12, -6, 'steel', -1, 0.5);
      k.cyl(7, 22, -8, 12, -6, 'steel', 48, 7, true);
      k.head(7, -8, 34, -6, 'steel', 1, 0.5);
      for (let y = 15; y < 34; y += 3) k.torus(7.01, 0.04, -8, y, -6, 'darksteel', 64);
      k.cyl(1.6, 3, -8, 37.4, -6, 'steel', 20);
      k.pipe([[-8, 40.2, -6], [-8, 44, -6], [-34, 44, -6], [-34, 20.5, -6]], 1.2, 'steel', 16);
      k.column(-34, -6, { skirt: 8, sections: [{ r: 2.4, h: 10 }], platforms: [14, 19], ladderAngle: Math.PI, bands: false });
      k.pipe([[-34, 10, -3.6], [-34, 10, -1], [-44, 10, -1], [-44, 10, -3.4]], 1.0, 'steel', 14);
      stack(k, -44, -6, 0, 2.6, 78, { key: 'concrete' });
      k.emitters.push({ p: V(-44, 79, -6), kind: 'smoke' });
      // stripper + reactor/disengager
      k.head(2.4, 8, 26, -6, 'steel', -1, 0.6);
      k.cyl(2.4, 13, 8, 26, -6, 'steel', 32);
      k.add(new THREE.CylinderGeometry(4.2, 2.4, 3, 36, 1, true), 'steel', k.at(8, 40.5, -6));
      k.cyl(4.2, 10, 8, 42, -6, 'steel', 40, 4.2, true);
      k.head(4.2, 8, 52, -6, 'steel', 1, 0.5);
      k.circPlatform(8, -6, 52, 4.2, 1.4, 0, TAU);
      // riser
      k.pipe([[14.2, 5, -6], [14.2, 48, -6], [12.2, 48, -6]], 1.0, 'steel', 16);
      k.cyl(1.5, 2, 14.2, 3.5, -6, 'darksteel', 20);
      for (let y = 8; y < 46; y += 5) k.torus(1.02, 0.06, 14.2, y, -6, 'darksteel', 24);
      // standpipes with slide valves
      k.pipe([[-8, 9, -6], [-8, 7, -6], [6, 5, -6], [14.2, 5, -6]], 0.7, 'steel', 14);
      k.box(1.8, 1.8, 1.8, 2, 5.3, -6, 'darksteel');
      k.hcyl(0.25, 3, 2, 6.2, -7.8, 'yellow', Math.PI / 2, 8);
      k.pipe([[8, 24.8, -6], [8, 23, -6], [-1, 18.5, -6]], 0.6, 'steel', 14);
      k.box(1.6, 1.6, 1.6, 3.8, 19.6, -6, 'darksteel');
      // main air blower and duct
      k.box(16, 9, 8, -8, 0, 18, 'panel');
      k.box(16.4, 0.4, 8.4, -8, 9, 18, 'darksteel');
      k.pipe([[-8, 4, 14], [-8, 4, -6], [-8, 8.2, -6]], 1.3, 'steel', 16);
      // vapour line to main fractionator
      k.pipe([[8, 54.3, -6], [8, 57, -6], [20, 57, -6], [20, 8, -6], [22.8, 8, -6]], 1.0, 'cladding', 16);
      k.column(26, -6, { skirt: 5, sections: [{ r: 3.2, h: 40 }], platforms: [10, 17, 24, 31, 38, 45.6], ladderAngle: Math.PI / 2 });
      airCooler(k, 38, -2, 12, 2, { bw: 6, bd: 9, ry: Math.PI / 2 });
      k.pipe([[26, 47, -6], [26, 49, -6], [33, 49, -6], [33, 15, -6], [35, 15, -2]], 0.6, 'cladding');
      for (let x = 22; x <= 34; x += 4) k.pump(x, 14);
      supportedRun(k, [30, 20], [30, 54], 6.5, [[0.3, 'steel'], [0.4, 'cladding'], [0.2, 'pipeGreen']]);
    },
  },
  /* ---------------------------------------------------------------- 07 Pipe rack */
  {
    id: 'rack', name: 'Main pipe rack', short: 'Pipe rack', kicker: 'The plant’s spine',
    origin: [0, 0, 0], anchor: [10, 16, 0], view: { dir: [0.35, 0.32, 1.0], dist: 70 },
    desc: 'A steel structure running the length of the plant, carrying process lines, steam, cooling water, nitrogen, flare and power cables between every unit, the tank farm and the jetty. Road access runs underneath. Large hot lines take up thermal growth in expansion loops.',
    stats: [['Width', '8 m'], ['Tiers', '2 + cable level'], ['Bent spacing', '6 m'], ['Clear height', '≥ 5.5 m']],
    parts: [
      { name: 'Expansion loop', p: [10, 13, 1], d: 'Hot lines rise and double back so thermal growth bends the loop instead of pushing the anchors.' },
      { name: 'Process tier', p: [-30, 7, 0], d: 'The lower level carries the process lines between units.' },
      { name: 'Utility tier', p: [-30, 9.6, 0], d: 'Steam, condensate, nitrogen, air and water lines.' },
      { name: 'Cable trays', p: [-30, 11.6, 0], d: 'Power and instrument cables run on trays above the pipes.' },
      { name: 'Bents', p: [-60, 5, 4], d: 'Portal frames every 6 m hold the tiers and leave a road-width clearway below.' },
    ],
    build(k) {
      const x0 = -250, x1 = 252;
      for (let x = x0; x <= x1; x += 6) {
        for (const z of [-4, 4]) { k.box(0.45, 12, 0.45, x, 0, z, 'structure'); k.box(1, 0.4, 1, x, 0, z, 'concrete'); }
        for (const y of [6.5, 9.1, 11.7]) k.box(0.35, 0.45, 8.6, x, y - 0.45, 0, 'structure');
        if (Math.abs(x) % 36 < 1) for (const z of [-4, 4]) { k.beam([x, 0.5, z], [x + 6, 6, z], 0.2, 'structure'); k.beam([x + 6, 0.5, z], [x, 6, z], 0.2, 'structure'); }
      }
      for (const y of [6.3, 8.9, 11.5]) for (const z of [-4, 4]) k.box(x1 - x0, 0.3, 0.3, (x0 + x1) / 2, y - 0.3, z, 'structure');
      const tier1 = [[0.5, 'cladding'], [0.35, 'steel'], [0.3, 'pipeGrey'], [0.45, 'cladding'], [0.25, 'pipeYellow'], [0.3, 'steel'], [0.4, 'pipeGreen'], [0.2, 'steel'], [0.35, 'pipeGrey']];
      const tier2 = [[0.3, 'pipeGreen'], [0.25, 'steel'], [0.45, 'pipeBlue'], [0.45, 'pipeBlue'], [0.2, 'pipeYellow'], [0.3, 'pipeRed'], [0.25, 'steel']];
      const run = (list, y) => list.forEach(([r, key], i) => {
        const z = -3.6 + (i + 0.5) * (7.2 / list.length);
        if (r >= 0.45 && y < 7) {
          const pts = [[x0, y + r, z]];
          for (const L of [-120, 10, 140]) pts.push([L - 5, y + r, z], [L - 5, y + r + 5 + i * 0.2, z], [L + 5, y + r + 5 + i * 0.2, z], [L + 5, y + r, z]);
          pts.push([x1, y + r, z]);
          k.pipe(pts, r, key, 12);
        } else k.pipe([[x0, y + r, z], [x1, y + r, z]], r, key, 10);
      });
      run(tier1, 6.5);
      run(tier2, 9.1);
      for (const z of [-2.5, 2.2]) k.box(x1 - x0, 0.15, 1.6, (x0 + x1) / 2, 11.7, z, 'darksteel');
      for (const x of [-190, -60, 70, 200]) k.lamp(x, 12.8, 4.5);
      // pipelines on sleepers: to the jetty (north) and the tank farm (south)
      for (let z = -8; z > -150; z -= 6) k.box(6, 0.8, 0.8, 0, 0, z, 'concrete');
      [[0.6, 'cladding'], [0.45, 'steel'], [0.35, 'pipeGrey'], [0.3, 'pipeRed']].forEach(([r, key], i) => k.pipe([[-2.2 + i * 1.5, 6.5 + r, -4], [-2.2 + i * 1.5, 6.5 + r, -8], [-2.2 + i * 1.5, 0.8 + r, -12], [-2.2 + i * 1.5, 0.8 + r, -152]], r, key, 12));
      for (let z = 8; z < 112; z += 6) k.box(6, 0.8, 0.8, -60, 0, z, 'concrete');
      [[0.55, 'steel'], [0.45, 'steel'], [0.35, 'pipeGrey'], [0.3, 'pipeRed']].forEach(([r, key], i) => k.pipe([[-62.2 + i * 1.5, 6.5 + r, 4], [-62.2 + i * 1.5, 6.5 + r, 8], [-62.2 + i * 1.5, 0.8 + r, 12], [-62.2 + i * 1.5, 0.8 + r, 112]], r, key, 12));
    },
  },
  /* ---------------------------------------------------------------- 08 Cooling tower */
  {
    id: 'cooling', name: 'Cooling tower', short: 'Cooling tower', kicker: 'Mechanical draft · 6 cells',
    origin: [60, 0, 58], anchor: [0, 22, 0], view: { dir: [0.45, 0.55, 1.0], dist: 95 },
    desc: 'Warm water returning from the plant’s exchangers is sprayed over fill packing while big fans pull air up through each cell. A small part evaporates, which cools the rest; it collects in the basin and is pumped back out. The white plume is condensed water vapour, not smoke.',
    stats: [['Cells', '6'], ['Fan diameter', '≈ 9 m'], ['Circulation', '15,000–30,000 m³/h'], ['Cooling range', '≈ 8–12 °C']],
    parts: [
      { name: 'Fan stacks', p: [-19.5, 16, 0], d: 'Velocity-recovery stacks around each fan; the fans draw air up through the fill.' },
      { name: 'Air inlet louvers', p: [0, 4, 8], d: 'Air enters low on both faces; louvers stop water splashing out.' },
      { name: 'Hot water risers', p: [-13, 9, 11], d: 'Return water climbs to distribution headers above the fill.' },
      { name: 'Cold water basin', p: [0, 1.2, 9.5], d: 'Cooled water collects in the concrete basin under the cells.' },
      { name: 'Circulating pumps', p: [-8, 1.5, 17], d: 'Large pumps send cooled water back around the refinery.' },
    ],
    build(k) {
      const n = 6, cw = 13, W = n * cw, D = 15;
      k.box(W + 4, 1.5, D + 4, 0, 0, 0, 'concrete');
      for (let i = 0; i < n; i++) {
        const x = -W / 2 + (i + 0.5) * cw;
        k.box(cw - 0.2, 6, D, x, 6, 0, 'panel');
        for (let y = 1.8; y < 6; y += 0.45) for (const s of [-1, 1]) k.box(cw - 0.4, 0.08, 0.5, x, y, s * (D / 2 - 0.1), 'darksteel');
        k.add(new THREE.CylinderGeometry(4.9, 4.4, 3.8, 40, 1, true), 'panelDS', k.at(x, 12.3 + 1.9, 0));
        k.torus(4.9, 0.08, x, 16.1, 0, 'darksteel', 40);
        const fan = makeFan(4.1, 8);
        fan.position.set(x, 13.2, 0);
        k.dynamic.push(fan);
        k.emitters.push({ p: V(x, 16.5, 0), kind: 'steam' });
        k.pipe([[x, 0.9, 11.5], [x, 13.2, 11.5], [x, 13.2, 7.6]], 0.55, 'pipeBlue', 14);
      }
      for (let i = 0; i <= n; i++) k.box(0.5, 12, D + 0.4, -W / 2 + i * cw, 1.5, 0, 'panel');
      k.box(W, 0.3, D, 0, 12, 0, 'panel');
      k.railing([-W / 2, -D / 2], [W / 2, -D / 2], 12.3);
      k.railing([-W / 2, D / 2], [W / 2, D / 2], 12.3);
      k.stair([W / 2 + 2, 0, -D / 2 + 1], [W / 2 + 2, 12.3, D / 2 - 1.5]);
      k.pipe([[-W / 2, 1, 11.5], [W / 2, 1, 11.5]], 1.0, 'pipeBlue', 16);
      for (let x = -12; x <= 12; x += 6) { k.pump(x, 17, Math.PI / 2); k.pipe([[x, 1.5, 15.5], [x, 1.5, 12.5]], 0.5, 'pipeBlue'); }
      k.lamp(-W / 2, 14.5, D / 2);
      k.lamp(W / 2, 14.5, -D / 2);
    },
  },
  /* ---------------------------------------------------------------- 09 LPG */
  {
    id: 'lpg', name: 'LPG storage spheres', short: 'LPG spheres', kicker: 'Pressurised storage',
    origin: [168, 0, 62], anchor: [0, 26, 0], view: { dir: [0.4, 0.4, 1.0], dist: 90 },
    desc: 'Propane and butane stay liquid only under pressure, so they are stored in spheres, which spread the stress evenly across the shell. Each sphere stands on legs welded at the equator, braced against wind and earthquake loads, and has a deluge ring to cool it with water in a fire.',
    stats: [['Diameter', '12–20 m'], ['Design pressure', '≈ 15–18 bar'], ['Capacity each', '1,000–3,500 m³'], ['Legs', '8–12']],
    parts: [
      { name: 'Sphere shell', p: [0, 14, 8.3], d: 'Welded steel plates form the pressure vessel; a sphere needs the least material for its volume.' },
      { name: 'Legs and bracing', p: [0, 6, 8], d: 'Columns welded at the equator, with cross-bracing between them.' },
      { name: 'Relief valves', p: [0, 23, 0], d: 'Safety valves on the top platform protect against overpressure.' },
      { name: 'Deluge ring', p: [0, 20.5, 5], d: 'A water ring that sprays the shell to keep it cool during a fire.' },
      { name: 'Stairway', p: [-6, 10, -6], d: 'A stair tower to the equator, then steps up the shell to the top platform.' },
    ],
    build(k) {
      k.box(76, 0.3, 32, 0, 0, 0, 'concrete');
      for (const [a, b] of [[[-38, -16], [38, -16]], [[-38, 16], [38, 16]], [[-38, -16], [-38, 16]], [[38, -16], [38, 16]]]) {
        const cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2;
        k.box(Math.abs(b[0] - a[0]) + 0.5, 1.2, Math.abs(b[1] - a[1]) + 0.5, cx, 0, cz, 'concrete');
      }
      for (const x of [-24, 0, 24]) {
        sphere(k, x, 0, 8, 14);
        k.pipe([[x, 6, 0], [x, 1.2, 0], [x, 1.2, 12], [-30, 1.2, 12]], 0.25, 'pipeGrey');
      }
      k.pipe([[-30, 1.2, 12], [-40, 1.2, 12], [-40, 1.2, -62], [-108, 1.2, -62]], 0.35, 'pipeGrey');
    },
  },
  /* ---------------------------------------------------------------- 10 Tank farm */
  {
    id: 'tanks', name: 'Tank farm', short: 'Tank farm', kicker: 'Crude & product storage',
    origin: [-40, 0, 205], anchor: [-60, 30, -40], view: { dir: [0.25, 0.75, 1.0], dist: 290 },
    desc: 'Crude waits here before processing and finished products wait for shipment. The big tanks have external floating roofs that ride on the liquid, cutting vapour losses; smaller fixed cone-roof tanks hold heavier products. Each group sits inside a bund wall that can contain a full tank’s contents.',
    stats: [['Floating-roof tanks', '6'], ['Largest', '≈ 52 m dia'], ['Capacity each', '≈ 30,000–90,000 m³'], ['Cone-roof tanks', '4']],
    parts: [
      { name: 'Floating roof', p: [-150, 12, -45], d: 'A pontoon-supported steel deck that floats on the liquid, leaving almost no vapour space.', dist: 60 },
      { name: 'Rolling ladder', p: [-121, 17, -30], d: 'Runs from the gauger’s platform down to the roof and rolls along a track as the roof moves.', dist: 36 },
      { name: 'Wind girder', p: [-85, 19.5, -19], d: 'A stiffening ring near the top of an open-top shell; it doubles as a walkway.', dist: 40 },
      { name: 'Spiral stair', p: [-120, 10, -58], d: 'Climbs around the shell to the gauger’s platform.', dist: 40 },
      { name: 'Foam chambers', p: [-25, 18, -22.5], d: 'Discharge firefighting foam into the rim seal area if a fire starts.', dist: 36 },
      { name: 'Bund wall', p: [-60, 1.5, -80], d: 'A low concrete wall that contains a spill; the enclosed volume exceeds the largest tank.', dist: 60 },
      { name: 'Cone-roof tanks', p: [-15, 15, 45], d: 'Fixed-roof tanks for low-volatility products such as fuel oil.', dist: 70 },
    ],
    build(k) {
      k.box(360, 0.2, 190, -50, 0, 0, 'asphalt');
      const fl = [[-150, -45, 26, 20, 11], [-85, -45, 26, 20, 16], [-25, -45, 22, 18, 7], [35, -45, 22, 18, 13], [-150, 45, 22, 18, 14], [-95, 45, 22, 18, 6]];
      fl.forEach(([x, z, R, H, lvl], i) => floatingTank(k, x, z, R, H, lvl, 0.4 + i * 0.9));
      [[-45, 45], [-15, 45], [15, 45], [45, 45]].forEach(([x, z], i) => coneTank(k, x, z, 11, 14, 1 + i));
      const wall = (x0, z0, x1, z1) => k.box(Math.abs(x1 - x0) + 0.6, 1.6, Math.abs(z1 - z0) + 0.6, (x0 + x1) / 2, 0, (z0 + z1) / 2, 'concrete');
      for (const [xa, xb, za, zb] of [[-185, 65, -80, -10], [-185, -60, 12, 80], [-60, 65, 22, 70]]) {
        wall(xa, za, xb, za); wall(xa, zb, xb, zb); wall(xa, za, xa, zb); wall(xb, za, xb, zb);
      }
      wall(-117, -80, -117, -10); wall(-55, -80, -55, -10); wall(5, -80, 5, -10); wall(-122, 12, -122, 80);
      k.pipe([[-185, 1, 0], [70, 1, 0]], 0.6, 'steel', 12);
      k.pipe([[-185, 1, 2], [70, 1, 2]], 0.45, 'pipeGrey', 12);
      k.pipe([[-20, 1.4, 2], [-20, 1.4, -92]], 0.45, 'pipeGrey', 12);
      for (let x = -180; x < 70; x += 60) { k.cyl(0.2, 9, x, 0, -3, 'structure', 8); k.lamp(x, 9.2, -3); }
    },
  },
  /* ---------------------------------------------------------------- 11 Flare */
  {
    id: 'flare', name: 'Flare system', short: 'Flare', kicker: 'Emergency relief',
    origin: [305, 0, -100], anchor: [0, 116, 0], view: { dir: [-0.6, 0.35, 1.0], dist: 170 },
    desc: 'The plant’s safety valve. Relief valves across every unit discharge into a common header. Liquids drop out in a knock-out drum, and the gas passes a liquid seal, climbs the derrick-supported riser and burns at the tip. Continuous pilot flames keep it ready to light at any moment.',
    stats: [['Height', '≈ 100 m'], ['Support', 'Derrick'], ['Smokeless capacity', 'with steam assist'], ['Pilots', '3–4, always lit']],
    parts: [
      { name: 'Flare tip & pilots', p: [0, 103, 0], d: 'The burner at the top, ringed by continuously burning pilot flames.', dist: 34 },
      { name: 'Molecular seal', p: [0, 96.5, 1.5], d: 'Uses purge gas buoyancy to stop air getting back down the stack.', dist: 30 },
      { name: 'Derrick structure', p: [0, 50, 4], d: 'A three-legged lattice tower that holds up the tall, slender riser.', dist: 70 },
      { name: 'Knock-out drum', p: [-18, 4, 8], d: 'Removes liquid droplets from the relief gas so burning liquid cannot rain out.', dist: 40 },
      { name: 'Liquid seal drum', p: [-5, 6, 10], d: 'Gas bubbles through a water seal, which prevents flashback into the header.', dist: 30 },
    ],
    build(k) {
      k.box(52, 0.3, 44, -8, 0, 4, 'concrete');
      const H = 94;
      const legs = [0, 1, 2].map((i) => (i / 3) * TAU + 0.3);
      const at = (a, y) => { const r = 8 - (6 * y) / H; return V(Math.sin(a) * r, y, Math.cos(a) * r); };
      legs.forEach((a) => { k.rod(at(a, 0), at(a, H), 0.32, 'structure', 8); k.box(2, 1, 2, at(a, 0).x, 0, at(a, 0).z, 'concrete'); });
      for (let y = 0; y < H; y += 7) {
        const y2 = Math.min(H, y + 7);
        legs.forEach((a, i) => {
          const b = legs[(i + 1) % 3];
          k.rod(at(a, y2), at(b, y2), 0.12, 'structure', 5);
          k.rod(at(a, y), at(b, y2), 0.09, 'structure', 4);
          k.rod(at(b, y), at(a, y2), 0.09, 'structure', 4);
          k.rod(V(0, y2, 0), at(a, y2), 0.08, 'structure', 4);
        });
      }
      for (let y = 0; y < H; y += 8) k.cyl(0.8, Math.min(8, H - y), 0, y, 0, (y / 8) % 2 ? 'white' : 'pipeRed', 20);
      k.cyl(1.5, 5, 0, H, 0, 'darksteel', 24);
      k.circPlatform(0, 0, H + 1.5, 1.5, 1.6, 0, TAU, false);
      k.cyl(0.95, 3.5, 0, H + 5, 0, 'darksteel', 20);
      k.torus(1.1, 0.12, 0, H + 8.3, 0, 'darksteel', 24);
      for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; k.rod([Math.sin(a) * 1.25, H + 2, Math.cos(a) * 1.25], [Math.sin(a) * 1.25, H + 8.9, Math.cos(a) * 1.25], 0.08, 'steel', 6); }
      k.ladder(0, 0, 0.8, 0, H + 1.5, Math.PI, true);
      for (const y of [30, 62, 92]) legs.forEach((a) => { const p = at(a, y); k.sphere(0.3, p.x, p.y + 0.4, p.z, 'redLight', 8); });
      flame(k, 0, H + 8.6, 0, 8, 22);
      k.drum(-18, 3.6, 8, 3, 16, 0);
      k.column(-5, 10, { skirt: 1, sections: [{ r: 2, h: 7 }], platforms: [9.3], ladderAngle: Math.PI, bands: false });
      k.pipe([[-60, 9, 100], [-60, 5, 60], [-60, 5, 8], [-26.5, 5, 8]], 0.9, 'steel', 14);
      k.pipe([[-10, 5, 8], [-7, 5, 8], [-7, 5, 10]], 0.8, 'steel', 14);
      k.pipe([[-5, 8, 7.8], [-5, 8, 4], [-1, 8, 0.5], [-0.3, 8, 0]], 0.8, 'steel', 14);
      for (let z = 12; z < 100; z += 8) k.box(3, 4.5, 0.6, -60, 0, z, 'concrete');
    },
  },
  /* ---------------------------------------------------------------- 12 Marine terminal */
  {
    id: 'jetty', name: 'Marine terminal', short: 'Jetty & tanker', kicker: 'Crude import · product export',
    origin: [0, 0, -150], anchor: [0, 36, -268], view: { dir: [0.75, 0.55, 0.6], dist: 210 },
    desc: 'A trestle carries the pipelines about 250 m out to deep water. At the loading platform, articulated marine loading arms connect to the tanker’s midship manifold. Breasting dolphins take the ship’s weight against fenders, and mooring dolphins hold its lines. A large crude carrier can discharge its whole cargo in about a day and a half.',
    stats: [['Trestle length', '≈ 250 m'], ['Loading arms', '4 × 16″'], ['Tanker length', '250 m'], ['Deadweight', '≈ 115,000 t (Aframax)']],
    parts: [
      { name: 'Loading arms', p: [0, 24, -265], d: 'Counterweighted, articulated pipe arms that follow the ship as it rises and falls.', dist: 55 },
      { name: 'Breasting dolphins', p: [45, 8, -268], d: 'Piled structures with fenders that take the ship’s berthing load.', dist: 50 },
      { name: 'Mooring dolphins', p: [115, 8, -258], d: 'Hold the mooring lines at the bow and stern.', dist: 50 },
      { name: 'Trestle', p: [0, 8, -110], d: 'A piled causeway carrying pipelines and a service road out to the berth.', dist: 70 },
      { name: 'Ship manifold', p: [0, 15, -284], d: 'Midship crossover where the loading arms bolt on.', dist: 45 },
      { name: 'Accommodation & bridge', p: [-92, 26, -298], d: 'Crew quarters, engine casing and the navigation bridge at the stern.', dist: 70 },
    ],
    build(k) {
      // trestle
      const dy = 7;
      for (let z = -8; z > -236; z -= 12) for (const x of [-4, 4]) k.cyl(0.5, dy + 12, x, -12, z, 'concrete', 12);
      k.box(9, 0.6, 236, 0, dy - 0.6, -118, 'concrete');
      k.railing([-4.5, -2], [-4.5, -236], dy);
      k.railing([4.5, -2], [4.5, -236], dy);
      [[0.6, 'cladding'], [0.45, 'steel'], [0.35, 'pipeGrey'], [0.3, 'pipeRed']].forEach(([r, key], i) => k.pipe([[-2.2 + i * 1.5, 0.8 + r, -2], [-2.2 + i * 1.5, dy + 0.5 + r, -10], [-2.2 + i * 1.5, dy + 0.5 + r, -250]], r, key, 12));
      for (let z = -12; z > -236; z -= 30) k.lamp(4.3, dy + 6, z);
      for (let z = -12; z > -236; z -= 30) k.cyl(0.12, 6, 4.3, dy, z, 'structure', 6);
      // loading platform
      for (let x = -24; x <= 24; x += 8) for (let z = -238; z >= -262; z -= 8) k.cyl(0.6, dy + 12, x, -12, z, 'concrete', 12);
      k.box(52, 1.2, 30, 0, dy - 1.2, -250, 'concrete');
      k.box(8, 4, 6, -18, dy, -242, 'superWhite');
      k.box(8.4, 0.3, 6.4, -18, dy + 4, -242, 'darksteel');
      k.box(7, 1, 0.1, -18, dy + 2.2, -238.95, 'glass');
      k.railing([-26, -236], [-26, -264], dy);
      k.railing([26, -236], [26, -264], dy);
      // loading arms
      for (const x of [-15, -5, 5, 15]) {
        k.box(2, 0.6, 2, x, dy, -261, 'concrete');
        k.cyl(0.45, 12, x, dy + 0.6, -261, 'superWhite', 16);
        k.sphere(0.7, x, dy + 12.8, -261, 'superWhite', 14);
        k.pipe([[x, dy + 12.8, -261], [x, dy + 21, -267]], 0.32, 'superWhite', 12);
        k.pipe([[x, dy + 21, -267], [x, dy + 8.6, -283], [x, dy + 7.4, -283]], 0.3, 'superWhite', 12);
        k.rod([x + 0.6, dy + 12.8, -261], [x + 0.6, dy + 16, -255.5], 0.12, 'darksteel', 6);
        k.box(1.6, 1.6, 1.6, x + 0.6, dy + 15.2, -255, 'pipeBlue');
        k.rod([x - 0.6, dy + 21, -267], [x - 0.6, dy + 22.5, -262], 0.1, 'darksteel', 6);
        k.box(1.2, 1.2, 1.2, x - 0.6, dy + 22, -261.6, 'pipeBlue');
        k.lamp(x, dy + 13.8, -261);
      }
      // fire monitor towers
      for (const x of [-22, 22]) {
        k.frame(x, -256, 2.4, 2.4, [6, 14, 20], { bays: [1, 1], floors: true, rails: true, brace: true, key: 'pipeRed' });
        k.rod([x, dy + 20, -256], [x, dy + 21.5, -258], 0.25, 'pipeRed', 8);
      }
      // dolphins and catwalks
      const dolphin = (x, z, w, d, fenders) => {
        for (const px of [-w / 3, w / 3]) for (const pz of [-d / 3, d / 3]) k.cyl(0.55, 16, x + px, -12, z + pz, 'concrete', 10);
        k.box(w, 3, d, x, 4, z, 'concrete');
        if (fenders) for (const fx of [-w / 4, w / 4]) k.add(new THREE.CylinderGeometry(1.1, 1.1, 3.4, 16), 'hullBlack', k.at(x + fx, 4.5, z - d / 2 - 1.1));
        k.cyl(0.35, 0.8, x, 7, z + d / 4, 'darksteel', 10);
        k.cyl(0.35, 0.8, x + 1.4, 7, z + d / 4, 'darksteel', 10);
        k.lamp(x, 11, z);
        k.cyl(0.1, 4, x, 7, z, 'structure', 6);
      };
      for (const x of [-72, -42, 42, 72]) dolphin(x, -266, 8, 7, true);
      for (const x of [-128, -100, 100, 128]) dolphin(x, -254, 7, 7, false);
      const walk = (x0, x1, z) => {
        k.box(Math.abs(x1 - x0), 0.25, 1.4, (x0 + x1) / 2, 7.8, z, 'grating');
        for (const s of [-0.7, 0.7]) k.rod([x0, 8.9, z + s], [x1, 8.9, z + s], 0.03, 'yellow', 4);
        for (const s of [-0.7, 0.7]) k.beam([x0, 7.2, z + s], [x1, 7.2, z + s], 0.15, 'structure');
      };
      walk(-26, -38, -262); walk(-46, -68, -266); walk(-76, -96.5, -260); walk(-103.5, -124.5, -254);
      walk(26, 38, -262); walk(46, 68, -266); walk(76, 96.5, -260); walk(103.5, 124.5, -254);

      // tanker (hull plan: stern at -x, bow at +x)
      const L = 250, B = 44, zc = -298;
      const plan = new THREE.Shape();
      const hb = B / 2;
      plan.moveTo(-L / 2, -hb * 0.8);
      plan.quadraticCurveTo(-L / 2 - 2, 0, -L / 2, hb * 0.8);
      plan.quadraticCurveTo(-L / 2 + 1, hb, -L / 2 + 12, hb);
      plan.lineTo(L / 2 - 45, hb);
      plan.bezierCurveTo(L / 2 - 15, hb, L / 2, hb * 0.35, L / 2 + 2, 0);
      plan.bezierCurveTo(L / 2, -hb * 0.35, L / 2 - 15, -hb, L / 2 - 45, -hb);
      plan.lineTo(-L / 2 + 12, -hb);
      plan.quadraticCurveTo(-L / 2 + 1, -hb, -L / 2, -hb * 0.8);
      const hull = (y0, h, key, inset = 0) => {
        const g = new THREE.ExtrudeGeometry(plan, { depth: h, bevelEnabled: false, curveSegments: 18 });
        g.rotateX(-Math.PI / 2);
        if (inset) g.scale(1 - inset / L, 1, 1 - inset / B);
        g.translate(0, y0, zc);
        k.add(g, key);
      };
      hull(-15, 16.2, 'hullRed');
      hull(1.2, 10.8, 'hullBlack');
      hull(12, 0.25, 'deck', 1.5);
      k.box(28, 3, B - 4, L / 2 - 34, 12, zc, 'hullBlack');
      k.box(27, 0.2, B - 5, L / 2 - 34, 15, zc, 'deck');
      k.cyl(0.35, 12, L / 2 - 30, 15, zc, 'superWhite', 10);
      // deck: pipelines, catwalk, hatches, manifold, cranes
      for (const dz of [-4, -2, 0]) k.pipe([[-70, 12.9, zc + dz], [L / 2 - 50, 12.9, zc + dz]], 0.45, 'pipeRed', 10);
      for (let x = -70; x < L / 2 - 50; x += 8) k.box(0.4, 2.2, 0.4, x, 12.2, zc + 3, 'structure');
      k.box(L / 2 - 50 + 70, 0.2, 1.4, (L / 2 - 50 - 70) / 2, 14.4, zc + 3, 'grating');
      for (let x = -66; x < L / 2 - 52; x += 12) for (const dz of [-12, 10]) k.cyl(0.8, 0.9, x, 12.2, zc + dz, 'pipeRed', 14);
      for (const dx of [-4, 0, 4]) k.pipe([[dx, 12.9, zc - 4], [dx, 12.9, zc + hb - 1.5], [dx, 14.2, zc + hb - 1.5]], 0.45, 'pipeRed', 10);
      for (const dz of [hb - 5, -hb + 5]) {
        k.cyl(0.6, 10, -12, 12.2, zc + dz, 'superWhite', 14);
        k.rod([-12, 22, zc + dz], [4, 19, zc + dz * 0.8], 0.35, 'superWhite', 8);
      }
      // accommodation, bridge, funnel
      const ax = -L / 2 + 30;
      k.box(20, 18, 32, ax, 12, zc, 'superWhite');
      for (let lvl = 0; lvl < 5; lvl++) {
        const y = 14 + lvl * 3.4;
        k.box(0.1, 1.2, 28, ax + 10.05, y, zc, 'glass');
        for (const s of [-1, 1]) k.box(18, 1.2, 0.1, ax, y, zc + s * 16.05, 'glass');
      }
      k.box(14, 3.2, B + 2, ax + 1, 30, zc, 'superWhite');
      k.box(0.1, 1.6, B, ax + 8.05, 31.2, zc, 'glass');
      k.box(1.2, 8, 1.2, ax, 33.2, zc, 'superWhite');
      k.box(6, 0.3, 0.6, ax, 39, zc, 'darksteel');
      k.box(9, 14, 8, ax - 16, 12, zc, 'hullBlack');
      k.box(9.1, 2, 8.1, ax - 16, 22, zc, 'pipeRed');
      k.emitters.push({ p: V(ax - 16, 27, zc), kind: 'smoke' });
      for (const s of [-1, 1]) {
        k.box(8, 2.6, 3, ax - 4, 20, zc + s * 18, 'orange');
        k.box(0.3, 4, 0.3, ax - 7, 18, zc + s * 17, 'structure');
      }
      for (const [x, y, z] of [[L / 2 - 30, 27, zc], [ax, 39.5, zc], [-L / 2 + 4, 14, zc]]) k.lamp(x, y, z);
    },
  },
];

/* ================================================================== site (unlabelled context) */
export function buildSite(k) {
  // roads
  const road = (x0, z0, x1, z1, w = 9) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    k.box(x0 === x1 ? w : len + w, 0.12, x0 === x1 ? len + w : w, (x0 + x1) / 2, 0, (z0 + z1) / 2, 'asphalt');
    const n = Math.floor(len / 10);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      k.box(x0 === x1 ? 0.2 : 3.5, 0.02, x0 === x1 ? 3.5 : 0.2, x, 0.12, z, 'white');
    }
  };
  road(-270, 20, 280, 20); road(-270, -92, 250, -92); road(-270, 100, 280, 100);
  road(-235, -130, -235, 300); road(-75, -92, -75, 20); road(12, -130, 12, 20); road(86, -92, 86, 20); road(245, -140, 245, 100);
  road(86, 20, 86, 100);
  // control room, substation, admin & workshop
  k.box(34, 6, 20, -60, 0, 52, 'concrete');
  k.box(34.4, 0.5, 20.4, -60, 6, 52, 'darksteel');
  k.box(26, 1.1, 0.1, -60, 3, 62.05, 'glass');
  k.box(12, 4, 10, -104, 0, 56, 'panel');
  for (let i = 0; i < 3; i++) { k.box(3, 3, 2.4, -118 + i * 5, 0, 70, 'pipeGreen'); k.box(3.4, 0.3, 2.8, -118 + i * 5, 3, 70, 'darksteel'); }
  k.box(40, 10, 22, 140, 0, 140, 'panel');
  k.box(40.4, 0.4, 22.4, 140, 10, 140, 'darksteel');
  for (let i = 0; i < 6; i++) k.box(5, 1.3, 0.1, 124 + i * 6.4, 6, 151.05, 'glass');
  k.box(50, 12, 26, 220, 0, 150, 'superWhite');
  k.box(50.4, 0.4, 26.4, 220, 12, 150, 'panel');
  // street lights along roads
  for (let x = -250; x <= 270; x += 45) for (const z of [26, 94]) { k.cyl(0.14, 10, x, 0, z, 'structure', 6); k.lamp(x, 10.2, z); }
  // shoreline revetment
  const rng = mulberry(7);
  for (let i = 0; i < 420; i++) {
    const x = -700 + rng() * 1400;
    const z = -148 - rng() * 10;
    const s = 1.2 + rng() * 2.6;
    k.add(new THREE.DodecahedronGeometry(s, 0), 'rock', k.at(x, -0.6 + rng() * 1.2, z, rng() * 3, rng() * 3, rng() * 3, 1, 0.7, 1));
  }
  k.box(1400, 2.2, 8, 0, -1.8, -146, 'rock');
  // perimeter fence
  for (const [a, b] of [[[-300, -140], [-300, 330]], [[340, -140], [340, 330]], [[-300, 330], [340, 330]]]) {
    const A = V(a[0], 0, a[1]), B = V(b[0], 0, b[1]);
    const len = A.distanceTo(B);
    for (let t = 0; t <= len; t += 4) { const p = A.clone().lerp(B, t / len); k.box(0.12, 2.6, 0.12, p.x, 0, p.z, 'structure'); }
    k.beam(A.clone().setY(2.5), B.clone().setY(2.5), 0.06, 'structure');
    k.box(a[0] === b[0] ? 0.03 : len, 2.3, a[0] === b[0] ? len : 0.03, (a[0] + b[0]) / 2, 0.2, (a[1] + b[1]) / 2, 'fenceMesh');
  }
}

export function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
