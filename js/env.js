import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

export const SEA_LEVEL = -0.6;

/** Procedural gravel/soil texture so the ground is not a flat colour. */
function groundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#8a8377';
  g.fillRect(0, 0, 512, 512);
  const img = g.getImageData(0, 0, 512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 38;
    img.data[i] += n; img.data[i + 1] += n * 0.95; img.data[i + 2] += n * 0.85;
  }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${60 + Math.random() * 40},${55 + Math.random() * 35},${45 + Math.random() * 30},${0.08 + Math.random() * 0.12})`;
    const r = 2 + Math.random() * 14;
    g.beginPath(); g.arc(Math.random() * 512, Math.random() * 512, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(60, 40);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function createEnvironment(renderer, scene) {
  // Sky and image-based lighting
  const sky = new Sky();
  sky.scale.setScalar(9000);
  const su = sky.material.uniforms;
  su.turbidity.value = 5.5;
  su.rayleigh.value = 2.0;
  su.mieCoefficient.value = 0.006;
  su.mieDirectionalG.value = 0.86;
  scene.add(sky);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const skyScene = new THREE.Scene();
  const skyForEnv = new Sky();
  skyForEnv.scale.setScalar(1000);
  skyScene.add(skyForEnv);
  let envRT = null;

  const sunDir = new THREE.Vector3();
  const sun = new THREE.DirectionalLight(0xffd4a8, 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.35;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 3000;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xa9c1e0, 0x6b5b4a, 0.55);
  scene.add(hemi);

  // Ground
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(2400, 6, 1400),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.97, metalness: 0 }),
  );
  ground.position.set(0, -3, -150 + 700);
  ground.receiveShadow = true;
  scene.add(ground);

  // Sea: analytic waves, sky-coloured fresnel reflection and sun glitter
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(16000, 16000, 1, 1),
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: sunDir },
        uSunColor: { value: new THREE.Color(1.0, 0.72, 0.45) },
        uDeep: { value: new THREE.Color(0x0b2a3a) },
        uHorizon: { value: new THREE.Color(0xf2b27a) },
        uZenith: { value: new THREE.Color(0x3d6aa0) },
        uFogColor: { value: new THREE.Color(0xd9b393) },
        uFogDensity: { value: 0.00032 },
        uGlint: { value: 1 },
      },
      vertexShader: /* glsl */`
        varying vec3 vWorld;
        void main(){ vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */`
        uniform float uTime, uFogDensity, uGlint;
        uniform vec3 uSunDir, uSunColor, uDeep, uHorizon, uZenith, uFogColor;
        varying vec3 vWorld;
        vec2 wave(vec2 p, vec2 d, float f, float a, float s){ float ph = dot(d,p)*f + uTime*s; return d * (a * f * cos(ph)); }
        void main(){
          vec2 p = vWorld.xz;
          vec2 g = vec2(0.0);
          g += wave(p, normalize(vec2( 0.8, 0.6)), 0.045, 0.30, 0.9);
          g += wave(p, normalize(vec2(-0.5, 0.9)), 0.07,  0.18, 1.3);
          g += wave(p, normalize(vec2( 0.2,-1.0)), 0.13,  0.08, 1.9);
          g += wave(p, normalize(vec2( 0.9,-0.3)), 0.29,  0.035, 2.7);
          g += wave(p, normalize(vec2(-0.7,-0.6)), 0.61,  0.014, 3.6);
          g += wave(p, normalize(vec2( 0.3, 0.95)), 1.3,  0.006, 5.1);
          vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
          vec3 V = normalize(cameraPosition - vWorld);
          float dist = length(cameraPosition - vWorld);
          N = normalize(mix(N, vec3(0,1,0), clamp(dist / 5000.0, 0.0, 0.85)));
          vec3 R = reflect(-V, N);
          float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
          vec3 sky = mix(uHorizon, uZenith, pow(clamp(R.y, 0.0, 1.0), 0.45));
          vec3 col = mix(uDeep, sky, fres);
          float s = max(dot(R, uSunDir), 0.0);
          col += uSunColor * (pow(s, 900.0) * 18.0 + pow(s, 90.0) * 0.8) * uGlint;
          float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
          col = mix(col, uFogColor, fog);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = SEA_LEVEL;
  scene.add(water);

  scene.fog = new THREE.FogExp2(0xd9b393, 0.00032);

  const MODES = {
    day: {
      elevation: 17, azimuth: 236, sun: 3.4, sunColor: 0xffd9b0, hemi: 0.55, env: 0.7, exposure: 0.8,
      fog: 0xd9c2aa, horizon: 0xeec4a0, zenith: 0x5a8cc4, deep: 0x103448, glint: 1, turbidity: 4.5, rayleigh: 1.6, fogDensity: 0.00022,
    },
    night: {
      elevation: -4.5, azimuth: 232, sun: 0.28, sunColor: 0x8fa8d8, hemi: 0.1, env: 0.12, exposure: 0.9,
      fog: 0x0d1420, horizon: 0x1a2536, zenith: 0x060a12, deep: 0x02070c, glint: 0.05, turbidity: 2, rayleigh: 0.6, fogDensity: 0.0003,
    },
  };

  function setMode(name) {
    const m = MODES[name];
    const phi = THREE.MathUtils.degToRad(90 - m.elevation);
    const theta = THREE.MathUtils.degToRad(m.azimuth);
    sunDir.setFromSphericalCoords(1, phi, theta);
    for (const s of [su, skyForEnv.material.uniforms]) {
      s.sunPosition.value.copy(sunDir);
      s.turbidity.value = m.turbidity;
      s.rayleigh.value = m.rayleigh;
    }
    if (envRT) envRT.dispose();
    envRT = pmrem.fromScene(skyScene);
    scene.environment = envRT.texture;
    scene.environmentIntensity = m.env;
    // moonlight comes from a higher angle so night shadows still read
    const lightDir = name === 'night' ? new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(50), theta + 1.2) : sunDir;
    sun.userData.dir = lightDir.clone();
    sun.intensity = m.sun;
    sun.color.set(m.sunColor);
    hemi.intensity = m.hemi;
    scene.fog.color.set(m.fog);
    scene.fog.density = m.fogDensity;
    water.material.uniforms.uFogDensity.value = m.fogDensity;
    const wu = water.material.uniforms;
    wu.uFogColor.value.set(m.fog);
    wu.uHorizon.value.set(m.horizon);
    wu.uZenith.value.set(m.zenith);
    wu.uDeep.value.set(m.deep);
    wu.uGlint.value = m.glint;
    renderer.toneMappingExposure = m.exposure;
    return m;
  }

  /** Keep the shadow frustum tight around what the camera is looking at. */
  function updateShadow(target, camDist) {
    const size = THREE.MathUtils.clamp(camDist * 0.85, 45, 650);
    const cam = sun.shadow.camera;
    if (Math.abs(cam.right - size) > 0.5) {
      cam.left = -size; cam.right = size; cam.top = size; cam.bottom = -size;
      cam.updateProjectionMatrix();
    }
    // snap to shadow texels to avoid shimmering while orbiting
    const texel = (size * 2) / sun.shadow.mapSize.x;
    const t = target.clone();
    t.x = Math.round(t.x / texel) * texel;
    t.z = Math.round(t.z / texel) * texel;
    sun.target.position.copy(t);
    sun.position.copy(t).addScaledVector(sun.userData.dir, 1200);
  }

  return { sky, sun, hemi, water, setMode, updateShadow, sunDir };
}
