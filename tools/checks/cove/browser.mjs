// Run through Vite: /tools/checks/cove/browser.html. Exercise the real GLB,
// the single-boat download contract, motion and independently owned resources.
import * as THREE from 'three';
import { createSunnyCoveScene } from '../../../src/scene-assets/sunny-cove/index.js';
import { BOATS } from '../../../src/scene-assets/sunny-cove/config/boats.js';
import { modelBytes } from '../../../src/shared/assets/gltf.js';

const report = window.coveCheck = { status: 'running', passed: [], failures: [] };
const output = document.querySelector('#report');
const update = () => { output.textContent = JSON.stringify(report, null, 2); };
function check(condition, label) {
  if (!condition) throw new Error(label);
  report.passed.push(label); update();
}
const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#view'), antialias: false });
renderer.setSize(640, 400, false); renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.debug.onShaderError = () => { throw new Error('WebGL shader failed'); };
const originalRead = modelBytes.read, requested = [];
modelBytes.read = async (url, options) => { requested.push(url); return originalRead(url, options); };
const options = { renderer, assetBaseUrl: new URL('/assets/', location.href).href, quality: 'low' };
let asset, survivor;
const render = () => renderer.render(asset.scene, asset.camera);
const visibleHulls = () => asset.scene.children.filter(object => object.userData.boatId).length;
try {
  check(BOATS.length === 1 && BOATS[0].id === 'riva-aquarama', 'the production roster contains only Riva');
  asset = await createSunnyCoveScene(options);
  asset.resize(640, 400); await asset.detailReady; render();
  const sky = asset.environment.sky, originalSkyRender = sky.mesh.onBeforeRender, solarPasses = [];
  sky.mesh.onBeforeRender = function (renderer, scene, camera, ...args) {
    solarPasses.push({ main: camera === asset.camera, image: sky.material.uniforms.uSolarImage.value });
    originalSkyRender.call(this, renderer, scene, camera, ...args);
  };
  render(); sky.mesh.onBeforeRender = originalSkyRender;
  check(solarPasses.some(pass => !pass.main && pass.image === 0)
    && solarPasses.some(pass => pass.main && pass.image === 1)
    && sky.material.uniforms.uSolarImage.value === 1,
  'reflection omits the duplicate solar image and restores the main-view sun');
  check(asset.snapshot().boatId === 'riva-aquarama' && visibleHulls() === 1, 'default is exactly one real Riva');
  check(typeof asset.setBoat === 'undefined' && !asset.dock, 'scene exposes no boat switching or dock');
  check(asset.snapshot().detailState.status === 'ready', 'the complete scene is ready without deferred scenery');
  check(requested.length === 1 && requested[0].includes('/runtime/riva-aquarama.glb'),
    'startup downloads only the optimized Riva model');
  const visual = asset.boatVisual, dimensions = visual.dimensions, definition = BOATS[0];
  check(Math.abs(dimensions.beam - .738211833252415) < .0002
    && Math.abs(dimensions.height - .5632309079558888) < .0002,
  'complete hull dimensions match independent Riva GLB measurements');
  const bow = new THREE.Vector3(1, 0, 0).applyQuaternion(visual.mount.quaternion);
  check(bow.distanceTo(new THREE.Vector3(0, 0, -1)) < 1e-8
    && Math.abs(visual.mount.position.y + definition.draft) < 1e-8,
  'authored bow and waterline retain their calibrated orientation');
  check(asset.water.mesh.material.uniforms.uContactShape === asset.interaction.uniforms.uContactShape,
    'water shader references the Riva contact profile');
  check(asset.interaction.uniforms.uContactShape.value[2] === Math.fround(definition.contact.wakeStrength),
    'Riva uses its calibrated wake strength');
  const start = { ...asset.boat }, phases = new Set();
  let last = start, maxJump = 0;
  for (let frame = 0; frame < 90 * 60; frame++) {
    asset.update(1 / 60); phases.add(asset.boat.phase);
    maxJump = Math.max(maxJump, Math.hypot(asset.boat.x - last.x, asset.boat.z - last.z));
    last = { ...asset.boat }; if (frame % 600 === 0) render();
  }
  check(phases.size === 1 && phases.has('cruising') && maxJump < .025,
    'Riva cruises continuously without docking or position jumps');
  check(Math.hypot(asset.boat.x - start.x, asset.boat.z - start.z) < 1e-7,
    'the 90-second cruise closes without teleporting');
  check(requested.length === 1, 'a complete cruise triggers no background model requests');
  const frozen = JSON.stringify({ boat: asset.boat, interaction: asset.interaction.snapshot() });
  asset.update(0);
  check(JSON.stringify({ boat: asset.boat, interaction: asset.interaction.snapshot() }) === frozen,
    'zero elapsed time freezes the boat and wake');
  for (const mood of ['afternoon', 'sunset', 'bluehour']) { asset.setMood(mood, { immediate: true }); render(); }
  check(asset.state.mood === 'bluehour' && requested.length === 1,
    'all three palettes compile without downloading a sky or scenery model');
  const shadowTargetMatchesBoat = () => asset.environment.lights.sun.target.position
    .distanceTo(new THREE.Vector3(asset.boat.x, 0, asset.boat.z)) < 1e-8;
  check(shadowTargetMatchesBoat(), 'immediate mood changes keep the compact shadow centered on the boat');
  asset.setMood('afternoon'); asset.update(1 / 60); render();
  check(shadowTargetMatchesBoat(), 'a moving mood transition keeps the compact shadow centered on the boat');
  for (const camera of ['auto', 'waterline', 'follow', 'scenic', 'overview']) {
    asset.setCamera(camera, { immediate: true }); render();
  }
  check(asset.snapshot().camera.mode === 'overview', 'all five camera choices render');
  asset.reset();
  check(asset.interaction.snapshot().trail.count === 0 && asset.boat.phase === 'cruising',
    'reset clears the old wake and resumes the continuous cruise');
  survivor = await createSunnyCoveScene({ ...options, boatId: 'maverick-gt' });
  survivor.resize(640, 400); await survivor.detailReady;
  check(survivor.boatVisual.boatId === 'riva-aquarama', 'legacy boat IDs normalize to Riva without loading an old model');
  asset.dispose(); asset.dispose();
  survivor.update(1 / 60); renderer.render(survivor.scene, survivor.camera);
  check(!survivor.snapshot().disposed, 'disposing one scene leaves an independent Riva scene usable');
  survivor.dispose(); survivor = undefined;
  const empty = new THREE.Scene(), emptyCamera = new THREE.PerspectiveCamera();
  renderer.render(empty, emptyCamera);
  report.afterDisposal = { ...renderer.info.memory };
  check(renderer.info.memory.geometries === 0, 'disposing both scenes releases their GPU geometries');
  const memories = [];
  for (let cycle = 0; cycle < 3; cycle++) {
    asset = await createSunnyCoveScene(options); asset.resize(640, 400); render();
    memories.push({ ...renderer.info.memory }); asset.dispose(); renderer.render(empty, emptyCamera);
    check(renderer.info.memory.geometries === 0, `reopen cycle ${cycle + 1} releases geometry`);
  }
  report.reopenMemory = memories;
  check(memories.every(memory => memory.geometries === memories[0].geometries && memory.textures === memories[0].textures),
    'reopening the complete scene keeps GPU geometry and texture counts stable');
  check(requested.every(url => url.includes('/runtime/riva-aquarama.glb')),
    'all scene instances request only Riva');
  modelBytes.read = async () => { throw new Error('intentional Riva failure'); };
  let failed = false;
  try { await createSunnyCoveScene(options); } catch (error) { failed = error.message === 'intentional Riva failure'; }
  renderer.render(empty, emptyCamera);
  check(failed && renderer.info.memory.geometries === 0, 'failed model load rejects and releases partial scene resources');
  modelBytes.read = async (url, options) => { requested.push(url); return originalRead(url, options); };
  asset = await createSunnyCoveScene(options); asset.resize(640, 400); render();
  check(visibleHulls() === 1, 'a fresh scene recovers after a failed model load');
  asset.dispose();
  const abort = new AbortController(); abort.abort();
  let aborted = false, requestsBeforeAbort = requested.length;
  try { await createSunnyCoveScene({ ...options, signal: abort.signal }); } catch (error) { aborted = error.name === 'AbortError'; }
  check(aborted && requested.length === requestsBeforeAbort, 'an already cancelled scene starts no model request');
  report.requests = requested; report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failures.push(error.stack || String(error));
} finally {
  modelBytes.read = originalRead; asset?.dispose(); survivor?.dispose();
  renderer.dispose(); renderer.forceContextLoss(); update();
}
