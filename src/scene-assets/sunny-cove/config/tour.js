// Metres / seconds. A continuous water tour with no stopping or berth.
export const COVE_TOUR = Object.freeze({
  navigation: Object.freeze({ travelDuration: 90, dwellDuration: 0, startProgress: .104, continuous: true }),
  camera: Object.freeze({ holdDuration: 20, transitionDuration: 12 }),
});

/** Align an authored route to the dock's actual world berth and bow direction. */
export function routeAtBerth(route, { position, heading }) {
  if (![position?.x, position?.z, heading].every(Number.isFinite))
    throw new TypeError('A finite berth position and heading are required');
  const [origin, handle] = route[0];
  const authoredHeading = Math.atan2(-(handle[0] - origin[0]), -(handle[1] - origin[1]));
  const angle = heading - authoredHeading, cos = Math.cos(angle), sin = Math.sin(angle);
  return route.map(segment => segment.map(([x, z]) => {
    const dx = x - origin[0], dz = z - origin[1];
    return [position.x + dx * cos + dz * sin, position.z - dx * sin + dz * cos];
  }));
}
