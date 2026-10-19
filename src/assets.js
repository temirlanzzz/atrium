// Real-world assets: Khronos sample scans (see CREDITS.md), an HDRI sky and
// photographed wood. Each scan is normalised to a real size, keeps its
// KHR_materials_variants colourways, and can be instanced per sub-mesh.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// name → target size along its largest axis (m), and how to stand it up.
export const SCANS = {
  shoe: { file: 'MaterialsVariantsShoe', size: .3 },
  sunglasses: { file: 'SunglassesKhronos', size: .16 },
  watch: { file: 'ChronographWatch', size: .075 },
  corset: { file: 'Corset', height: 1.55 },
  sofa: { file: 'GlamVelvetSofa', size: 2.05 },
  chair: { file: 'SheenChair', size: .83 },
  damask: { file: 'ChairDamaskPurplegold', size: .83 },
  pouf: { file: 'SpecularSilkPouf', size: .62 },
  lamp: { file: 'IridescenceLamp', height: .52 },
  plant: { file: 'DiffuseTransmissionPlant', height: .9 },
  vases: { file: 'GlassVaseFlowers', size: .3 }
};

const manager = new THREE.LoadingManager();
const gltf = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);
const tex = new THREE.TextureLoader(manager);
export const onProgress = (fn) => { manager.onProgress = (_, done, total) => fn(done / total); };

function texture(url, { srgb = false, repeat = 1 } = {}) {
  const t = tex.load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function loadEnvironment(renderer) {
  const hdr = await new HDRLoader(manager).loadAsync('./hdr/quarry_01_1k.hdr');
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  return { sky: hdr, env: pmrem.fromEquirectangular(hdr).texture, pmrem };
}

export const textures = {
  oak: () => texture('./tex/hardwood2_diffuse.jpg', { srgb: true }),
  oakRough: () => texture('./tex/hardwood2_roughness.jpg'),
  fabricNormal: () => texture('./tex/fabric_normal.png'),
  fabricORM: () => texture('./tex/fabric_orm.png')
};

// Read KHR_materials_variants: for every mesh, the material to use per variant.
async function readVariants(g) {
  const ext = g.parser.json.extensions?.KHR_materials_variants;
  if (!ext) return { names: [], byMesh: new Map() };
  const byMesh = new Map();
  const jobs = [];
  g.scene.traverse((o) => {
    if (!o.isMesh) return;
    const a = g.parser.associations.get(o);
    const prim = a && g.parser.json.meshes[a.meshes]?.primitives[a.primitives ?? 0];
    const maps = prim?.extensions?.KHR_materials_variants?.mappings;
    if (!maps) return;
    const list = new Array(ext.variants.length).fill(o.material);
    for (const m of maps) jobs.push(g.parser.getDependency('material', m.material).then((mat) => { for (const v of m.variants) list[v] = mat; }));
    byMesh.set(o, list);
  });
  await Promise.all(jobs);
  return { names: ext.variants.map((v) => v.name), byMesh };
}

// Meshopt output stores positions/normals as normalised integers; baking a
// transform into those would clip, so copy them out as plain floats first.
function toFloat(src) {
  const g = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(src.attributes)) {
    if (name === 'position' || name === 'normal' || name === 'tangent') {
      const out = new Float32Array(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
      g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
    } else g.setAttribute(name, a);
  }
  if (src.index) g.setIndex(src.index);
  g.groups = src.groups.slice();
  return g;
}

// A scan as a list of parts {geometry, material(s) per variant}, already in
// normalised product space: centred on x/z, resting on y = 0, real size.
export async function loadScan(key, { lod = false } = {}) {
  const spec = SCANS[key];
  const g = await gltf.loadAsync(`./models/${lod ? 'lod/' : ''}${spec.file}.glb`);
  const variants = await readVariants(g);
  const root = g.scene;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
  const s = spec.height ? spec.height / size.y : spec.size / Math.max(size.x, size.y, size.z);
  const norm = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2));
  const parts = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const geometry = toFloat(o.geometry).applyMatrix4(new THREE.Matrix4().multiplyMatrices(norm, o.matrixWorld));
    const mats = variants.byMesh.get(o) || [o.material];
    parts.push({ geometry, materials: mats });
  });
  return { key, parts, variants: variants.names, size: size.multiplyScalar(s), scene: root, norm };
}

// A standalone, fully featured copy for the product page (transmission etc. intact).
export function scanObject(scan, variant = 0) {
  const group = new THREE.Group();
  for (const p of scan.parts) {
    const m = new THREE.Mesh(p.geometry, p.materials[Math.min(variant, p.materials.length - 1)]);
    m.castShadow = m.receiveShadow = true; group.add(m);
  }
  group.userData.setVariant = (v) => group.children.forEach((m, i) => { const mats = scan.parts[i].materials; m.material = mats[Math.min(v, mats.length - 1)]; });
  return group;
}

// Cheaper materials for hundreds of instanced copies: transmission (which costs
// a whole extra scene render) becomes plain reflective glass.
const cheapCache = new Map();
export function cheap(mat) {
  if (cheapCache.has(mat)) return cheapCache.get(mat);
  let m = mat;
  if (mat.transmission > 0) {
    m = mat.clone();
    m.transmission = 0; m.transparent = true; m.opacity = .28; m.depthWrite = false; m.roughness = Math.min(m.roughness, .1);
  }
  cheapCache.set(mat, m);
  return m;
}

// One InstancedMesh per part (and per variant) so a scan can fill hundreds of windows.
export class ScanInstancer {
  constructor(scan, capacity, parent) {
    this.scan = scan; this.sets = [];
    const nv = Math.max(1, scan.variants.length);
    for (let v = 0; v < nv; v++) {
      const meshes = scan.parts.map((p) => {
        const m = new THREE.InstancedMesh(p.geometry, cheap(p.materials[Math.min(v, p.materials.length - 1)]), capacity);
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0;
        parent.add(m); return m;
      });
      this.sets.push({ meshes, n: 0 });
    }
  }
  reset() { this.sets.forEach((s) => { s.n = 0; }); }
  add(matrix, variant = 0) {
    const s = this.sets[variant % this.sets.length];
    for (const m of s.meshes) m.setMatrixAt(s.n, matrix);
    s.n++;
  }
  commit() {
    for (const s of this.sets) for (const m of s.meshes) { m.count = s.n; m.instanceMatrix.needsUpdate = true; }
  }
}
