import assert from 'node:assert/strict';
import test from 'node:test';
import { routeColor } from '../src/route-colors.js';
import { describeVehicle, formatHeading } from '../src/vehicle-info.js';

function position(overrides = {}) {
  return {
    carId: 'car-001',
    lat: 48.8608,
    lng: 2.3415,
    heading: 90,
    speed: 12.4,
    routeId: 'route-001',
    ts: 100,
    ...overrides,
  };
}

test('décrit un véhicule en mouvement de façon lisible', () => {
  const info = describeVehicle(position());

  assert.deepEqual(info, {
    state: 'moving',
    stateLabel: 'En mouvement',
    color: routeColor('route-001'),
    speed: '12 km/h',
    heading: '90° E',
    route: 'route-001',
    coords: '48.86080, 2.34150',
  });
});

test('décrit un véhicule à l’arrêt et un véhicule en erreur', () => {
  assert.equal(describeVehicle(position({ speed: 0 })).stateLabel, "À l'arrêt");
  assert.equal(describeVehicle(position({ speed: 0 })).speed, '0 km/h');
  assert.equal(describeVehicle(position({ status: 'error' })).stateLabel, 'En erreur');
});

test('formate le cap en degrés et en point cardinal', () => {
  assert.equal(formatHeading(0), '0° N');
  assert.equal(formatHeading(45), '45° NE');
  assert.equal(formatHeading(180), '180° S');
  assert.equal(formatHeading(270), '270° O');
  assert.equal(formatHeading(360), '0° N');
  assert.equal(formatHeading(-90), '270° O');
  assert.equal(formatHeading(undefined), '—');
});

test('gère les valeurs manquantes sans lever d’erreur', () => {
  const info = describeVehicle({ carId: 'car-002', routeId: undefined, lat: undefined, lng: undefined, speed: undefined, heading: undefined });

  assert.equal(info.route, '—');
  assert.equal(info.coords, '—');
  assert.equal(info.speed, '—');
  assert.equal(info.heading, '—');
  assert.equal(info.stateLabel, 'En mouvement');
});
