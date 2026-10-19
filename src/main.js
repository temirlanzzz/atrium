import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createTowers, FH, A } from './towers.js';
import { createStudio, SIZES } from './studio.js';
import { createPost } from './post.js';
import { SCANS, loadEnvironment, loadScan, onProgress } from './assets.js';
import { DEPARTMENTS, collectionOf, variantNames } from './catalog.js';

const $ = (s) => document.querySelector(s);
const CAPTURE = new URLSearchParams(location.search).has('capture');
const ease = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = (t) => 1 - Math.pow(1 - t, 4);
const clamp = THREE.MathUtils.clamp, damp = THREE.MathUtils.damp;

const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: CAPTURE });
renderer.setPixelRatio(Math.min(devicePixelRatio, CAPTURE ? 1 : 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// The courtyard is lit by a real overcast HDRI sky; the shaft below fades into
// mist. Warm lamps that travel with the camera stand in for the shop lighting
// that every window would cast onto the garments facing the courtyard.
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x60676d, .03);
scene.backgroundIntensity = .9;
const sun = new THREE.DirectionalLight(0xfff1e2, .9); sun.position.set(4, 10, 3); scene.add(sun);
const lampLow = new THREE.PointLight(0xffdcb8, 26, 26, 1.6), lampHigh = new THREE.PointLight(0xffe7cf, 18, 24, 1.6);
scene.add(lampLow, lampHigh);
const fullScans = {};
// The product page loads full-detail scans on demand (the windows use light LODs).
const fullScan = (k) => fullScans[k] ? Promise.resolve(fullScans[k]) : loadScan(k).then((s) => (fullScans[k] = s));

const camera = new THREE.PerspectiveCamera(62, 1, .05, 170);
let towers, studio, post;

/* ---------------- state ---------------- */
const S = {
  mode: 'loading', t: 0, y: 0, v: 0, yaw: .35, yawV: 0, look: -1, pitch: -.82, fov: 62,
  px: 0, py: 0, pointer: new THREE.Vector2(-9, -9), pointerMoved: false, hover: null, input: 0,
  keys: new Set(), anim: null, bag: 0, product: null, lastPick: 0
};

/* ---------------- layout ---------------- */
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  studio?.setAspect(w / h);
  post?.setSize(w, h);
}
addEventListener('resize', resize);

/* ---------------- build ---------------- */
async function build() {
  const bar = $('#load-bar'), step = (p, label) => { bar.style.transform = `scaleX(${p})`; $('#load-label').textContent = label; return new Promise(r => setTimeout(r, CAPTURE ? 0 : 30)); };
  onProgress((p) => { bar.style.transform = `scaleX(${.05 + p * .75})`; });
  await step(.05, 'loading the sky');
  const { sky, env, pmrem } = await loadEnvironment(renderer);
  scene.background = sky; scene.environment = env;
  $('#load-label').textContent = 'unpacking the collection';
  const lod = {};
  await Promise.all(Object.keys(SCANS).map(async (k) => { lod[k] = await loadScan(k, { lod: true }); variantNames[k] = lod[k].variants; }));
  await step(.85, 'dressing the windows');
  towers = createTowers(scene, lod);
  studio = createStudio(renderer, fullScans);
  studio.scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture; studio.scene.environmentIntensity = .55;
  await step(.92, 'lighting the windows');
  post = createPost(renderer, scene, camera);
  resize();
  S.roofY = towers.update(0, false, 0) || 0;
  S.y = 46; // start above the roof for the plunge
  renderer.compile(scene, camera); renderer.compile(studio.scene, studio.camera);
  await step(1, 'ready');
  $('#loader').classList.add('done');
  startIntro();
}

function startIntro() {
  S.mode = 'intro';
  S.anim = { t: 0, dur: 3.6 };
  $('#title').classList.add('show');
}

/* ---------------- camera ---------------- */
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
function applyFallCamera() {
  const sway = S.mode === 'fall' ? 1 : 0;
  camera.position.set(Math.sin(S.t * .21) * .5 * sway, S.y, Math.cos(S.t * .17) * .5 * sway);
  euler.set(S.pitch + S.py * .12, S.yaw - S.px * .22, Math.sin(S.t * .4) * .02 + S.yawV * .02);
  camera.quaternion.setFromEuler(euler);
  camera.fov = S.fov; camera.updateProjectionMatrix();
}

