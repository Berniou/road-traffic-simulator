import assert from 'node:assert/strict';
import test from 'node:test';
import { RealtimeConnection } from '../src/realtime-connection.js';

function createTimers() {
  let nextId = 0;
  const tasks = new Map();
  const delays = [];

  return {
    delays,
    get size() {
      return tasks.size;
    },
    setTimeout(callback, delay) {
      nextId += 1;
      tasks.set(nextId, callback);
      delays.push(delay);
      return nextId;
    },
    clearTimeout(id) {
      tasks.delete(id);
    },
    runNext() {
      const next = tasks.entries().next().value;
      assert.ok(next, 'une tentative de reconnexion doit être planifiée');
      const [id, callback] = next;
      tasks.delete(id);
      callback();
    },
  };
}

function position(carId, ts = 100) {
  return { carId, lat: 48.87, lng: 2.34, heading: 90, speed: 10, routeId: 'route-001', ts };
}

function createHarness({ loadPositions = async () => {} } = {}) {
  const sockets = [];
  const statuses = [];
  const positions = [];
  const errors = [];
  const timers = createTimers();

  class FakeWebSocket {
    constructor(url) {
      this.url = String(url);
      this.readyState = 0;
      this.listeners = new Map();
      sockets.push(this);
    }

    addEventListener(type, listener) {
      const listeners = this.listeners.get(type) ?? [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    }

    emit(type, event = {}) {
      for (const listener of this.listeners.get(type) ?? []) listener(event);
    }

    open() {
      this.readyState = 1;
      this.emit('open');
    }

    message(value) {
      this.emit('message', { data: JSON.stringify(value) });
    }

    close() {
      if (this.readyState === 3) return;
      this.readyState = 3;
      this.emit('close');
    }
  }

  const connection = new RealtimeConnection({
    url: 'ws://localhost:8080/ws',
    WebSocket: FakeWebSocket,
    loadPositions,
    onPosition: (value) => positions.push(value),
    onStatusChange: (status) => statuses.push(status),
    onError: (error) => errors.push(error),
    initialReconnectDelay: 1000,
    maxReconnectDelay: 8000,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
  });

  return { connection, errors, positions, sockets, statuses, timers };
}

async function flushPromises() {
  await new Promise((resolve) => setImmediate(resolve));
}

test('la connexion recharge les positions puis reçoit les mises à jour temps réel', async () => {
  let loads = 0;
  const { connection, positions, sockets, statuses } = createHarness({
    loadPositions: async () => {
      loads += 1;
    },
  });

  connection.start();
  assert.equal(sockets.length, 1);
  assert.equal(sockets[0].url, 'ws://localhost:8080/ws');
  sockets[0].open();
  await flushPromises();
  sockets[0].message(position('car-001'));

  assert.equal(loads, 1);
  assert.deepEqual(statuses, ['connecting', 'connected']);
  assert.deepEqual(positions, [position('car-001')]);
});

test('une coupure est signalée et les tentatives utilisent une attente progressive', async () => {
  const { connection, sockets, statuses, timers } = createHarness();
  connection.start();
  sockets[0].open();
  await flushPromises();

  sockets[0].close();

  assert.equal(statuses.at(-1), 'disconnected');
  assert.equal(sockets.length, 1);
  assert.deepEqual(timers.delays, [1000]);

  timers.runNext();
  assert.equal(sockets.length, 2);
  sockets[1].close();
  assert.equal(sockets.length, 2);
  assert.deepEqual(timers.delays, [1000, 2000]);

  timers.runNext();
  sockets[2].open();
  await flushPromises();
  assert.equal(statuses.at(-1), 'connected');

  sockets[2].close();
  assert.deepEqual(timers.delays, [1000, 2000, 1000]);
});

test('les messages reçus pendant la resynchronisation sont appliqués après son succès', async () => {
  let loads = 0;
  let finishReload;
  const { connection, positions, sockets, statuses, timers } = createHarness({
    loadPositions: () => {
      loads += 1;
      if (loads === 1) return Promise.resolve();
      return new Promise((resolve) => {
        finishReload = resolve;
      });
    },
  });
  connection.start();
  sockets[0].open();
  await flushPromises();
  sockets[0].close();
  timers.runNext();

  sockets[1].open();
  sockets[1].message(position('car-001', 200));

  assert.equal(loads, 2);
  assert.equal(positions.length, 0);
  assert.equal(statuses.at(-1), 'connecting');

  finishReload();
  await flushPromises();

  assert.equal(statuses.at(-1), 'connected');
  assert.deepEqual(positions, [position('car-001', 200)]);
});

test('un échec de resynchronisation ferme le socket et déclenche une seule tentative différée', async () => {
  const failure = new Error('HTTP 503');
  const { connection, errors, sockets, statuses, timers } = createHarness({
    loadPositions: async () => {
      throw failure;
    },
  });
  connection.start();

  sockets[0].open();
  await flushPromises();

  assert.deepEqual(errors, [failure]);
  assert.equal(sockets[0].readyState, 3);
  assert.equal(statuses.at(-1), 'disconnected');
  assert.equal(sockets.length, 1);
  assert.equal(timers.size, 1);
  assert.deepEqual(timers.delays, [1000]);
});

test('les événements d’un ancien socket sont ignorés après une reconnexion', async () => {
  const { connection, positions, sockets, timers } = createHarness();
  connection.start();
  sockets[0].open();
  await flushPromises();
  sockets[0].close();
  timers.runNext();
  sockets[1].open();
  await flushPromises();

  sockets[0].message(position('car-001', 200));
  sockets[1].message(position('car-002', 200));

  assert.deepEqual(positions, [position('car-002', 200)]);
});

test('l’arrêt annule la reconnexion programmée', () => {
  const { connection, sockets, timers } = createHarness();
  connection.start();
  sockets[0].close();
  assert.equal(timers.size, 1);

  connection.stop();

  assert.equal(timers.size, 0);
  assert.equal(sockets.length, 1);
});
