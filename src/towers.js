// The courtyard: four towers facing inward, every window a lit display bay.
// Floors are recycled through a ring of slots, so the fall never ends while
// the GPU only ever holds ~24 floors. Everything repeated is instanced.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as G from './garments.js';
import { concrete, terrazzo, fabricNormal, signTexture } from './textures.js';
import { productAt, DEPARTMENTS } from './catalog.js';

export const A = 7.2, COLS = 5, BW = 2.4, GAP = .4, FH = 3.4, SILL = .35, WH = 2.65, D = 1.6;
const RING = 24, BAYS = RING * 4 * COLS;
const TYPES = Object.keys(G.BUILDERS);
const RAIL_Y = WH - .2, HERO_Z = -.62, HERO_S = 1.12;

// Facade orientation per side: local +Z faces the courtyard centre.
const SIDES = [0, -Math.PI / 2, Math.PI, Math.PI / 2].map((ry, s) => {
  const pos = [new THREE.Vector3(0, 0, -A), new THREE.Vector3(A, 0, 0), new THREE.Vector3(0, 0, A), new THREE.Vector3(-A, 0, 0)][s];
  return { ry, pos, q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry) };
});
const colX = (c) => -A + GAP + BW / 2 + c * (BW + GAP);

// World-space-ish UVs on boxes so concrete is not stretched.
function worldUV(g, scale = .25) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    const [u, v] = ax > .5 ? [p.getZ(i), p.getY(i)] : ay > .5 ? [p.getX(i), p.getZ(i)] : [p.getX(i), p.getY(i)];
    uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
const box = (w, h, d, x, y, z) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(x, y, z); return b; };
const plane = (w, h, x, y, z, rx = 0, ry = 0) => { const p = new THREE.PlaneGeometry(w, h); p.rotateX(rx); p.rotateY(ry); p.translate(x, y, z); return p; };

function facadeGeometry() {
  const parts = [box(2 * A + 1.2, SILL, .5, 0, SILL / 2, -.25), box(2 * A + 1.2, FH - SILL - WH, .5, 0, SILL + WH + (FH - SILL - WH) / 2, -.25)];
  for (let i = 0; i <= COLS; i++) {
    const x = -A + GAP / 2 + i * (BW + GAP);
    parts.push(box(GAP, WH, .5, x, SILL + WH / 2, -.25));
    parts.push(box(.12, FH, .32, x, FH / 2, .16)); // vertical fin
  }
  parts.push(box(2 * A, .1, .38, 0, SILL + WH + .05, .1)); // lintel ledge
  return worldUV(mergeGeometries(parts));
}

function shellGeometry() { // inward-facing back + sides + ceiling of one bay
  return mergeGeometries([
    plane(BW, WH, 0, WH / 2, -D),
    plane(D, WH, -BW / 2, WH / 2, -D / 2, 0, Math.PI / 2),
    plane(D, WH, BW / 2, WH / 2, -D / 2, 0, -Math.PI / 2),
    plane(BW, D, 0, WH, -D / 2, Math.PI / 2)
  ]);
}

function shelvesGeometry() { // two oak shelf units in the back corners
  const parts = [];
  for (const sx of [-1, 1]) {
    const x = sx * (BW / 2 - .28);
    parts.push(box(.025, WH, .5, sx * (BW / 2 - .52), WH / 2, -D + .27));
    for (const y of [.5, 1.12, 1.74]) parts.push(new RoundedBoxGeometry(.5, .035, .5, 2, .008).translate(x, y, -D + .27));
  }
  parts.push(box(BW - .3, .02, .02, 0, RAIL_Y, HERO_Z)); // rail
  return G.merge(parts);
}

function frameGeometry() {
  const t = .06, z = .03;
  return mergeGeometries([box(BW + t, t, .08, 0, WH + t / 2, z), box(BW + t, t, .08, 0, -t / 2 + .01, z),
    box(t, WH, .08, -BW / 2 - t / 2 + .02, WH / 2, z), box(t, WH, .08, BW / 2 + t / 2 - .02, WH / 2, z)]);
}

function panelTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 150, 4, 32, 150, 190);
  g.addColorStop(0, '#fff'); g.addColorStop(.45, '#bbb'); g.addColorStop(1, '#2a2a2a');
  x.fillStyle = g; x.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function dressFormGeometry() {
  const torso = G.loft([{ y: .82, a: .15, b: .105 }, { y: .95, a: .172, b: .115 }, { y: 1.05, a: .142, b: .098 }, { y: 1.18, a: .15, b: .106 },
    { y: 1.3, a: .164, b: .116, z: .01 }, { y: 1.38, a: .176, b: .1 }, { y: 1.44, a: .15, b: .075, p: 2.6 }, { y: 1.5, a: .064, b: .056 }, { y: 1.56, a: .045, b: .045 }],
  { seg: 40, steps: 4, capStart: true, capEnd: true });
  const cap = new THREE.SphereGeometry(.045, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); cap.translate(0, 1.56, 0);
  const pole = new THREE.CylinderGeometry(.012, .012, .82, 10); pole.translate(0, .41, 0);
  const foot = new THREE.CylinderGeometry(.2, .22, .03, 32); foot.translate(0, .015, 0);
  return G.merge([torso, cap, pole, foot]);
}

// Garment material: physical cloth with sheen, plus a cheap per-instance sway
// in the vertex shader (pivoting at the hang point, stronger while falling fast).
export function clothMaterial(type, uniforms) {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: type === 'dress' ? .42 : .86, sheen: type === 'dress' ? .8 : .6, sheenRoughness: type === 'dress' ? .3 : .6,
    sheenColor: new THREE.Color(type === 'dress' ? 0x8a8a8a : 0x5a5a5a), normalMap: fabricNormal(G.FABRIC[type]),
    normalScale: new THREE.Vector2(.55, .55), side: THREE.DoubleSide, envMapIntensity: .9
  });
  m.normalMap = m.normalMap.clone(); m.normalMap.repeat.set(26, 26); m.normalMap.needsUpdate = true;
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

