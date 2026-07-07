// Compare-only: sara-v3-old.glb (old) vs sara-v3.glb (new, with eyelashes).
// Run from repo root in WSL:  node replace-sara.mjs
import fs from 'node:fs';

const OLD = 'apps/web/public/avatars/sara-v3-old.glb';
const NEW = 'apps/web/public/avatars/sara-v3.glb';

function parseGlb(file) {
  const d = fs.readFileSync(file);
  if (d.readUInt32LE(0) !== 0x46546c67) throw new Error(file + ': not a GLB');
  const jsonLen = d.readUInt32LE(12);
  return { size: d.length, gltf: JSON.parse(d.subarray(20, 20 + jsonLen).toString('utf8')) };
}

function report(label, file) {
  const { size, gltf } = parseGlb(file);
  console.log(`\n===== ${label}: ${file} (${(size / 1e6).toFixed(2)} MB) =====`);
  console.log('--- materials ---');
  (gltf.materials || []).forEach((m, i) => {
    const ext = Object.keys(m.extensions || {}).join(',') || '-';
    console.log(`${i}: ${m.name} | alpha:${m.alphaMode || 'OPAQUE'} | 2sided:${!!m.doubleSided} | ext:${ext}`);
  });
  console.log('--- meshes ---');
  (gltf.meshes || []).forEach((mesh, mi) => {
    console.log(`mesh ${mi}: ${mesh.name} (${mesh.primitives.length} prims)`);
    mesh.primitives.forEach((p, pi) => {
      const mat = p.material != null ? gltf.materials[p.material].name : 'none';
      console.log(`  prim ${pi}: mat=${mat} | morphs=${(p.targets || []).length}`);
    });
    const names = (mesh.extras || {}).targetNames;
    if (names) console.log(`  targetNames (${names.length}): ${names.join(', ')}`);
  });
  return gltf;
}

const oldG = report('OLD', OLD);
const newG = report('NEW', NEW);

const oldMats = new Set((oldG.materials || []).map(m => m.name));
const newMats = new Set((newG.materials || []).map(m => m.name));
console.log('\n===== DIFF =====');
console.log('materials removed:', [...oldMats].filter(n => !newMats.has(n)).join(', ') || 'none');
console.log('materials added:  ', [...newMats].filter(n => !oldMats.has(n)).join(', ') || 'none');
