import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ------------------------------------------------------------------
   Materials. Each unit gets its own clones (so a unit can be highlighted
   on its own); `key` names are shared across the plant.
------------------------------------------------------------------ */
const std = (color, roughness, metalness, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

export const BASE = {
  cladding: std(0xd3d6da, 0.36, 0.78),   // aluminium jacket over insulation
  steel: std(0xb4b9bf, 0.42, 0.7),
  darksteel: std(0x4b5057, 0.55, 0.55),
  structure: std(0x6a7078, 0.62, 0.45),  // galvanised structural steel
  grating: std(0x55595e, 0.8, 0.4),
  yellow: std(0xd6a21e, 0.5, 0.25),      // handrails, ladders, cages
  white: std(0xe9e6df, 0.55, 0.08),      // tank paint
  whiteDS: std(0xe4e1da, 0.6, 0.08, { side: THREE.DoubleSide }),
  concrete: std(0xaaa59b, 0.95, 0.0),
  asphalt: std(0x3c3e41, 0.92, 0.0),
  casing: std(0x7e868d, 0.55, 0.5),      // heater casing
  refractory: std(0x8b5a3c, 0.85, 0.1),
  rust: std(0x7a4a33, 0.8, 0.3),
  pipeGrey: std(0x8f969d, 0.45, 0.6),
  pipeGreen: std(0x4c7a58, 0.55, 0.3),
  pipeRed: std(0xa1322a, 0.5, 0.3),
  pipeYellow: std(0xc9a23c, 0.5, 0.3),
  pipeBlue: std(0x3d6f98, 0.5, 0.3),
  hullBlack: std(0x1f2429, 0.55, 0.35),
  hullRed: std(0x7d2721, 0.6, 0.3),
  deck: std(0x49604e, 0.75, 0.2),
  superWhite: std(0xf0efe9, 0.5, 0.1),
  panel: std(0x7f8c86, 0.7, 0.3),        // cooling tower cladding
  panelDS: std(0x76837d, 0.7, 0.3, { side: THREE.DoubleSide }),
  ground: std(0x8a8377, 0.97, 0.0),
  orange: std(0xe0661d, 0.5, 0.1),
  fenceMesh: std(0x9aa0a6, 0.6, 0.6, { transparent: true, opacity: 0.28, depthWrite: false }),
  glass: std(0x1d2b36, 0.12, 0.9, { emissive: new THREE.Color(0xffc27a), emissiveIntensity: 0 }),
  rock: std(0x66625c, 0.95, 0.0, { flatShading: true }),
  glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 2.4, 0.7) }),
  redLight: new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 0.35, 0.2) }),
};

/* ------------------------------------------------------------------ Kit: collects geometry per material, merges on build */
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const Y = new THREE.Vector3(0, 1, 0);

export class Kit {
  constructor(id) {
    this.id = id;
    this.bins = new Map();
    this.mats = {};
    this.lamps = [];     // world-space lamp positions (lit at night)
    this.dynamic = [];   // objects added unmerged (fans, flames...)
    this.emitters = [];  // steam / smoke sources in local space
    this.group = new THREE.Group();
    this.group.name = id;
    this.origin = new THREE.Vector3();
  }

  mat(key) {
    if (!this.mats[key]) {
      const m = BASE[key].clone();
      if (key !== 'glow' && key !== 'redLight') m.userData.base = { emissive: m.emissive?.clone() };
      this.mats[key] = m;
    }
    return this.mats[key];
  }

