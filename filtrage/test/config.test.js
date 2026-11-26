import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from '../src/config.js';

test('le filtrage utilise les topics et la fenêtre de 300 ms par défaut', () => {
  const config = loadConfig({});
  assert.equal(config.windowSizeMs, 300);
  assert.equal(config.kafkaRawTopic, 'car.positions.raw');
  assert.equal(config.kafkaLatestTopic, 'car.positions.latest');
});

test('la taille de fenêtre doit être un entier positif', () => {
  assert.equal(loadConfig({ WINDOW_SIZE_MS: '500' }).windowSizeMs, 500);
  assert.throws(() => loadConfig({ WINDOW_SIZE_MS: '0' }), /WINDOW_SIZE_MS/);
  assert.throws(() => loadConfig({ WINDOW_SIZE_MS: 'abc' }), /WINDOW_SIZE_MS/);
});
