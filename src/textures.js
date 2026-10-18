// Procedural textures. Nothing is downloaded: every map is drawn on a canvas.
import * as THREE from 'three';

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

// Turn a grayscale height canvas into a tangent-space normal map.
function heightToNormal(src, strength = 2) {
  const w = src.width, h = src.height;
  const hd = src.getContext('2d').getImageData(0, 0, w, h).data;
  const [c, x] = canvas(w, h);
  const out = x.createImageData(w, h);
  const H = (i, j) => hd[(((j + h) % h) * w + ((i + w) % w)) * 4] / 255;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const dx = (H(i + 1, j) - H(i - 1, j)) * strength;
    const dy = (H(i, j + 1) - H(i, j - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), k = (j * w + i) * 4;
    out.data[k] = (-dx / l * 0.5 + 0.5) * 255;
    out.data[k + 1] = (dy / l * 0.5 + 0.5) * 255;
    out.data[k + 2] = (1 / l * 0.5 + 0.5) * 255;
    out.data[k + 3] = 255;
  }
  x.putImageData(out, 0, 0);
  return c;
}

function tex(c, { repeat = 1, srgb = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Fabric weaves, drawn as height fields. One tile covers ~2 cm of cloth.
const weaves = {
  weave(x, s) { // plain weave: alternating over/under yarns
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
      const over = (i + j) % 2 === 0, g = x.createLinearGradient(0, 0, over ? s / 8 : 0, over ? 0 : s / 8);
      const px = i * s / 8, py = j * s / 8;
      x.fillStyle = over ? '#d8d8d8' : '#8a8a8a';
      x.fillRect(px, py, s / 8, s / 8);
      g.addColorStop(0, 'rgba(0,0,0,.35)'); g.addColorStop(.5, 'rgba(255,255,255,.15)'); g.addColorStop(1, 'rgba(0,0,0,.35)');
      x.fillStyle = g; x.save(); x.translate(px, py); x.fillRect(0, 0, s / 8, s / 8); x.restore();
    }
  },
  knit(x, s) { // stockinette: columns of V stitches
    x.fillStyle = '#404040'; x.fillRect(0, 0, s, s);
    const cw = s / 6, ch = s / 8;
    for (let j = 0; j < 9; j++) for (let i = 0; i < 6; i++) for (const side of [-1, 1]) {
      const cx = i * cw + cw / 2, cy = j * ch;
      const g = x.createRadialGradient(cx + side * cw * .2, cy, 1, cx + side * cw * .2, cy, cw * .45);
      g.addColorStop(0, '#f0f0f0'); g.addColorStop(1, 'rgba(64,64,64,0)');
      x.fillStyle = g;
      x.save(); x.translate(cx + side * cw * .22, cy); x.rotate(side * .55); x.scale(.55, 1.2);
      x.beginPath(); x.arc(0, 0, cw * .42, 0, Math.PI * 2); x.fill(); x.restore();
    }
  },
  denim(x, s) { // 3/1 twill: diagonal ridges
    x.fillStyle = '#707070'; x.fillRect(0, 0, s, s);
    x.lineWidth = s / 18;
    for (let k = -s; k < 2 * s; k += s / 6) {
      const g = x.createLinearGradient(k, 0, k + s / 12, 0);
      x.strokeStyle = '#e0e0e0'; x.globalAlpha = .7;
      x.beginPath(); x.moveTo(k, 0); x.lineTo(k + s, s); x.stroke();
    }
    x.globalAlpha = 1;
  },
  jersey(x, s) { // fine knit with slub noise
    weaves.knit(x, s);
    const id = x.getImageData(0, 0, s, s);
    for (let i = 0; i < id.data.length; i += 4) { const n = (Math.random() - .5) * 40; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; }
    x.putImageData(id, 0, 0);
  },
  rib(x, s) { // vertical ribs for cuffs and sweaters
    for (let i = 0; i < s; i++) {
      const v = 128 + 110 * Math.sin(i / s * Math.PI * 2 * 4);
      x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(i, 0, 1, s);
    }
  }
};

const cache = {};
export function fabricNormal(kind = 'weave') {
  if (cache[kind]) return cache[kind];
  const [c, x] = canvas(128);
  weaves[kind](x, 128);
  // Soft blur so mip levels average to a calm cloth sheen instead of moiré.
  const [b, bx] = canvas(128);
  bx.filter = 'blur(0.6px)'; bx.drawImage(c, 0, 0);
  return (cache[kind] = tex(heightToNormal(b, kind === 'rib' ? 3 : 4)));
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

// Polished terrazzo for bay floors.
export function terrazzo() {
  if (cache.terrazzo) return cache.terrazzo;
  const s = 256, [c, x] = canvas(s);
  x.fillStyle = '#cfc8bd'; x.fillRect(0, 0, s, s);
  const chips = ['#8c8478', '#e9e4dc', '#5c564e', '#b9a68c', '#a7aeb3'];
  for (let i = 0; i < 900; i++) {
    x.fillStyle = chips[i % chips.length];
    x.save(); x.translate(Math.random() * s, Math.random() * s); x.rotate(Math.random() * 3);
    x.fillRect(0, 0, Math.random() * 5 + 1, Math.random() * 4 + 1); x.restore();
  }
  return (cache.terrazzo = tex(c, { srgb: true }));
}

// Vertical neon department sign for the tower corners.
export function signTexture(text, color) {
  const [c, x] = canvas(128, 2048);
  x.fillStyle = '#000'; x.fillRect(0, 0, 128, 2048);
  x.save(); x.translate(64, 1024); x.rotate(-Math.PI / 2);
  x.font = '600 84px "Helvetica Neue", Arial, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.letterSpacing = '28px';
  x.shadowColor = color; x.shadowBlur = 24;
  x.fillStyle = color; x.fillText(text, 0, 4);
  x.shadowBlur = 0; x.fillStyle = '#fff'; x.globalAlpha = .85; x.fillText(text, 0, 4);
  x.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Equirect sky: overcast silver clouds above, bottomless black below.
export function skyTexture() {
  const w = 1024, h = 512, [c, x] = canvas(w, h);
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#d9dde3'); g.addColorStop(.25, '#9aa3ae'); g.addColorStop(.45, '#2b3038');
  g.addColorStop(.52, '#07080b'); g.addColorStop(1, '#000');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const cx = Math.random() * w, cy = Math.pow(Math.random(), 1.6) * h * .42, r = 20 + Math.random() * 90;
    const v = 140 + Math.random() * 110, cg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    cg.addColorStop(0, `rgba(${v},${v + 4},${v + 10},.22)`); cg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = cg; x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
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
