export const DEFAULT_OSRM_BASE_URL = 'https://router.project-osrm.org';

const ROUTE_WAYPOINTS = Object.freeze([
  [[48.8685, 2.3415], [48.8635, 2.3370], [48.8575, 2.3410], [48.8565, 2.3540], [48.8685, 2.3415]],
  [[48.8685, 2.3415], [48.8565, 2.3540], [48.8575, 2.3410], [48.8635, 2.3370], [48.8685, 2.3415]],
  [[48.8685, 2.3450], [48.8635, 2.3405], [48.8575, 2.3445], [48.8565, 2.3575], [48.8685, 2.3450]],
  [[48.8705, 2.3415], [48.8655, 2.3370], [48.8595, 2.3410], [48.8585, 2.3540], [48.8705, 2.3415]],
  [[48.8670, 2.3390], [48.8620, 2.3345], [48.8560, 2.3385], [48.8550, 2.3515], [48.8670, 2.3390]],
  [[48.8680, 2.3440], [48.8630, 2.3370], [48.8580, 2.3400], [48.8580, 2.3520], [48.8660, 2.3480], [48.8680, 2.3440]],
  [[48.8680, 2.3440], [48.8660, 2.3480], [48.8580, 2.3520], [48.8580, 2.3400], [48.8630, 2.3370], [48.8680, 2.3440]],
  [[48.8660, 2.3440], [48.8610, 2.3370], [48.8560, 2.3400], [48.8560, 2.3520], [48.8640, 2.3480], [48.8660, 2.3440]],
  [[48.8680, 2.3480], [48.8630, 2.3410], [48.8580, 2.3440], [48.8580, 2.3560], [48.8660, 2.3520], [48.8680, 2.3480]],
  [[48.8640, 2.3450], [48.8600, 2.3400], [48.8560, 2.3460], [48.8570, 2.3550], [48.8630, 2.3530], [48.8640, 2.3450]],
]);

export function createRoute(index) {
  const suffix = String(index + 1).padStart(3, '0');
  const waypoints = ROUTE_WAYPOINTS[index % ROUTE_WAYPOINTS.length].map(([lat, lng]) => ({ lat, lng }));

  return {
    routeId: `route-${suffix}`,
    waypoints,
  };
}

function normalizeGeometry(geometry) {
  if (geometry?.type !== 'LineString' || !Array.isArray(geometry.coordinates)) {
    throw new Error('OSRM n’a pas renvoyé de géométrie GeoJSON LineString.');
  }

  const coordinates = geometry.coordinates.filter((coordinate, index, all) => {
    if (!Array.isArray(coordinate) || coordinate.length < 2) {
      throw new Error('Coordonnée OSRM invalide.');
    }

    const previous = all[index - 1];
    return index === 0 || coordinate[0] !== previous[0] || coordinate[1] !== previous[1];
  });

  if (coordinates.length < 2) {
    throw new Error('L’itinéraire OSRM doit contenir au moins deux positions distinctes.');
  }

  return { ...geometry, coordinates };
}

export async function loadRoute(index, {
  osrmBaseUrl = DEFAULT_OSRM_BASE_URL,
  fetchImpl = fetch,
} = {}) {
  const route = createRoute(index);
  const coordinates = route.waypoints.map(({ lng, lat }) => `${lng},${lat}`).join(';');
  const url = new URL(`${osrmBaseUrl.replace(/\/$/, '')}/route/v1/driving/${coordinates}`);
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');

  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`OSRM a répondu HTTP ${response.status} pour ${route.routeId}.`);

  const body = await response.json();
  if (body.code !== 'Ok' || !body.routes?.[0]) {
    throw new Error(`OSRM n’a pas pu calculer ${route.routeId}: ${body.message ?? body.code ?? 'réponse invalide'}.`);
  }

  const geometry = normalizeGeometry(body.routes[0].geometry);

  return {
    routeId: route.routeId,
    geometry,
    coordinates: geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
  };
}

export function loadRoutes({
  vehicleCount = 7,
  osrmBaseUrl = DEFAULT_OSRM_BASE_URL,
  fetchImpl = fetch,
} = {}) {
  return Promise.all(Array.from(
    { length: vehicleCount },
    (_, index) => loadRoute(index, { osrmBaseUrl, fetchImpl }),
  ));
}
