// The courtyard: four stone towers facing inward, every window a lit display
// bay. Floors are recycled through a ring of slots, so the fall never ends
// while the GPU only ever holds ~24 floors. Everything repeated is instanced:
// procedural fixtures, garments, and real scanned products (ScanInstancer).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as G from './garments.js';
import { concrete, radialShadow } from './textures.js';
import { textures, ScanInstancer } from './assets.js';
import { productAt, isGarment } from './catalog.js';

export const A = 7.2, COLS = 5, BW = 2.4, GAP = .4, FH = 3.4, SILL = .35, WH = 2.65, D = 1.7;
const RING = 24, BAYS = RING * 4 * COLS;
const GTYPES = Object.keys(G.BUILDERS);
const RAIL_Y = WH - .22, HERO_Z = -.75, HERO_S = 1.08;
const UP = new THREE.Vector3(0, 1, 0);

// Facade orientation per side: local +Z faces the courtyard centre.
const SIDES = [0, -Math.PI / 2, Math.PI, Math.PI / 2].map((ry, s) => {
  const pos = [new THREE.Vector3(0, 0, -A), new THREE.Vector3(A, 0, 0), new THREE.Vector3(0, 0, A), new THREE.Vector3(-A, 0, 0)][s];
  return { ry, pos, q: new THREE.Quaternion().setFromAxisAngle(UP, ry) };
});
const colX = (c) => -A + GAP + BW / 2 + c * (BW + GAP);

// World-space UVs on boxes so stone is never stretched.
function worldUV(g, scale = .3) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    const [u, v] = ax > .5 ? [p.getZ(i), p.getY(i)] : ay > .5 ? [p.getX(i), p.getZ(i)] : [p.getX(i), p.getY(i)];
    uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const plane = (w, h, x, y, z, rx = 0, ry = 0) => { const p = new THREE.PlaneGeometry(w, h); p.rotateX(rx); p.rotateY(ry); p.translate(x, y, z); return p; };

function facadeGeometry() { // limestone bands and piers around the five openings of one floor
  const parts = [box(2 * A + 1.2, SILL, .55, 0, SILL / 2, -.27), box(2 * A + 1.2, FH - SILL - WH, .55, 0, SILL + WH + (FH - SILL - WH) / 2, -.27)];
  for (let i = 0; i <= COLS; i++) parts.push(box(GAP, WH, .55, -A + GAP / 2 + i * (BW + GAP), SILL + WH / 2, -.27));
  parts.push(box(2 * A + 1.2, .06, .1, 0, SILL - .03, .05)); // sill drip
  return worldUV(mergeGeometries(parts));
}
function bronzeGeometry() { // slim bronze reveals and a mid-height transom bar per opening
  const parts = [];
  for (let c = 0; c < COLS; c++) {
    const x = colX(c), t = .045;
    parts.push(box(BW, t, .07, x, SILL + WH - t / 2, -.03), box(BW, t, .07, x, SILL + t / 2, -.03),
      box(t, WH, .07, x - BW / 2 + t / 2, SILL + WH / 2, -.03), box(t, WH, .07, x + BW / 2 - t / 2, SILL + WH / 2, -.03),
      box(BW, .02, .05, x, SILL + WH - .45, -.03));
  }
  return mergeGeometries(parts);
}
function shellGeometry() { // inward-facing back, sides and ceiling of one bay
  return mergeGeometries([plane(BW, WH, 0, WH / 2, -D), plane(D, WH, -BW / 2, WH / 2, -D / 2, 0, Math.PI / 2),
    plane(D, WH, BW / 2, WH / 2, -D / 2, 0, -Math.PI / 2), plane(BW, D, 0, WH, -D / 2, Math.PI / 2)]);
}
function shelvesGeometry() { // two oak shelf units in the back corners
  const parts = [];
  for (const sx of [-1, 1]) {
    parts.push(box(.03, WH, .42, sx * (BW / 2 - .5), WH / 2, -D + .22));
    for (const y of [.55, 1.15, 1.75]) parts.push(new RoundedBoxGeometry(.46, .035, .42, 2, .008).translate(sx * (BW / 2 - .25), y, -D + .22));
  }
  return G.merge(parts);
}
function railGeometry() {
  const bar = new THREE.CylinderGeometry(.012, .012, BW - .9, 12); bar.rotateZ(Math.PI / 2); bar.translate(0, RAIL_Y, HERO_Z);
  const drops = [-1, 1].map(s => new THREE.CylinderGeometry(.006, .006, WH - RAIL_Y, 8).translate(s * (BW / 2 - .48), RAIL_Y + (WH - RAIL_Y) / 2, HERO_Z));
  return G.merge([bar, ...drops]);
}
function plinthGeometry() { return new RoundedBoxGeometry(.5, 1, .5, 3, .02).translate(0, .5, 0); }
function dressFormGeometry() {
  const torso = G.loft([{ y: .82, a: .15, b: .105 }, { y: .95, a: .172, b: .115 }, { y: 1.05, a: .142, b: .098 }, { y: 1.18, a: .15, b: .106 },
    { y: 1.3, a: .164, b: .116, z: .01 }, { y: 1.38, a: .176, b: .1 }, { y: 1.44, a: .15, b: .075, p: 2.6 }, { y: 1.5, a: .064, b: .056 }, { y: 1.56, a: .045, b: .045 }],
  { seg: 40, steps: 4, capStart: true, capEnd: true });
  const cap = new THREE.SphereGeometry(.045, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.56, 0);
  return G.merge([torso, cap]);
}
function standGeometry() {
  const pole = new THREE.CylinderGeometry(.011, .011, .84, 10).translate(0, .41, 0);
  const foot = new THREE.CylinderGeometry(.17, .19, .025, 32).translate(0, .0125, 0);
  return G.merge([pole, foot]);
}

