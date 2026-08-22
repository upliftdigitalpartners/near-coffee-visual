import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ═══════════ constants ═══════════ */
const W = 9, HW = W / 2;          // barn width  (x: -4.5 .. 4.5)
const Z_FRONT = -7, Z_BACK = 6;   // door wall / counter wall
const WALL_H = 4.0, RIDGE_H = 6.1;
const DOOR_W = 2.8, DOOR_H = 3.3;
const EYE = 1.58, SIT = 1.16;

const stage = document.getElementById('stage');
const tipEl = document.getElementById('tip');

/* ═══════════ renderer / scene ═══════════ */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.0;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, 0.2, 1900);
scene.fog = new THREE.Fog(0x1a140f, 40, 900);

/* ═══════════ canvas texture helpers ═══════════ */
const texCache = {};
function canvasTex(key, w, h, draw, repeat) {
  if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 16;
  texCache[key] = t; return t;
}
function noise(ctx, w, h, amt, alpha) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amt;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
    if (alpha !== undefined) d[i + 3] = alpha;
  }
  ctx.putImageData(img, 0, 0);
}
function woodTex(key, base, dark, planks, vertical) {
  return canvasTex(key, 1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    const step = h / planks;
    const F = (a, b, fn) => { if (vertical) fn(b, a); else fn(a, b); };
    for (let i = 0; i < planks; i++) {
      const y = i * step;
      // each board is cut from a different tree
      const drift = (Math.random() - .5) * 26;
      const boardBase = shade(base, drift);
      ctx.fillStyle = boardBase;
      if (vertical) ctx.fillRect(y, 0, step, h); else ctx.fillRect(0, y, w, step);

      // long grain: many fine fibres, denser near board edges
      const fibres = 96;
      for (let g = 0; g < fibres; g++) {
        const t = g / fibres;
        const edge = Math.min(t, 1 - t) * 2;
        ctx.strokeStyle = shade(dark, (Math.random() - .5) * 30);
        ctx.globalAlpha = (.04 + Math.random() * .13) * (1.25 - edge * .5);
        ctx.lineWidth = .4 + Math.random() * 1.5;
        ctx.beginPath();
        const off = y + t * step + (Math.random() - .5) * 2.4;
        const wob = 4 + Math.random() * 12;
        if (vertical) {
          ctx.moveTo(off, 0);
          ctx.bezierCurveTo(off + wob, h * .28, off - wob, h * .62, off + wob * .3, h);
        } else {
          ctx.moveTo(0, off);
          ctx.bezierCurveTo(w * .28, off + wob, w * .62, off - wob, w, off + wob * .3);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // knots — grain has to swirl around them or it reads as wallpaper
      const knots = Math.random() < .55 ? 1 : 0;
      for (let k = 0; k < knots; k++) {
        const ka = y + step * (.25 + Math.random() * .5);
        const kb = Math.random() * (vertical ? h : w);
        const kr = 5 + Math.random() * 11;
        for (let ring = kr * 2.6; ring > 0; ring -= 1.1 + Math.random()) {
          ctx.strokeStyle = shade(dark, (Math.random() - .5) * 20);
          ctx.globalAlpha = .1 + (1 - ring / (kr * 2.6)) * .4;
          ctx.lineWidth = .5 + Math.random();
          ctx.beginPath();
          F(ka, kb, (X, Y) => ctx.ellipse(X, Y, ring * .5, ring, Math.random() * .3, 0, 7));
          ctx.stroke();
        }
        ctx.globalAlpha = .55;
        ctx.fillStyle = shade(dark, -30);
        ctx.beginPath();
        F(ka, kb, (X, Y) => ctx.ellipse(X, Y, kr * .22, kr * .42, 0, 0, 7));
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // seam between boards, with a soft shadow gutter
      const grad = vertical
        ? ctx.createLinearGradient(y - 4, 0, y + 5, 0)
        : ctx.createLinearGradient(0, y - 4, 0, y + 5);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(.45, 'rgba(0,0,0,.55)');
      grad.addColorStop(.55, 'rgba(0,0,0,.5)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      if (vertical) ctx.fillRect(y - 4, 0, 9, h); else ctx.fillRect(0, y - 4, w, 9);

      // nail heads at the ends of each board
      [0.035, 0.965].forEach(p => {
        if (Math.random() > .72) return;
        ctx.globalAlpha = .5;
        ctx.fillStyle = shade(dark, -18);
        ctx.beginPath();
        F(y + step * .5, p * (vertical ? h : w), (X, Y) => ctx.arc(X, Y, 2.4, 0, 7));
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    }
    // weathering blotches
    for (let i = 0; i < 55; i++) {
      ctx.globalAlpha = .015 + Math.random() * .05;
      ctx.fillStyle = Math.random() > .5 ? '#000' : '#fff';
      ctx.beginPath();
      ctx.ellipse(Math.random() * w, Math.random() * h, 14 + Math.random() * 90, 8 + Math.random() * 44, Math.random() * 3, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    noise(ctx, w, h, 13);
  }, [1, 1]);
}
function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const f = 1 + amt / 255;
  return '#' + new THREE.Color(Math.min(1, c.r * f), Math.min(1, c.g * f), Math.min(1, c.b * f)).getHexString();
}
const DERIV = 512;
function normalFrom(tex, strength) {
  const img = tex.image;
  const w = Math.min(DERIV, img.width), h = Math.min(DERIV, img.height);
  const sc = document.createElement('canvas'); sc.width = w; sc.height = h;
  const sx = sc.getContext('2d'); sx.drawImage(img, 0, 0, w, h);
  const src = sx.getImageData(0, 0, w, h).data;
  const out = sx.createImageData(w, h), o = out.data;
  const L = (X, Y) => {
    const i = (((Y + h) % h) * w + ((X + w) % w)) * 4;
    return (src[i] * .3 + src[i + 1] * .59 + src[i + 2] * .11) / 255;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (L(x - 1, y) - L(x + 1, y)) * strength;
    const dy = (L(x, y - 1) - L(x, y + 1)) * strength;
    const len = Math.hypot(dx, dy, 1);
    const i = (y * w + x) * 4;
    o[i] = ((dx / len) * .5 + .5) * 255;
    o[i + 1] = ((dy / len) * .5 + .5) * 255;
    o[i + 2] = ((1 / len) * .5 + .5) * 255;
    o[i + 3] = 255;
  }
  sx.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(sc);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
function roughFrom(tex, lo, hi) {
  const img = tex.image;
  const w = Math.min(DERIV, img.width), h = Math.min(DERIV, img.height);
  const sc = document.createElement('canvas'); sc.width = w; sc.height = h;
  const sx = sc.getContext('2d'); sx.drawImage(img, 0, 0, w, h);
  const d = sx.getImageData(0, 0, w, h);
  const a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    const l = (a[i] * .3 + a[i + 1] * .59 + a[i + 2] * .11) / 255;
    const v = (lo + (hi - lo) * (1 - l)) * 255;
    a[i] = a[i + 1] = a[i + 2] = v; a[i + 3] = 255;
  }
  sx.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(sc);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
const softDot = canvasTex('dot', 64, 64, (ctx, w) => {
  const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, w);
});

/* ═══════════ materials ═══════════ */
const T_FL = woodTex('fl', '#6a5138', '#2c2014', 9, false);
const T_WL = woodTex('wl', '#5b3d26', '#241408', 12, true);
const T_WO = woodTex('wo', '#4a3120', '#1e1108', 12, true);
const T_CL = woodTex('cl', '#4e3421', '#1d1109', 14, false);
const T_SL = woodTex('sl', '#7b6a55', '#33291d', 5, false);
function relief(t, x, y, str, rlo, rhi) {
  const n = normalFrom(t, str); n.repeat.set(x, y);
  const r = roughFrom(t, rlo, rhi); r.repeat.set(x, y);
  return { normalMap: n, normalScale: new THREE.Vector2(1, 1), roughnessMap: r };
}
const M = {
  floor: new THREE.MeshStandardMaterial({ map: cloneRep(T_FL, 3, 7), roughness: .78,
    ...relief(T_FL, 3, 7, 2.4, .58, .94), envMapIntensity: .15, color: 0x9c9285 }),
  wall: new THREE.MeshStandardMaterial({ map: cloneRep(T_WL, 3, 2), roughness: .9, color: 0x8d7b6c,
    ...relief(T_WL, 3, 2, 3.2, .6, 1), envMapIntensity: .35 }),
  wallOut: new THREE.MeshStandardMaterial({ map: cloneRep(T_WO, 4, 2), roughness: .96, color: 0x7d6e60,
    ...relief(T_WO, 4, 2, 3.4, .7, 1), envMapIntensity: .3 }),
  beam: new THREE.MeshStandardMaterial({ map: cloneRep(T_WO, .7, .7), color: 0x6b5644, roughness: .93,
    ...relief(T_WO, .7, .7, 2.6, .68, 1), envMapIntensity: .3 }),
  ceil: new THREE.MeshStandardMaterial({ map: cloneRep(T_CL, 3, 4), roughness: .96, color: 0x7f6e5e,
    ...relief(T_CL, 3, 4, 3, .7, 1), envMapIntensity: .28 }),
  slab: new THREE.MeshStandardMaterial({ map: cloneRep(T_SL, 2, 1), roughness: .72, color: 0xa39c92,
    ...relief(T_SL, 2, 1, 1.5, .55, .88), envMapIntensity: .15 }),
  brass: new THREE.MeshStandardMaterial({ color: 0x87724f, metalness: 1, roughness: .58, envMapIntensity: .8 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x9e9a94, metalness: 1, roughness: .4, envMapIntensity: 1.2 }),
  black: new THREE.MeshStandardMaterial({ color: 0x191512, roughness: .56, metalness: .45, envMapIntensity: .6 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xf2f8fa, transparent: true, opacity: .1, roughness: .02,
    metalness: 0, ior: 1.5, side: THREE.DoubleSide, envMapIntensity: 1.2, depthWrite: false }),
  cream: new THREE.MeshStandardMaterial({ color: 0xe6dccb, roughness: .62, envMapIntensity: .22 }),
  paper: new THREE.MeshStandardMaterial({ color: 0xdcd0b4, roughness: .96, envMapIntensity: .2 }),
  cork: new THREE.MeshStandardMaterial({ color: 0x8a6a41, roughness: .97, envMapIntensity: .2 }),
  snow: new THREE.MeshStandardMaterial({ color: 0xc9d2de, roughness: .78, envMapIntensity: .55 }),
  pine: new THREE.MeshStandardMaterial({ color: 0x141c14, roughness: 1, envMapIntensity: .12, flatShading: true, side: THREE.DoubleSide }),
  bark: new THREE.MeshStandardMaterial({ color: 0x241d16, roughness: 1, envMapIntensity: .12 }),
  crust: new THREE.MeshStandardMaterial({ color: 0xb8813f, roughness: .74, envMapIntensity: .5 }),
  linen: new THREE.MeshStandardMaterial({ color: 0x8f8676, roughness: 1, envMapIntensity: .2 }),
  figure: new THREE.MeshStandardMaterial({ color: 0x2b211a, roughness: .95, envMapIntensity: .3 }),
};
function cloneRep(t, x, y) { const c = t.clone(); c.needsUpdate = true; c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(x, y); return c; }

/* ═══════════ small builders ═══════════ */
const rbCache = {};
function roundedBoxGeo(w, h, d, r) {
  r = Math.max(.0015, Math.min(r, w / 2.6, h / 2.6, d / 2.6));
  const key = [w, h, d, r].map(n => n.toFixed(4)).join('_');
  if (rbCache[key]) return rbCache[key];
  const sh = new THREE.Shape();
  const X = w / 2 - r, Y = h / 2 - r;
  sh.moveTo(-w / 2, -Y);
  sh.lineTo(-w / 2, Y); sh.quadraticCurveTo(-w / 2, h / 2, -X, h / 2);
  sh.lineTo(X, h / 2); sh.quadraticCurveTo(w / 2, h / 2, w / 2, Y);
  sh.lineTo(w / 2, -Y); sh.quadraticCurveTo(w / 2, -h / 2, X, -h / 2);
  sh.lineTo(-X, -h / 2); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2, -Y);
  const g = new THREE.ExtrudeGeometry(sh, {
    depth: Math.max(.0005, d - 2 * r), bevelEnabled: true,
    bevelThickness: r, bevelSize: r, bevelSegments: 2, curveSegments: 3,
  });
  g.translate(0, 0, -(d / 2 - r));
  g.computeVertexNormals();
  rbCache[key] = g; return g;
}
function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(roundedBoxGeo(w, h, d, Math.min(w, h, d) * .11), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  (parent || scene).add(m); return m;
}
function cyl(rt, rb, h, mat, x, y, z, parent, seg) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 24), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  (parent || scene).add(m); return m;
}
const hotspots = [];
function hot(mesh, label, action, lookAt) {
  mesh.userData.hot = { label, action, lookAt: lookAt || null };
  hotspots.push(mesh); return mesh;
}
function litTargets(obj) {
  const out = [];
  const root = obj.material && obj.material.visible !== false && obj.visible ? obj : (obj.parent || obj);
  root.traverse(o => {
    if (o.isMesh && o.visible && o.material && o.material.emissive && o.material.transparent !== true) out.push(o);
  });
  return out.slice(0, 24);
}
const hoverState = { targets: [], t: 0 };
function setHoverTargets(list) {
  hoverState.targets.forEach(e => { e.mat.emissive.setHex(e.hex); e.mat.emissiveIntensity = e.int; });
  hoverState.targets = list.map(m => ({
    mat: m.material, hex: m.material.emissive.getHex(), int: m.material.emissiveIntensity,
  }));
  hoverState.t = 0;
}
function animateHover(dt) {
  if (!hoverState.targets.length) return;
  hoverState.t = Math.min(1, hoverState.t + dt * 4);
  const pulse = .5 + Math.sin(clock * 3.4) * .5;
  hoverState.targets.forEach(e => {
    e.mat.emissive.setHex(0x6a4a24);
    e.mat.emissiveIntensity = hoverState.t * (.16 + pulse * .1);
  });
}

/* ═══════════ barn shell ═══════════ */
const D = Z_BACK - Z_FRONT;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M.floor);
floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, (Z_FRONT + Z_BACK) / 2);
floor.receiveShadow = true; scene.add(floor);

const sideWallMat = M.wall.clone();
sideWallMat.side = THREE.DoubleSide;
sideWallMat.map = cloneRep(woodTex('wl', '#5b3d26', '#241408', 12, true), .42, .3);
function wallWithHoles(len, h, holes, mat, x, y, z, ry) {
  const sh = new THREE.Shape();
  sh.moveTo(-len / 2, 0); sh.lineTo(len / 2, 0); sh.lineTo(len / 2, h); sh.lineTo(-len / 2, h); sh.closePath();
  holes.forEach(([cx, cy, w, hh]) => {
    const p = new THREE.Path();
    p.moveTo(cx - w / 2, cy - hh / 2); p.lineTo(cx + w / 2, cy - hh / 2);
    p.lineTo(cx + w / 2, cy + hh / 2); p.lineTo(cx - w / 2, cy + hh / 2); p.closePath();
    sh.holes.push(p);
  });
  const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), mat);
  m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; scene.add(m); return m;
}
const MIDZ = (Z_FRONT + Z_BACK) / 2;
wallWithHoles(D, WALL_H + .45, [[-1.1, 1.85, 1.5, 1.4], [-3.5, 1.85, 1.5, 1.4], [1.9, 1.85, 1.5, 1.4]],
  sideWallMat, -HW, 0, MIDZ, Math.PI / 2);