function facingDept() {
  const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  // looking down, the facade at the top of the screen is the one "ahead"
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const d = S.look < 0 ? up : f; d.y = 0;
  const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  let best = 0, bd = -2;
  dirs.forEach(([x, z], i) => { const k = x * d.x + z * d.z; if (k > bd) { bd = k; best = i; } });
  return DEPARTMENTS[best];
}

/* ---------------- interaction ---------------- */
let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: 0, id: e.pointerId, type: e.pointerType }; });
addEventListener('pointermove', (e) => {
  S.pointer.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); S.pointerMoved = true;
  if (S.mode === 'fall' && e.pointerType === 'mouse') { S.px = S.pointer.x; S.py = S.pointer.y; }
  if (drag && S.mode === 'fall') {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY;
    S.yawV += dx * .0045 * (S.look < 0 ? -1 : 1);
    if (drag.type !== 'mouse') S.v += dy * -.08 * S.look * -1; // swipe up = fall further
    S.input = 0;
  }
});
addEventListener('pointerup', (e) => {
  if (drag && drag.moved < 8 && S.mode === 'fall') {
    if (e.pointerType !== 'mouse') { S.pointer.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); pickHover(); }
    if (S.hover) enterBay(S.hover);
  }
  drag = null;
});
addEventListener('wheel', (e) => {
  if (S.mode !== 'fall') return;
  const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
  S.v = clamp(S.v + e.deltaY * k * .012, -30, 45); S.input = 0;
}, { passive: true });
addEventListener('keydown', (e) => {
  S.keys.add(e.key.toLowerCase());
  if (e.key === 'f' && S.mode === 'fall') flipLook();
  if (e.key === 'Escape' && S.mode === 'studio') exitStudio();
});
addEventListener('keyup', (e) => S.keys.delete(e.key.toLowerCase()));

function flipLook() {
  S.look *= -1;
  $('#flip').textContent = S.look < 0 ? 'Look up ↑' : 'Look down ↓';
}
$('#flip').addEventListener('click', flipLook);
// Department links turn you to face that tower (the facade "ahead" on screen).
const DEPT_YAW = [0, -Math.PI / 2, Math.PI, Math.PI / 2];
document.querySelectorAll('#nav a').forEach((a, i) => a.addEventListener('click', (e) => {
  e.preventDefault(); if (S.mode !== 'fall') return;
  let y = DEPT_YAW[i]; while (y - S.yaw > Math.PI) y -= Math.PI * 2; while (S.yaw - y > Math.PI) y += Math.PI * 2;
  S.yawTarget = y; S.yawV = 0; S.input = 0;
}));

const raycaster = new THREE.Raycaster();
function pickHover() {
  camera.updateMatrixWorld();
  raycaster.setFromCamera(S.pointer, camera);
  const h = towers.pick(raycaster);
  const valid = h && h.distance < 32 ? h : null;
  S.hover = valid;
  towers.setHover(valid ? valid.bay : -1);
  const tag = $('#tag');
  if (valid) {
    const p = valid.product;
    tag.innerHTML = `<small>${p.brand}</small><b>${p.name}</b><span>${money(p.price)}</span>`;
    tag.classList.add('on');
    canvas.style.cursor = 'pointer';
  } else { tag.classList.remove('on'); canvas.style.cursor = ''; }
}

const money = (n) => '$' + n.toLocaleString('en-US');

/* ---------------- bay → studio → back ---------------- */
function enterBay(h) {
  S.mode = 'zoom'; S.product = h.product;
  S.ready = h.product.scan ? fullScan(h.product.type) : Promise.resolve();
  $('#tag').classList.remove('on'); towers.setHover(-1);
  const view = towers.bayView(h.bay);
  const m = new THREE.Matrix4().lookAt(view.eye, view.target, new THREE.Vector3(0, 1, 0));
  S.anim = { t: 0, dur: 1.35, fromP: camera.position.clone(), fromQ: camera.quaternion.clone(), toP: view.eye, toQ: new THREE.Quaternion().setFromRotationMatrix(m), fromF: S.fov, view };
  document.body.classList.add('zooming');
}

function showStudio() {
  S.mode = 'studio';
  studio.open(S.product);
  post.setScene(studio.scene, studio.camera); post.bloom.enabled = false;
  studio.controls.enabled = true;
  fillPanel(S.product);
  document.body.classList.add('in-studio'); document.body.classList.remove('zooming');
  if (!S.product.scan && S.product.type !== 'pants') setTimeout(() => { if (S.mode === 'studio' && !studio.onModel) setTryOn(true); }, CAPTURE ? 0 : 650);
}