// Garment cloth: physical sheen over a real woven-fabric normal map, with a
// cheap per-instance sway in the vertex shader (pivoting at the hang point).
export function clothMaterial(type, uniforms) {
  const silky = type === 'dress';
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: silky ? .5 : .92, sheen: silky ? .9 : .7, sheenRoughness: silky ? .35 : .75,
    sheenColor: new THREE.Color(silky ? 0x9a9a9a : 0x6a6a6a), normalMap: textures.fabricNormal(), roughnessMap: textures.fabricORM(),
    normalScale: new THREE.Vector2(.6, .6), side: THREE.DoubleSide, envMapIntensity: .85
  });
  m.normalMap.repeat.set(36, 36); m.roughnessMap.repeat.set(36, 36);
  if (uniforms) {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uniforms.uTime; sh.uniforms.uSway = uniforms.uSway;
      sh.vertexShader = 'uniform float uTime; uniform float uSway;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float ph = dot(instanceMatrix[3].xyz, vec3(1.37, .71, 2.13));
          float lever = max(0., ${G.HANG_Y[type].toFixed(3)} - transformed.y);
          transformed.z += sin(uTime * 1.7 + ph) * uSway * lever * lever * .6;
          transformed.x += sin(uTime * 1.1 + ph * 1.3) * uSway * lever * .12;
        #endif`);
    };
    m.customProgramCacheKey = () => 'cloth-sway-' + type;
  }
  return m;
}

// A simple packed InstancedMesh: add() during a rebuild, commit() at the end.
class Pack {
  constructor(geo, mat, cap, parent, color = false) {
    this.m = new THREE.InstancedMesh(geo, mat, cap);
    this.m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.m.frustumCulled = false; this.m.count = 0; this.n = 0;
    if (color) this.m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    parent.add(this.m);
  }
  add(mtx, col) { this.m.setMatrixAt(this.n, mtx); if (col) this.m.setColorAt(this.n, col); this.n++; }
  reset() { this.n = 0; }
  commit() { this.m.count = this.n; this.m.instanceMatrix.needsUpdate = true; if (this.m.instanceColor) this.m.instanceColor.needsUpdate = true; }
}

