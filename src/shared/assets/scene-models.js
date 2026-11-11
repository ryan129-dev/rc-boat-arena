// Scene delivery variants keep the complete library models at their original URLs.
// Only explicitly listed project models have a scene delivery variant.
export const SCENE_MODEL_VARIANTS = Object.fromEntries([
  'riva-aquarama',
].map(id => [`library/${id}/model.glb`, `runtime/${id}.glb`]));

export function sceneModelUrl(url, base = document.baseURI) {
  const absolute = new URL(url, base);
  const marker = '/assets/';
  const offset = absolute.pathname.lastIndexOf(marker);
  if (offset < 0) return absolute.href;
  const replacement = SCENE_MODEL_VARIANTS[absolute.pathname.slice(offset + marker.length)];
  if (replacement) absolute.pathname = absolute.pathname.slice(0, offset + marker.length) + replacement;
  return absolute.href;
}