wallWithHoles(D, WALL_H + .45, [[3.9, 2.2, 1.4, 1.2]], sideWallMat, HW, 0, MIDZ, -Math.PI / 2);

// front (west) wall with the big doorway
const sideW = (W - DOOR_W) / 2;
box(sideW, WALL_H, .22, M.wall, -(DOOR_W / 2 + sideW / 2), WALL_H / 2, Z_FRONT);
box(sideW, WALL_H, .22, M.wall, (DOOR_W / 2 + sideW / 2), WALL_H / 2, Z_FRONT);
box(DOOR_W, WALL_H - DOOR_H, .22, M.wall, 0, DOOR_H + (WALL_H - DOOR_H) / 2, Z_FRONT);
// door frame
box(.13, DOOR_H, .3, M.beam, -DOOR_W / 2, DOOR_H / 2, Z_FRONT);
box(.13, DOOR_H, .3, M.beam, DOOR_W / 2, DOOR_H / 2, Z_FRONT);
box(DOOR_W + .26, .16, .3, M.beam, 0, DOOR_H, Z_FRONT);

// back (east) wall — counter wall, with an opening into the bakery
const BAK_X0 = 1.5, BAK_X1 = 3.3;
box(HW + BAK_X0, WALL_H, .22, M.wall, (-HW + BAK_X0) / 2, WALL_H / 2, Z_BACK);
box(HW - BAK_X1, WALL_H, .22, M.wall, (BAK_X1 + HW) / 2, WALL_H / 2, Z_BACK);
box(BAK_X1 - BAK_X0, WALL_H - 2.5, .22, M.wall, (BAK_X0 + BAK_X1) / 2, 2.5 + (WALL_H - 2.5) / 2, Z_BACK);
box(BAK_X1 - BAK_X0 + .2, .14, .3, M.beam, (BAK_X0 + BAK_X1) / 2, 2.5, Z_BACK);

// gable ends + pitched ceiling
function gableEnd(z) {
  const s = new THREE.Shape();
  s.moveTo(-HW, WALL_H); s.lineTo(0, RIDGE_H); s.lineTo(HW, WALL_H); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: .2, bevelEnabled: false });
  const m = new THREE.Mesh(g, M.wall); m.position.set(0, 0, z - .1); m.receiveShadow = true; scene.add(m);
}
gableEnd(Z_FRONT + .1); gableEnd(Z_BACK + .12);
const slopeLen = Math.hypot(HW, RIDGE_H - WALL_H);
const pitch = Math.atan2(RIDGE_H - WALL_H, HW);
const roofMat = M.ceil.clone(); roofMat.side = THREE.DoubleSide;
[-1, 1].forEach(sgn => {
  const g = new THREE.PlaneGeometry(slopeLen + .5, D + .4, 1, 1);
  g.rotateX(-Math.PI / 2);
  g.rotateZ(-sgn * pitch);
  const m = new THREE.Mesh(g, roofMat);
  m.position.set(sgn * HW / 2, (WALL_H + RIDGE_H) / 2, (Z_FRONT + Z_BACK) / 2);
  m.receiveShadow = true; scene.add(m);
});
// ridge beam + tie beams
box(.22, .3, D, M.beam, 0, RIDGE_H - .18, (Z_FRONT + Z_BACK) / 2);
for (let z = Z_FRONT + 2.2; z < Z_BACK; z += 2.6) {
  box(W, .2, .22, M.beam, 0, WALL_H - .12, z);
  box(.16, .5, .16, M.beam, 0, WALL_H + .2, z);
}

/* ═══════════ side windows ═══════════ */
function window4(x, z, ry, w, h, sillY) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  const f = .09;
  box(w + f * 2, f, .3, M.beam, 0, sillY - f / 2, 0, g);
  box(w + f * 2, f, .3, M.beam, 0, sillY + h + f / 2, 0, g);
  box(f, h, .3, M.beam, -w / 2 - f / 2, sillY + h / 2, 0, g);
  box(f, h, .3, M.beam, w / 2 + f / 2, sillY + h / 2, 0, g);
  box(.05, h, .1, M.beam, 0, sillY + h / 2, 0, g);
  box(w, .05, .1, M.beam, 0, sillY + h / 2, 0, g);
  const pane = box(w, h, .02, M.glass, 0, sillY + h / 2, 0, g);
  pane.castShadow = false;
  return g;
}
[0.6, 3.0, -2.4].forEach(z => window4(-HW + .05, z, Math.PI / 2, 1.5, 1.4, 1.15));
window4(HW - .05, 3.4, -Math.PI / 2, 1.4, 1.2, 1.6);

/* ═══════════ outside: snow, Tetons, pines, porch ═══════════ */
const skyCanvas = document.createElement('canvas'); skyCanvas.width = 8; skyCanvas.height = 256;
const skyTex = new THREE.CanvasTexture(skyCanvas); skyTex.colorSpace = THREE.SRGBColorSpace;
// A pure backdrop: no depth interaction (so it costs no depth range) and no
// tone mapping (AgX crushes saturated sky blues into navy).
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(500, 40, 28),
  new THREE.MeshBasicMaterial({
    map: skyTex, side: THREE.BackSide, fog: false, toneMapped: false,
    depthTest: false, depthWrite: false,
  })
);
sky.renderOrder = -1000;
sky.frustumCulled = false;
scene.add(sky);
function paintSky(top, bottom, glow) {
  const c = skyCanvas.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top); g.addColorStop(.55, bottom); g.addColorStop(1, glow || bottom);
  c.fillStyle = g; c.fillRect(0, 0, 8, 256);
  skyTex.needsUpdate = true;
}

