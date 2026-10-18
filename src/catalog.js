// Deterministic, endless catalog: every window (floor, side, column) always
// shows the same product, so the infinite fall is browsable and shareable.

export const DEPARTMENTS = [
  { key: 'outer', name: 'Outerwear', sign: 'OUTERWEAR', color: '#ffb36b', types: ['coat', 'coat', 'hoodie'] },
  { key: 'knit', name: 'Knit & Jersey', sign: 'KNIT · JERSEY', color: '#9fd3ff', types: ['sweater', 'tee', 'tee', 'sweater'] },
  { key: 'dress', name: 'Dresses', sign: 'DRESSES', color: '#ff8fb8', types: ['dress'] },
  { key: 'denim', name: 'Denim & Trousers', sign: 'DENIM · TROUSERS', color: '#b8f5c8', types: ['pants'] }
];

// Each run of 9 floors is a collection with its own palette.
const COLLECTIONS = [
  { name: 'Slate & Ember', colors: ['#2d3038', '#8c3b2a', '#c7b8a3', '#1b1c20', '#a0662f', '#e8e2d6'] },
  { name: 'Glacier', colors: ['#dfe7ee', '#7f97ab', '#2f4558', '#b9c9d4', '#f5f6f2', '#40525f'] },
  { name: 'Terracotta Sun', colors: ['#b5532f', '#e2a36b', '#5b3424', '#f1d9b8', '#8a6f4f', '#d97a4d'] },
  { name: 'Night Garden', colors: ['#1f3328', '#3f5e3a', '#c4b27a', '#121a16', '#7a8f5a', '#e6e0c8'] },
  { name: 'Porcelain', colors: ['#f2efe9', '#c9c3b8', '#8e98a3', '#e7d9cc', '#1f2226', '#b7a99a'] },
  { name: 'Ultraviolet', colors: ['#2b1d4f', '#6c4ab6', '#d6c8ff', '#141021', '#9c7bd8', '#efe8ff'] },
  { name: 'Desert Road', colors: ['#c8a777', '#7d5a3a', '#efe2c8', '#3b2c22', '#a88a5c', '#59483a'] },
  { name: 'Harbour', colors: ['#1d2c44', '#3c5a80', '#c9d3df', '#0f1626', '#88a1bf', '#e4e9ef'] }
];
const DENIM = ['#2b3d63', '#3d5584', '#1c2640', '#6b84ad', '#23252b', '#c9ccd2'];

const WORDS = {
  coat: { n: ['Trench', 'Overcoat', 'Car Coat', 'Wrap Coat', 'Duster', 'Balmacaan'], m: ['Wool', 'Gabardine', 'Cashmere', 'Waxed Cotton', 'Melton'] },
  hoodie: { n: ['Hoodie', 'Zip Hood', 'Fleece Hood'], m: ['Loopback', 'Heavyweight', 'Brushed', 'Organic'] },
  sweater: { n: ['Crewneck', 'Sweater', 'Jumper', 'Knit'], m: ['Merino', 'Lambswool', 'Cashmere', 'Alpaca', 'Cotton Cable'] },
  tee: { n: ['Tee', 'Boxy Tee', 'Pocket Tee', 'Heavy Tee'], m: ['Supima', 'Slub', 'Pima', 'Garment-Dyed'] },
  dress: { n: ['Slip Dress', 'Midi Dress', 'Column Dress', 'Bias Dress', 'Sundress'], m: ['Silk', 'Satin', 'Crêpe', 'Linen', 'Viscose'] },
  pants: { n: ['Straight Jean', 'Wide Trouser', 'Carpenter', 'Pleated Trouser', 'Selvedge Jean'], m: ['Rigid', 'Selvedge', 'Twill', 'Washed', 'Raw'] }
};
const ADJ = ['Archive', 'Studio', 'Field', 'Quiet', 'Atelier', 'Nomad', 'Column', 'Pale', 'Dusk', 'Signal', 'Fold', 'North'];
const PRICE = { coat: [240, 690], hoodie: [85, 160], sweater: [110, 340], tee: [38, 75], dress: [140, 420], pants: [95, 260] };
const DESC = {
  coat: 'Cut long and easy through the shoulder, with a storm flap, horn buttons and a self-belt that ties or buckles.',
  hoodie: 'A heavyweight loopback hood with a double-layer hood, kangaroo pocket and ribbed cuffs that hold their shape.',
  sweater: 'Fully fashioned on a 12-gauge machine, with a rib-knit crew neck, cuffs and hem.',
  tee: 'A dense jersey tee with a tubular body, taped shoulders and a rib collar that does not stretch out.',
  dress: 'Cut on the bias so it skims rather than clings, with fine adjustable straps and a narrow sash at the waist.',
  pants: 'A high-rise straight leg from 14 oz cloth, with a long inseam made to stack softly at the ankle.'
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

export function productAt(floor, side, col) {
  const r = rng(hash(floor, side, col));
  const dept = DEPARTMENTS[side], type = pick(r, dept.types), w = WORDS[type];
  const palette = type === 'pants' && r() < .7 ? DENIM : collectionOf(floor).colors;
  const color = pick(r, palette);
  const [lo, hi] = PRICE[type];
  const price = Math.round((lo + r() * (hi - lo)) / 5) * 5 - 1;
  const swatches = [color, ...[0, 1, 2].map(() => pick(r, palette))].filter((c, i, a) => a.indexOf(c) === i);
  return {
    id: `${String(Math.abs(floor)).padStart(3, '0')}-${side}${col}`,
    floor, side, col, type, dept, color, swatches, price,
    name: `${pick(r, ADJ)} ${pick(r, w.m)} ${pick(r, w.n)}`,
    desc: DESC[type],
    collection: collectionOf(floor).name,
    // set dressing for the side shelves of this window
    stacks: [pick(r, palette), pick(r, palette)],
    shoe: pick(r, ['#f2efe9', '#1d1d1f', '#7a4b2a', '#c9b79c', '#2b3d63']),
    bag: r() < .45 ? pick(r, ['#5a3522', '#151515', '#c9a27a', '#8b1e2c', '#e8e2d6']) : null
  };
}