export function createTowers(scene) {
  const uniforms = { uTime: { value: 0 }, uSway: { value: .02 } };
  const group = new THREE.Group(); scene.add(group);
  const conc = concrete();
  const mats = {
    facade: new THREE.MeshStandardMaterial({ map: conc, color: 0x55524e, roughness: .9, metalness: 0 }),
    shell: new THREE.MeshStandardMaterial({ color: 0x6f6a63, roughness: .95, emissive: 0x1a1612, emissiveIntensity: .5 }),
    floor: new THREE.MeshStandardMaterial({ map: terrazzo(), color: 0x4a4540, roughness: .18, metalness: 0, envMapIntensity: 1 }),
    wood: new THREE.MeshStandardMaterial({ color: 0xb08a62, roughness: .55 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: .35, metalness: .85 }),
    strip: new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.3, 3.6) }),
    panel: new THREE.MeshBasicMaterial({ map: panelTexture(), color: new THREE.Color(1.25, 1.2, 1.15) }),
    form: new THREE.MeshPhysicalMaterial({ color: 0x141416, roughness: .35, clearcoat: 1, clearcoatRoughness: .15 }),
    hanger: new THREE.MeshStandardMaterial({ color: 0x8b6a47, roughness: .45 }),
    stack: clothMaterial('sweater'), shoe: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .55, sheen: .4 }),
    sole: new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: .7 }),
    bag: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .38, clearcoat: .5, clearcoatRoughness: .4 }),
    ledge: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.1, 1.8) })
  };
  const inst = (geo, mat, count, color = false) => {
    const m = new THREE.InstancedMesh(geo, mat, count);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (color) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(1), 3);
    m.frustumCulled = false; m.count = 0; group.add(m);
    return m;
  };
  const floorGeo = plane(BW, D, 0, .002, -D / 2, -Math.PI / 2);
  const M = {
    facade: inst(facadeGeometry(), mats.facade, RING * 4),
    ledge: inst(box(2 * A, .025, .03, 0, SILL + WH - .01, .3), mats.ledge, RING * 4),
    shell: inst(shellGeometry(), mats.shell, BAYS, true),
    floor: inst(floorGeo, mats.floor, BAYS),
    panel: inst(plane(BW * .86, WH * .9, 0, WH * .47, -D + .015), mats.panel, BAYS, true),
    strip: inst(box(BW * .9, .025, .05, 0, WH - .02, -.22), mats.strip, BAYS),
    shelves: inst(shelvesGeometry(), mats.wood, BAYS),
    frame: inst(frameGeometry(), mats.frame, BAYS),
    form: inst(dressFormGeometry(), mats.form, BAYS),
    hanger: inst(G.hanger(), mats.hanger, BAYS),
    stack: inst(G.foldedStack(4, 7), mats.stack, BAYS * 4, true),
    shoe: inst(G.shoeUpper(), mats.shoe, BAYS, true),
    sole: inst(G.shoeSole(), mats.sole, BAYS),
    bag: inst(G.bag(), mats.bag, BAYS, true)
  };
  const garments = {};
  for (const t of TYPES) garments[t] = inst(G.BUILDERS[t](), clothMaterial(t, uniforms), BAYS, true);

  // Invisible hit planes over each opening (never added to the scene).
  const hit = new THREE.InstancedMesh(plane(BW, WH, 0, WH / 2, .02), new THREE.MeshBasicMaterial(), BAYS);
  hit.count = BAYS;

  // Corner pillars with vertical neon department signs, re-positioned to follow the camera.
  const pillars = new THREE.Group(); group.add(pillars);
  const PH = 120;
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: .25, metalness: .6, envMapIntensity: .6 });
  for (let k = 0; k < 4; k++) {
    const sx = k === 0 || k === 3 ? -1 : 1, sz = k < 2 ? -1 : 1;
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.1, PH, 1.1), pillarMat);
    p.position.set(sx * (A + .15), 0, sz * (A + .15)); pillars.add(p);
    // a sign on each courtyard-facing face, labelled by the department it borders
    for (const [face, dept] of [[0, k < 2 ? 0 : 2], [1, sx < 0 ? 3 : 1]]) {
      const d = DEPARTMENTS[dept], st = signTexture(d.sign, d.color);
      st.wrapT = THREE.RepeatWrapping; st.repeat.set(1, PH / 30);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(.32, PH), new THREE.MeshBasicMaterial({ map: st, color: new THREE.Color(2.2, 2.2, 2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      if (face === 0) { s.position.set(p.position.x, 0, p.position.z - sz * .56); if (sz > 0) s.rotation.y = Math.PI; }
      else { s.position.set(p.position.x - sx * .56, 0, p.position.z); s.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2; }
      pillars.add(s);
    }
  }

  // Roof slabs and a lit parapet, seen during the intro plunge.
  const roof = new THREE.Group(); group.add(roof);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x1c1d21, roughness: .8 });
  for (const s of SIDES) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(2 * A + 26, 1.2, 14), roofMat);
    r.position.copy(s.pos).add(new THREE.Vector3(0, .6, -7.2).applyQuaternion(s.q)); r.quaternion.copy(s.q); roof.add(r);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(2 * A, .05, .05), mats.ledge);
    edge.position.copy(s.pos).add(new THREE.Vector3(0, 1.22, .02).applyQuaternion(s.q)); edge.quaternion.copy(s.q); roof.add(edge);
  }
  // rooftop lights: a scattered grid of small warm points
  const dots = new THREE.InstancedMesh(new THREE.BoxGeometry(.25, .08, .25), mats.ledge, 160);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < 160; i++) {
    const s = SIDES[i % 4], lx = (Math.random() - .5) * (2 * A + 20), lz = -1.5 - Math.random() * 12;
    const p = s.pos.clone().add(new THREE.Vector3(lx, 1.24, lz).applyQuaternion(s.q));
    dots.setMatrixAt(i, mtx.makeTranslation(p.x, p.y, p.z));
  }
  roof.add(dots);

  /* ---------- slot management ---------- */
  let base = 0; // floor index that sits at world y = 0 (rebased to keep floats small)
  const slotFloor = new Array(RING).fill(null);
  const bays = new Array(BAYS).fill(null); // product per bay index
  const bayMatrix = Array.from({ length: BAYS }, () => new THREE.Matrix4());
  let dirty = true, hoverBay = -1;
  const tmp = new THREE.Matrix4(), tmp2 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const floorTop = (f) => -(f - base) * FH;
  const bayIndex = (slot, s, c) => (slot * 4 + s) * COLS + c;

  function assignSlot(slot, f) {
    slotFloor[slot] = f;
    const yb = floorTop(f) - FH;
    for (let s = 0; s < 4; s++) {
      const S = SIDES[s], fi = slot * 4 + s;
      tmp.compose(v.set(S.pos.x, yb, S.pos.z), S.q, sc);
      M.facade.setMatrixAt(fi, f < 0 ? zero : tmp);
      M.ledge.setMatrixAt(fi, f < 0 ? zero : tmp);
      for (let c = 0; c < COLS; c++) {
        const b = bayIndex(slot, s, c);
        const local = new THREE.Vector3(colX(c), yb + SILL, 0).applyQuaternion(S.q).add(new THREE.Vector3(S.pos.x, 0, S.pos.z));
        bayMatrix[b].compose(local, S.q, sc);
        bays[b] = f < 0 ? null : productAt(f, s, c);
      }
    }
    dirty = true;
  }

  const col = new THREE.Color();
  function rebuild() {
    const counts = Object.fromEntries(TYPES.map(t => [t, 0]));
    let nStack = 0, nShoe = 0, nBag = 0, nForm = 0, nHanger = 0;
    for (let b = 0; b < BAYS; b++) {
      const p = bays[b], W = bayMatrix[b];
      for (const k of ['shell', 'floor', 'panel', 'strip', 'shelves', 'frame']) M[k].setMatrixAt(b, p ? W : zero);
      hit.setMatrixAt(b, p ? W : zero);
      if (!p) continue;
      const dc = new THREE.Color(p.dept.color);
      M.shell.setColorAt(b, col.set(0xf3ede4).lerp(dc, .12));
      M.panel.setColorAt(b, col.set(0xffffff).lerp(dc, .35).multiplyScalar(b === hoverBay ? 2.2 : 1));
      // hero garment: on a dress form (some coats, dresses and knits) or hung from the rail
      const r = ((p.floor * 7 + p.side * 13 + p.col * 29) % 10 + 10) % 10;
      const onForm = p.type !== 'pants' && p.type !== 'tee' && r < 4;
      const yaw = ((r / 10) - .5) * .5;
      if (onForm) {
        tmp2.compose(v.set(0, 0, HERO_Z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), sc.set(HERO_S, HERO_S, HERO_S));
        M.form.setMatrixAt(nForm++, tmp.multiplyMatrices(W, tmp2));
        // the garment sits on the form at its natural height
      } else {
        const hy = RAIL_Y - .07 - G.HANG_Y[p.type] * HERO_S;
        tmp2.compose(v.set(0, hy, HERO_Z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), sc.set(HERO_S, HERO_S, HERO_S));
        const hm = new THREE.Matrix4().compose(new THREE.Vector3(0, RAIL_Y - .06, HERO_Z), q, new THREE.Vector3(1, 1, 1));
        if (p.type !== 'pants') M.hanger.setMatrixAt(nHanger++, tmp.multiplyMatrices(W, hm));
      }
      const gm = garments[p.type], gi = counts[p.type]++;
      gm.setMatrixAt(gi, tmp.multiplyMatrices(W, tmp2));
      gm.setColorAt(gi, col.set(p.color));
      sc.set(1, 1, 1);
      // shelves: four folded stacks, a pair of shoes, sometimes a bag
      const spots = [[-1, .52], [-1, 1.14], [1, .52], [1, 1.14]];
      spots.forEach(([sx, y], k) => {
        tmp2.compose(v.set(sx * (BW / 2 - .28), y + .018, -D + .27), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (k - 1.5) * .05), sc);
        M.stack.setMatrixAt(nStack, tmp.multiplyMatrices(W, tmp2));
        M.stack.setColorAt(nStack++, col.set(p.stacks[k % 2]));
      });
      tmp2.compose(v.set(BW / 2 - .28, 1.76, -D + .3), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -.5), sc);
      tmp.multiplyMatrices(W, tmp2);
      M.shoe.setMatrixAt(nShoe, tmp); M.sole.setMatrixAt(nShoe, tmp); M.shoe.setColorAt(nShoe++, col.set(p.shoe));
      if (p.bag) {
        tmp2.compose(v.set(-(BW / 2 - .28), 1.77, -D + .28), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), .35), sc);
        M.bag.setMatrixAt(nBag, tmp.multiplyMatrices(W, tmp2)); M.bag.setColorAt(nBag++, col.set(p.bag));
      }
    }
    for (const k of ['shell', 'floor', 'panel', 'strip', 'shelves', 'frame']) M[k].count = BAYS;
    M.facade.count = M.ledge.count = RING * 4;
    M.stack.count = nStack; M.shoe.count = M.sole.count = nShoe; M.bag.count = nBag; M.form.count = nForm; M.hanger.count = nHanger;
    for (const t of TYPES) garments[t].count = counts[t];
    for (const m of [...Object.values(M), ...Object.values(garments), hit]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    hit.computeBoundingSphere(); hit.computeBoundingBox?.();
    dirty = false;
  }

  function update(camY, lookUp, dt) {
    uniforms.uTime.value += dt;
    // Rebase far from the origin so float precision never degrades. The
    // returned shift tells the caller how far to move the camera with it.
    let shiftY = 0;
    if (Math.abs(camY) > FH * 60) {
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
    // pillars and signs follow the camera, snapped so the sign pattern does not slide
    const roofY = floorTop(0) + 1.2;
    const snap = Math.round(camY / 30) * 30;
    pillars.position.y = Math.min(roofY - PH / 2, snap);
    roof.position.y = floorTop(0);
    roof.visible = roofY - camY < 200;
    return shiftY;
  }

  const ray = { hits: [] };
  function pick(raycaster) {
    ray.hits.length = 0;
    hit.raycast(raycaster, ray.hits);
    if (!ray.hits.length) return null;
    ray.hits.sort((a, b) => a.distance - b.distance);
    const b = ray.hits[0].instanceId;
    return bays[b] ? { bay: b, product: bays[b], distance: ray.hits[0].distance } : null;
  }

  function setHover(b) {
    if (b === hoverBay) return;
    const prev = hoverBay; hoverBay = b;
    for (const k of [prev, b]) if (k >= 0 && bays[k]) {
      const dc = new THREE.Color(bays[k].dept.color);
      M.panel.setColorAt(k, col.set(0xffffff).lerp(dc, .35).multiplyScalar(k === hoverBay ? 2.4 : 1));
    }
    M.panel.instanceColor.needsUpdate = true;
  }

  // Where to put the camera to look straight into a bay.
  function bayView(b, dist = 3.1) {
    const W = bayMatrix[b], pos = new THREE.Vector3(), quat = new THREE.Quaternion(), s = new THREE.Vector3();
    W.decompose(pos, quat, s);
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
    const target = pos.clone().add(new THREE.Vector3(0, 1.5, HERO_Z).applyQuaternion(quat));
    return { target, eye: target.clone().addScaledVector(n, dist + Math.abs(HERO_Z)).add(new THREE.Vector3(0, .1, 0)), normal: n };
  }

  return { group, update, pick, setHover, bayView, uniforms, get base() { return base; }, floorAt: (y) => base + Math.floor(-y / FH), materials: mats };
}
