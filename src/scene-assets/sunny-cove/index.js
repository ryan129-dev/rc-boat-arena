import * as THREE from 'three';
import { createSceneViewer } from '../../shared/viewing/viewer.js';
import { createBoatWaterInteraction } from '../boat-water-interaction/index.js';
import { createCoveEnvironment } from './environment.js';
import { createCoveWater } from './water.js';
import { createCoveBoat } from './boat.js';
import { createCoveNavigation, stepCoveNavigation, resetCoveNavigation } from './navigation.js';
import { createCoveCamera, CAMERA_MODES } from './camera.js';
import { MOODS } from './presets.js';
import { BOATS, DEFAULT_BOAT_ID, getBoatDefinition } from './config/boats.js';
import { COVE_TOUR } from './config/tour.js';

export { MOODS, CAMERA_MODES, BOATS, DEFAULT_BOAT_ID, COVE_TOUR };
export { createCoveWater, createCoveBoat, createCoveCamera, createCoveNavigation, createBoatWaterInteraction };

/** One boat, open water and sky. Renderer/RAF remain with the consumer. */
export async function createSunnyCoveScene({ renderer, assetBaseUrl, quality = 'balanced',
  signal, mood = 'afternoon', cameraMode = 'auto', reducedMotion = false, tour = COVE_TOUR } = {}) {
  if (!renderer || !assetBaseUrl) throw new Error('Sunny Cove requires renderer and assetBaseUrl');
  if (!Object.hasOwn(MOODS, mood)) throw new Error(`Unknown Sunny Cove mood: ${mood}`);
  // Ignore old saved boat IDs. This composition has a single asset and never switches models.
  const definition = getBoatDefinition(DEFAULT_BOAT_ID);
  signal?.throwIfAborted();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 1600);
  const water = createCoveWater(scene, { quality });
  const rig = createCoveCamera(camera, { ...tour.camera, reducedMotion });
  const state = { elapsed: 0, mood, boatId: DEFAULT_BOAT_ID,
    camera: reducedMotion && cameraMode === 'auto' ? 'scenic' : cameraMode };
  rig.setMode(state.camera);
  let environment, boatVisual, interaction, boat, disposed = false;
  const loading = new AbortController();
  const abort = () => loading.abort(signal?.reason);
  signal?.addEventListener('abort', abort, { once: true });
  function dispose() {
    if (disposed) return; disposed = true; loading.abort();
    signal?.removeEventListener('abort', abort);
    rig.dispose(); water.setInteraction(null); water.dispose(); interaction?.dispose();
    boatVisual?.dispose(); environment?.dispose();
  }
  try {
    const results = await Promise.allSettled([
      createCoveEnvironment(scene, { renderer, quality, mood, signal: loading.signal })
        .catch(error => { loading.abort(); throw error; }),
      createCoveBoat(scene, new URL(definition.path, assetBaseUrl).href, { signal: loading.signal, definition })
        .catch(error => { loading.abort(); throw error; }),
    ]);
    if (results[0].status === 'fulfilled') environment = results[0].value;
    if (results[1].status === 'fulfilled') boatVisual = results[1].value;
    signal?.throwIfAborted();
    const failed = results.find(result => result.status === 'rejected' && result.reason?.name !== 'AbortError')
      ?? results.find(result => result.status === 'rejected');
    if (failed) throw failed.reason;
    boat = createCoveNavigation(tour.navigation);
    interaction = createBoatWaterInteraction({ ...boatVisual.dimensions, ...definition.contact, sampleSurface: water.sampleSurface });
    water.setInteraction(interaction); rig.setBoatDimensions(boatVisual.dimensions);
    water.setMood(MOODS[mood], { immediate: true });
    interaction.reset(0, boat);
    boatVisual.update(0, 0, boat, interaction.pose); environment.update(0, 0, boat);
    water.update(0, boat); rig.snap(boat);
  } catch (error) { dispose(); throw error; }
  return {
    scene, camera, boat, state, environment, water, boatVisual, interaction,
    detailReady: Promise.resolve(),
    update(dt) {
      if (disposed) return;
      dt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, .05)) : 0;
      state.elapsed += dt;
      stepCoveNavigation(boat, dt);
      water.update(state.elapsed, boat); interaction.update(dt, state.elapsed, boat);
      boatVisual.update(dt, state.elapsed, boat, interaction.pose); environment.update(dt, state.elapsed, boat);
      rig.update(dt, state.elapsed, boat);
    },
    setMood(name, { immediate = false } = {}) {
      if (!Object.hasOwn(MOODS, name)) throw new Error(`Unknown Sunny Cove mood: ${name}`);
      state.mood = name;
      const preset = environment.setMood(name, { immediate });
      water.setMood(preset, { immediate }); return preset;
    },
    setCamera(name, { immediate = false } = {}) {
      rig.setMode(name); state.camera = rig.snapshot().mode;
      if (immediate) rig.snap(boat);
    },
    resize(width, height) { rig.resize(width, height); rig.snap(boat); water.resize(width, height); },
    reset() {
      resetCoveNavigation(boat); state.elapsed = 0;
      water.update(0, boat); interaction.reset(0, boat);
      boatVisual.update(0, 0, boat, interaction.pose); environment.update(0, 0, boat);
      rig.snap(boat);
    },
    snapshot() { return { ...state, boat: { ...boat }, dimensions: { ...boatVisual.dimensions },
      camera: rig.snapshot(), interaction: interaction.snapshot(),
      detailState: { status: 'ready', error: null }, disposed }; },
    dispose,
  };
}

/** Both the public page and local workbench use this exact host. */
export function createSunnyCoveViewer(options = {}) {
  return createSceneViewer({ ...options, mood: options.mood ?? 'afternoon',
    createScene: sceneOptions => createSunnyCoveScene({ ...sceneOptions, tour: options.tour }) });
}
