import assert from 'node:assert/strict';
import test from 'node:test';
import { PositionBroadcaster, validatePosition } from '../src/position-broadcaster.js';

function position(carId = 'car-001', ts = 123456789) {
  return { carId, lat: 48.87, lng: 2.34, heading: 90, speed: 10, routeId: 'route-001', ts };
}

function client(readyState = 1, send = () => {}) {
  return { readyState, send };
}

test('chaque client connecté reçoit tous les champs de la position', () => {
  const received = [];
  const clients = new Set([
    client(1, (payload) => received.push(payload)),
    client(1, (payload) => received.push(payload)),
  ]);
  const broadcaster = new PositionBroadcaster({ clients });
  const expected = position();

  broadcaster.broadcast(expected);

  assert.equal(received.length, 2);
  assert.deepEqual(JSON.parse(received[0]), expected);
  assert.deepEqual(JSON.parse(received[1]), expected);
});

test('les clients fermés sont ignorés', () => {
  let calls = 0;
  const broadcaster = new PositionBroadcaster({
    clients: new Set([client(3, () => { calls += 1; })]),
  });
  broadcaster.broadcast(position());
  assert.equal(calls, 0);
});

test("l'indisponibilité d'un client n'interrompt pas la diffusion aux autres", () => {
  const received = [];
  const errors = [];
  const failing = client(1, () => { throw new Error('client indisponible'); });
  const healthy = client(1, (payload) => received.push(JSON.parse(payload).carId));
  const broadcaster = new PositionBroadcaster({
    clients: new Set([failing, healthy]),
    onError: (error, carId) => errors.push([error.message, carId]),
  });

  assert.doesNotThrow(() => broadcaster.broadcast(position()));
  assert.deepEqual(received, ['car-001']);
  assert.deepEqual(errors, [['client indisponible', 'car-001']]);
});

test("une erreur asynchrone d'envoi est isolée", () => {
  const errors = [];
  let notifyError;
  const failing = client(1, (_payload, callback) => { notifyError = callback; });
  const broadcaster = new PositionBroadcaster({
    clients: new Set([failing]),
    onError: (error) => errors.push(error.message),
  });

  broadcaster.broadcast(position());
  assert.doesNotThrow(() => notifyError(new Error('connexion perdue')));
  assert.deepEqual(errors, ['connexion perdue']);
});

test('une position sans champ obligatoire est rejetée', () => {
  const invalid = position();
  delete invalid.heading;
  assert.throws(() => validatePosition(invalid), /heading/);
  assert.throws(() => validatePosition({ ...position(), ts: Number.NaN }), /ts/);
});
