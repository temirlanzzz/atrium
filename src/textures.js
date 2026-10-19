// Procedural textures. Nothing is downloaded: every map is drawn on a canvas.
import * as THREE from 'three';

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, { repeat = 1, srgb = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Concrete / stone for tower piers: color and roughness from layered noise.
export function concrete() {
  if (cache.concrete) return cache.concrete;
  const s = 256, [c, x] = canvas(s);
  x.fillStyle = '#7d7a76'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) {
    const r = Math.random() * 3 + .4, v = 90 + Math.random() * 80;
    x.fillStyle = `rgba(${v},${v - 3},${v - 6},${Math.random() * .25})`;
    x.beginPath(); x.arc(Math.random() * s, Math.random() * s, r, 0, 7); x.fill();
  }
  // board-form lines
  for (let y = 0; y < s; y += 32) { x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(0, y, s, 1.5); }
  return (cache.concrete = tex(c, { srgb: true }));
}

// Soft round contact shadow for the studio floor.
export function radialShadow() {
  const [c, x] = canvas(256);
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,.75)'); g.addColorStop(.45, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  return t;
}
