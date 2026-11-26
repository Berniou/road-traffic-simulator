import assert from 'node:assert/strict';
import test from 'node:test';
import { createMapStyle, PARIS_SECOND_ARRONDISSEMENT } from '../src/map-style.js';

test('la carte est centrée sur le 2e arrondissement de Paris', () => {
  assert.deepEqual(PARIS_SECOND_ARRONDISSEMENT, [2.342, 48.868]);
});

test('le fond de carte utilise des tuiles vectorielles OpenStreetMap', () => {
  const style = createMapStyle();

  assert.equal(style.version, 8);
  assert.equal(style.sources.openmaptiles.type, 'vector');
  assert.match(style.sources.openmaptiles.url, /^https:/);
  assert.match(style.sources.openmaptiles.attribution, /OpenStreetMap/);
});

test('le style personnalise les routes, autoroutes, plans d’eau et espaces verts', () => {
  const layers = new Map(createMapStyle().layers.map((layer) => [layer.id, layer]));

  assert.equal(layers.get('roads').paint['line-color'], '#ffffff');
  assert.equal(layers.get('motorways').paint['line-color'], '#f6b93b');
  assert.equal(layers.get('water').paint['fill-color'], '#aad3df');
  assert.equal(layers.get('green-spaces').paint['fill-color'], '#c8e6c9');
});
