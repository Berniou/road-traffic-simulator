export const VEHICLE_ROUTE_COLOR = '#4285F4';
export const VEHICLE_ROUTES_SOURCE_ID = 'vehicle-routes';

function featureCollection(routes) {
  return {
    type: 'FeatureCollection',
    features: routes.map((route) => ({
      type: 'Feature',
      properties: { routeId: route.routeId },
      geometry: route.geometry,
    })),
  };
}

export function renderVehicleRoutes(map, routes) {
  const data = featureCollection(routes);
  const source = map.getSource(VEHICLE_ROUTES_SOURCE_ID);

  if (source) {
    source.setData(data);
    return;
  }

  map.addSource(VEHICLE_ROUTES_SOURCE_ID, { type: 'geojson', data });
  map.addLayer({
    id: 'vehicle-routes-line',
    type: 'line',
    source: VEHICLE_ROUTES_SOURCE_ID,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': VEHICLE_ROUTE_COLOR,
      'line-width': 4,
      'line-opacity': 0.85,
    },
  });
}

export async function loadVehicleRoutes({ map, url = '/routes', fetchImpl = fetch }) {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const routes = await response.json();
  const render = () => renderVehicleRoutes(map, routes);

  if (map.isStyleLoaded()) render();
  else map.once('load', render);

  return routes;
}
