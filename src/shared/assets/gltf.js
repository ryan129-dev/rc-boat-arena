import { createBinaryCache } from './binary-cache.js';
import { disposeObjects } from '../rendering/resources.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { sceneModelUrl } from './scene-models.js';

export const modelBytes = createBinaryCache();
// This module is already behind the workbench's optional 3D entry. Make the
// parser a normal dependency so Vite preloads it with the public scene instead
// of discovering another blocking request after the engine starts executing.
let loader;
function getLoader() {
  return loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
}
// Every consumer owns its parsed scene. Source bytes and parser code are reused;
// transforms/material edits and disposal in one viewer cannot corrupt another.
export async function loadGLTF(url, { signal, onProgress, delivery = 'full' } = {}) {
  const absolute = delivery === 'scene' ? sceneModelUrl(url) : new URL(url, document.baseURI).href;
  const parser = getLoader();
  const data = await modelBytes.read(absolute, { signal, onProgress });
  signal?.throwIfAborted();
  let gltf;
  try { gltf = await parser.parseAsync(data, new URL('.', absolute).href); }
  catch (error) { modelBytes.clear(absolute); throw error; }
  if (signal?.aborted) { disposeObjects(gltf.scenes); signal.throwIfAborted(); }
  return gltf;
}
