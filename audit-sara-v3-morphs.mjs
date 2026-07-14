// B2.0.1 — READ-ONLY morph inventory dump for sara-v3.glb.
// Does not modify the GLB or any app code.
// Run from repo root in WSL:  node audit-sara-v3-morphs.mjs
// Output: docs/sara-v3-morph-inventory.raw.json
import fs from 'node:fs';

const FILE = 'apps/web/public/avatars/sara-v3.glb';
const OUT = 'docs/sara-v3-morph-inventory.raw.json';

const d = fs.readFileSync(FILE);
if (d.readUInt32LE(0) !== 0x46546c67) throw new Error(FILE + ': not a GLB');
const jsonLen = d.readUInt32LE(12);
const gltf = JSON.parse(d.subarray(20, 20 + jsonLen).toString('utf8'));

const meshes = (gltf.meshes || []).map((mesh, mi) => {
  const targetNames = (mesh.extras || {}).targetNames || null;
  return {
    index: mi,
    name: mesh.name,
    primitives: mesh.primitives.map((p, pi) => ({
      prim: pi,
      material: p.material != null ? (gltf.materials[p.material] || {}).name : null,
      morphTargetCount: (p.targets || []).length,
    })),
    // Per-prim weights/names: glTF puts targetNames on mesh.extras (shared by prims)
    targetNames,
    weights: mesh.weights ? mesh.weights.length : 0,
  };
});

const allNames = [...new Set(meshes.flatMap((m) => m.targetNames || []))].sort();

const result = {
  file: FILE,
  sizeMB: +(d.length / 1e6).toFixed(2),
  generatedAt: new Date().toISOString(),
  meshCount: meshes.length,
  meshes,
  uniqueMorphNames: allNames,
  uniqueMorphCount: allNames.length,
  // Sanity flags for the wired set
  wiredCheck: Object.fromEntries(
    [
      'viseme_rest','viseme_AA','viseme_IH','viseme_O','viseme_S','viseme_PP',
      'viseme_CH','viseme_E','jawOpen','eyeBlinkLeft','eyeBlinkRight',
    ].map((n) => [n, allNames.includes(n)])
  ),
};

fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log('Wrote ' + OUT + ' — ' + allNames.length + ' unique morph names across ' + meshes.length + ' meshes.');