function exitStudio() {
  if (S.mode !== 'studio') return;
  S.mode = 'fadeout';
  S.anim = { t: 0, dur: .35, then: () => {
    post.setScene(scene, camera); post.bloom.enabled = true; studio.controls.enabled = false;
    document.body.classList.remove('in-studio');
    S.mode = 'unzoom';
    const back = S.lastFall;
    S.anim = { t: 0, dur: 1.2, fromP: camera.position.clone(), fromQ: camera.quaternion.clone(), back };
  } };
}

// Real colourways for scans (KHR_materials_variants), fabric colours for garments.
const SIZED = { shoe: ['39', '40', '41', '42', '43'], watch: null, sunglasses: null, corset: ['XS', 'S', 'M', 'L', 'XL'] };
function fillPanel(p) {
  $('#p-dept').textContent = `${p.dept.name} · ${p.collection}`;
  $('#p-brand').textContent = p.brand;
  $('#p-name').textContent = p.name;
  $('#p-price').textContent = money(p.price);
  $('#p-id').textContent = `Item ${p.id} · level ${Math.abs(p.floor)}`;
  $('#p-desc').textContent = p.desc;
  const cap = (t) => t.replace(/\b\w/g, (c) => c.toUpperCase());
  if (p.scan) {
    $('#p-sw').innerHTML = p.swatches.length ? p.swatches.map((n, i) => `<button class="vt${i === p.variant ? ' on' : ''}" data-v="${i}">${cap(n)}</button>`).join('') : '<span class="one">One colour</span>';
  } else {
    $('#p-sw').innerHTML = p.swatches.map((c, i) => `<button class="sw${i ? '' : ' on'}" style="--c:${c}" data-c="${c}" aria-label="Colour ${i + 1}"></button>`).join('');
  }
  const sizes = p.scan ? SIZED[p.type] : SIZES.map(([s]) => s);
  $('#size-row').hidden = !sizes;
  if (sizes) $('#p-size').innerHTML = sizes.map((s, i) => `<button class="${i === 2 ? 'on' : ''}" data-i="${i}">${s}</button>`).join('');
  $('#p-fit').textContent = p.scan ? '' : 'Fit: ' + SIZES[2][2];
  $('#p-try').hidden = p.scan || p.type === 'pants';
  setTryOnLabel(false);
}
$('#p-sw').addEventListener('click', (e) => {
  const b = e.target.closest('.sw, .vt'); if (!b) return;
  document.querySelectorAll('#p-sw button').forEach(x => x.classList.toggle('on', x === b));
  if (b.dataset.v) studio.setVariant(+b.dataset.v); else studio.setColor(b.dataset.c);
});
$('#p-size').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  document.querySelectorAll('#p-size button').forEach(x => x.classList.toggle('on', x === b));
  if (S.product.scan) return;
  const [, k, fit] = SIZES[+b.dataset.i]; studio.setSize(k); $('#p-fit').textContent = 'Fit: ' + fit;
});
function setTryOnLabel(on) { $('#p-try').textContent = on ? 'Show on the rail' : 'Show on the form'; }
function setTryOn(on) { setTryOnLabel(studio.tryOn(on)); }
$('#p-try').addEventListener('click', () => setTryOn(!studio.onModel));
$('#p-detail').addEventListener('click', () => studio.focusDetail());
$('#p-spin').addEventListener('click', (e) => { studio.controls.autoRotate = !studio.controls.autoRotate; e.currentTarget.classList.toggle('on', studio.controls.autoRotate); });
$('#p-close').addEventListener('click', exitStudio);
$('#p-add').addEventListener('click', (e) => {
  S.bag++;
  const b = $('#bag'), fly = document.createElement('i'), r = e.currentTarget.getBoundingClientRect(), t = b.getBoundingClientRect();
  fly.className = 'fly'; fly.style.left = r.left + r.width / 2 + 'px'; fly.style.top = r.top + 'px';
  fly.style.setProperty('--dx', t.left + t.width / 2 - r.left - r.width / 2 + 'px'); fly.style.setProperty('--dy', t.top - r.top + 'px');
  const sw = document.querySelector('#p-sw .sw.on');
  fly.style.background = sw ? getComputedStyle(sw).getPropertyValue('--c') : '#1a1a1a';
  document.body.appendChild(fly); setTimeout(() => fly.remove(), 900);
  setTimeout(() => { $('#bag-n').textContent = S.bag; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }, 780);
  const toast = $('#toast'); toast.textContent = `Added to bag · ${S.product.name}`; toast.classList.add('on'); clearTimeout(toast._h); toast._h = setTimeout(() => toast.classList.remove('on'), 2200);
});

