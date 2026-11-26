const PARIS_SECOND = Object.freeze({ lat: 48.8693, lng: 2.3411 });

function point(latOffset, lngOffset) {
  return {
    lat: Number((PARIS_SECOND.lat + latOffset).toFixed(6)),
    lng: Number((PARIS_SECOND.lng + lngOffset).toFixed(6)),
  };
}

export function createRoute(index) {
  const offset = index * 0.00015;
  const suffix = String(index + 1).padStart(3, '0');

  return {
    routeId: `route-${suffix}`,
    coordinates: [
      point(-0.001 + offset, -0.002),
      point(0.001 + offset, -0.002),
      point(0.001 + offset, 0.002),
      point(-0.001 + offset, 0.002),
    ],
  };
}