export function createTowers(scene, scans) {
  const uniforms = { uTime: { value: 0 }, uSway: { value: .02 } };
  const group = new THREE.Group(); scene.add(group);
  const stone = concrete(); stone.repeat.set(1, 1);
  const oak = textures.oak(), oakR = textures.oakRough();
  const shadowTex = radialShadow();
  const mats = {
    facade: new THREE.MeshStandardMaterial({ map: stone, color: 0xeef0f2, roughness: .9, envMapIntensity: .8 }),
    bronze: new THREE.MeshStandardMaterial({ color: 0x3b2f25, roughness: .38, metalness: .85 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xc9d6dc, roughness: .04, metalness: 0, transparent: true, opacity: .12, envMapIntensity: 1.6, depthWrite: false }),
    shell: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .95, emissive: 0x2b2219, emissiveIntensity: .35 }),
    floor: new THREE.MeshStandardMaterial({ map: oak, roughnessMap: oakR, roughness: .55, color: 0xb9a48c }),
    shelf: new THREE.MeshStandardMaterial({ map: oak, roughnessMap: oakR, color: 0xd9c7ae }),
    light: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.6, 3.1, 2.5) }),
    brass: new THREE.MeshStandardMaterial({ color: 0xb59a6a, roughness: .3, metalness: 1 }),
    plinth: new THREE.MeshStandardMaterial({ color: 0xeee8de, roughness: .62 }),
    form: new THREE.MeshPhysicalMaterial({ color: 0xd9ccb6, roughness: .9, sheen: .5, sheenColor: new THREE.Color(0x555555), normalMap: textures.fabricNormal(), normalScale: new THREE.Vector2(.4, .4) }),
    hanger: new THREE.MeshStandardMaterial({ color: 0x8b6a47, roughness: .45 }),
    shadow: new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: shadowTex, transparent: true, opacity: .55, depthWrite: false }),
    stack: clothMaterial('sweater')
  };
  mats.form.normalMap = mats.form.normalMap.clone(); mats.form.normalMap.repeat.set(20, 20);
  oak.repeat.set(2, 2); oakR.repeat.set(2, 2);

  const P = (geo, mat, cap, color) => new Pack(geo, mat, cap, group, color);
  const M = {
    facade: P(facadeGeometry(), mats.facade, RING * 4),
    bronze: P(bronzeGeometry(), mats.bronze, RING * 4),
    shell: P(shellGeometry(), mats.shell, BAYS, true),
    floor: P(plane(BW, D, 0, .002, -D / 2, -Math.PI / 2), mats.floor, BAYS),
    glass: P(plane(BW, WH, 0, WH / 2, -.01), mats.glass, BAYS),
    light: P(box(BW * .8, .012, .05, 0, WH - .006, -.35), mats.light, BAYS),
    spots: P(G.merge([-1, 0, 1].map(i => new THREE.CylinderGeometry(.035, .035, .01, 16).translate(i * .7, WH - .005, -D * .55))), mats.light, BAYS),
    shelves: P(shelvesGeometry(), mats.shelf, BAYS),
    rail: P(railGeometry(), mats.brass, BAYS),
    plinth: P(plinthGeometry(), mats.plinth, BAYS * 3),
    form: P(dressFormGeometry(), mats.form, BAYS),
    stand: P(standGeometry(), mats.brass, BAYS),
    hanger: P(G.hanger(), mats.hanger, BAYS),
    stack: P(G.foldedStack(4, 7), mats.stack, BAYS * 4, true),
    shadow: P(plane(1, 1, 0, .004, 0, -Math.PI / 2), mats.shadow, BAYS * 6)
  };
  const garments = {};
  for (const t of GTYPES) garments[t] = P(G.BUILDERS[t](), clothMaterial(t, uniforms), BAYS, true);
  const S = {};
  for (const [k, scan] of Object.entries(scans)) S[k] = new ScanInstancer(scan, k === 'shoe' ? BAYS * 2 : BAYS, group);

  // Invisible hit planes over each opening (never added to the scene).
  const hit = new THREE.InstancedMesh(plane(BW, WH, 0, WH / 2, .02), new THREE.MeshBasicMaterial(), BAYS);
  hit.count = BAYS;

  // Roof parapet, seen from above during the intro plunge.
  const roof = new THREE.Group(); group.add(roof);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x77706a, roughness: .9 });
  for (const s of SIDES) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(2 * A + 26, 1.2, 14), roofMat);
    r.position.copy(s.pos).add(new THREE.Vector3(0, .6, -7.2).applyQuaternion(s.q)); r.quaternion.copy(s.q); roof.add(r);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(2 * A + 1.2, .14, .7), mats.facade);
    cap.position.copy(s.pos).add(new THREE.Vector3(0, 1.27, -.1).applyQuaternion(s.q)); cap.quaternion.copy(s.q); roof.add(cap);
  }
  // A mist floor that travels below the camera, so the shaft never reveals the sky's ground.
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x60676d }));
  group.add(mist);
  // corner returns: tall stone piers closing the square
  const corners = new THREE.Group(); group.add(corners);
  const PH = 120;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const p = new THREE.Mesh(worldUV(new THREE.BoxGeometry(1.2, PH, 1.2), .3), mats.facade);
    p.position.set(sx * (A + .3), 0, sz * (A + .3)); corners.add(p);
  }

  /* ---------- slot management ---------- */
  let base = 0;
  const slotFloor = new Array(RING).fill(null);
  const bays = new Array(BAYS).fill(null);
  const bayMatrix = Array.from({ length: BAYS }, () => new THREE.Matrix4());
  let dirty = true, hoverBay = -1;
  const tmp = new THREE.Matrix4(), loc = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const floorTop = (f) => -(f - base) * FH;
  const bayIndex = (slot, s, c) => (slot * 4 + s) * COLS + c;
  const at = (W, x, y, z, yaw = 0, sc = 1) => tmp.multiplyMatrices(W, loc.compose(v.set(x, y, z), q.setFromAxisAngle(UP, yaw), one.set(sc, sc, sc)));
  const shadowAt = (W, x, z, w, d) => M.shadow.add(tmp.multiplyMatrices(W, loc.compose(v.set(x, 0, z), q.identity(), one.set(w, 1, d))));

  function assignSlot(slot, f) {
    slotFloor[slot] = f;
    const yb = floorTop(f) - FH;
    for (let s = 0; s < 4; s++) for (let c = 0; c < COLS; c++) {
      const S = SIDES[s], b = bayIndex(slot, s, c);
      const p = new THREE.Vector3(colX(c), yb + SILL, 0).applyQuaternion(S.q).add(new THREE.Vector3(S.pos.x, 0, S.pos.z));
      bayMatrix[b].compose(p, S.q, new THREE.Vector3(1, 1, 1));
      bays[b] = f < 0 ? null : productAt(f, s, c);
    }
    dirty = true;
  }

  const col = new THREE.Color();
  // Lay out one bay around its hero product.
  function dress(b, p, W) {
    const t = p.type, r = p.extra;
    if (isGarment(t)) {
      M.shelves.add(W); M.rail.add(W);
      const onForm = t !== 'pants' && t !== 'tee' && r < .45, yaw = (r - .5) * .4;
      let gm;
      if (onForm) {
        M.form.add(at(W, 0, 0, HERO_Z, yaw, HERO_S)); M.stand.add(at(W, 0, 0, HERO_Z, yaw, HERO_S));
        gm = at(W, 0, 0, HERO_Z, yaw, HERO_S).clone();
      } else {
        M.hanger.add(at(W, 0, RAIL_Y - .055, HERO_Z, yaw, 1));
        gm = at(W, 0, RAIL_Y - .075 - G.HANG_Y[t] * HERO_S, HERO_Z, yaw, HERO_S).clone();
        if (t === 'pants') M.hanger.add(at(W, 0, RAIL_Y - .055, HERO_Z, yaw, 1));
      }
      garments[t].add(gm, col.set(p.color));
      shadowAt(W, 0, HERO_Z, .9, .6);
      [[-1, .57], [-1, 1.17], [1, .57], [1, 1.17]].forEach(([sx, y], k) => M.stack.add(at(W, sx * (BW / 2 - .25), y + .018, -D + .22, (k - 1.5) * .05), col.set(p.stacks[k % 2])));
      S.shoe.add(at(W, BW / 2 - .25, 1.77, -D + .25, -.6), Math.floor(r * 3));
      if (r > .55) { S.plant.add(at(W, -BW / 2 + .32, 0, -.35, r * 6)); shadowAt(W, -BW / 2 + .32, -.35, .7, .7); }
      return;
    }
    if (t === 'shoe') { // a sneaker wall plus a hero on a plinth
      M.shelves.add(W);
      M.plinth.add(at(W, 0, 0, -.7, 0, 1)); S.shoe.add(at(W, 0, 1.0, -.7, -.5 + r), p.variant);
      shadowAt(W, 0, -.7, .8, .8);
      for (const [x, y, k] of [[-1, .57, 1], [-1, 1.17, 2], [1, .57, 2], [1, 1.17, 1], [-1, 1.77, 0], [1, 1.77, 0]])
        S.shoe.add(at(W, x * (BW / 2 - .25), y + .018, -D + .22, x > 0 ? -.4 : .4 + Math.PI), (p.variant + k) % 3);
      return;
    }
    if (t === 'watch' || t === 'sunglasses') { // three plinths of accessories
      const items = t === 'watch' ? ['watch', 'sunglasses', 'watch'] : ['sunglasses', 'watch', 'sunglasses'];
      [[-.75, .9], [0, 1.1], [.75, .9]].forEach(([x, h], k) => {
        M.plinth.add(tmp.multiplyMatrices(W, loc.compose(v.set(x, 0, -.8), q.identity(), one.set(.8, h, .8))));
        const key = items[k], s = key === 'watch' ? 1.6 : 1.5;
        S[key].add(at(W, x, h, -.8, (k - 1) * .4, s), key === 'watch' ? (p.variant + k) % 4 : 0);
        shadowAt(W, x, -.8, .6, .6);
      });
      if (r > .5) S.plant.add(at(W, BW / 2 - .35, 0, -D + .4, r * 5));
      return;
    }
    if (t === 'corset') {
      S.corset.add(at(W, 0, 0, -.8, (r - .5) * .6)); shadowAt(W, 0, -.8, .8, .8);
      S.pouf.add(at(W, .75, 0, -.55, r * 3)); shadowAt(W, .75, -.55, .8, .8);
      S.plant.add(at(W, -.8, 0, -D + .45, r * 4)); shadowAt(W, -.8, -D + .45, .7, .7);
      return;
    }
    // Home: a furnished vignette around the hero piece
    if (t === 'sofa') { S.sofa.add(at(W, 0, 0, -D + .58), p.variant); shadowAt(W, 0, -D + .58, 2.3, 1.2); S.pouf.add(at(W, .55, 0, -.45, r * 3)); shadowAt(W, .55, -.45, .8, .8); return; }
    const hero = t === 'lamp' ? 'chair' : t;
    if (hero === 'chair' || hero === 'damask') S[hero].add(at(W, -.25, 0, -.85, .35 * (r - .3)), hero === 'chair' ? p.variant : 0);
    else S.pouf.add(at(W, -.2, 0, -.8, r * 3));
    shadowAt(W, -.2, -.85, 1.1, .9);
    M.plinth.add(tmp.multiplyMatrices(W, loc.compose(v.set(.8, 0, -1.05), q.identity(), one.set(.75, .62, .75))));
    if (t === 'lamp' || r < .5) S.lamp.add(at(W, .8, .62, -1.05, r * 4)); else S.vases.add(at(W, .8, .62, -1.05, r * 4));
    if (t !== 'pouf' && r > .4) { S.pouf.add(at(W, .35, 0, -.35, r * 2)); shadowAt(W, .35, -.35, .8, .8); }
  }

  function rebuild() {
    for (const k in M) M[k].reset();
    for (const k in garments) garments[k].reset();
    for (const k in S) S[k].reset();
    for (let slot = 0; slot < RING; slot++) for (let s = 0; s < 4; s++) {
      const f = slotFloor[slot];
      if (f === null || f < 0) continue;
      const S0 = SIDES[s];
      const m = new THREE.Matrix4().compose(new THREE.Vector3(S0.pos.x, floorTop(f) - FH, S0.pos.z), S0.q, new THREE.Vector3(1, 1, 1));
      M.facade.add(m); M.bronze.add(m);
    }
    for (let b = 0; b < BAYS; b++) {
      const p = bays[b], W = bayMatrix[b];
      hit.setMatrixAt(b, p ? W : zero);
      if (!p) continue;
      M.shell.add(W, col.set(0xf1ebe2).lerp(new THREE.Color(p.dept.color), .1).multiplyScalar(b === hoverBay ? 1.35 : 1));
      M.floor.add(W); M.glass.add(W); M.light.add(W); M.spots.add(W);
      p.slot = M.shell.n - 1;
      dress(b, p, W);
    }
    for (const k in M) M[k].commit();
    for (const k in garments) garments[k].commit();
    for (const k in S) S[k].commit();
    hit.instanceMatrix.needsUpdate = true; hit.computeBoundingSphere();
    dirty = false;
  }

  function update(camY, lookUp, dt) {
    uniforms.uTime.value += dt;
    let shiftY = 0;
    if (Math.abs(camY) > FH * 60) { // rebase far from the origin so float precision never degrades
      const shift = Math.round(-camY / FH);
      base += shift; slotFloor.fill(null);
      shiftY = shift * FH; camY += shiftY;
    }
    const fc = base + Math.floor(-camY / FH);
    const start = lookUp ? fc - 15 : fc - 6;
    for (let f = start; f < start + RING; f++) {
      const slot = ((f % RING) + RING) % RING;
      if (slotFloor[slot] !== f) assignSlot(slot, f);
    }
    if (dirty) rebuild();
    const roofY = floorTop(0) + 1.2;
    corners.position.y = Math.min(roofY - PH / 2, Math.round(camY / 30) * 30);
    roof.position.y = floorTop(0);
    roof.visible = roofY - camY < 200;
    mist.position.y = camY - 90;
    return shiftY;
  }

  const hits = [];
  function pick(raycaster) {
    hits.length = 0;
    hit.raycast(raycaster, hits);
    if (!hits.length) return null;
    hits.sort((a, b) => a.distance - b.distance);
    const b = hits[0].instanceId;
    return bays[b] ? { bay: b, product: bays[b], distance: hits[0].distance } : null;
  }

  function setHover(b) {
    if (b === hoverBay) return;
    const prev = hoverBay; hoverBay = b;
    for (const k of [prev, b]) if (k >= 0 && bays[k]) {
      M.shell.m.setColorAt(bays[k].slot, col.set(0xf1ebe2).lerp(new THREE.Color(bays[k].dept.color), .1).multiplyScalar(k === hoverBay ? 1.35 : 1));
    }
    M.shell.m.instanceColor.needsUpdate = true;
  }

  function bayView(b, dist = 2.9) {
    const W = bayMatrix[b], pos = new THREE.Vector3(), quat = new THREE.Quaternion();
    W.decompose(pos, quat, new THREE.Vector3());
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
    const target = pos.clone().add(new THREE.Vector3(0, 1.3, -.8).applyQuaternion(quat));
    return { target, eye: target.clone().addScaledVector(n, dist + .8).add(new THREE.Vector3(0, .1, 0)), normal: n };
  }

  return { group, update, pick, setHover, bayView, uniforms, get base() { return base; }, floorAt: (y) => base + Math.floor(-y / FH) };
}
