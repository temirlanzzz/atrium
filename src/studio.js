// The fitting studio: a product opens here on a rail, then flies onto a
// mannequin. Orbit to turn it, zoom in to see the weave, change colour and size.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as G from './garments.js';
import { clothMaterial } from './towers.js';
import { radialShadow } from './textures.js';

const ease = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const BASE_Y = .04, RACK_X = -1.25, BAR_Y = 1.92;
export const SIZES = [['XS', .93, 'Snug'], ['S', .965, 'Close'], ['M', 1, 'True to size'], ['L', 1.04, 'Relaxed'], ['XL', 1.085, 'Oversized']];

export function createStudio(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0c0f);
  scene.fog = new THREE.Fog(0x0b0c0f, 6, 16);
  const camera = new THREE.PerspectiveCamera(32, 1, .05, 60);
  camera.position.set(.6, 1.45, 4.4);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(-.2, 1.1, 0);
  controls.enableDamping = true; controls.dampingFactor = .08;
  controls.minDistance = .55; controls.maxDistance = 6; controls.maxPolarAngle = Math.PI * .56;
  controls.autoRotateSpeed = .8; controls.enabled = false; controls.enablePan = false;

  // Cyclorama: a back-faced sphere whose shader glows behind the model.
  const cyc = new THREE.Mesh(new THREE.SphereGeometry(14, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTint: { value: new THREE.Color(0x3a3530) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform vec3 uTint; varying vec3 vP;
      void main(){ vec3 d = normalize(vP); float g = exp(-pow(length(d.xy - vec2(0., .12)) * 2.2, 2.)) * smoothstep(-.2, .1, -d.z);
        float floorDark = smoothstep(.05, -.25, d.y);
        gl_FragColor = vec4(mix(vec3(.018,.019,.024) + uTint * g * .55, vec3(.01), floorDark), 1.); }`
  }));
  scene.add(cyc);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 64), new THREE.MeshStandardMaterial({ color: 0x0d0e11, roughness: .5, metalness: .2 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const plinth = new THREE.Mesh(G.standGeometry(), new THREE.MeshPhysicalMaterial({ color: 0x1a1b1f, roughness: .18, metalness: .1, clearcoat: 1, clearcoatRoughness: .08 }));
  plinth.receiveShadow = true; scene.add(plinth);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: radialShadow(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = BASE_Y + .002; scene.add(shadow);

  // Lighting: warm key with soft shadows, cool and warm rims, low fill.
  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x1a1410, .35));
  const key = new THREE.DirectionalLight(0xfff1e0, 1.25);
  key.position.set(2.2, 3.6, 2.8); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 6; key.shadow.bias = -.0004; key.shadow.normalBias = .02;
  Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2.6, bottom: -.4, near: .5, far: 10 });
  scene.add(key);
  const rimA = new THREE.SpotLight(0x8fb6ff, 30, 9, .5, .6); rimA.position.set(-2.6, 2.6, -2.4); rimA.target.position.set(0, 1.1, 0);
  const rimB = new THREE.SpotLight(0xffb27a, 22, 9, .5, .6); rimB.position.set(2.8, 2.0, -2.2); rimB.target.position.set(0, 1.1, 0);
  scene.add(rimA, rimA.target, rimB, rimB.target);

  const ceramic = new THREE.MeshPhysicalMaterial({ color: 0xa8a39b, roughness: .48, clearcoat: .4, clearcoatRoughness: .35 });
  const mannequin = new THREE.Mesh(G.mannequinGeometry(), ceramic);
  mannequin.position.y = BASE_Y; mannequin.castShadow = mannequin.receiveShadow = true; scene.add(mannequin);

  // A freestanding chrome rail where the garment first appears.
  const chrome = new THREE.MeshStandardMaterial({ color: 0xcfd3d8, metalness: 1, roughness: .18 });
  const rack = new THREE.Group(); rack.position.set(RACK_X, 0, -.1); rack.rotation.y = .35;
  for (const x of [-.42, .42]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, BAR_Y, 12), chrome); post.position.set(x, BAR_Y / 2, 0);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(.04, .02, .42), chrome); foot.position.set(x, .01, 0);
    rack.add(post, foot);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .9, 12), chrome); bar.rotation.z = Math.PI / 2; bar.position.y = BAR_Y;
  const hanger = new THREE.Mesh(G.hanger(), new THREE.MeshStandardMaterial({ color: 0x8b6a47, roughness: .45 }));
  hanger.position.y = BAR_Y - .055; hanger.castShadow = true;
  rack.add(bar, hanger); rack.traverse(o => { o.castShadow = true; }); scene.add(rack);

  let garment = null, product = null, onModel = false, anim = null, sizeK = 1, curK = 1, targetColor = new THREE.Color();
  const geoCache = {};

  function rackPose(type) {
    const p = new THREE.Vector3(0, BAR_Y - .075 - G.HANG_Y[type], 0);
    rack.updateMatrixWorld();
    const m = new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).premultiply(rack.matrixWorld);
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), s = new THREE.Vector3();
    m.decompose(pos, quat, s);
    return { pos, quat };
  }
  const modelPose = () => ({ pos: new THREE.Vector3(0, BASE_Y, 0), quat: new THREE.Quaternion() });

  function open(p) {
    product = p;
    if (garment) { scene.remove(garment); garment.material.dispose(); }
    geoCache[p.type] ??= G.BUILDERS[p.type]();
    const mat = clothMaterial(p.type);
    mat.color.set(p.color); targetColor.set(p.color);
    garment = new THREE.Mesh(geoCache[p.type], mat);
    garment.castShadow = true; garment.receiveShadow = true;
    const r = rackPose(p.type);
    garment.position.copy(r.pos); garment.quaternion.copy(r.quat);
    scene.add(garment);
    onModel = false; anim = null; sizeK = curK = 1; hanger.visible = p.type !== 'pants';
    // portrait screens put the panel at the bottom, so frame the model in the upper half
    const portrait = camera.aspect < .9;
    home.copy(portrait ? new THREE.Vector3(0, .55, 0) : new THREE.Vector3(0, 1.1, 0));
    camera.position.set(portrait ? .3 : .5, portrait ? 1.2 : 1.5, portrait ? 6.6 : 4.6);
    controls.target.set(portrait ? -.2 : -.35, home.y, 0);
    controls.autoRotate = false; controls.update();
  }

  function tryOn(on = !onModel) {
    if (!garment) return onModel;
    const from = { pos: garment.position.clone(), quat: garment.quaternion.clone() };
    const to = on ? modelPose() : rackPose(product.type);
    anim = { t: 0, dur: 1.25, from, to, on };
    onModel = on;
    return onModel;
  }

  function setColor(hex) { targetColor.set(hex); }
  function setSize(k) { sizeK = k; }
  function focusDetail() {
    const target = onModel ? new THREE.Vector3(0, 1.28, 0) : rackPose(product.type).pos.clone().add(new THREE.Vector3(0, G.HANG_Y[product.type] - .2, 0));
    camFly = { t: 0, from: camera.position.clone(), fromT: controls.target.clone(), to: target.clone().add(new THREE.Vector3(.28, .06, .78)), toT: target };
  }
  let camFly = null;
  const home = new THREE.Vector3(0, 1.1, 0);

  const wob = { v: 0, x: 0 };
  function update(dt) {
    if (!garment) return;
    if (anim) {
      anim.t = Math.min(1, anim.t + dt / anim.dur);
      const e = ease(anim.t);
      garment.position.lerpVectors(anim.from.pos, anim.to.pos, e);
      garment.position.y += Math.sin(Math.PI * e) * .35; // lift on an arc
      garment.quaternion.slerpQuaternions(anim.from.quat, anim.to.quat, e);
      garment.rotateY(Math.sin(Math.PI * e) * Math.PI * (anim.on ? 2 : -2) * e * (1 - e) * 1.2);
      if (anim.t >= 1) { wob.v = 2.4; anim = null; if (onModel) controls.target.copy(home); }
    }
    // a damped spring squash when cloth lands
    wob.v += (-wob.x * 120 - wob.v * 9) * dt; wob.x += wob.v * dt;
    const k = (curK = THREE.MathUtils.damp(curK, sizeK, 8, dt));
    garment.scale.set(k * (1 + wob.x * .05), k * (1 - wob.x * .04), k * (1 + wob.x * .05));
    if (onModel && !anim) garment.position.y = BASE_Y - (k - 1) * .9; // bigger sizes drop a little lower
    garment.material.color.lerp(targetColor, 1 - Math.exp(-dt * 8));
    if (camFly) {
      camFly.t = Math.min(1, camFly.t + dt / 1.1);
      const e = ease(camFly.t);
      camera.position.lerpVectors(camFly.from, camFly.to, e); controls.target.lerpVectors(camFly.fromT, camFly.toT, e);
      if (camFly.t >= 1) camFly = null;
    }
    controls.update(dt);
  }

  function setAspect(a) { camera.aspect = a; camera.updateProjectionMatrix(); }

  return { scene, camera, controls, open, tryOn, setColor, setSize, focusDetail, update, setAspect, get onModel() { return onModel; } };
}
