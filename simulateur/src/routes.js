export const DEFAULT_OSRM_BASE_URL = 'https://router.project-osrm.org';

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
  const start = point(-0.001 + offset, -0.002);

  return {
    routeId: `route-${suffix}`,
    waypoints: [
      start,
      point(0.001 + offset, -0.002),
      point(0.001 + offset, 0.002),
      point(-0.001 + offset, 0.002),
      start,
    ],
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