  /** Add a geometry (consumed) with a matrix or position/rotation. */
  add(geo, key, matrix) {
    if (matrix) geo.applyMatrix4(matrix);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const bin = `${key}|${geo.index ? 'i' : 'n'}`;
    if (!this.bins.has(bin)) this.bins.set(bin, { key, list: [] });
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    geo.clearGroups();
    this.bins.get(bin).list.push(geo);
    return geo;
  }
  at(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _q.setFromEuler(new THREE.Euler(rx, ry, rz));
    return _m.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz)).clone();
  }

  /* ---------- primitives ---------- */
  box(w, h, d, x, y, z, key, ry = 0) {
    return this.add(new THREE.BoxGeometry(w, h, d), key, this.at(x, y + h / 2, z, 0, ry, 0));
  }
  cyl(r, h, x, y, z, key, seg = 24, rTop = r, open = false) {
    return this.add(new THREE.CylinderGeometry(rTop, r, h, seg, 1, open), key, this.at(x, y + h / 2, z));
  }
  /** Horizontal cylinder along X (ry rotates about Y). */
  hcyl(r, len, x, y, z, key, ry = 0, seg = 24) {
    return this.add(new THREE.CylinderGeometry(r, r, len, seg), key, this.at(x, y, z, 0, ry, Math.PI / 2));
  }
  sphere(r, x, y, z, key, seg = 24, sy = 1) {
    return this.add(new THREE.SphereGeometry(r, seg, Math.max(8, seg >> 1)), key, this.at(x, y, z, 0, 0, 0, 1, sy, 1));
  }
  /** Dome head: top (dir=1) or bottom (dir=-1); ratio 0.5 = 2:1 ellipsoidal, 1 = hemispherical. */
  head(r, x, y, z, key, dir = 1, ratio = 0.5, seg = 32) {
    const g = new THREE.SphereGeometry(r, seg, 12, 0, Math.PI * 2, dir > 0 ? 0 : Math.PI / 2, Math.PI / 2);
    return this.add(g, key, this.at(x, y, z, 0, 0, 0, 1, ratio, 1));
  }
  /** Rod between two points. */
  rod(a, b, r, key, seg = 6) {
    const A = a.isVector3 ? a : new THREE.Vector3(...a);
    const B = b.isVector3 ? b : new THREE.Vector3(...b);
    const dir = new THREE.Vector3().subVectors(B, A);
    const len = dir.length();
    if (len < 1e-4) return;
    const g = new THREE.CylinderGeometry(r, r, len, seg, 1, true);
    _q.setFromUnitVectors(Y, dir.normalize());
    _m.compose(_v.addVectors(A, B).multiplyScalar(0.5), _q, _s.set(1, 1, 1));
    return this.add(g, key, _m);
  }
  /** Square-section member between two points (beams, bracing). */
  beam(a, b, t, key) {
    const A = a.isVector3 ? a : new THREE.Vector3(...a);
    const B = b.isVector3 ? b : new THREE.Vector3(...b);
    const dir = new THREE.Vector3().subVectors(B, A);
    const len = dir.length();
    if (len < 1e-4) return;
    const g = new THREE.BoxGeometry(t, len, t);
    _q.setFromUnitVectors(Y, dir.normalize());
    _m.compose(_v.addVectors(A, B).multiplyScalar(0.5), _q, _s.set(1, 1, 1));
    return this.add(g, key, _m);
  }
  /** Pipe along a polyline with welded elbow joints. */
  pipe(points, r, key = 'pipeGrey', seg = 10) {
    const P = points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p)));
    for (let i = 0; i < P.length - 1; i++) this.rod(P[i], P[i + 1], r, key, seg);
    for (let i = 1; i < P.length - 1; i++) this.add(new THREE.SphereGeometry(r * 1.04, seg, 6), key, this.at(P[i].x, P[i].y, P[i].z));
  }
  /** Flat annulus (platforms, wind girders) with thickness. */
  ring(rIn, rOut, t, x, y, z, key, seg = 48, a0 = 0, arc = Math.PI * 2) {
    const shape = [new THREE.Vector2(rIn, 0), new THREE.Vector2(rOut, 0), new THREE.Vector2(rOut, t), new THREE.Vector2(rIn, t), new THREE.Vector2(rIn, 0)];
    return this.add(new THREE.LatheGeometry(shape, seg, a0, arc), key, this.at(x, y, z));
  }
  /** Horizontal torus arc; a0 uses the same angle convention as positions (sin a, cos a). */
  torus(R, r, x, y, z, key, seg = 64, arc = Math.PI * 2, a0 = 0) {
    return this.add(new THREE.TorusGeometry(R, r, 5, seg, arc), key, this.at(x, y, z, Math.PI / 2, 0, Math.PI / 2 - a0 - arc));
  }
  lamp(x, y, z) {
    this.lamps.push(new THREE.Vector3(x, y, z));
  }

  /* ---------- assemblies ---------- */

  /** Circular platform with railing around a vertical vessel. */
  circPlatform(cx, cz, y, rVessel, width = 1.4, a0 = 0, arc = Math.PI * 2, lamps = true) {
    const rOut = rVessel + width;
    this.ring(rVessel + 0.05, rOut, 0.12, cx, y - 0.12, cz, 'grating', 48, a0, arc);
    this.torus(rOut - 0.05, 0.035, cx, y + 1.1, cz, 'yellow', 64, arc, a0);
    this.torus(rOut - 0.05, 0.03, cx, y + 0.55, cz, 'yellow', 64, arc, a0);
    const n = Math.max(6, Math.round((rOut * arc) / 1.8));
    for (let i = 0; i <= n; i++) {
      const a = a0 + (arc * i) / n;
      const px = cx + Math.sin(a) * (rOut - 0.05), pz = cz + Math.cos(a) * (rOut - 0.05);
      this.rod([px, y, pz], [px, y + 1.1, pz], 0.03, 'yellow', 4);
    }
    // bracket struts under the platform
    for (let i = 0; i < 6; i++) {
      const a = a0 + (arc * (i + 0.5)) / 6;
      const s = Math.sin(a), c = Math.cos(a);
      this.beam([cx + s * rVessel, y - 1.2, cz + c * rVessel], [cx + s * (rOut - 0.1), y - 0.12, cz + c * (rOut - 0.1)], 0.1, 'structure');
    }
    if (lamps) this.lamp(cx + Math.sin(a0 + arc / 2) * (rOut - 0.2), y + 2.2, cz + Math.cos(a0 + arc / 2) * (rOut - 0.2));
  }

  /** Caged vertical ladder at angle `a` on a vessel of radius r. */
  ladder(cx, cz, r, y0, y1, a, cage = true) {
    const s = Math.sin(a), c = Math.cos(a);
    const tx = c, tz = -s; // tangent
    const d = r + 0.35;
    const L = [cx + s * d - tx * 0.22, cz + c * d - tz * 0.22];
    const R = [cx + s * d + tx * 0.22, cz + c * d + tz * 0.22];
    this.rod([L[0], y0, L[1]], [L[0], y1 + 1.1, L[1]], 0.03, 'yellow', 4);
    this.rod([R[0], y0, R[1]], [R[0], y1 + 1.1, R[1]], 0.03, 'yellow', 4);
    for (let y = y0 + 0.3; y < y1; y += 0.3) this.rod([L[0], y, L[1]], [R[0], y, R[1]], 0.016, 'yellow', 3);
    if (!cage) return;
    for (let y = y0 + 2.2; y < y1 + 1; y += 0.9) {
      this.torus(0.42, 0.018, cx + s * (d + 0.02), y, cz + c * (d + 0.02), 'yellow', 10, Math.PI, a - Math.PI / 2);
    }
    for (let k = -1; k <= 1; k++) {
      const off = d + 0.42 - Math.abs(k) * 0.14;
      this.rod([cx + s * off + tx * k * 0.34, y0 + 2.2, cz + c * off + tz * k * 0.34], [cx + s * off + tx * k * 0.34, y1 + 1, cz + c * off + tz * k * 0.34], 0.012, 'yellow', 3);
    }
  }

  /**
   * Vertical process vessel / column.
   * sections: [{ r, h }] bottom → top; cones are inserted where radius changes.
   */
  column(cx, cz, { base = 0, skirt = 4, sections, top = 'ellipse', key = 'cladding', platforms = [], ladderAngle = 0, bands = true, nozzles = [] }) {
    const r0 = sections[0].r;
    this.cyl(r0 * 1.02, skirt, cx, base, cz, 'darksteel', 32);
    this.cyl(r0 * 1.12, 0.5, cx, base, cz, 'concrete', 32);
    let y = base + skirt;
    this.head(r0, cx, y, cz, key, -1, 0.5);
    const profile = [];
    sections.forEach((s, i) => {
      if (i > 0 && s.r !== sections[i - 1].r) {
        const tr = Math.abs(s.r - sections[i - 1].r) * 1.2;
        this.add(new THREE.CylinderGeometry(s.r, sections[i - 1].r, tr, 32, 1, true), key, this.at(cx, y + tr / 2, cz));
        y += tr;
      }
      this.cyl(s.r, s.h, cx, y, cz, key, 32, s.r, true);
      profile.push({ y0: y, y1: y + s.h, r: s.r });
      if (bands) for (let b = y + 3; b < y + s.h - 0.5; b += 3) this.torus(s.r + 0.01, 0.025, cx, b, cz, 'steel', 48);
      y += s.h;
    });
    const rTop = sections[sections.length - 1].r;
    if (top === 'ellipse') this.head(rTop, cx, y, cz, key, 1, 0.5);
    else if (top === 'hemi') this.head(rTop, cx, y, cz, key, 1, 1);
    const topY = y + (top === 'hemi' ? rTop : rTop * 0.5);
    const radiusAt = (yy) => (profile.find((p) => yy >= p.y0 && yy <= p.y1) || profile[profile.length - 1]).r;

    platforms.forEach((py, i) => {
      const r = radiusAt(py);
      const arc = py > y - 0.5 ? Math.PI * 2 : Math.PI * 1.1;
      const a0 = ladderAngle + (i % 2 ? Math.PI * 0.2 : -Math.PI * 0.35);
      this.circPlatform(cx, cz, py, r, 1.4, a0, arc);
    });
    // ladder segments between successive platforms, alternating side
    const levels = [base, ...platforms];
    for (let i = 0; i < levels.length - 1; i++) {
      const a = ladderAngle + (i % 2 ? 0.25 : -0.25);
      this.ladder(cx, cz, radiusAt(levels[i + 1] - 1) + 0.05, levels[i], levels[i + 1], a, levels[i + 1] - levels[i] > 3);
    }
    // top platform on the head
    if (platforms.length && platforms[platforms.length - 1] >= y - 0.5) {
      this.cyl(0.25, 1.2, cx, topY - 0.2, cz, 'steel', 12);
    }
    nozzles.forEach(({ y: ny, a, len = 1.2, r = 0.25 }) => {
      const R = radiusAt(ny);
      const s = Math.sin(a), c = Math.cos(a);
      this.rod([cx + s * R, ny, cz + c * R], [cx + s * (R + len), ny, cz + c * (R + len)], r, 'steel', 12);
      this.add(new THREE.CylinderGeometry(r * 1.6, r * 1.6, 0.12, 14), 'steel', (() => { _q.setFromUnitVectors(Y, new THREE.Vector3(s, 0, c)); return _m.compose(_v.set(cx + s * (R + len), ny, cz + c * (R + len)), _q, _s.set(1, 1, 1)).clone(); })());
    });
    return { topY, radiusAt, shellTop: y };
  }

  /** Horizontal drum on saddles, axis along X then rotated by ry. */
  drum(cx, y, cz, r, len, ry = 0, key = 'cladding', saddles = true) {
    const rot = new THREE.Matrix4().makeRotationY(ry);
    const T = (x, yy, z) => new THREE.Vector3(x, yy, z).applyMatrix4(rot).add(new THREE.Vector3(cx, 0, cz));
    this.add(new THREE.CylinderGeometry(r, r, len, 28, 1, true), key, this.at(cx, y, cz, 0, ry, Math.PI / 2));
    for (const sgn of [-1, 1]) {
      const p = T((sgn * len) / 2, y, 0);
      this.add(new THREE.SphereGeometry(r, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), key, this.at(p.x, p.y, p.z, 0, ry, -sgn * Math.PI / 2, 1, 0.5, 1));
    }
    if (saddles) {
      for (const sgn of [-0.32, 0.32]) {
        const p = T(sgn * len, 0, 0);
        this.box(0.5, y - r * 0.55, r * 1.7, p.x, 0, p.z, 'concrete', ry);
      }
    }
    for (let i = -1; i <= 1; i += 2) {
      const p = T(i * len * 0.18, y + r, 0);
      this.cyl(0.18, 0.7, p.x, p.y - 0.05, p.z, 'steel', 10);
    }
  }

  /** Shell-and-tube exchanger stack (two shells). */
  exchanger(cx, cz, len = 7, r = 0.7, ry = 0) {
    const rot = new THREE.Matrix4().makeRotationY(ry);
    const T = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(rot).add(new THREE.Vector3(cx, 0, cz));
    for (const lvl of [1.3, 1.3 + r * 2.4]) {
      const c = T(0, lvl, 0);
      this.add(new THREE.CylinderGeometry(r, r, len, 20), 'steel', this.at(c.x, c.y, c.z, 0, ry, Math.PI / 2));
      const ch = T(len / 2 + 0.35, lvl, 0);
      this.add(new THREE.CylinderGeometry(r * 1.05, r * 1.05, 0.7, 20), 'darksteel', this.at(ch.x, ch.y, ch.z, 0, ry, Math.PI / 2));
      const cv = T(-len / 2 - 0.15, lvl, 0);
      this.add(new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 'steel', this.at(cv.x, cv.y, cv.z, 0, ry, Math.PI / 2, 1, 0.4, 1));
      for (const f of [-0.3, 0.3]) { const n = T(f * len, lvl + r, 0); this.cyl(0.16, 0.5, n.x, n.y, n.z, 'steel', 10); }
    }
    for (const f of [-0.35, 0.35]) { const p = T(f * len, 0, 0); this.box(0.4, 1.3 - r * 0.6, r * 1.6, p.x, 0, p.z, 'concrete', ry); }
  }

  /** Centrifugal pump + motor on a skid. */
  pump(x, z, ry = 0) {
    this.box(2.6, 0.3, 1.0, x, 0, z, 'concrete', ry);
    const rot = new THREE.Matrix4().makeRotationY(ry);
    const T = (a, y, b) => new THREE.Vector3(a, y, b).applyMatrix4(rot).add(new THREE.Vector3(x, 0, z));
    let p = T(-0.7, 0.75, 0); this.add(new THREE.CylinderGeometry(0.42, 0.42, 0.45, 18), 'pipeBlue', this.at(p.x, p.y, p.z, Math.PI / 2, ry, 0));
    p = T(0.5, 0.7, 0); this.add(new THREE.CylinderGeometry(0.34, 0.34, 1.0, 16), 'pipeGreen', this.at(p.x, p.y, p.z, 0, ry, Math.PI / 2));
    p = T(-0.7, 1.2, 0); this.cyl(0.14, 0.9, p.x, p.y, p.z, 'steel', 10);
  }

  /** Straight railing along a line at height y. */
  railing(a, b, y, posts = 1.8) {
    const A = new THREE.Vector3(a[0], y, a[1]), B = new THREE.Vector3(b[0], y, b[1]);
    const len = A.distanceTo(B);
    this.rod(A.clone().setY(y + 1.1), B.clone().setY(y + 1.1), 0.03, 'yellow', 4);
    this.rod(A.clone().setY(y + 0.55), B.clone().setY(y + 0.55), 0.025, 'yellow', 4);
    const n = Math.max(1, Math.round(len / posts));
    for (let i = 0; i <= n; i++) {
      const p = A.clone().lerp(B, i / n);
      this.rod(p, p.clone().setY(y + 1.1), 0.03, 'yellow', 4);
    }
  }

  /** Steel structure: grid of columns with floors at given levels. */
  frame(cx, cz, w, d, levels, { bays = [2, 1], brace = true, floors = true, rails = true, key = 'structure' } = {}) {
    const [bx, bz] = bays;
    const x0 = cx - w / 2, z0 = cz - d / 2;
    const top = levels[levels.length - 1];
    for (let i = 0; i <= bx; i++) for (let j = 0; j <= bz; j++) {
      const x = x0 + (w * i) / bx, z = z0 + (d * j) / bz;
      this.box(0.4, top, 0.4, x, 0, z, key);
      this.box(0.9, 0.4, 0.9, x, 0, z, 'concrete');
    }
    levels.forEach((ly) => {
      for (let i = 0; i <= bx; i++) this.box(0.3, 0.45, d, x0 + (w * i) / bx, ly - 0.45, cz, key);
      for (let j = 0; j <= bz; j++) this.box(w, 0.45, 0.3, cx, ly - 0.45, z0 + (d * j) / bz, key);
      if (floors) this.box(w, 0.08, d, cx, ly - 0.05, cz, 'grating');
      if (rails) {
        this.railing([x0, z0], [x0 + w, z0], ly);
        this.railing([x0, z0 + d], [x0 + w, z0 + d], ly);
        this.railing([x0, z0], [x0, z0 + d], ly);
        this.railing([x0 + w, z0], [x0 + w, z0 + d], ly);
      }
      this.lamp(x0 + 0.4, ly + 2.6, z0 + 0.4);
      this.lamp(x0 + w - 0.4, ly + 2.6, z0 + d - 0.4);
    });
    if (brace) {
      let prev = 0;
      levels.forEach((ly) => {
        this.beam([x0, prev, z0], [x0 + w / bx, ly - 0.4, z0], 0.18, key);
        this.beam([x0 + w / bx, prev, z0], [x0, ly - 0.4, z0], 0.18, key);
        this.beam([x0 + w, prev, z0 + d], [x0 + w, ly - 0.4, z0 + d - d / bz], 0.18, key);
        this.beam([x0 + w, prev, z0 + d - d / bz], [x0 + w, ly - 0.4, z0 + d], 0.18, key);
        prev = ly;
      });
    }
  }

  /** Straight stair flight from a (x,y,z) to b; width w. */
  stair(a, b, w = 1.0) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const run = new THREE.Vector3(B.x - A.x, 0, B.z - A.z);
    const n = Math.max(2, Math.round((B.y - A.y) / 0.2));
    const side = new THREE.Vector3(-run.z, 0, run.x).normalize().multiplyScalar(w / 2);
    const ry = Math.atan2(run.x, run.z);
    for (const sgn of [-1, 1]) {
      const o = side.clone().multiplyScalar(sgn);
      this.beam(A.clone().add(o), B.clone().add(o), 0.12, 'structure');
      this.rod(A.clone().add(o).setY(A.y + 1), B.clone().add(o).setY(B.y + 1), 0.028, 'yellow', 4);
    }
    for (let i = 1; i < n; i++) {
      const p = A.clone().lerp(B, i / n);
      this.box(w, 0.05, 0.28, p.x, p.y, p.z, 'grating', ry);
    }
  }

  /** Helical stair on a cylindrical shell (tanks). */
  spiralStair(cx, cz, R, y0, y1, a0, sweep) {
    const n = Math.round((y1 - y0) / 0.2);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = a0 + sweep * t;
      const y = y0 + (y1 - y0) * t;
      const s = Math.sin(a), c = Math.cos(a);
      if (i % 1 === 0) this.box(0.28, 0.05, 0.95, cx + s * (R + 0.55), y, cz + c * (R + 0.55), 'grating', a);
      pts.push([cx + s * (R + 1.05), y + 1.0, cz + c * (R + 1.05)]);
      if (i % 9 === 0) this.rod([cx + s * (R + 1.05), y, cz + c * (R + 1.05)], [cx + s * (R + 1.05), y + 1, cz + c * (R + 1.05)], 0.028, 'yellow', 4);
    }
    for (let i = 0; i < pts.length - 1; i += 1) this.rod(pts[i], pts[i + 1], 0.03, 'yellow', 4);
    // outer stringer
    for (let i = 0; i < pts.length - 1; i += 1) this.rod([pts[i][0], pts[i][1] - 1.08, pts[i][2]], [pts[i + 1][0], pts[i + 1][1] - 1.08, pts[i + 1][2]], 0.06, 'structure', 4);
  }

  build() {
    for (const { key, list } of this.bins.values()) {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, this.mat(key));
      mesh.castShadow = key !== 'glow' && key !== 'redLight' && key !== 'grating';
      mesh.receiveShadow = true;
      mesh.userData.unit = this.id;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
    }
    this.dynamic.forEach((o) => this.group.add(o));
    this.bins.clear();
    return this.group;
  }
}
