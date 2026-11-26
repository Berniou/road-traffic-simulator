import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import WebSocket from 'ws';
import { createAdminWebSocketServer } from '../src/admin-websocket-server.js';

function position(carId, ts) {
  return { carId, lat: 48.87, lng: 2.34, heading: 90, speed: 10, routeId: 'route-001', ts };
}

test('les clients Admin reçoivent les positions sans rechargement ni regroupement', async (t) => {
  const server = await createAdminWebSocketServer({
    webSocketHost: '127.0.0.1',
    webSocketPort: 0,
    webSocketPath: '/ws',
  });
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
