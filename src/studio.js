// The product page stage: a bright seamless photo studio. Scanned products
// keep their real colourways; garments go from a rail onto a linen dress form.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as G from './garments.js';
import { clothMaterial } from './towers.js';
import { scanObject, textures } from './assets.js';

const ease = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const RACK_X = -1.25, BAR_Y = 1.92;
export const SIZES = [['XS', .93, 'Snug'], ['S', .965, 'Close'], ['M', 1, 'True to size'], ['L', 1.04, 'Relaxed'], ['XL', 1.085, 'Oversized']];

export function createStudio(renderer, fullScans) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe8e5e0);
  const camera = new THREE.PerspectiveCamera(30, 1, .02, 60);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .08; controls.enablePan = false;
  controls.minDistance = .25; controls.maxDistance = 7; controls.maxPolarAngle = Math.PI * .52;
  controls.autoRotateSpeed = .7; controls.enabled = false;

  // Seamless sweep: a floor that curves up into the back wall.
  const shape = new THREE.CurvePath();
  shape.add(new THREE.LineCurve(new THREE.Vector2(6, 0), new THREE.Vector2(-2, 0)));
  shape.add(new THREE.QuadraticBezierCurve(new THREE.Vector2(-2, 0), new THREE.Vector2(-4, 0), new THREE.Vector2(-4, 2)));
  shape.add(new THREE.LineCurve(new THREE.Vector2(-4, 2), new THREE.Vector2(-4, 8)));
  const pts = shape.getPoints(24);
  const wallGeo = new THREE.PlaneGeometry(30, 1, 1, pts.length - 1);
  const wp = wallGeo.attributes.position;
  for (let i = 0; i < pts.length; i++) for (let j = 0; j < 2; j++) {
    const k = i * 2 + j; wp.setXYZ(k, j ? 15 : -15, pts[i].y, pts[i].x);
  }
  wallGeo.computeVertexNormals();
  const wall = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({ color: 0xd9d5cf, roughness: .95, side: THREE.DoubleSide }));
  wall.receiveShadow = true; scene.add(wall);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c8, .45));
  const key = new THREE.DirectionalLight(0xfff6ec, 1.5);
  key.position.set(2.4, 4.2, 3.2); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 10; key.shadow.blurSamples = 16; key.shadow.bias = -.0003; key.shadow.normalBias = .02;
  Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 2.8, bottom: -.6, near: .5, far: 12 });
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xe8f0ff, .8); rim.position.set(-3, 2.5, -2.5); scene.add(rim);

  const plinth = new THREE.Mesh(new RoundedBoxGeometry(.7, .8, .7, 4, .02).translate(0, .4, 0), new THREE.MeshStandardMaterial({ color: 0xf4f1ec, roughness: .55 }));
  plinth.castShadow = plinth.receiveShadow = true; scene.add(plinth);

  // Garment set: a brass rail and a linen dress form on a brass stand.
  const brass = new THREE.MeshStandardMaterial({ color: 0xb59a6a, metalness: 1, roughness: .28 });
  const rack = new THREE.Group(); rack.position.set(RACK_X, 0, -.1); rack.rotation.y = .35;
  for (const x of [-.42, .42]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, BAR_Y, 12), brass); post.position.set(x, BAR_Y / 2, 0);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(.035, .015, .4), brass); foot.position.set(x, .008, 0);
    rack.add(post, foot);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(.011, .011, .9, 12), brass); bar.rotation.z = Math.PI / 2; bar.position.y = BAR_Y;
  const hanger = new THREE.Mesh(G.hanger(), new THREE.MeshStandardMaterial({ color: 0x8b6a47, roughness: .45 })); hanger.position.y = BAR_Y - .055;
  rack.add(bar, hanger); rack.traverse(o => { o.castShadow = true; }); scene.add(rack);
  const linen = new THREE.MeshPhysicalMaterial({ color: 0xd9ccb6, roughness: .9, sheen: .5, sheenColor: new THREE.Color(0x666666), normalMap: textures.fabricNormal(), normalScale: new THREE.Vector2(.5, .5) });
  linen.normalMap = linen.normalMap.clone(); linen.normalMap.repeat.set(20, 20);
  const form = new THREE.Group();
  const torso = new THREE.Mesh(G.loft([{ y: .82, a: .15, b: .105 }, { y: .95, a: .172, b: .115 }, { y: 1.05, a: .142, b: .098 }, { y: 1.18, a: .15, b: .106 },
    { y: 1.3, a: .164, b: .116, z: .01 }, { y: 1.38, a: .176, b: .1 }, { y: 1.44, a: .15, b: .075, p: 2.6 }, { y: 1.5, a: .064, b: .056 }, { y: 1.56, a: .045, b: .045 }],
  { seg: 64, steps: 6, capStart: true, capEnd: true }), linen);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .84, 12).translate(0, .41, 0), brass);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(.2, .22, .03, 48).translate(0, .015, 0), brass);
  form.add(torso, pole, foot); form.traverse(o => { o.castShadow = o.receiveShadow = true; }); scene.add(form);

  let product = null, item = null, garment = null, onModel = false, anim = null, sizeK = 1, curK = 1, camFly = null;
  const targetColor = new THREE.Color(), home = new THREE.Vector3(), geoCache = {};

  function rackPose(type) {
    rack.updateMatrixWorld();
    const m = new THREE.Matrix4().makeTranslation(0, BAR_Y - .075 - G.HANG_Y[type], 0).premultiply(rack.matrixWorld);
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion(); m.decompose(pos, quat, new THREE.Vector3());
    return { pos, quat };
  }

  // On wide screens the product page panel covers the right ~420px, so shift
  // the projection to centre the product in the space that is left.
  function offsetView() {
    const w = innerWidth, h = innerHeight;
    if (camera.aspect < .9) camera.clearViewOffset();
    else camera.setViewOffset(w, h, Math.min(220, w * .16), 0, w, h);
  }
  function frame(center, radius, dir = new THREE.Vector3(.35, .22, 1)) {
    offsetView();
    const portrait = camera.aspect < .9;
    const dist = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * (portrait ? 1.9 : 1.15);
    home.copy(center); if (portrait) home.y -= radius * .55;
    camera.position.copy(home).addScaledVector(dir.normalize(), dist);
    controls.target.copy(home); controls.minDistance = radius * .5; controls.maxDistance = dist * 2.2; controls.update();
  }

  function open(p) {
    product = p;
    if (item) { scene.remove(item); item = null; }
    if (garment) { scene.remove(garment); garment.material.dispose(); garment = null; }
    anim = null; camFly = null; sizeK = curK = 1; onModel = false;
    const isScan = p.scan;
    rack.visible = form.visible = !isScan;
    plinth.visible = false;
    if (isScan) {
      const scan = fullScans[p.type];
      item = scanObject(scan, p.variant);
      const small = Math.max(scan.size.x, scan.size.y, scan.size.z) < .5;
      const lift = small ? .8 : 0;
      plinth.visible = small;
      item.position.y = lift;
      if (p.type === 'shoe') item.rotation.y = -.6;
      if (p.type === 'watch') item.rotation.set(-.35, .4, 0);
      if (small) item.scale.setScalar(p.type === 'watch' ? 2.2 : 1.6);
      scene.add(item);
      const box = new THREE.Box3().setFromObject(item), sph = box.getBoundingSphere(new THREE.Sphere());
      frame(sph.center, Math.max(sph.radius, small ? .22 : .5));
      return;
    }
    geoCache[p.type] ??= G.BUILDERS[p.type]();
    const mat = clothMaterial(p.type); mat.color.set(p.color); targetColor.set(p.color);
    garment = new THREE.Mesh(geoCache[p.type], mat); garment.castShadow = garment.receiveShadow = true;
    const r = rackPose(p.type); garment.position.copy(r.pos); garment.quaternion.copy(r.quat);
    hanger.visible = p.type !== 'pants';
    form.visible = p.type !== 'pants';
    scene.add(garment);
    frame(new THREE.Vector3(-.5, 1.05, 0), .95, new THREE.Vector3(.25, .12, 1));
  }

  function tryOn(on = !onModel) {
    if (!garment || product.type === 'pants') return onModel;
    const from = { pos: garment.position.clone(), quat: garment.quaternion.clone() };
    const to = on ? { pos: new THREE.Vector3(), quat: new THREE.Quaternion() } : rackPose(product.type);
    anim = { t: 0, dur: 1.2, from, to, on }; onModel = on;
    return onModel;
  }
  function setColor(hex) { targetColor.set(hex); }
  function setVariant(i) { item?.userData.setVariant(i); }
  function setSize(k) { sizeK = k; }
  function focusDetail() {
    const box = new THREE.Box3().setFromObject(item || garment), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    if (garment) c.y = onModel ? 1.25 : c.y + s.y * .25;
    const d = Math.max(s.x, s.y, s.z) * (garment ? .45 : .9);
    camFly = { t: 0, from: camera.position.clone(), fromT: controls.target.clone(), to: c.clone().add(new THREE.Vector3(d * .35, d * .1, d)), toT: c };
  }

  const wob = { v: 0, x: 0 };
  function update(dt) {
    if (garment) {
      if (anim) {
        anim.t = Math.min(1, anim.t + dt / anim.dur);
        const e = ease(anim.t);
        garment.position.lerpVectors(anim.from.pos, anim.to.pos, e);
        garment.position.y += Math.sin(Math.PI * e) * .3;
        garment.quaternion.slerpQuaternions(anim.from.quat, anim.to.quat, e);
        if (anim.t >= 1) { wob.v = 2.2; anim = null; if (onModel) { camFly = { t: 0, from: camera.position.clone(), fromT: controls.target.clone(), to: new THREE.Vector3(.55, 1.35, 3.6), toT: new THREE.Vector3(0, 1.05, 0) }; } }
      }
      wob.v += (-wob.x * 120 - wob.v * 9) * dt; wob.x += wob.v * dt;
      const k = (curK = THREE.MathUtils.damp(curK, sizeK, 8, dt));
      garment.scale.set(k * (1 + wob.x * .04), k * (1 - wob.x * .03), k * (1 + wob.x * .04));
      if (onModel && !anim) garment.position.y = -(k - 1) * .9;
      garment.material.color.lerp(targetColor, 1 - Math.exp(-dt * 8));
    }
    if (camFly) {
      camFly.t = Math.min(1, camFly.t + dt / 1.1);
      const e = ease(camFly.t);
      camera.position.lerpVectors(camFly.from, camFly.to, e); controls.target.lerpVectors(camFly.fromT, camFly.toT, e);
      if (camFly.t >= 1) camFly = null;
    }
    controls.update(dt);
  }
  function setAspect(a) { camera.aspect = a; offsetView(); camera.updateProjectionMatrix(); }

  return { scene, camera, controls, open, tryOn, setColor, setVariant, setSize, focusDetail, update, setAspect, get onModel() { return onModel; } };
}