M.snow.map = canvasTex('snowg', 512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(202,216,236,${.015 + Math.random() * .04})`;
    const r = 8 + Math.random() * 70;
    ctx.beginPath(); ctx.ellipse(Math.random() * w, Math.random() * h, r, r * .45, Math.random() * 3, 0, 7); ctx.fill();
  }
  noise(ctx, w, h, 9);
}, [150, 150]);
M.snow.normalMap = normalFrom(M.snow.map, .9);
M.snow.normalMap.repeat.set(150, 150);
M.snow.normalScale = new THREE.Vector2(.35, .35);
const ground = new THREE.Mesh(new THREE.CircleGeometry(1500, 64), M.snow);
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.03; ground.receiveShadow = true; scene.add(ground);

const ridgeTex = canvasTex('ridge', 32, 256, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.26, 'rgba(246,249,253,1)');
  g.addColorStop(.44, 'rgba(203,211,222,1)'); g.addColorStop(.58, 'rgba(139,146,158,.95)');
  g.addColorStop(.72, 'rgba(126,137,155,.62)'); g.addColorStop(.86, 'rgba(150,163,182,.24)');
  g.addColorStop(1, 'rgba(160,173,192,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
});
function ridge(pts, z, height, spread, tint, opacity) {
  const s = new THREE.Shape();
  s.moveTo(-spread, -height * .4);
  pts.forEach(([px, py]) => s.lineTo(px * spread, py * height));
  s.lineTo(spread, -height * .4); s.closePath();
  const g = new THREE.ShapeGeometry(s);
  const t = ridgeTex.clone(); t.needsUpdate = true;
  t.repeat.set(1 / (spread * 2), 1 / height); t.offset.set(.5, 0);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    map: t, color: tint, fog: false, transparent: true, opacity, depthWrite: false
  }));
  m.position.z = z; m.renderOrder = -100 - Math.round(z / 100); scene.add(m); return m;
}
function rnd(seed) { let x = seed; return () => (x = Math.sin(x * 12.9898) * 43758.5453, x - Math.floor(x)); }
function makeRidge(seed, steps, rough, base) {
  const r = rnd(seed);
  let h = [base * .35, base, base * .55, base, base * .3];
  for (let s = 0; s < steps; s++) {
    const out = [];
    for (let i = 0; i < h.length - 1; i++) {
      out.push(h[i]);
      const mid = (h[i] + h[i + 1]) / 2 + (r() - .5) * rough * Math.pow(.56, s);
      out.push(Math.max(.06, mid));
    }
    out.push(h[h.length - 1]);
    h = out;
  }
  return h.map((y, i) => [-1 + (2 * i) / (h.length - 1), Math.min(1, y)]);
}
const far = ridge(makeRidge(7.13, 5, 1.5, .5), -1050, 245, 1100, 0xa9bdd6, 1);
const mid = ridge(makeRidge(3.77, 5, 1.5, .62), -675, 215, 700, 0xc3d2e4, 1);
const near = ridge(makeRidge(1.41, 5, 1.45, .8), -425, 130, 437, 0xffffff, 1);

// treeline + scattered pines
function firGeometry() {
  const tiers = [
    { r: 1.0, h: 1.5, y: 0.55 },
    { r: 0.74, h: 1.5, y: 1.45 },
    { r: 0.48, h: 1.5, y: 2.3 },
    { r: 0.24, h: 1.1, y: 3.0 },
  ];
  const parts = tiers.map(t => {
    const g = new THREE.ConeGeometry(t.r, t.h, 8, 1, true);
    g.translate(0, t.y, 0);
    return g;
  });
  try { const m = mergeGeometries(parts, false); if (m) { m.computeVertexNormals(); return m; } }
  catch (e) { console.warn('fir merge failed', e); }
  return new THREE.ConeGeometry(1, 3.4, 8);
}
const pineGeo = firGeometry();
const trunkGeo = new THREE.CylinderGeometry(.09, .12, .8, 5);
const pines = new THREE.InstancedMesh(pineGeo, M.pine, 260);
const trunks = new THREE.InstancedMesh(trunkGeo, M.bark, 260);
const dummy = new THREE.Object3D();
let pi = 0;
const pineData = [];
for (let i = 0; i < 260; i++) {
  const a = Math.random() * Math.PI * 2, r = 22 + Math.pow(Math.random(), .6) * 150;
  let x = Math.sin(a) * r, z = -Math.abs(Math.cos(a)) * r - 8;
  if (Math.abs(x) < 9 && z > -40) x += 16 * Math.sign(x || 1);
  const s = .7 + Math.random() * 1.9;
  dummy.position.set(x, 0, z); dummy.scale.set(s, s * (.85 + Math.random() * .45), s); dummy.rotation.y = Math.random() * 3;
  dummy.updateMatrix(); pines.setMatrixAt(pi, dummy.matrix);
  dummy.position.set(x, .4 * s, z); dummy.updateMatrix(); trunks.setMatrixAt(pi, dummy.matrix);
  pineData.push({ x, z, s, hs: dummy.scale.y / s, ry: dummy.rotation.y, ph: Math.random() * 6.3 });
  pi++;
}
pines.instanceMatrix.needsUpdate = true; trunks.instanceMatrix.needsUpdate = true;
scene.add(pines, trunks);

// buck-rail fence, Mormon Row style
for (let i = 0; i < 9; i++) {
  const x = -19 + i * 4.4, z = -31;
  box(.12, 1.5, .12, M.bark, x, .75, z);
  box(.12, 1.2, .12, M.bark, x + .5, .6, z - .5);
  box(3.4, .09, .09, M.bark, x + 1.7, 1.15, z - .25);
  box(3.4, .09, .09, M.bark, x + 1.7, .72, z - .25);
}

/* porch */
const porch = new THREE.Group(); scene.add(porch);
box(W + 1.6, .18, 3.2, M.slab, 0, .06, Z_FRONT - 1.6, porch).receiveShadow = true;
[-1, 1].forEach(s => { box(.18, 2.72, .18, M.beam, s * (HW - .2), 1.36, Z_FRONT - 3.0, porch);
  box(.15, 2.72, .15, M.beam, s * 2.1, 1.36, Z_FRONT - 3.0, porch); });
box(W + 1.6, .22, .3, M.beam, 0, 2.78, Z_FRONT - 3.0, porch);
const roofGeo = new THREE.BoxGeometry(W + 2.0, .16, 3.6);
const roof = new THREE.Mesh(roofGeo, M.beam);
roof.position.set(0, 3.02, Z_FRONT - 1.7); roof.rotation.x = -0.13;
roof.castShadow = true; porch.add(roof);
// bench
box(2.0, .1, .48, M.slab, -2.3, .58, Z_FRONT - 1.0, porch);
box(2.0, .5, .08, M.slab, -2.3, .85, Z_FRONT - .78, porch);
[-.85, .85].forEach(o => box(.1, .5, .44, M.beam, -2.3 + o, .32, Z_FRONT - 1.0, porch));
// hanging sign
const signTex = canvasTex('sign', 512, 256, (ctx, w, h) => {
  ctx.fillStyle = '#2a1f18'; ctx.fillRect(0, 0, w, h);
  noise(ctx, w, h, 22);
  ctx.strokeStyle = 'rgba(184,147,90,.5)'; ctx.lineWidth = 3; ctx.strokeRect(16, 16, w - 32, h - 32);
  ctx.fillStyle = '#e8dcc4'; ctx.textAlign = 'center'; ctx.font = '300 62px "Playfair Display",Georgia,serif';
  ctx.fillText('near coffee', w / 2, h / 2 + 4);
  ctx.font = 'italic 26px "Playfair Display",Georgia,serif'; ctx.fillStyle = 'rgba(196,168,130,.75)';
  ctx.fillText('open whenever you are', w / 2, h / 2 + 52);
});
const sign = box(2.0, 1.0, .07, new THREE.MeshStandardMaterial({ map: signTex, roughness: .85 }), 3.2, 2.05, Z_FRONT - 2.95, porch);
[2.45, 3.95].forEach(o => cyl(.02, .02, .45, M.steel, o, 2.57, Z_FRONT - 2.95, porch, 8));
hot(sign, 'near coffee — since the barn', () => story('sign'));

/* ═══════════ counter, back bar, machine ═══════════ */
const C_Z = 4.35, C_X0 = -3.6, C_X1 = 0.9, C_W = C_X1 - C_X0, C_CX = (C_X0 + C_X1) / 2;
box(C_W, 1.0, .78, M.wall, C_CX, .5, C_Z);
box(C_W + .12, .09, .92, M.slab, C_CX, 1.05, C_Z);
box(C_W + .12, .07, .06, M.brass, C_CX, .18, C_Z - .48);
// back bar
box(C_W + 1.2, .06, .34, M.slab, C_CX + .4, 1.62, Z_BACK - .3);
box(C_W + 1.2, .06, .34, M.slab, C_CX + .4, 2.14, Z_BACK - .3);
for (let i = 0; i < 14; i++) {
  const x = C_X0 - .3 + i * .34;
  cyl(.045, .038, .085, M.cream, x, 1.71, Z_BACK - .3, null, 12);
  if (i % 3 === 0) cyl(.055, .05, .19, M.glass, x + .12, 2.26, Z_BACK - .32, null, 14);
}

// espresso machine
const mach = new THREE.Group(); mach.position.set(-2.5, 1.1, C_Z + .06); scene.add(mach);
box(1.15, .52, .62, M.steel, 0, .26, 0, mach);
box(1.19, .1, .66, M.brass, 0, .56, 0, mach);
box(1.02, .2, .1, M.black, 0, .34, -.34, mach);
[-.3, .3].forEach(o => {
  cyl(.055, .055, .18, M.brass, o, .12, -.33, mach, 16);
  box(.19, .05, .05, M.black, o, .05, -.42, mach);
  cyl(.03, .03, .3, M.brass, o + .34, .2, -.3, mach, 10).rotation.z = -.5;
});
const gauge = cyl(.07, .07, .03, M.cream, .44, .42, -.3, mach, 18); gauge.rotation.x = Math.PI / 2;
hot(box(1.2, .62, .68, new THREE.MeshBasicMaterial({ visible: false }), 0, .3, 0, mach), 'the machine', () => story('machine'));
// grinder
const grinder = new THREE.Group(); grinder.position.set(-1.55, 1.1, C_Z + .02); scene.add(grinder);
box(.24, .38, .26, M.black, 0, .19, 0, grinder);
cyl(.11, .13, .3, M.glass, 0, .53, 0, grinder, 18);
cyl(.12, .12, .02, M.black, 0, .69, 0, grinder, 18);
hot(box(.3, .8, .3, new THREE.MeshBasicMaterial({ visible: false }), 0, .4, 0, grinder), 'the grinder', () => story('grinder'));

// pastry case
const caseG = new THREE.Group(); caseG.position.set(-.15, 1.1, C_Z); scene.add(caseG);
box(1.3, .04, .58, M.slab, 0, .02, 0, caseG);
const glassBox = box(1.3, .52, .58, M.glass, 0, .3, 0, caseG); glassBox.castShadow = false; glassBox.receiveShadow = false;
box(1.34, .05, .62, M.brass, 0, .58, 0, caseG);
for (let i = 0; i < 5; i++) {
  const cr = new THREE.Mesh(new THREE.TorusGeometry(.075, .036, 8, 16, Math.PI * 1.35), M.crust);
  cr.position.set(-.44 + i * .22, .12, -.1); cr.rotation.x = -Math.PI / 2; cr.rotation.z = i * .7;
  cr.castShadow = true; caseG.add(cr);
}
for (let i = 0; i < 4; i++) {
  const sc = box(.15, .07, .15, M.crust, -.36 + i * .24, .1, .14, caseG);
  sc.rotation.y = i;
}
hot(box(1.36, .62, .64, new THREE.MeshBasicMaterial({ visible: false }), 0, .3, 0, caseG), 'this morning’s bake', () => openMenu());

// chalkboard
const boardTex = canvasTex('board', 700, 460, (ctx, w, h) => {
  ctx.fillStyle = '#171a17'; ctx.fillRect(0, 0, w, h); noise(ctx, w, h, 14);
  ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 2; ctx.strokeRect(22, 22, w - 44, h - 44);
  ctx.fillStyle = 'rgba(240,232,220,.88)'; ctx.textAlign = 'center';
  ctx.font = 'italic 44px "Playfair Display",Georgia,serif';
  ctx.fillText('the board', w / 2, 92);
  ctx.font = '300 25px "DM Sans",sans-serif'; ctx.textAlign = 'left';
  const rows = [['drip · house', '3'], ['cortado', '4'], ['flat white', '4'], ['pour-over, single origin', '5'],
  ['hot chocolate, stovetop', '4'], ['butter croissant', '4'], ['morning bun', '4'], ['sourdough + jam', '5']];
  rows.forEach((r, i) => {
    const y = 150 + i * 37;
    ctx.fillStyle = 'rgba(240,232,220,.72)'; ctx.fillText(r[0], 70, y);
    ctx.fillStyle = 'rgba(196,168,130,.8)'; ctx.textAlign = 'right'; ctx.fillText(r[1], w - 70, y);
    ctx.textAlign = 'left';
  });
});
const board = box(2.4, 1.55, .06, new THREE.MeshStandardMaterial({ map: boardTex, roughness: .95 }), -2.2, 2.85, Z_BACK - .16);
hot(board, 'read the board', () => openMenu());

/* ═══════════ clutter ═══════════ */
// stacked cups waiting to be used
for (let c = 0; c < 3; c++) {
  const n = 3 + (c % 2);
  for (let k = 0; k < n; k++) cyl(.043, .036, .07, M.cream, .55 + c * .17, 1.13 + k * .062, C_Z - .22, null, 14);
}
// jars of beans on the back bar
[[-3.4, 0x4a2f1a], [-3.05, 0x6b4423], [1.0, 0x3d2413]].forEach(([x, col]) => {
  cyl(.085, .085, .26, M.glass, x, 2.31, Z_BACK - .3, null, 18).castShadow = false;
  cyl(.075, .075, .17, new THREE.MeshStandardMaterial({ color: col, roughness: .9 }), x, 2.27, Z_BACK - .3, null, 18);
  cyl(.088, .088, .022, M.brass, x, 2.45, Z_BACK - .3, null, 18);
});
// knock box, scale, milk jug, napkins
box(.17, .16, .17, M.black, -1.15, 1.18, C_Z - .12);
cyl(.06, .07, .13, M.steel, -.72, 1.16, C_Z - .3, null, 16);
box(.13, .09, .09, M.cream, .3, 1.14, C_Z + .18);
// a broom in the corner
const broom = new THREE.Group(); broom.position.set(4.15, 0, -5.6); broom.rotation.z = .16; scene.add(broom);
cyl(.017, .017, 1.5, M.beam, 0, .75, 0, broom, 8);
box(.3, .16, .08, M.linen, 0, .08, 0, broom);
// crate of firewood by the door
box(.5, .34, .38, M.beam, -3.9, .17, -5.9);
for (let i = 0; i < 5; i++) {
  const l = cyl(.045, .05, .44, M.bark, -4.02 + (i % 3) * .1, .38 + Math.floor(i / 3) * .09, -5.9 + (i % 2) * .07, null, 6);
  l.rotation.z = Math.PI / 2; l.rotation.y = Math.random() * .4;
}

/* ═══════════ stove ═══════════ */
const stove = new THREE.Group(); stove.position.set(3.5, 0, 1.0); scene.add(stove);
cyl(.36, .42, 1.0, M.black, 0, .5, 0, stove, 20);
cyl(.4, .4, .06, M.black, 0, 1.03, 0, stove, 20);
cyl(.09, .09, 2.9, M.black, 0, 2.5, 0, stove, 14);
const stoveDoor = cyl(.19, .19, .06, new THREE.MeshStandardMaterial({ color: 0xff8a3c, emissive: 0xff6a18, emissiveIntensity: 1.6, roughness: .6 }), 0, .5, -.36, stove, 18);
stoveDoor.rotation.x = Math.PI / 2;
box(1.0, .1, 1.0, M.black, 0, .05, 0, stove);
for (let i = 0; i < 7; i++) cyl(.05, .06, .5 + Math.random() * .2, M.bark, 1.0 + Math.random() * .3, .1 + i * .12, .1 + Math.random() * .4, stove, 6).rotation.z = Math.PI / 2;
hot(cyl(.55, .55, 1.2, new THREE.MeshBasicMaterial({ visible: false }), 0, .6, 0, stove, 10), 'the stove', () => story('stove'));

/* ═══════════ tables, chairs, seats ═══════════ */
const tables = [];
function table(x, z, r) {
  const g = new THREE.Group();
  g.position.set(x + (Math.random() - .5) * .05, 0, z + (Math.random() - .5) * .05);
  g.rotation.y = Math.random() * 3; scene.add(g);
  cyl(r, r, .055, M.slab, 0, .74, 0, g, 32);
  cyl(.055, .055, .72, M.beam, 0, .37, 0, g, 12);
  cyl(.28, .32, .05, M.beam, 0, .03, 0, g, 16);
  tables.push(g); return g;
}
function chair(x, z, ry) {
  const g = new THREE.Group();
  g.position.set(x + (Math.random() - .5) * .13, 0, z + (Math.random() - .5) * .13);
  g.rotation.y = ry + (Math.random() - .5) * .34;
  g.rotation.z = (Math.random() - .5) * .008;
  scene.add(g);
  box(.42, .05, .42, M.slab, 0, .45, 0, g);
  [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]].forEach(([a, b]) => box(.045, .45, .045, M.beam, a, .22, b, g));
  box(.42, .05, .045, M.beam, 0, .78, -.19, g);
  box(.42, .05, .045, M.beam, 0, .62, -.19, g);
  [-.18, .18].forEach(a => box(.045, .5, .045, M.beam, a, .6, -.19, g));
  return g;
}
const cupGeo = new THREE.CylinderGeometry(.042, .033, .075, 18);
function cup(parent, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  g.rotation.y = Math.random() * 6; (parent || scene).add(g);
  const c = new THREE.Mesh(cupGeo, M.cream); c.castShadow = true; g.add(c);
  const h = new THREE.Mesh(new THREE.TorusGeometry(.026, .006, 6, 14), M.cream);
  h.position.set(.05, 0, 0); h.rotation.y = Math.PI / 2; g.add(h);
  const s = new THREE.Mesh(new THREE.CircleGeometry(.036, 16), new THREE.MeshStandardMaterial({ color: 0x36200f, roughness: .3 }));
  s.rotation.x = -Math.PI / 2; s.position.y = .034; g.add(s);
  return g;
}

const SEATS = [
  { id: 'window', label: 'the window seat', pos: [-2.9, 0, -2.6], look: [-4.6, 1.3, -3.4],
    body: 'The draft off the glass is real; so is the light at eight in the morning. Most people who sit here stay longer than they meant to.' },
  { id: 'stove', label: 'the chair by the stove', pos: [2.6, 0, 1.6], look: [3.6, 1.0, 1.0],
    body: 'Warmest chair in the barn, and the one everyone fights over in February. The kettle on top is not decoration.' },
  { id: 'long', label: 'the long table', pos: [-.2, 0, .4], look: [.6, 1.1, 2.6],
    body: 'One slab of fir off a fallen barn down the road. Strangers end up elbow to elbow here, which was the whole idea.' },
  { id: 'porch', label: 'the porch bench', pos: [-2.3, 0, Z_FRONT - 1.9], look: [-2.0, 1.2, -22],
    body: 'Nothing between you and the range but a fence line. Bring the mug out; nobody minds.' },
];
table(-2.9, -2.6, .52); chair(-2.9, -2.0, Math.PI); chair(-2.9, -3.2, 0);
table(2.5, 2.3, .48); chair(2.5, 2.85, Math.PI); chair(2.6, 1.75, 0);
// long communal table
const lt = new THREE.Group(); lt.position.set(-.2, 0, -.2); scene.add(lt);
box(1.05, .07, 3.0, M.slab, 0, .75, 0, lt);
[-1.3, 1.3].forEach(o => { box(.9, .07, .1, M.beam, 0, .38, o, lt); box(.1, .72, .1, M.beam, -.4, .37, o, lt); box(.1, .72, .1, M.beam, .4, .37, o, lt); });
[-1.0, 0, 1.0].forEach(o => { chair(-.95, o - .2, Math.PI / 2); chair(.55, o - .2, -Math.PI / 2); });
cup(scene, -.2, .82, .4);

// window bar + stools along the left wall
box(.4, .06, 3.4, M.slab, -4.24, 1.02, 1.6);
[-1, 1].forEach(o => box(.06, 1.0, .3, M.beam, -4.24, .5, 1.6 + o * 1.4));
[0.9, 2.3].forEach(z => { cyl(.16, .18, .68, M.slab, -3.85, .68, z, null, 16); cyl(.04, .04, .68, M.steel, -3.85, .34, z, null, 10); });

/* ═══════════ pinboard + notes ═══════════ */
const pinboard = new THREE.Group(); pinboard.position.set(-HW + .07, 1.85, -5.0); pinboard.rotation.y = Math.PI / 2; scene.add(pinboard);
box(1.7, 1.15, .05, M.cork, 0, 0, 0, pinboard);
box(1.78, .06, .07, M.beam, 0, .6, 0, pinboard);
box(1.78, .06, .07, M.beam, 0, -.6, 0, pinboard);
hot(box(1.8, 1.2, .12, new THREE.MeshBasicMaterial({ visible: false }), 0, 0, 0, pinboard), 'the wall of notes', () => openPanel('panel-note'));
const noteMeshes = [];
function noteTexture(text) {
  const c = document.createElement('canvas'); c.width = 320; c.height = 220;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e9dcbe'; ctx.fillRect(0, 0, 320, 220); noise(ctx, 320, 220, 12);
  ctx.fillStyle = 'rgba(60,42,26,.82)'; ctx.font = 'italic 25px "Playfair Display",Georgia,serif';
  const words = String(text).split(/\s+/); let line = '', y = 52;
  words.forEach(wd => {
    const t = line ? line + ' ' + wd : wd;
    if (ctx.measureText(t).width > 264) { ctx.fillText(line, 28, y); line = wd; y += 34; }
    else line = t;
  });
  ctx.fillText(line, 28, y);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function renderNotes() {
  noteMeshes.forEach(m => pinboard.remove(m)); noteMeshes.length = 0;
  const list = loadNotes();
  list.slice(-10).forEach((n, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(.3, .21),
      new THREE.MeshStandardMaterial({ map: noteTexture(n.t), roughness: .96 }));
    const col = i % 4, row = Math.floor(i / 4);
    m.position.set(-.6 + col * .4 + (Math.random() - .5) * .04, .34 - row * .34 + (Math.random() - .5) * .04, .035);
    m.rotation.z = (Math.random() - .5) * .16;
    pinboard.add(m); noteMeshes.push(m);
  });
  const meta = document.getElementById('notes-meta');
  meta.textContent = `${list.length} on the wall · gone in 7 days`;
}
function loadNotes() {
  try {
    const raw = JSON.parse(localStorage.getItem('nearcoffee.notes') || '[]');
    const cut = Date.now() - 7 * 864e5;
    const live = raw.filter(n => n.ts > cut);
    if (live.length !== raw.length) localStorage.setItem('nearcoffee.notes', JSON.stringify(live));
    return live;
  } catch (e) { return []; }
}

/* ═══════════ photographs on the east wall ═══════════ */
const loader = new THREE.TextureLoader();
[['images/frame-1.jpg', 1.0, -3.6], ['images/frame-2.jpg', .78, -2.1], ['images/frame-3.jpg', .9, -.55]].forEach(([src, h, z], i) => {
  const g = new THREE.Group(); g.position.set(HW - .07, 2.0, z); g.rotation.y = -Math.PI / 2; scene.add(g);
  const w = h * 1.3;
  box(w + .1, h + .1, .05, M.beam, 0, 0, -.02, g);
  const ph = box(w, h, .02, new THREE.MeshStandardMaterial({ color: 0x8a8580, roughness: .6 }), 0, 0, .015, g);
  loader.load(src, t => { t.colorSpace = THREE.SRGBColorSpace; ph.material.map = t; ph.material.color.set(0xffffff); ph.material.needsUpdate = true; });
  if (i === 1) hot(box(w + .2, h + .2, .1, new THREE.MeshBasicMaterial({ visible: false }), 0, 0, 0, g), 'the photographs', () => story('photos'));
});

/* ═══════════ record player ═══════════ */
const rec = new THREE.Group(); rec.position.set(3.9, 0, -1.6); scene.add(rec);
box(.7, .8, .45, M.slab, 0, .4, 0, rec);
box(.52, .07, .38, M.black, 0, .84, 0, rec);
const platter = cyl(.15, .15, .02, new THREE.MeshStandardMaterial({ color: 0x131110, roughness: .4 }), -.06, .88, 0, rec, 28);
cyl(.05, .05, .022, M.brass, -.06, .89, 0, rec, 18);
const tonearm = box(.02, .015, .22, M.steel, .13, .9, -.02, rec); tonearm.rotation.y = -.5;
hot(box(.75, 1.0, .5, new THREE.MeshBasicMaterial({ visible: false }), 0, .5, 0, rec), 'the record player', () => toggleRadio());

/* ═══════════ bakery, through the back opening ═══════════ */
const BK = new THREE.Group(); scene.add(BK);
const bkX0 = 0.2, bkX1 = 4.4, bkZ0 = Z_BACK, bkZ1 = Z_BACK + 3.8, bkH = 2.9;
const bkCX = (bkX0 + bkX1) / 2, bkCZ = (bkZ0 + bkZ1) / 2, bkW = bkX1 - bkX0, bkD = bkZ1 - bkZ0;
const bkFloor = new THREE.Mesh(new THREE.PlaneGeometry(bkW, bkD), M.floor);
bkFloor.rotation.x = -Math.PI / 2; bkFloor.position.set(bkCX, .001, bkCZ); bkFloor.receiveShadow = true; BK.add(bkFloor);
const bkCeil = new THREE.Mesh(new THREE.PlaneGeometry(bkW, bkD), M.ceil);
bkCeil.rotation.x = Math.PI / 2; bkCeil.position.set(bkCX, bkH, bkCZ); BK.add(bkCeil);
[[bkX0, bkCZ, Math.PI / 2, bkD], [bkCX, bkZ1, Math.PI, bkW]].forEach(([x, z, ry, len]) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(len, bkH), M.wall);
  m.position.set(x, bkH / 2, z); m.rotation.y = ry; m.receiveShadow = true; BK.add(m);
});
wallWithHoles(bkD, bkH, [[-.4, 1.75, 1.3, 1.2]], sideWallMat, bkX1, 0, bkCZ, -Math.PI / 2);
window4(bkX1 - .05, bkCZ - .4, -Math.PI / 2, 1.3, 1.2, 1.15);
// oven
box(1.5, 1.6, .9, M.black, 3.3, .8, bkZ1 - .55, BK);
const ovenGlass = box(.78, .4, .05, new THREE.MeshStandardMaterial({ color: 0xd8843c, emissive: 0xff7a22, emissiveIntensity: .8, roughness: .5 }), 3.3, .95, bkZ1 - 1.02, BK);
[-.12, .06].forEach(o => box(.72, .025, .02, M.black, 3.3, .95 + o, bkZ1 - 1.05, BK));
box(1.1, .06, .08, M.brass, 3.3, .58, bkZ1 - 1.06, BK);
box(1.6, .08, 1.0, M.slab, 3.3, 1.66, bkZ1 - .55, BK);
// work bench + racks
box(2.4, .9, .7, M.wall, 1.5, .45, bkZ0 + .8, BK);
box(2.5, .08, .8, M.slab, 1.5, .93, bkZ0 + .8, BK);
for (let i = 0; i < 6; i++) {
  const l = box(.22, .08, .1, M.crust, .7 + i * .3, 1.0, bkZ0 + .7 + (i % 2) * .22, BK);
  l.rotation.y = i * .5;
}
box(.9, .04, .5, M.linen, 1.9, .99, bkZ0 + 1.0, BK).rotation.z = .02;
for (let s = 0; s < 3; s++) {
  box(1.4, .05, .5, M.steel, .95, 1.4 + s * .45, bkZ1 - .4, BK);
  for (let i = 0; i < 3; i++) cyl(.09, .09, .05, M.crust, .55 + i * .4, 1.47 + s * .45, bkZ1 - .4, BK, 12);
}
hot(box(1.6, 1.7, 1.0, new THREE.MeshBasicMaterial({ visible: false }), 3.3, .85, bkZ1 - .55, BK), 'the oven', () => story('oven'));

/* ═══════════ people already here ═══════════ */
const figures = [];
function figure(x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  cyl(.16, .21, .62, M.figure, 0, .74, 0, g, 12);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.11, 16, 12), M.figure);
  head.position.y = 1.16; head.castShadow = true; g.add(head);
  box(.34, .1, .3, M.figure, 0, .46, .06, g);
  g.visible = false; g.userData.baseRy = ry; figures.push(g); return g;
}
figure(-2.9, -2.05, Math.PI); figure(-.95, -.6, Math.PI / 2); figure(2.6, 1.8, 0); figure(-3.85, 2.3, -Math.PI / 2);

/* ═══════════ lights ═══════════ */
const hemi = new THREE.HemisphereLight(0xbcd2ee, 0x4a3a2c, .6); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffdcae, 2.4);
sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.radius = 3.2;
const sc = sun.shadow.camera; sc.left = -14; sc.right = 14; sc.top = 12; sc.bottom = -6; sc.near = 1; sc.far = 120;
sun.shadow.bias = -0.0007; sun.shadow.normalBias = .03;
scene.add(sun, sun.target);
const ambient = new THREE.AmbientLight(0xffe2c0, .22); scene.add(ambient);
const bounce = new THREE.DirectionalLight(0xc9c1b4, .5);
bounce.position.set(-2, .4, -9); bounce.target.position.set(0, 2.4, 3);
scene.add(bounce, bounce.target);


try { RectAreaLightUniformsLib.init(); } catch (e) { console.warn('area lights unavailable', e); }
const winLights = [];
function windowLight(x, y, z, w, h, ry, boost) {
  const l = new THREE.RectAreaLight(0xcfe2ff, 1, w, h);
  l.position.set(x, y, z); l.rotation.y = ry;
  scene.add(l);
  winLights.push({ light: l, boost: boost || 1 });
  return l;
}
[0.6, 3.0, -2.4].forEach(z => windowLight(-HW + .12, 1.85, z, 1.5, 1.4, Math.PI / 2, 1));
windowLight(HW - .12, 2.2, 3.4, 1.4, 1.2, -Math.PI / 2, 1);
windowLight(4.28, 1.75, bkZ0 + 1.5, 1.3, 1.2, -Math.PI / 2, .8);
windowLight(0, 1.7, Z_FRONT + .18, DOOR_W, DOOR_H, 0, 1.5);

const bulbs = [];
[[0, -4.0], [0, -1.0], [-1.6, 2.6]].forEach(([x, z]) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  cyl(.008, .008, 1.5, M.black, 0, RIDGE_H - 1.1, 0, g, 6);
  const glassB = new THREE.Mesh(new THREE.SphereGeometry(.075, 18, 14),
    new THREE.MeshStandardMaterial({ color: 0xffdca0, emissive: 0xffc477, emissiveIntensity: 2.4, roughness: .3 }));
  glassB.position.y = RIDGE_H - 1.9; g.add(glassB);
  const l = new THREE.PointLight(0xffb163, 9, 11, 2);
  // No shadow casting here: point-light cube shadows self-shadow every
  // upward-facing surface in this geometry, and the sun already casts.
  l.position.y = RIDGE_H - 1.9;
  g.add(l);
  bulbs.push({ light: l, glass: glassB });
});
const stoveLight = new THREE.PointLight(0xff7a2a, 7, 7, 2);
stoveLight.position.set(3.5, .7, .7); scene.add(stoveLight);
const ovenLight = new THREE.PointLight(0xff8c3a, 6, 6, 2);
ovenLight.position.set(3.3, 1.0, bkZ1 - 1.3); scene.add(ovenLight);
const bakeryLight = new THREE.PointLight(0xffd9a4, 8, 9, 2);
bakeryLight.position.set(2.0, 2.45, bkZ0 + 1.7); scene.add(bakeryLight);
const bakeryBulb = new THREE.Mesh(new THREE.SphereGeometry(.06, 14, 10), new THREE.MeshStandardMaterial({ color: 0xffdca0, emissive: 0xffc477, emissiveIntensity: 2.2, roughness: .3 }));
bakeryBulb.position.copy(bakeryLight.position); scene.add(bakeryBulb);
cyl(.006, .006, .45, M.black, 2.0, 2.68, bkZ0 + 1.7, null, 6);
const counterLight = new THREE.PointLight(0xffc98a, 6, 6.5, 2);
counterLight.position.set(-1.6, 2.62, C_Z - .5); scene.add(counterLight);

/* ═══════════ things that move on their own ═══════════ */
const _d = new THREE.Object3D();
function animateLife(dt) {
  // wind through the treeline
  const gust = .5 + Math.sin(clock * .21) * .3 + Math.sin(clock * .07) * .2;
  for (let i = 0; i < pineData.length; i++) {
    const p = pineData[i];
    const lean = Math.sin(clock * 1.1 + p.ph) * .028 * gust * p.s;
    _d.position.set(p.x, 0, p.z);
    _d.scale.set(p.s, p.s * p.hs, p.s);
    _d.rotation.set(lean * .6, p.ry, lean);
    _d.updateMatrix();
    pines.setMatrixAt(i, _d.matrix);
  }
  pines.instanceMatrix.needsUpdate = true;

  // bulbs on their cords
  bulbs.forEach((b, i) => {
    const g = b.glass.parent;
    g.rotation.z = Math.sin(clock * .62 + i * 2.1) * .012 * (1 + gust);
    g.rotation.x = Math.cos(clock * .48 + i * 1.3) * .009 * (1 + gust);
  });

  // people breathe, and occasionally shift
  figures.forEach((f, i) => {
    if (!f.visible) return;
    const br = Math.sin(clock * (.9 + i * .07) + i) * .012;
    f.scale.set(1, 1 + br, 1);
    f.rotation.y = f.userData.baseRy + Math.sin(clock * .18 + i * 1.7) * .16;
  });
}

/* ═══════════ how brightly sunlight enters ═══════════ */
// Beams are carried by lit dust rather than additive volumes: a solid volume
// always leaves a hard seam where it intersects furniture, and a correct fix
// needs full ray-marching. The openings below drive how brightly motes glow.
const OPENINGS = [
  { p: new THREE.Vector3(0, 1.7, Z_FRONT + .1), n: new THREE.Vector3(0, 0, 1), r: 2.6 },
  { p: new THREE.Vector3(-HW + .1, 1.85, 0.6), n: new THREE.Vector3(1, 0, 0), r: 2.0 },
  { p: new THREE.Vector3(-HW + .1, 1.85, 3.0), n: new THREE.Vector3(1, 0, 0), r: 2.0 },
  { p: new THREE.Vector3(-HW + .1, 1.85, -2.4), n: new THREE.Vector3(1, 0, 0), r: 2.0 },
  { p: new THREE.Vector3(HW - .1, 2.2, 3.4), n: new THREE.Vector3(-1, 0, 0), r: 1.9 },
];

const _lightDir = new THREE.Vector3();
let sunGlow = 0;
function updateShafts() {
  _lightDir.copy(sun.target.position).sub(sun.position).normalize();
  const strength = THREE.MathUtils.clamp((todBlend.sunI - .5) / 3.2, 0, 1);
  let best = 0;
  OPENINGS.forEach(o => { best = Math.max(best, Math.max(0, -_lightDir.dot(o.n))); });
  sunGlow = Math.pow(best, 1.2) * strength;
}

/* ═══════════ particles: dust, steam, snow ═══════════ */
function points(count, size, color, opacity, spawn) {
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) { const p = spawn(i); pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2]; seed[i] = Math.random(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.Points(g, new THREE.PointsMaterial({
    size, map: softDot, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  }));
  m.userData.seed = seed; scene.add(m); return m;
}
const dust = points(900, .026, 0xffd9a8, .5, () => [(Math.random() - .5) * 8.4, .25 + Math.random() * 3.6, Z_FRONT + Math.random() * 13]);
const snowP = points(1400, .09, 0xffffff, .75, () => [(Math.random() - .5) * 120, Math.random() * 40, -Math.random() * 120 - 4]);
snowP.material.blending = THREE.NormalBlending;
const steam = points(160, .04, 0xffffff, .11, () => [0, -99, 0]);
steam.material.blending = THREE.NormalBlending;
const steamSrc = [];
function addSteam(x, y, z) { steamSrc.push({ x, y, z, t: Math.random() }); }
addSteam(-.2, .88, .4);
addSteam(-2.5, 1.7, C_Z - .1);

/* ═══════════ time of day ═══════════ */
const TOD = {
  dawn: { h: 6.4, sun: 0xffb173, sunI: 2.5, hemiS: 0x9aa0a8, hemiI: .8, amb: 1.15, exp: 1.5, bulb: 9,
    sky: ['#24406b', '#cc7f50', '#f5bb7d'], snow: 0xbcc4dc, fog: 0x2a2436, word: 'first light' },
  day:  { h: 12.5, sun: 0xffeed2, sunI: 4.2, hemiS: 0xbcc8d6, hemiI: 1.3, amb: 1.7, exp: 1.85, bulb: 5.5,
    sky: ['#5286c6', '#9dc0e2', '#cfe0f2'], snow: 0xb9c5d5, fog: 0x9fb5cf, word: 'high day' },
  dusk: { h: 19.6, sun: 0xff8f45, sunI: 3.4, hemiS: 0x8a857f, hemiI: .85, amb: 1.15, exp: 1.8, bulb: 12,
    sky: ['#3b3750', '#9b5a5e', '#ee9560'], snow: 0xc9b3ac, fog: 0x3a2a2c, word: 'last light' },
  night:{ h: 1.3, sun: 0x8fa6d8, sunI: .5, hemiS: 0x2e3138, hemiI: .42, amb: .44, exp: 1.9, bulb: 15,
    sky: ['#05080f', '#0b1220', '#131c2e'], snow: 0x9fb2cf, fog: 0x0d1120, word: 'deep night' },
};
let todKey = 'live', todNow = TOD.night, todBlend = { ...TOD.night };
function localHour() {
  const s = new Date().toLocaleString('en-US', { timeZone: 'America/Denver', hour12: false, hour: '2-digit', minute: '2-digit' });
  const [h, m] = s.split(':').map(Number); return h + m / 60;
}
function keyForHour(h) {
  if (h >= 4.5 && h < 8.5) return 'dawn';
  if (h >= 8.5 && h < 17.5) return 'day';
  if (h >= 17.5 && h < 21) return 'dusk';
  return 'night';
}
function setTod(key) {
  todKey = key;
  const eff = key === 'live' ? keyForHour(localHour()) : key;
  todNow = TOD[eff];
  document.querySelectorAll('#light-row .pill').forEach(b => b.dataset.on = String(b.dataset.tod === key));
  paintSkyFor(todNow);
  updateClock();
  if (window.__booted) updatePresence();
}
function applyTod(dt) {
  const t = todNow, k = Math.min(1, dt * 1.4);
  const lerp = (a, b) => a + (b - a) * k;
  todBlend.sunI = lerp(todBlend.sunI, t.sunI);
  todBlend.hemiI = lerp(todBlend.hemiI, t.hemiI);
  todBlend.amb = lerp(todBlend.amb, t.amb);
  todBlend.bulb = lerp(todBlend.bulb, t.bulb);
  sun.intensity = todBlend.sunI; sun.color.lerp(new THREE.Color(t.sun), k);
  hemi.intensity = todBlend.hemiI; hemi.color.lerp(new THREE.Color(t.hemiS), k);
  ambient.intensity = todBlend.amb;
  bulbs.forEach((b, i) => {
    b.light.intensity = todBlend.bulb * (0.94 + Math.sin(clock * 2.3 + i * 2) * .05);
    b.glass.material.emissiveIntensity = 0.6 + todBlend.bulb * .18;
  });
  counterLight.intensity = todBlend.bulb * .32; bakeryLight.intensity = 7 + todBlend.bulb * .4;
  bounce.intensity = .3 + todBlend.sunI * .42;
  const skyLit = new THREE.Color(t.sky[2]).lerp(new THREE.Color(0xffffff), .45);
  winLights.forEach(wl => {
    wl.light.intensity = (.25 + todBlend.sunI * .85) * wl.boost;
    wl.light.color.lerp(skyLit, k);
  });
  renderer.toneMappingExposure += (t.exp - renderer.toneMappingExposure) * k;
  M.snow.color.lerp(new THREE.Color(t.snow), k);
  ground.material.color.lerp(new THREE.Color(t.snow), k);
  scene.fog.color.lerp(new THREE.Color(t.fog), k);
  near.material.color.lerp(new THREE.Color(t.snow).lerp(new THREE.Color(0xffffff), .5), k);
  mid.material.color.lerp(new THREE.Color(t.snow).lerp(new THREE.Color(t.sky[1]), .3), k);
  far.material.color.lerp(new THREE.Color(t.snow).lerp(new THREE.Color(t.sky[1]), .62), k);
  // sun position: rises east (+z), sets west (-z) through the door
  const hh = t.h, a = ((hh - 6) / 12) * Math.PI;
  const el = Math.max(-.15, Math.sin(a)) * 1.05;
  sun.position.set(Math.sin(a) * 40 * Math.cos(el) + 10, 6 + Math.sin(el) * 55, Math.cos(a) * 60);
  sun.target.position.set(0, 1, 0);
}
function paintSkyFor(t) { paintSky(t.sky[0], t.sky[1], t.sky[2]); }

/* ═══════════ camera rig ═══════════ */
let cinematic = false;
const rig = {
  pos: new THREE.Vector3(0, EYE, Z_FRONT - 5.2),
  yaw: 0, pitch: -0.02,
  tPos: new THREE.Vector3(0, EYE, Z_FRONT - 5.2), tYaw: 0, tPitch: -0.02,
  travel: 0, seated: false, place: 'porch',
};
const ZONES = [
  [-4.1, 4.1, Z_FRONT + .5, Z_BACK - .8],       // main room
  [-1.3, 1.3, Z_FRONT - 3.0, Z_FRONT + .6],     // doorway + porch
  [-6.5, 6.5, Z_FRONT - 9, Z_FRONT - 1.2],      // outside / porch deck
  [0.5, 4.1, Z_BACK - .8, bkZ1 - .6],           // bakery
];
function inZone(x, z) { return ZONES.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1); }

const ANCHORS = {
  room:    { pos: [0, EYE, -1.4], look: [0, 1.5, 5.4] },
  counter: { pos: [-1.6, EYE, .4], look: [-2.0, 1.8, 5.2] },
  bakery:  { pos: [.9, EYE, 6.3], look: [3.0, 1.5, 9.8] },
  porch:   { pos: [-.45, EYE, Z_FRONT - 1.2], look: [1.6, 105, -900] },
  approach:{ pos: [0, EYE, Z_FRONT - 3.4], look: [0, 2.2, 6] },
  door:    { pos: [0, EYE, Z_FRONT + 1.6], look: [0, 2.0, -40] },
};
function lookAngles(from, to) {
  const d = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) };
}
function goTo(name, seat) {
  const a = seat || ANCHORS[name];
  if (!a) return;
  rig.tPos.set(a.pos[0], seat ? SIT : (a.pos[1] ?? EYE), a.pos[2]);
  const ang = lookAngles([a.pos[0], seat ? SIT : (a.pos[1] ?? EYE), a.pos[2]], a.look);
  rig.tYaw = ang.yaw; rig.tPitch = ang.pitch;
  rig.travel = 1; rig.seated = !!seat;
  rig.place = name;
  document.querySelectorAll('.place').forEach(b => b.dataset.on = String(b.dataset.go === name));
  if (!seat) closePanel('panel-seat');
}
SEATS.forEach(s => {
  const marker = new THREE.Mesh(new THREE.SphereGeometry(.3, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
  marker.position.set(s.pos[0], .5, s.pos[2]); scene.add(marker);
  hot(marker, s.label, () => sitAt(s));
});
function sitAt(s) {
  goTo(s.id, { pos: s.pos, look: s.look });
  document.getElementById('seat-kicker').textContent = s.label;
  document.getElementById('seat-title').textContent = 'Stay a while';
  document.getElementById('seat-body').textContent = s.body;
  openPanel('panel-seat');
  currentSeat = s;
}
let currentSeat = SEATS[2];

/* ═══════════ input ═══════════ */
let dragging = false, lastX = 0, lastY = 0, mx = 0, my = 0, dragDist = 0;
stage.addEventListener('pointerdown', e => {
  dragging = true; dragDist = 0; lastX = e.clientX; lastY = e.clientY; stage.classList.add('dragging');
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointerup', e => { dragging = false; stage.classList.remove('dragging'); });
stage.addEventListener('pointermove', e => {
  mx = (e.clientX / innerWidth) * 2 - 1; my = (e.clientY / innerHeight) * 2 - 1;
  if (dragging) {
    dragDist += Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY);
    rig.tYaw -= (e.clientX - lastX) * .0032;
    rig.tPitch = THREE.MathUtils.clamp(rig.tPitch - (e.clientY - lastY) * .0026, -.55, .45);
    lastX = e.clientX; lastY = e.clientY; rig.travel = 0;
  }
  tipEl.style.left = e.clientX + 'px'; tipEl.style.top = e.clientY + 'px';
});
addEventListener('wheel', e => {
  if (e.target.closest('.panel')) return;
  const step = THREE.MathUtils.clamp(-e.deltaY * .0022, -.5, .5);
  const fx = -Math.sin(rig.tYaw), fz = -Math.cos(rig.tYaw);
  const nx = rig.tPos.x + fx * step, nz = rig.tPos.z + fz * step;
  if (inZone(nx, rig.tPos.z)) rig.tPos.x = nx;
  if (inZone(rig.tPos.x, nz)) rig.tPos.z = nz;
  rig.tPos.y = EYE; rig.seated = false; rig.travel = 0;
  footstep();
  hideHint();
}, { passive: true });
addEventListener('keydown', e => {
  const f = { ArrowUp: 1, w: 1, ArrowDown: -1, s: -1 }[e.key];
  if (f) {
    const nx = rig.tPos.x - Math.sin(rig.tYaw) * .35 * f, nz = rig.tPos.z - Math.cos(rig.tYaw) * .35 * f;
    if (inZone(nx, rig.tPos.z)) rig.tPos.x = nx;
    if (inZone(rig.tPos.x, nz)) rig.tPos.z = nz;
    rig.tPos.y = EYE; rig.seated = false; rig.travel = 0;
    footstep();
  }
  if (e.key === 'ArrowLeft' || e.key === 'a') rig.tYaw += .1;
  if (e.key === 'ArrowRight' || e.key === 'd') rig.tYaw -= .1;
  if (e.key === 'Escape') closeAll();
});

const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
let hovered = null;
function pick() {
  ndc.set(mx, -my); ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(hotspots, true);
  const h = hits.find(x => x.distance < 22);
  const obj = h ? h.object : null;
  if (obj !== hovered) {
    hovered = obj;
    if (obj && obj.userData.hot) {
      tipEl.textContent = obj.userData.hot.label; tipEl.style.opacity = 1; stage.classList.add('pointing');
      setHoverTargets(litTargets(obj));
      blip(760, .02, .05);
    } else {
      tipEl.style.opacity = 0; stage.classList.remove('pointing');
      setHoverTargets([]);
    }
  }
}
stage.addEventListener('click', e => {
  if (dragDist > 6) { dragDist = 0; return; }
  mx = (e.clientX / innerWidth) * 2 - 1; my = (e.clientY / innerHeight) * 2 - 1;
  pick();
  if (hovered && hovered.userData.hot) { hovered.userData.hot.action(); hideHint(); }
});

/* ═══════════ panels & stories ═══════════ */
const STORIES = {
  machine: { k: 'behind the counter', t: 'A 1974 lever machine, rebuilt twice',
    p: ['It came out of a bakery in Livingston with a cracked group head and a note taped to the boiler that said <em>runs hot, be kind</em>. Two winters of evenings later it pulls the best shot in the valley, which is admittedly a small valley.',
      'Pull the lever and you can hear the spring load. That sound is most of why I bought it.'] },
  grinder: { k: 'behind the counter', t: 'Ground to order, always',
    p: ['One origin at a time, changed when the bag runs out rather than when a calendar says so. Right now it is a washed Guji — apricot, black tea, a little sweetness at the end.',
      'If you want it lighter or darker, say so. It is a dial, not a doctrine.'] },
  stove: { k: 'the corner', t: 'The stove earns its keep',
    p: ['Barn wood is drafty by design — it was built for hay, not for people. The stove is what makes the difference between a shelter and a room.',
      'It gets lit at five in the morning, before anything else, and the kettle goes on top of it. Everything else in here happens downstream of that.'] },
  photos: { k: 'the east wall', t: 'Whatever the light did that week',
    p: ['I shoot the same fence line most mornings and it is never the same photograph twice. The frames come down and go back up whenever something better happens outside.',
      'None of them are for sale. Ask anyway, and I will probably print you one.'] },
  oven: { k: 'the back room', t: 'Small batches, most mornings',
    p: ['Croissants proof overnight on the bench by the window because that corner sits at exactly the right temperature in winter. In July they go in the walk-in and sulk.',
      'When the tray runs out, that is the day. There is no second bake.'] },
  sign: { k: 'the porch', t: 'Open whenever you are',
    p: ['The hours moved around so much the first year that I gave up and painted this instead. In practice: light on, door open.',
      'The barn is a hundred and ten years old. It has been a hay loft, a garage, and briefly somebody’s recording studio. This is the first time it has smelled like coffee.'] },
};
function story(id) {
  const s = STORIES[id]; if (!s) return;
  document.getElementById('story-kicker').textContent = s.k;
  document.getElementById('story-title').textContent = s.t;
  document.getElementById('story-body').innerHTML = s.p.map(x => `<p>${x}</p>`).join('');
  openPanel('panel-story');
}
const MENU = [
  ['Drip, house blend', '3', 'Big pot, made all day, refills are free and you can pour it yourself.'],
  ['Cortado', '4', 'Two ounces of milk, no more, in a glass that holds the heat.'],
  ['Flat white', '4', 'The one I make for myself at half past ten.'],
  ['Pour-over, single origin', '5', 'Takes four minutes. That is the point of it.'],
  ['Stovetop hot chocolate', '4', 'Dark, thick, stirred on the wood stove until it coats the spoon.'],
  ['Butter croissant', '4', 'Laminated Tuesday and Friday. Gone by ten both days.'],
  ['Morning bun', '4', 'Orange zest, cinnamon, more sugar than is defensible.'],
  ['Sourdough and jam', '5', 'Chokecherry, picked down the road in August.'],
];
function openMenu() {
  const list = document.getElementById('menu-list');
  list.innerHTML = MENU.map(([n, p, d], i) =>
    `<button class="menu-item" data-order="${i}"><span class="n">${n}</span><span class="p">${p}</span><span class="d">${d}</span></button>`).join('');
  list.querySelectorAll('[data-order]').forEach(b => b.addEventListener('click', () => order(MENU[+b.dataset.order])));
  openPanel('panel-menu');
}
let orderTimers = [], myCup = null, grinding = 0;
function order(item) {
  const note = document.getElementById('menu-note');
  orderTimers.forEach(clearTimeout); orderTimers = [];
  const baked = /croissant|bun|sourdough/i.test(item[0]);
  const stages = baked
    ? [[0, `Getting you a <em>${item[0].toLowerCase()}</em> off the tray.`, () => { }],
       [900, 'Warming it through.', () => noiseBurst(1.4, 320, .03)]]
    : [[0, `<em>${item[0]}</em> — grinding.`, () => { grinding = 1.9; noiseBurst(1.9, 900, .07, 380); }],
       [2100, 'Tamped. Pulling the shot.', () => { noiseBurst(3.4, 1800, .05, 700); blip(180, .05, .3, 'sawtooth'); }],
       [5700, 'Steaming the milk.', () => noiseBurst(2.2, 2600, .045, 1400)]];
  stages.forEach(([ms, text, fx]) => orderTimers.push(setTimeout(() => { note.innerHTML = text; fx(); }, ms)));
  const done = baked ? 2400 : 8200;
  orderTimers.push(setTimeout(() => {
    const s = currentSeat;
    const at = rig.seated && s ? s : null;
    const x = at ? at.pos[0] + .35 : -1.4, z = at ? at.pos[2] - .1 : C_Z - .35;
    const y = at ? (at.id === 'porch' ? .93 : .82) : 1.13;
    if (myCup) scene.remove(myCup);
    myCup = cup(scene, x, y, z);
    addSteam(x, y + .06, z);
    blip(1050, .06, .5);
    note.innerHTML = at ? `<em>${item[0]}</em> is on your table.` : `<em>${item[0]}</em> is on the counter, under the lamp.`;
    setHint(at ? 'your cup is on the table' : 'your cup is waiting on the counter');
  }, done));
}
function syncPanelState() {
  const any = !!document.querySelector('.panel[data-open="true"]');
  document.body.classList.toggle('panel-open', any);
}
function openPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.dataset.open = String(p.id === id));
  syncPanelState();
}
function closePanel(id) { const p = document.getElementById(id); if (p) p.dataset.open = 'false'; syncPanelState(); }
function closeAll() { document.querySelectorAll('.panel').forEach(p => p.dataset.open = 'false'); syncPanelState(); }
document.addEventListener('click', e => {
  const c = e.target.closest('[data-close]'); if (c) closeAll();
  const g = e.target.closest('[data-go]'); if (g) { goTo(g.dataset.go); closeAll(); hideHint(); }
});

/* ═══════════ audio (generated, no files) ═══════════ */
let actx = null, roomGain = null, radioGain = null, radioTimer = null;
function ensureAudio() {
  if (actx) return actx;
  actx = new (window.AudioContext || window.webkitAudioContext)();
  roomGain = actx.createGain(); roomGain.gain.value = 0; roomGain.connect(actx.destination);
  radioGain = actx.createGain(); radioGain.gain.value = 0; radioGain.connect(actx.destination);
  // wind / room tone: filtered brown noise
  const len = actx.sampleRate * 4;
  const buf = actx.createBuffer(1, len, actx.sampleRate);
  const d = buf.getChannelData(0); let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + .02 * w) / 1.02; d[i] = last * 3.2; }
  const src = actx.createBufferSource(); src.buffer = buf; src.loop = true;
  const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
  const lfo = actx.createOscillator(); lfo.frequency.value = .06;
  const lfoG = actx.createGain(); lfoG.gain.value = 180;
  lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
  src.connect(lp); lp.connect(roomGain); src.start();
  crackle();
  return actx;
}
function crackle() {
  if (!actx) return;
  setTimeout(() => {
    if (roomGain && roomGain.gain.value > 0.001) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'square'; o.frequency.value = 900 + Math.random() * 2200;
      g.gain.setValueAtTime(0.0001, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(.035 + Math.random() * .05, actx.currentTime + .004);
      g.gain.exponentialRampToValueAtTime(.0001, actx.currentTime + .07 + Math.random() * .1);
      o.connect(g); g.connect(roomGain); o.start(); o.stop(actx.currentTime + .25);
    }
    crackle();
  }, 180 + Math.random() * 1400);
}
const CHORDS = [[196, 233.1, 293.7], [174.6, 220, 261.6], [146.8, 220, 277.2], [164.8, 196, 246.9]];
function radioLoop() {
  if (!actx || radioGain.gain.value < .001) return;
  const ch = CHORDS[Math.floor(Math.random() * CHORDS.length)];
  ch.forEach((f, i) => {
    const o = actx.createOscillator(), g = actx.createGain(), lp = actx.createBiquadFilter();
    o.type = i === 0 ? 'sine' : 'triangle'; o.frequency.value = f * (i === 2 ? 2 : 1);
    o.detune.value = (Math.random() - .5) * 9;
    lp.type = 'lowpass'; lp.frequency.value = 1100;
    g.gain.setValueAtTime(0.0001, actx.currentTime);
    g.gain.linearRampToValueAtTime(.05 / (i + 1), actx.currentTime + 1.6);
    g.gain.linearRampToValueAtTime(0.0001, actx.currentTime + 5.4);
    o.connect(lp); lp.connect(g); g.connect(radioGain);
    o.start(); o.stop(actx.currentTime + 5.6);
  });
  radioTimer = setTimeout(radioLoop, 4600);
}
function blip(freq, gain, dur, type) {
  if (!actx || !soundOn || !roomGain) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type || 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, actx.currentTime);
  g.gain.exponentialRampToValueAtTime(Math.max(.0002, gain), actx.currentTime + .008);
  g.gain.exponentialRampToValueAtTime(.0001, actx.currentTime + dur);
  o.connect(g); g.connect(roomGain);
  o.start(); o.stop(actx.currentTime + dur + .05);
}
function chime() {
  if (!actx || !soundOn) return;
  [1318, 1760, 2093].forEach((f, i) => setTimeout(() => blip(f, .07, .9, 'sine'), i * 90));
}
function noiseBurst(dur, cutoff, gain, sweep) {
  if (!actx || !soundOn || !roomGain) return null;
  const len = Math.ceil(actx.sampleRate * dur);
  const buf = actx.createBuffer(1, len, actx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * .6;
  const src = actx.createBufferSource(); src.buffer = buf;
  const bp = actx.createBiquadFilter(); bp.type = 'bandpass';
  bp.frequency.setValueAtTime(cutoff, actx.currentTime);
  bp.Q.value = 1.1;
  if (sweep) bp.frequency.linearRampToValueAtTime(sweep, actx.currentTime + dur);
  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, actx.currentTime);
  g.gain.linearRampToValueAtTime(gain, actx.currentTime + .12);
  g.gain.setValueAtTime(gain, actx.currentTime + dur - .25);
  g.gain.linearRampToValueAtTime(.0001, actx.currentTime + dur);
  src.connect(bp); bp.connect(g); g.connect(roomGain);
  src.start(); src.stop(actx.currentTime + dur + .05);
  return src;
}
let lastStep = 0;
function footstep() {
  if (!actx || !soundOn) return;
  const now = performance.now();
  if (now - lastStep < 340) return;
  lastStep = now;
  noiseBurst(.11, 150 + Math.random() * 80, .05);
  blip(70 + Math.random() * 20, .05, .1, 'triangle');
}
let soundOn = false, radioOn = false;
function toggleSound() {
  ensureAudio(); actx.resume();
  soundOn = !soundOn;
  roomGain.gain.linearRampToValueAtTime(soundOn ? .5 : 0, actx.currentTime + 1.2);
  const b = document.getElementById('btn-sound');
  b.textContent = soundOn ? 'sound on' : 'sound off'; b.dataset.on = String(soundOn);
}
function toggleRadio() {
  ensureAudio(); actx.resume();
  radioOn = !radioOn;
  radioGain.gain.linearRampToValueAtTime(radioOn ? .6 : 0, actx.currentTime + 1.4);
  const b = document.getElementById('btn-radio');
  b.textContent = radioOn ? 'radio on' : 'radio off'; b.dataset.on = String(radioOn);
  if (radioOn) radioLoop(); else clearTimeout(radioTimer);
}
document.getElementById('btn-sound').addEventListener('click', toggleSound);
document.getElementById('btn-radio').addEventListener('click', toggleRadio);
document.querySelectorAll('#light-row .pill').forEach(b => b.addEventListener('click', () => setTod(b.dataset.tod)));
document.getElementById('btn-note').addEventListener('click', () => openPanel('panel-note'));
document.getElementById('seat-order').addEventListener('click', openMenu);
document.getElementById('note-pin').addEventListener('click', () => {
  const el = document.getElementById('note-text');
  const t = el.value.trim(); if (!t) return;
  const list = loadNotes(); list.push({ t: t.slice(0, 120), ts: Date.now() });
  localStorage.setItem('nearcoffee.notes', JSON.stringify(list.slice(-40)));
  el.value = ''; renderNotes(); closeAll();
  goTo('door'); setHint('pinned by the door');
});

/* ═══════════ readouts ═══════════ */
function updateClock() {
  const now = new Date();
  const eff = todKey === 'live' ? keyForHour(localHour()) : todKey;
  const timeStr = todKey === 'live'
    ? now.toLocaleString('en-US', { timeZone: 'America/Denver', hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()
    : ({ dawn: '6:24am', day: '12:30pm', dusk: '7:36pm', night: '1:18am' })[eff];
  const temp = ({ dawn: '18°F', day: '31°F', dusk: '24°F', night: '11°F' })[eff];
  document.getElementById('clock').textContent = `${timeStr} · ${TOD[eff].word} · ${temp} · snow`;
}
function updatePresence() {
  const h = todKey === 'live' ? localHour() : TOD[todKey].h;
  let n = 0;
  if (h > 7 && h < 11) n = 3; else if (h >= 11 && h < 15) n = 2; else if (h >= 15 && h < 19) n = 1; else n = 0;
  n = Math.min(n, figures.length);
  figures.forEach((f, i) => { f.visible = i < n; });
  const lines = [
    'you have the place to yourself',
    'one other here &middot; <em>reading, by the window</em>',
    'two others here &middot; <em>a laptop and a long conversation</em>',
    'three others here &middot; <em>the good kind of quiet</em>',
  ];
  document.getElementById('presence').innerHTML = lines[n];
}
let hintTimer = null;
function setHint(t) {
  const el = document.getElementById('hint');
  el.textContent = t; el.style.opacity = 1;
  clearTimeout(hintTimer); hintTimer = setTimeout(() => el.style.opacity = 0, 5200);
}
function hideHint() { clearTimeout(hintTimer); hintTimer = setTimeout(() => document.getElementById('hint').style.opacity = 0, 2600); }

/* ═══════════ realism pass: env reflections, AO, bloom ═══════════ */
// A STATIC neutral environment. A probe that samples the room picks up the
// bulbs and the coloured sky, and glossy horizontal surfaces then mirror that
// cast back as red or violet bands. This never changes colour with the light.
function refreshEnv() {
  try {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, '#95908a');
    g.addColorStop(0.5, '#837d77');
    g.addColorStop(1, '#6b655e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const rt = pmrem.fromEquirectangular(t);
    scene.environment = rt.texture;
    scene.environmentIntensity = .8;
    pmrem.dispose(); t.dispose();
  } catch (err) {
    console.warn('environment unavailable', err);
  }
}

let composer = null, postOK = false;
try {
  composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .11, .55, 1.02);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  postOK = true;
} catch (err) {
  console.warn('post stack unavailable, rendering direct', err);
  postOK = false;
}

/* ═══════════ loop ═══════════ */
let clock = 0, prev = performance.now();
let schedId = null, paused = false;
function schedule() {
  if (schedId) { clearTimeout(schedId); schedId = null; }
  if (paused) return;
  if (document.hidden) schedId = setTimeout(() => tick(performance.now()), 120);
  else requestAnimationFrame(tick);
}
function tick(now) {
  try { tickBody(now); } catch (err) { console.error('render failed', err); }
  frameCount++;
  schedule();
}
let frameCount = 0;
const DEBUG = /[?&]debug/.test(location.search);
const debugApi = {
  scene, renderer, THREE,
  get frames() { return frameCount; }, camera, rig, goTo,
  get anchors() { return ANCHORS; },
  pause() { paused = true; }, resume() { if (paused) { paused = false; prev = performance.now(); schedule(); } },
  setEnv(v) { scene.environmentIntensity = v ? .8 : 0; },
  setWinLights(v) { winLights.forEach(w => w.light.visible = v); },
  setBloomOff(v) { if (composer) composer.passes.forEach(p => { if (p.constructor.name === 'UnrealBloomPass') p.enabled = !v; }); },
  depthInfo() {
    return { rt: depthRT && [depthRT.width, depthRT.height], post: postOK, near: camera.near, far: camera.far };
  },
  step(n, dt) {
    n = n || 1; dt = dt || 16.7;
    for (let i = 0; i < n; i++) { prev = performance.now() - dt; tick(performance.now()); }
    return frameCount;
  },
};
if (DEBUG) window.nearCoffee = debugApi;
function tickBody(now) {
  const dt = Math.min(.05, (now - prev) / 1000); prev = now; clock += dt;

  // camera easing
  const k = 1 - Math.pow(0.001, dt * (rig.travel ? (cinematic ? .42 : .9) : 2.2));
  rig.pos.lerp(rig.tPos, k);
  rig.yaw += (rig.tYaw - rig.yaw) * k;
  rig.pitch += (rig.tPitch - rig.pitch) * k;
  if (rig.travel && rig.pos.distanceTo(rig.tPos) < .02) rig.travel = 0;
  const moving = rig.pos.distanceTo(rig.tPos) > .04;
  const bob = moving ? Math.sin(clock * 7.2) * .009 : 0;
  const breathe = Math.sin(clock * (rig.seated ? .55 : .85)) * (rig.seated ? .011 : .006) + bob;
  const sway = Math.sin(clock * .37) * .004 + (moving ? Math.sin(clock * 3.6) * .0035 : 0);
  camera.position.set(rig.pos.x, rig.pos.y + breathe, rig.pos.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = rig.yaw - mx * .075 + sway;
  camera.rotation.x = rig.pitch - my * .045;

  applyTod(dt);
  updateShafts();
  pick();
  animateHover(dt);
  animateLife(dt);

  // stove + oven flicker
  const fl = .82 + Math.sin(clock * 9.1) * .1 + Math.sin(clock * 3.3) * .08;
  stoveLight.intensity = 7 * fl; ovenLight.intensity = 5.4 * fl;
  stoveDoor.material.emissiveIntensity = 1.2 + fl * .7;
  ovenGlass.material.emissiveIntensity = 1.0 + fl * .5;
  platter.rotation.y += radioOn ? dt * 3.5 : 0;
  if (grinding > 0) {
    grinding -= dt;
    grinder.position.x = -1.55 + Math.sin(clock * 70) * .004;
    grinder.rotation.z = Math.sin(clock * 58) * .006;
  } else if (grinder.rotation.z !== 0) {
    grinder.position.x = -1.55; grinder.rotation.z = 0;
  }

  // dust
  const dp = dust.geometry.attributes.position, ds = dust.userData.seed;
  for (let i = 0; i < ds.length; i++) {
    dp.array[i * 3] += Math.sin(clock * .3 + ds[i] * 9) * .0016;
    dp.array[i * 3 + 1] += (.0035 + ds[i] * .004) * (ds[i] > .5 ? 1 : -1) * .6;
    dp.array[i * 3 + 2] += Math.cos(clock * .22 + ds[i] * 7) * .0014;
    if (dp.array[i * 3 + 1] > 4.2) dp.array[i * 3 + 1] = .2;
    if (dp.array[i * 3 + 1] < .15) dp.array[i * 3 + 1] = 4.0;
  }
  dp.needsUpdate = true;
  dust.material.opacity = .045 + sunGlow * .14 + todBlend.sunI * .015;
  dust.material.color.copy(sun.color).lerp(new THREE.Color(0xfff4e2), .75);
  dust.material.size = .02 + sunGlow * .018;

  // snow outside
  const sp = snowP.geometry.attributes.position, ss = snowP.userData.seed;
  for (let i = 0; i < ss.length; i++) {
    sp.array[i * 3 + 1] -= (.7 + ss[i] * 1.6) * dt;
    sp.array[i * 3] += Math.sin(clock * .5 + ss[i] * 12) * .02 + .035;
    if (sp.array[i * 3 + 1] < 0) { sp.array[i * 3 + 1] = 34 + Math.random() * 6; sp.array[i * 3] = (Math.random() - .5) * 120; }
    if (sp.array[i * 3] > 62) sp.array[i * 3] -= 124;
  }
  sp.needsUpdate = true;

  // steam
  const stp = steam.geometry.attributes.position;
  const per = Math.floor(160 / Math.max(1, steamSrc.length));
  steamSrc.forEach((s, si) => {
    for (let i = 0; i < per; i++) {
      const idx = si * per + i;
      const life = ((clock * .35 + i / per + s.t) % 1);
      stp.array[idx * 3] = s.x + Math.sin(life * 6 + i) * life * .09;
      stp.array[idx * 3 + 1] = s.y + life * .34;
      stp.array[idx * 3 + 2] = s.z + Math.cos(life * 5 + i * 1.7) * life * .07;
    }
  });
  stp.needsUpdate = true;

  if (postOK) {
    try { composer.render(); }
    catch (err) { console.warn('composer failed, falling back', err); postOK = false; renderer.render(scene, camera); }
  } else {
    renderer.render(scene, camera);
  }
}

/* ═══════════ boot ═══════════ */
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (composer) composer.setSize(innerWidth, innerHeight);
});
setTod('live');
paintSkyFor(todNow);
todBlend = { sunI: todNow.sunI, hemiI: todNow.hemiI, amb: todNow.amb, bulb: todNow.bulb };
applyTod(1);
paintSkyFor(todNow);
renderNotes();
updatePresence();
updateClock();
setInterval(() => { if (todKey === 'live') { setTod('live'); } updatePresence(); }, 60000);
window.__booted = true;
schedule();
document.addEventListener('visibilitychange', schedule);
refreshEnv();


const enterEl = document.getElementById('enter'), enterBtn = document.getElementById('enter-btn');
setTimeout(() => {
  enterBtn.disabled = false;
  enterBtn.innerHTML = 'step inside';
  enterBtn.addEventListener('click', () => {
    enterEl.style.opacity = 0;
    setTimeout(() => enterEl.remove(), 1400);
    try { ensureAudio(); actx.resume(); } catch (e) { }
    if (!soundOn) toggleSound();
    cinematic = true;
    goTo('approach');
    setTimeout(() => { goTo('door'); chime(); }, 2300);
    setTimeout(() => footstep(), 3100);
    setTimeout(() => { goTo('room'); footstep(); }, 5000);
    setTimeout(() => {
      cinematic = false;
      setHint('drag to look · scroll to walk · click what you see');
    }, 8200);
  });
}, 1400);
