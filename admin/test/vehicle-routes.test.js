import assert from 'node:assert/strict';
import test from 'node:test';
import { routeColor } from '../src/route-colors.js';
import {
  loadVehicleRoutes,
  renderVehicleRoutes,
  VEHICLE_ROUTES_SOURCE_ID,
} from '../src/vehicle-routes.js';

function routes() {
  return [{
    routeId: 'route-001',
    geometry: {
      type: 'LineString',
      coordinates: [[2.339, 48.868], [2.34, 48.869]],
    },
  }, {
    routeId: 'route-002',
    geometry: {
      type: 'LineString',
      coordinates: [[2.34, 48.868], [2.341, 48.869]],
    },
  }];
}

test('chaque itinéraire OSRM est tracé avec une couleur Google différente', () => {
  let source;
  let layer;
  const map = {
    getSource: () => undefined,
    addSource: (id, value) => { source = { id, ...value }; },
    addLayer: (value) => { layer = value; },
  };

  renderVehicleRoutes(map, routes());

  assert.equal(source.id, VEHICLE_ROUTES_SOURCE_ID);
  assert.equal(source.type, 'geojson');
  assert.equal(source.data.type, 'FeatureCollection');
  assert.equal(source.data.features.length, 2);
  assert.equal(source.data.features[0].properties.routeId, 'route-001');
  assert.deepEqual(source.data.features[0].geometry, routes()[0].geometry);

  const colors = source.data.features.map(({ properties }) => properties.color);
  assert.deepEqual(colors, [routeColor('route-001'), routeColor('route-002')]);
  assert.notEqual(colors[0], colors[1]);

  assert.equal(layer.type, 'line');
  assert.equal(layer.source, VEHICLE_ROUTES_SOURCE_ID);
  assert.deepEqual(layer.paint['line-color'], ['get', 'color']);
});

test('les itinéraires sont récupérés puis affichés dès que le style est chargé', async () => {
  let onLoad;
  let rendered = false;
  const map = {
    isStyleLoaded: () => false,
    once: (event, callback) => {
      assert.equal(event, 'load');
      onLoad = callback;
    },
    getSource: () => undefined,
    addSource: () => {},
    addLayer: () => { rendered = true; },
  };

  const loaded = await loadVehicleRoutes({
    map,
    fetchImpl: async (url) => {
      assert.equal(url, '/routes');
      return { ok: true, json: async () => routes() };
    },
  });

  assert.deepEqual(loaded, routes());
  assert.equal(rendered, false);
  onLoad();
  assert.equal(rendered, true);
});

test('une source déjà créée est actualisée sans dupliquer la couche', () => {
  let data;
  let layerAdded = false;
  const map = {
    getSource: () => ({ setData: (value) => { data = value; } }),
    addLayer: () => { layerAdded = true; },
  };

  renderVehicleRoutes(map, routes());

  assert.equal(data.features[0].properties.routeId, 'route-001');
  assert.equal(layerAdded, false);
});

test('un échec de chargement des itinéraires est remonté', async () => {
  await assert.rejects(() => loadVehicleRoutes({
    map: {},
    fetchImpl: async () => ({ ok: false, status: 502 }),
  }), /HTTP 502/);
});
