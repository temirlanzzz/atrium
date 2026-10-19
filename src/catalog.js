// Deterministic, endless catalog: every window (floor, side, column) always
// shows the same product, so the infinite fall is browsable and shareable.

export const DEPARTMENTS = [
  { key: 'outer', name: 'Outerwear & Knit', color: '#b08d67', types: ['coat', 'coat', 'hoodie', 'sweater', 'tee', 'pants'] },
  { key: 'acc', name: 'Shoes & Accessories', color: '#8c949c', types: ['shoe', 'shoe', 'watch', 'sunglasses'] },
  { key: 'dress', name: 'Dresses & Couture', color: '#b9938f', types: ['dress', 'dress', 'corset'] },
  { key: 'home', name: 'Home', color: '#9a9a86', types: ['sofa', 'chair', 'damask', 'pouf', 'lamp'] }
];
export const GARMENTS = ['coat', 'hoodie', 'sweater', 'tee', 'dress', 'pants'];
export const isGarment = (t) => GARMENTS.includes(t);

// Each run of 9 floors is a seasonal edit with its own fabric palette.
const COLLECTIONS = [
  { name: 'Autumn Edit', colors: ['#6b4a34', '#c2a27c', '#2e2b29', '#8a6a52', '#d9cbb6', '#4a4f3a'] },
  { name: 'Coastal Linen', colors: ['#e8e3d8', '#b8b1a4', '#7e8a96', '#d6cfc2', '#3f4a55', '#a29a8d'] },
  { name: 'Charcoal Studies', colors: ['#2b2c2e', '#56585c', '#8c8d8f', '#1b1b1c', '#b6b4b0', '#3d3a36'] },
  { name: 'Terracotta', colors: ['#9c5a3c', '#c98f6b', '#5e3a2a', '#e3c7ab', '#7d6a55', '#b4734f'] },
  { name: 'Forest Wool', colors: ['#2f3b2f', '#55624a', '#a59f80', '#1f2621', '#7c7b5e', '#d8d2bd'] },
  { name: 'Porcelain', colors: ['#f1eee8', '#d9d3c9', '#a7a9ab', '#e6dccf', '#2a2b2d', '#c3b6a5'] }
];
const DENIM = ['#2c3e5c', '#40567a', '#1d2638', '#6b7f9e', '#262729', '#bfc3c8'];

