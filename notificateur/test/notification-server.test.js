import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import WebSocket from 'ws';
import { createNotificationServer } from '../src/notification-server.js';

function config(overrides = {}) {
  return {
    host: '127.0.0.1',
    port: 0,
    webSocketPath: '/ws',
    ...overrides,
  };
}

function position(carId, ts) {
  return { carId, lat: 48.87, lng: 2.34, heading: 90, speed: 10, routeId: 'route-001', ts };
}

test("la ressource HTTP restitue les dernières positions persistées pour l'initialisation", async (t) => {
  const positions = [position('car-001', 100), position('car-002', 200)];
  const server = await createNotificationServer(config(), {
    positionRepository: { findAll: async () => positions },
  });
  t.after(() => server.close());

  const response = await fetch(`http://127.0.0.1:${server.address().port}/positions`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), positions);
});

test('les clients Admin reçoivent les positions sans rechargement ni regroupement', async (t) => {
  const server = await createNotificationServer(config());
  t.after(() => server.close());

  const url = `ws://127.0.0.1:${server.address().port}/ws`;
  const first = new WebSocket(url);
  const second = new WebSocket(url);
  t.after(() => {
    first.terminate();
    second.terminate();
  });
  await Promise.all([once(first, 'open'), once(second, 'open')]);

  const firstMessage = once(first, 'message');
  const secondMessage = once(second, 'message');
  server.broadcaster.broadcast(position('car-001', 1));
  assert.deepEqual(JSON.parse((await firstMessage)[0].toString()), position('car-001', 1));
  assert.deepEqual(JSON.parse((await secondMessage)[0].toString()), position('car-001', 1));

  first.terminate();
  await once(first, 'close');
  const independentMessage = once(second, 'message');
  server.broadcaster.broadcast(position('car-002', 2));
  assert.deepEqual(JSON.parse((await independentMessage)[0].toString()), position('car-002', 2));
});

test("l'API peut notifier une position via HTTP et les clients Admin la reçoivent", async (t) => {
  const server = await createNotificationServer(config());
  t.after(() => server.close());

  const client = new WebSocket(`ws://127.0.0.1:${server.address().port}/ws`);
  t.after(() => client.terminate());
  await once(client, 'open');

  const message = once(client, 'message');
  const response = await fetch(`http://127.0.0.1:${server.address().port}/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(position('car-003', 3)),
  });

  assert.equal(response.status, 202);
  assert.deepEqual(JSON.parse((await message)[0].toString()), position('car-003', 3));
});

test('une notification invalide est rejetée sans interrompre le serveur', async (t) => {
  t.mock.method(console, 'error', () => {});
  const server = await createNotificationServer(config());
  t.after(() => server.close());

  const response = await fetch(`http://127.0.0.1:${server.address().port}/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ carId: 'car-001' }),
  });

  assert.equal(response.status, 400);
  const health = await fetch(`http://127.0.0.1:${server.address().port}/health`);
  assert.equal(health.status, 200);
});