/* ---------------- capture script (deterministic demo reel) ---------------- */
// ?shot=<type> opens that kind of product; ?shot=reel is the portfolio reel
// (fall, turn to Shoes, open the sneaker, switch through its real colourways).
const SHOT0 = new URLSearchParams(location.search).get('shot');
const SHOT = SHOT0 === 'reel' ? 'shoe' : SHOT0;
function captureScript(t) {
  if (SHOT === 'up') { if (S.mode === 'fall' && S.look < 0) flipLook(); return; }
  if (SHOT === 'still') return;
  if (S.mode === 'fall') {
    // a product-type shot turns to face that department first
    const di = SHOT ? DEPARTMENTS.findIndex(d => d.types.includes(SHOT)) : -1;
    if (di >= 0 && t > 4 && t < 4.1) S.yawTarget = DEPT_YAW[di];
    S.yawV += di >= 0 ? 0 : .0009;
    if (t > 4.2 && t < 5.4) S.v = Math.min(S.v + .9, 16);
    if (t > 7.1 && !S.scripted) {
      S.scripted = true;
      // pick a nearby, colourful coat or dress so the reel shows the try-on well
      let best = null, any = null;
      for (let y = .6; y >= -.2 && !best; y -= .1) for (let x = -.5; x <= .5; x += .1) {
        S.pointer.set(x, y); pickHover();
        const p = S.hover?.product;
        if (p) any ??= S.hover;
        if (p && (SHOT ? p.type === SHOT : p.type === 'coat') && (p.scan || new THREE.Color(p.color).getHSL({}).l > .25)) { best = S.hover; break; }
      }
      S.hover = best || any;
      if (S.hover) enterBay(S.hover);
    }
  }
  if (S.mode === 'studio') {
    studio.controls.autoRotate = true; studio.controls.autoRotateSpeed = 2.4;
    if (SHOT0 === 'reel') {
      const vt = document.querySelectorAll('#p-sw .vt');
      if (t > 10.6 && !S.v1) { S.v1 = true; vt[1]?.click(); }
      if (t > 12.4 && !S.v2) { S.v2 = true; vt[2]?.click(); }
      if (t > 13.4 && !S.added) { S.added = true; $('#p-add').click(); }
      return;
    }
    if (t > 12.2 && !S.detail) { S.detail = true; studio.focusDetail(); }
  }
}

