// Garment geometry, built procedurally around one body.
// Units are meters, feet at y = 0, front facing +Z. Every garment is offset
// outward from the same body measurements, so it fits the dress form and can
// also hang as a "ghost mannequin" on a rail.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const TAU = Math.PI * 2;
const cr = (p0, p1, p2, p3, t) => {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};
const se = (c, p) => Math.sign(c) * Math.pow(Math.abs(c), 2 / p);

// Elliptic loft through rings {y, a, b, x, z, p}, smoothed with Catmull-Rom.
// disp(theta, y, s) pushes the surface outward (s runs 0 at the first ring to 1 at the last).
export function loft(rings, { seg = 48, steps = 5, disp = null, capStart = false, capEnd = false } = {}) {
  const keys = ['y', 'a', 'b', 'x', 'z', 'p'];
  const R = rings.map(r => ({ x: 0, z: 0, p: 2, ...r }));
  const S = [];
  for (let i = 0; i < R.length - 1; i++) {
    const p0 = R[Math.max(i - 1, 0)], p1 = R[i], p2 = R[i + 1], p3 = R[Math.min(i + 2, R.length - 1)];
    for (let k = 0; k < steps; k++) {
      const t = k / steps, o = {};
      for (const key of keys) o[key] = cr(p0[key], p1[key], p2[key], p3[key], t);
      S.push(o);
    }
  }
  S.push({ ...R[R.length - 1] });
  const pos = [], uv = [], idx = [];
  S.forEach((r, k) => {
    const s = k / (S.length - 1), circ = Math.PI * (r.a + r.b);
    for (let j = 0; j <= seg; j++) {
      const th = j / seg * TAU, c = Math.cos(th), sn = Math.sin(th);
      const d = disp ? disp(th, r.y, s) : 0;
      pos.push(r.x + se(c, r.p) * r.a + c * d, r.y, r.z + se(sn, r.p) * r.b + sn * d);
      uv.push(j / seg * circ, r.y);
    }
  });
  const W = seg + 1;
  for (let k = 0; k < S.length - 1; k++) for (let j = 0; j < seg; j++) {
    const a = k * W + j, b = a + W;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const cap = (k, flip) => {
    const r = S[k], ci = pos.length / 3;
    pos.push(r.x, r.y, r.z); uv.push(0, r.y);
    for (let j = 0; j < seg; j++) flip ? idx.push(ci, k * W + j, k * W + j + 1) : idx.push(ci, k * W + j + 1, k * W + j);
  };
  if (capStart) cap(0, true);
  if (capEnd) cap(S.length - 1, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Tube swept along a smooth path with varying radius (parallel-transport frames).
export function sweep(points, radii, { seg = 24, steps = 32, disp = null, roundEnd = false, roundStart = false, flat = 1 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const n = points.length, P = [], T = [];
  for (let i = 0; i <= steps; i++) { P.push(curve.getPoint(i / steps)); T.push(curve.getTangent(i / steps)); }
  let N = new THREE.Vector3(0, 0, 1);
  if (Math.abs(N.dot(T[0])) > .9) N.set(1, 0, 0);
  N.sub(T[0].clone().multiplyScalar(N.dot(T[0]))).normalize();
  const pos = [], uv = [], idx = [];
  let len = 0;
  for (let i = 0; i <= steps; i++) {
    if (i > 0) {
      len += P[i].distanceTo(P[i - 1]);
      const q = new THREE.Quaternion().setFromUnitVectors(T[i - 1], T[i]);
      N.applyQuaternion(q).normalize();
    }
    const B = new THREE.Vector3().crossVectors(T[i], N).normalize();
    const t = i / steps, u = t * (n - 1), i0 = Math.min(Math.floor(u), n - 2), f = u - i0;
    let r = radii[i0] * (1 - f) + radii[i0 + 1] * f;
    if (roundEnd && t > .9) r *= Math.sqrt(Math.max(0, 1 - ((t - .9) / .1) ** 2)) * .8 + .2 * (1 - (t - .9) / .1);
    if (roundStart && t < .1) r *= Math.sqrt(Math.max(0, 1 - ((.1 - t) / .1) ** 2));
    for (let j = 0; j <= seg; j++) {
      const th = j / seg * TAU, c = Math.cos(th), s = Math.sin(th);
      const rr = r + (disp ? disp(th, t) : 0);
      pos.push(P[i].x + (N.x * c + B.x * s * flat) * rr, P[i].y + (N.y * c + B.y * s * flat) * rr, P[i].z + (N.z * c + B.z * s * flat) * rr);
      uv.push(j / seg * TAU * r, len);
    }
  }
  const W = seg + 1;
  for (let i = 0; i < steps; i++) for (let j = 0; j < seg; j++) {
    const a = i * W + j, b = a + W;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const mirror = (pts) => pts.map(p => new THREE.Vector3(-p.x, p.y, p.z));
const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
// Merge parts into one geometry. Non-indexed parts (extrusions) get a trivial
// index so they can join indexed ones; only position/normal/uv are kept.
export const merge = (parts) => {
  const ready = parts.map(p => {
    for (const k of Object.keys(p.attributes)) if (!['position', 'normal', 'uv'].includes(k)) p.deleteAttribute(k);
    if (!p.index) p.setIndex([...Array(p.attributes.position.count).keys()]);
    p.clearGroups();
    return p;
  });
  const g = mergeGeometries(ready, false);
  parts.forEach(p => p.dispose());
  return g;
};

// Folds that only push outward, so cloth never sinks into the body.
const folds = (amp, k1 = 7, k2 = 12, ph = 0) => (th, y, s) => {
  const a = amp(y, s);
  return a * (1 + .62 * Math.sin(th * k1 + y * 2.3 + ph) + .38 * Math.sin(th * k2 - y * 4.1 + 1.7 + ph));
};
const sleeveFolds = (amp) => (th, t) => amp * (1 + .6 * Math.sin(th * 5 + t * 19) + .4 * Math.sin(th * 3 - t * 31 + 1.1)) * (.4 + t);

/* ---------------- garments ---------------- */
function longSleeves(r0 = .07, rMid = .078, rEnd = .06, cuff = true, amp = .006) {
  const pts = [V(.13, 1.44), V(.2, 1.405), V(.27, 1.16, -.01), V(.315, .93, .02)];
  const parts = [];
  for (const p of [pts, mirror(pts)]) {
    parts.push(sweep(p, [r0, rMid, rMid * .88, rEnd], { seg: 26, steps: 36, disp: sleeveFolds(amp) }));
    if (cuff) {
      const a = p[3], dir = new THREE.Vector3().subVectors(p[3], p[2]).normalize();
      parts.push(sweep([a.clone().addScaledVector(dir, -.01), a.clone().addScaledVector(dir, .035), a.clone().addScaledVector(dir, .075)],
        [rEnd * .78, rEnd * .7, rEnd * .68], { seg: 22, steps: 6 }));
    }
  }
  return parts;
}

function ribBand(y0, y1, a, b) {
  return loft([{ y: y0, a, b }, { y: (y0 + y1) / 2, a: a * 1.01, b: b * 1.01 }, { y: y1, a, b }], { seg: 48, steps: 2 });
}

function collar(y, a, b, tube = .009) {
  const t = new THREE.TorusGeometry(1, tube, 10, 48);
  t.rotateX(Math.PI / 2); t.scale(a, 1, b); t.translate(0, y, 0);
  return t;
}

export function tee() {
  const body = loft([
    { y: .8, a: .208, b: .148 }, { y: .95, a: .202, b: .142 }, { y: 1.08, a: .192, b: .136 }, { y: 1.25, a: .197, b: .142, z: .005 },
    { y: 1.36, a: .216, b: .132 }, { y: 1.43, a: .2, b: .106, p: 2.6 }, { y: 1.475, a: .15, b: .086 }, { y: 1.5, a: .089, b: .079 }
  ], { disp: folds((y, s) => .002 + (1 - s) ** 2 * .008) });
  const pts = [V(.13, 1.44), V(.215, 1.4), V(.25, 1.3), V(.265, 1.24)];
  const sleeves = [pts, mirror(pts)].map(p => sweep(p, [.072, .077, .074, .07], { seg: 26, steps: 14, disp: sleeveFolds(.004) }));
  return merge([body, ...sleeves, collar(1.502, .087, .077)]);
}

export function sweater() {
  const body = loft([
    { y: .8, a: .2, b: .142 }, { y: .86, a: .214, b: .152 }, { y: 1.0, a: .206, b: .146 }, { y: 1.15, a: .2, b: .143 },
    { y: 1.3, a: .21, b: .148, z: .006 }, { y: 1.38, a: .222, b: .135 }, { y: 1.44, a: .204, b: .108, p: 2.6 },
    { y: 1.48, a: .15, b: .088 }, { y: 1.505, a: .092, b: .082 }
  ], { disp: folds((y, s) => .003 + (1 - s) ** 2 * .006, 9, 14) });
  return merge([body, ribBand(.74, .805, .196, .139), ...longSleeves(.072, .08, .062), collar(1.508, .09, .08, .014)]);
}

export function hoodie() {
  const body = loft([
    { y: .82, a: .212, b: .152 }, { y: .88, a: .226, b: .162 }, { y: 1.02, a: .218, b: .156 }, { y: 1.16, a: .212, b: .152 },
    { y: 1.3, a: .222, b: .156, z: .006 }, { y: 1.38, a: .232, b: .142 }, { y: 1.44, a: .212, b: .114, p: 2.6 },
    { y: 1.48, a: .16, b: .094 }, { y: 1.51, a: .1, b: .088 }
  ], { disp: folds((y, s) => .004 + (1 - s) ** 2 * .007, 6, 11) });
  const hood = new THREE.SphereGeometry(.16, 36, 18, 0, TAU, 0, Math.PI / 2);
  hood.scale(1, .72, .62); hood.rotateX(-(Math.PI / 2 + .75)); hood.translate(0, 1.44, -.12);
  const strings = [-1, 1].map(s => sweep([V(s * .04, 1.49, .095), V(s * .045, 1.4, .135), V(s * .05, 1.3, .152)], [.005, .005, .006], { seg: 8, steps: 10 }));
  return merge([body, ribBand(.76, .825, .206, .147), ...longSleeves(.076, .085, .066, true, .008), hood, ...strings, collar(1.512, .1, .089, .012)]);
}

export function coat() {
  const ring = [
    { y: .46, a: .3, b: .232 }, { y: .7, a: .262, b: .198 }, { y: .95, a: .216, b: .162 }, { y: 1.06, a: .196, b: .148 },
    { y: 1.25, a: .208, b: .153, z: .005 }, { y: 1.37, a: .228, b: .142 }, { y: 1.44, a: .218, b: .117, p: 2.8 },
    { y: 1.485, a: .162, b: .097 }, { y: 1.51, a: .102, b: .092 }
  ];
  const body = loft(ring, { disp: folds((y, s) => .003 + (1 - s) ** 2.4 * .014, 6, 10) });
  const col = loft([{ y: 1.5, a: .104, b: .094 }, { y: 1.535, a: .11, b: .1 }, { y: 1.565, a: .122, b: .112 }], { seg: 48, steps: 3 });
  const belt = loft([{ y: 1.035, a: .207, b: .158 }, { y: 1.06, a: .209, b: .16 }, { y: 1.085, a: .207, b: .158 }], { seg: 48, steps: 2 });
  const buckle = new RoundedBoxGeometry(.06, .045, .012, 2, .004); buckle.translate(0, 1.06, .164);
  const buttons = [];
  for (const [y, b] of [[1.3, .158], [1.18, .152], [.86, .182], [.98, .17]]) for (const x of [-.06, .06]) {
    const s = new THREE.SphereGeometry(.013, 12, 8); s.scale(1, 1, .5); s.translate(x, y, b * Math.sqrt(1 - (x / .2) ** 2) + .006); buttons.push(s);
  }
  return merge([body, col, belt, buckle, ...buttons, ...longSleeves(.08, .09, .07, true, .007)]);
}

export function dress() {
  const body = loft([
    { y: .52, a: .37, b: .32 }, { y: .7, a: .29, b: .25 }, { y: .88, a: .222, b: .172 }, { y: 1.0, a: .178, b: .127 },
    { y: 1.06, a: .158, b: .112 }, { y: 1.18, a: .167, b: .122 }, { y: 1.3, a: .184, b: .133, z: .012 }, { y: 1.37, a: .18, b: .123, z: .006 }
  ], { seg: 64, disp: folds((y, s) => .002 + Math.max(0, 1.0 - y) ** 1.6 * .05, 9, 13) });
  const straps = [-1, 1].map(s => sweep([V(s * .08, 1.36, .11), V(s * .11, 1.47, 0), V(s * .085, 1.36, -.1)], [.009, .009, .009], { seg: 8, steps: 16, flat: .4 }));
  const sash = loft([{ y: 1.045, a: .162, b: .116 }, { y: 1.065, a: .163, b: .117 }, { y: 1.085, a: .161, b: .115 }], { seg: 48, steps: 2 });
  return merge([body, ...straps, sash]);
}

export function pants() {
  const waist = loft([{ y: .82, a: .186, b: .13 }, { y: .92, a: .184, b: .128 }, { y: .99, a: .174, b: .121 }, { y: 1.05, a: .17, b: .118 }], { seg: 48, steps: 4 });
  const band = loft([{ y: 1.0, a: .176, b: .124 }, { y: 1.03, a: .177, b: .125 }, { y: 1.055, a: .175, b: .123 }], { seg: 48, steps: 2 });
  const pts = [V(.092, .9), V(.096, .7, .005), V(.1, .5, .012), V(.1, .3), V(.1, .04, -.01)];
  const legFold = (th, t) => .003 * (1 + .6 * Math.sin(th * 5 + t * 23)) + Math.max(0, t - .78) ** 1.5 * .09 * (1 + Math.sin(th * 4 + t * 60));
  const legs = [pts, mirror(pts)].map(p => sweep(p, [.1, .088, .081, .078, .076], { seg: 28, steps: 40, disp: legFold }));
  return merge([waist, band, ...legs]);
}

export function foldedStack(n = 4, seed = 1) {
  const parts = [];
  let y = 0, rnd = seed;
  const r = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647 - .5);
  for (let i = 0; i < n; i++) {
    const g = new RoundedBoxGeometry(.34, .05, .27, 3, .022);
    g.rotateY(r() * .12); g.translate(r() * .02, y + .025, r() * .02);
    parts.push(g); y += .052;
  }
  return merge(parts);
}

export function hanger() {
  const arm = sweep([V(-.2, -.075), V(-.1, -.03), V(0, 0), V(.1, -.03), V(.2, -.075)], [.011, .012, .013, .012, .011], { seg: 10, steps: 30, flat: .55 });
  const hook = new THREE.TorusGeometry(.03, .003, 6, 20, Math.PI * 1.3);
  hook.rotateZ(-.2); hook.translate(0, .045, 0);
  const neck = new THREE.CylinderGeometry(.003, .003, .03, 6); neck.translate(0, .015, 0);
  return merge([arm, hook, neck]);
}

// Hang point for each garment type (shoulder height or waistband).
export const HANG_Y = { tee: 1.47, sweater: 1.48, hoodie: 1.49, coat: 1.49, dress: 1.47, pants: 1.05 };
export const BUILDERS = { tee, sweater, hoodie, coat, dress, pants };