const NAMES = {
  coat: { n: ['Overcoat', 'Trench Coat', 'Car Coat', 'Wrap Coat', 'Chesterfield'], m: ['Wool-Twill', 'Cotton-Gabardine', 'Cashmere-Blend', 'Melton Wool', 'Double-Faced Wool'] },
  hoodie: { n: ['Hoodie', 'Zip-Up Hoodie'], m: ['Cotton-Jersey', 'Loopback Cotton', 'Brushed Fleece'] },
  sweater: { n: ['Sweater', 'Crewneck Sweater', 'Ribbed Sweater'], m: ['Merino Wool', 'Cashmere', 'Alpaca-Blend', 'Lambswool'] },
  tee: { n: ['T-Shirt', 'Boxy T-Shirt', 'Pocket T-Shirt'], m: ['Organic Cotton-Jersey', 'Supima Cotton', 'Slub Cotton'] },
  dress: { n: ['Slip Dress', 'Midi Dress', 'Column Dress', 'Maxi Dress'], m: ['Silk-Satin', 'Crepe', 'Linen-Blend', 'Washed Silk'] },
  pants: { n: ['Straight-Leg Jeans', 'Wide-Leg Trousers', 'Pleated Trousers'], m: ['Selvedge Denim', 'Rigid Denim', 'Wool-Twill', 'Cotton-Drill'] }
};
const BRANDS = ['Atrium Studio', 'Maison Lune', 'Nord & Field', 'Ateliers Vaux', 'Common Hours', 'Sable'];
const SCAN_PRODUCTS = {
  shoe: { name: 'Knit Runner Sneakers', brand: 'Shopify Lab', price: 145, desc: 'A lightweight knit upper on a cushioned foam sole, with a padded collar and a pull tab at the heel.' },
  watch: { name: 'Chronograph Dive Watch', brand: 'DGG Horology', price: 1290, desc: 'A 46 mm stainless-steel case with a quilted strap, screw-down crown and a three-register chronograph.' },
  sunglasses: { name: 'Aviator Sunglasses', brand: 'Khronos Optics', price: 240, desc: 'Lightweight metal aviators with iridescent mirrored lenses and acetate temple tips.' },
  corset: { name: 'Brocade Lace-Up Corset', brand: 'Ateliers Vaux', price: 680, desc: 'Steel-boned brocade with a lace-up back, a velvet trim and a matching choker, shown on a linen dress form.' },
  sofa: { name: 'Glam Velvet Sofa', brand: 'Wayfair Home', price: 1890, desc: 'A curved three-seat sofa in plush cotton velvet, on tapered brass-capped legs.' },
  chair: { name: 'Tufted Velvet Loveseat', brand: 'Wayfair Home', price: 640, desc: 'A button-tufted settee in performance velvet on solid walnut legs.' },
  damask: { name: 'Damask Accent Bench', brand: 'Wayfair Home', price: 520, desc: 'Purple and gold damask upholstery on a tufted seat with splayed oak legs.' },
  pouf: { name: 'Pleated Silk Pouf', brand: 'Wayfair Home', price: 320, desc: 'A round pouf wrapped in hand-pleated silk with a covered centre button.' },
  lamp: { name: 'Iridescent Glass Table Lamp', brand: 'Wayfair Home', price: 210, desc: 'An iridescent glass base with a linen drum shade and a brushed-nickel neck.' }
};
const PRICE = { coat: [290, 890], hoodie: [95, 180], sweater: [140, 420], tee: [45, 90], dress: [180, 560], pants: [120, 320] };
const DESC = {
  coat: 'Cut long and easy through the shoulder, with horn buttons, a storm flap and a self-tie belt.',
  hoodie: 'Heavyweight loopback cotton with a double-layer hood and ribbed cuffs that keep their shape.',
  sweater: 'Fully fashioned in a 12-gauge knit, with a ribbed crew neck, cuffs and hem.',
  tee: 'A dense jersey T-shirt with taped shoulders and a rib collar that will not stretch out.',
  dress: 'Cut on the bias so it skims rather than clings, with fine adjustable straps and a narrow sash.',
  pants: 'A high-rise straight leg in a heavy cloth, made long to stack softly at the ankle.'
};

function hash(...n) {
  let h = 2166136261;
  for (const v of n) { h ^= v + 0x9e3779b9; h = Math.imul(h, 16777619); h ^= h >>> 13; }
  return h >>> 0;
}
function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const pick = (r, a) => a[Math.floor(r() * a.length)];

export const collectionOf = (floor) => COLLECTIONS[((Math.floor(floor / 9) % COLLECTIONS.length) + COLLECTIONS.length) % COLLECTIONS.length];

// variantNames: colourway names per scan key, filled in once the models load.
export const variantNames = {};

export function productAt(floor, side, col) {
  const r = rng(hash(floor, side, col));
  const dept = DEPARTMENTS[side], type = pick(r, dept.types);
  const id = `${String(Math.abs(floor)).padStart(3, '0')}-${side}${col}`;
  const base = { id, floor, side, col, type, dept, collection: collectionOf(floor).name, stacks: [pick(r, collectionOf(floor).colors), pick(r, collectionOf(floor).colors)], extra: r() };
  if (SCAN_PRODUCTS[type]) {
    const sp = SCAN_PRODUCTS[type], names = variantNames[type] || [];
    const variant = names.length ? Math.floor(r() * names.length) : 0;
    return { ...base, ...sp, variant, swatches: names, scan: true };
  }
  const w = NAMES[type];
  const palette = type === 'pants' && r() < .6 ? DENIM : collectionOf(floor).colors;
  const color = pick(r, palette);
  const [lo, hi] = PRICE[type];
  const swatches = [color, ...[0, 1, 2].map(() => pick(r, palette))].filter((c, i, a) => a.indexOf(c) === i);
  return { ...base, color, swatches, price: Math.round((lo + r() * (hi - lo)) / 10) * 10 - 5, brand: pick(r, BRANDS), name: `${pick(r, w.m)} ${pick(r, w.n)}`, desc: DESC[type], scan: false };
}