/* ---------------- loop ---------------- */
function step(dt, render = true) {
  S.t += dt;
  if (CAPTURE) captureScript(S.t);
  const hud = S.mode === 'fall' || S.mode === 'intro';

  if (S.mode === 'intro') {
    const a = S.anim; a.t = Math.min(1, a.t + dt / a.dur);
    const e = easeOut(a.t);
    const roof = (towers.base * FH) + 1.2;
    S.y = THREE.MathUtils.lerp(roof + 46, roof - 9, e);
    S.pitch = THREE.MathUtils.lerp(-Math.PI / 2 + .02, -.82, ease(a.t));
    S.yaw = .35 + (1 - e) * 1.4;
    S.fov = THREE.MathUtils.lerp(78, 62, e);
    S.v = (1 - a.t) * 30;
    if (a.t >= 1) { S.mode = 'fall'; S.v = 2; setTimeout(() => $('#title').classList.remove('show'), CAPTURE ? 0 : 1600); }
  }

  if (S.mode === 'fall') {
    const k = S.keys;
    if (k.has('arrowdown') || k.has('s') || k.has(' ')) S.v += 40 * dt;
    if (k.has('arrowup') || k.has('w')) S.v -= 40 * dt;
    if (k.has('arrowleft') || k.has('a')) S.yawV += 2.2 * dt;
    if (k.has('arrowright') || k.has('d')) S.yawV -= 2.2 * dt;
    S.input += dt;
    const drift = S.input > 1.2 ? 1.1 : S.v;
    S.v = damp(S.v, drift, S.input > 1.2 ? 1.2 : 2.2, dt);
    S.y -= S.v * dt;
    const roof = towers.base * FH - 1.6;
    if (S.y > roof) { S.y = roof; S.v = Math.max(S.v, 0); }
    if (S.yawTarget !== undefined) { S.yaw = damp(S.yaw, S.yawTarget, 3.5, dt); if (Math.abs(S.yaw - S.yawTarget) < .002) S.yawTarget = undefined; }
    S.yaw += S.yawV * dt + (S.input > 3 && S.yawTarget === undefined ? dt * .03 : 0);
    S.yawV = damp(S.yawV, 0, 3, dt);
    S.pitch = damp(S.pitch, S.look < 0 ? -.82 : .9, 3.2, dt);
    S.fov = damp(S.fov, 62 + Math.min(Math.abs(S.v), 30) * .45, 4, dt);
    S.lastFall = { y: S.y, pitch: S.pitch, yaw: S.yaw, fov: S.fov };
  }

  if (S.mode === 'zoom') {
    const a = S.anim; a.t = Math.min(1, a.t + dt / a.dur);
    const e = ease(a.t);
    camera.position.lerpVectors(a.fromP, a.toP, e);
    camera.quaternion.slerpQuaternions(a.fromQ, a.toQ, e);
    camera.fov = THREE.MathUtils.lerp(a.fromF, 38, e); camera.updateProjectionMatrix();
    post.grade.uniforms.uFade.value = clamp((a.t - .78) / .22, 0, 1);
    if (a.t >= 1 && !S.waiting) { S.waiting = true; S.ready.then(() => { S.waiting = false; showStudio(); }); }
  } else if (S.mode === 'studio') {
    post.grade.uniforms.uFade.value = damp(post.grade.uniforms.uFade.value, 0, 6, dt);
    studio.update(dt);
  } else if (S.mode === 'fadeout') {
    const a = S.anim; a.t = Math.min(1, a.t + dt / a.dur);
    post.grade.uniforms.uFade.value = a.t; studio.update(dt);
    if (a.t >= 1) a.then();
  } else if (S.mode === 'unzoom') {
    const a = S.anim; a.t = Math.min(1, a.t + dt / a.dur);
    const e = ease(a.t);
    post.grade.uniforms.uFade.value = 1 - clamp(a.t / .35, 0, 1);
    S.y = a.back.y; S.pitch = a.back.pitch; S.yaw = a.back.yaw; S.fov = a.back.fov; S.v = 0;
    applyFallCamera();
    const toP = camera.position.clone(), toQ = camera.quaternion.clone();
    camera.position.lerpVectors(a.fromP, toP, e); camera.quaternion.slerpQuaternions(a.fromQ, toQ, e);
    if (a.t >= 1) { S.mode = 'fall'; S.input = 0; }
  }

  if (S.mode === 'fall' || S.mode === 'intro') applyFallCamera();

  // towers follow the camera's depth; rebasing shifts everything up together
  const camY = camera.position.y;
  const shift = towers.update(camY, S.look > 0 && S.mode === 'fall', dt);
  if (shift) { S.y += shift; camera.position.y += shift; if (S.lastFall) S.lastFall.y += shift; }
  lampLow.position.set(0, camera.position.y - 5, 0); lampHigh.position.set(0, camera.position.y + 4, 0);
  towers.uniforms.uSway.value = .012 + Math.min(Math.abs(S.v) / 25, 1) * .07;
  post.grade.uniforms.uSpeed.value = damp(post.grade.uniforms.uSpeed.value, Math.min(Math.abs(S.mode === 'fall' || S.mode === 'intro' ? S.v : 0) / 24, 1), 5, dt);

  if (S.mode === 'fall' && !CAPTURE && (S.pointerMoved || Math.abs(S.v) > .5) && S.t - S.lastPick > .05) {
    S.lastPick = S.t; S.pointerMoved = false;
    if (drag?.type !== 'touch') pickHover();
  }

  // HUD
  if (hud) {
    const f = towers.floorAt(camera.position.y);
    $('#depth').textContent = String(Math.max(0, f));
    $('#coll').textContent = collectionOf(Math.max(0, f)).name;
    const d = facingDept();
    if ($('#dept').textContent !== d.name) { $('#dept').textContent = d.name; document.querySelectorAll('#nav a').forEach((a, i) => a.classList.toggle('on', DEPARTMENTS[i] === d)); }
  }
  const tag = $('#tag');
  if (tag.classList.contains('on')) {
    tag.style.transform = `translate(${(S.pointer.x + 1) / 2 * innerWidth + 18}px, ${(1 - S.pointer.y) / 2 * innerHeight + 14}px)`;
  }
  if (render) post.render(dt);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (S.mode !== 'loading') step(dt);
  requestAnimationFrame(frame);
}

window.__ready = build().then(() => {
  if (!CAPTURE) requestAnimationFrame(frame);
  else { window.__step = (dt) => step(dt); window.__advance = (dt) => step(dt, false); window.__S = S; window.__post = post; window.__studio = studio; }
  document.body.classList.add('ready');
});
