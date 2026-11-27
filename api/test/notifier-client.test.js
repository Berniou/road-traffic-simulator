import assert from 'node:assert/strict';
import test from 'node:test';
import { createNotifierClient } from '../src/notifier-client.js';

function position() {
  return { carId: 'car-001', lat: 48.87, lng: 2.34, heading: 90, speed: 10, routeId: 'route-001', ts: 1 };
}

test('le client transmet la position au notificateur via POST /notify', async () => {
  const calls = [];
  const client = createNotifierClient({
    url: 'http://notifier:8080',
    fetch: async (url, options) => {
      calls.push({ url: url.toString(), options });
      return { ok: true, status: 202 };
    },
  });

  await client.notify(position());

  assert.equal(calls[0].url, 'http://notifier:8080/notify');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), position());
});

test("le client signale une réponse en erreur du notificateur", async () => {
  const client = createNotifierClient({
    url: 'http://notifier:8080',
    fetch: async () => ({ ok: false, status: 503 }),
  });

  await assert.rejects(() => client.notify(position()), /HTTP 503/);
});
