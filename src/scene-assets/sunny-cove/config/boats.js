// Pure metadata for the single curated boat, without Three.js.
// Paths are relative to the scene's assetBaseUrl; the shared loader selects the
// optimized scene variant. Length and draft are display settings in metres,
// not specifications of the real vessels. Local navigation points toward -Z.
export const DEFAULT_BOAT_ID = 'riva-aquarama';

export const BOATS = Object.freeze([
  Object.freeze({
    id: 'riva-aquarama',
    label: 'Riva Aquarama',
    subtitle: '桃花心木经典游艇',
    path: 'library/riva-aquarama/model.glb',
    length: 2.4,
    draft: 0.11,
    forward: '+X',
    yaw: Math.PI / 2,
    finish: 'riva-varnish',
    contact: Object.freeze({ sternWidth: 0.79, bowTaper: 0.58, sternOffset: 0.44, wakeStrength: 1 }),
  }),
]);

/** Reject stale or misspelled IDs; callers decide whether to restore a default. */
export function getBoatDefinition(id) {
  if (typeof id !== 'string' || !id) throw new TypeError('Boat ID must be a non-empty string');
  const definition = BOATS.find(boat => boat.id === id);
  if (!definition) throw new RangeError(`Unknown Sunny Cove boat: ${id}`);
  return definition;
}
