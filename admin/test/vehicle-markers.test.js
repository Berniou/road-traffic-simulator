import assert from 'node:assert/strict';
import test from 'node:test';
import { routeColor } from '../src/route-colors.js';
import { getVehicleState, VehicleMarkers } from '../src/vehicle-markers.js';

class FakeElement {
  constructor() {
    this.attributes = {};
    this.dataset = {};
    this.style = {
      setProperty: (name, value) => {
        this.style[name] = value;
      },
    };
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  querySelector(selector) {
    assert.equal(selector, '.vehicle-marker__icon');
    this.icon ??= new FakeElement();
    return this.icon;
  }
}

const fakeDocument = {
  createElement: () => new FakeElement(),
};

function createAnimationClock() {
  let time = 0;
  let nextFrameId = 0;
  const callbacks = new Map();

  return {
    get now() {
      return time;
    },
    requestAnimationFrame(callback) {
      nextFrameId += 1;
      callbacks.set(nextFrameId, callback);
      return nextFrameId;
    },
    cancelAnimationFrame(frameId) {
      callbacks.delete(frameId);
    },
    tick(duration) {
      time += duration;
      const pendingCallbacks = [...callbacks.values()];
      callbacks.clear();
      for (const callback of pendingCallbacks) callback(time);
    },
    get pendingFrames() {
      return callbacks.size;
    },
  };
}

function position(carId, overrides = {}) {
  return {
    carId,
    lat: 48.87,
    lng: 2.34,
    heading: 90,
    speed: 10,
    routeId: 'route-001',
    ts: 100,
    ...overrides,
  };
}

function assertCoordinatesClose(marker, expected) {
  assert.equal(marker.coordinates.length, expected.length);
  for (const [index, coordinate] of marker.coordinates.entries()) {
    assert.ok(Math.abs(coordinate - expected[index]) < 1e-12);
  }
}

function createMarkers({ animationDuration = 0 } = {}) {
  const created = [];
  const map = { center: [2.34, 48.87], zoom: 15 };
  const clock = createAnimationClock();

  class FakeMarker {
    constructor({ element, anchor }) {
      this.element = element;
      this.anchor = anchor;
      created.push(this);
    }

    setLngLat(coordinates) {
      this.coordinates = coordinates;
      this.coordinateUpdates ??= 0;
      this.coordinateUpdates += 1;
      return this;
    }

    addTo(target) {
      assert.ok(this.coordinates, 'les coordonnées doivent être définies avant l’ajout à la carte');
      this.map = target;
      return this;
    }

    remove() {
      this.removed = true;
    }
  }

  return {
    created,
    map,
    clock,
    markers: new VehicleMarkers({
      map,
      Marker: FakeMarker,
      document: fakeDocument,
      requestAnimationFrame: clock.requestAnimationFrame,
      cancelAnimationFrame: clock.cancelAnimationFrame,
      now: () => clock.now,
      animationDuration,
    }),
  };
}

test('chaque véhicule possède sa propre icône de voiture et son infobulle', () => {
  const { created, map, markers } = createMarkers();
  markers.sync([position('car-001'), position('car-002')]);

  assert.equal(created.length, 2);
  assert.deepEqual(created.map(({ element }) => element.dataset.carId), ['car-001', 'car-002']);
  assert.ok(created.every(({ anchor, map: markerMap }) => anchor === 'center' && markerMap === map));
  assert.ok(created.every(({ element }) => element.innerHTML.includes('viewBox="0 0 32 48"')));
  assert.ok(created.every(({ element }) => element.innerHTML.includes('vehicle-marker__body')));
  assert.equal(created[0].element.title, 'car-001 — en mouvement');
  assert.equal(created[1].element.attributes['aria-label'], 'car-002 — en mouvement');
});

test('les marqueurs utilisent les coordonnées et le cap de leur véhicule', () => {
  const { created, markers } = createMarkers();
  markers.sync([position('car-001', { lat: 48.868, lng: 2.342, heading: 225 })]);

  assert.deepEqual(created[0].coordinates, [2.342, 48.868]);
  assert.equal(created[0].element.icon.style.transform, 'rotate(225deg)');

  markers.sync([position('car-001', { lat: 48.869, lng: 2.343, heading: 45 })]);

  assert.equal(created.length, 1);
  assert.deepEqual(created[0].coordinates, [2.343, 48.869]);
  assert.equal(created[0].element.icon.style.transform, 'rotate(45deg)');
});

test('un véhicule prend la couleur de son itinéraire', () => {
  const { created, markers } = createMarkers();
  markers.sync([
    position('car-001', { speed: 12, routeId: 'route-001' }),
    position('car-002', { routeId: 'route-002' }),
  ]);

  assert.equal(created[0].element.style['--vehicle-color'], routeColor('route-001'));
  assert.equal(created[1].element.style['--vehicle-color'], routeColor('route-002'));
  assert.notEqual(
    created[0].element.style['--vehicle-color'],
    created[1].element.style['--vehicle-color'],
  );
});

test('un véhicule à l’arrêt ou en erreur conserve la couleur de son itinéraire', () => {
  const { created, markers } = createMarkers();
  markers.sync([
    position('car-001', { speed: 0, routeId: 'route-001' }),
    position('car-002', { status: 'error', routeId: 'route-002' }),
  ]);

  assert.equal(created[0].element.style['--vehicle-color'], routeColor('route-001'));
  assert.equal(created[0].element.dataset.state, 'stopped');
  assert.equal(created[0].element.title, "car-001 — à l'arrêt");
  assert.equal(created[1].element.style['--vehicle-color'], routeColor('route-002'));
  assert.equal(created[1].element.dataset.state, 'error');
  assert.equal(created[1].element.title, 'car-002 — en erreur');
});

test('une mise à jour ne réutilise jamais le marqueur d’un autre véhicule', () => {
  const { created, markers } = createMarkers();
  markers.sync([position('car-001'), position('car-002', { lng: 2.35 })]);
  const secondCoordinates = [...created[1].coordinates];

  markers.sync([position('car-001', { lng: 2.36 }), position('car-002', { lng: 2.35 })]);

  assert.equal(created.length, 2);
  assert.equal(created[0].element.dataset.carId, 'car-001');
  assert.equal(created[1].element.dataset.carId, 'car-002');
  assert.deepEqual(created[0].coordinates, [2.36, 48.87]);
  assert.deepEqual(created[1].coordinates, secondCoordinates);
});

test('une notification ne déplace que son propre véhicule parmi les 7 véhicules', () => {
  const { created, markers } = createMarkers();
  const positions = Array.from({ length: 7 }, (_, index) =>
    position(`car-00${index + 1}`, {
      lng: 2.34 + index / 1000,
      routeId: `route-00${index + 1}`,
    }),
  );
  markers.sync(positions);
  const otherPositions = created.map(({ coordinates }) => [...coordinates]);

  markers.upsert(position('car-004', { lng: 2.36, heading: 180, ts: 200 }));

  assert.equal(created.length, 7);
  assert.equal(created[3].coordinateUpdates, 2);
  assert.deepEqual(created[3].coordinates, [2.36, 48.87]);
  assert.equal(created[3].element.icon.style.transform, 'rotate(180deg)');
  for (const [index, marker] of created.entries()) {
    if (index === 3) continue;
    assert.equal(marker.coordinateUpdates, 1);
    assert.deepEqual(marker.coordinates, otherPositions[index]);
  }
});

test('deux véhicules évoluent indépendamment à leur propre cadence', () => {
  const { created, markers } = createMarkers();
  markers.sync([position('car-001'), position('car-002')]);

  markers.upsert(position('car-001', { lat: 48.871, ts: 150 }));
  markers.upsert(position('car-001', { lat: 48.872, ts: 200 }));
  markers.upsert(position('car-002', { lat: 48.873, ts: 175 }));

  assert.equal(created[0].coordinateUpdates, 3);
  assert.deepEqual(created[0].coordinates, [2.34, 48.872]);
  assert.equal(created[1].coordinateUpdates, 2);
  assert.deepEqual(created[1].coordinates, [2.34, 48.873]);
});

test('le marqueur est interpolé progressivement avec un cap cohérent et sans modifier la carte', () => {
  const { created, map, clock, markers } = createMarkers({ animationDuration: 300 });
  markers.upsert(position('car-001', { heading: 350 }));
  const initialMapState = { center: map.center, zoom: map.zoom };

  markers.upsert(position('car-001', { lat: 48.872, lng: 2.342, heading: 10, ts: 200 }));

  assertCoordinatesClose(created[0], [2.34, 48.87]);
  clock.tick(150);
  assertCoordinatesClose(created[0], [2.341, 48.871]);
  assert.equal(created[0].element.icon.style.transform, 'rotate(0deg)');
  assert.deepEqual(map, initialMapState);

  clock.tick(150);
  assertCoordinatesClose(created[0], [2.342, 48.872]);
  assert.equal(created[0].element.icon.style.transform, 'rotate(10deg)');
  assert.equal(clock.pendingFrames, 0);
});

test('chaque interpolation avance indépendamment des autres véhicules', () => {
  const { created, clock, markers } = createMarkers({ animationDuration: 300 });
  markers.sync([position('car-001'), position('car-002')]);

  markers.upsert(position('car-001', { lat: 48.872, ts: 200 }));
  clock.tick(100);
  assert.equal(created[0].coordinateUpdates, 2);
  assert.equal(created[1].coordinateUpdates, 1);

  markers.upsert(position('car-002', { lng: 2.35, ts: 200 }));
  clock.tick(100);
  assert.equal(created[0].coordinateUpdates, 3);
  assert.equal(created[1].coordinateUpdates, 2);

  clock.tick(100);
  assert.deepEqual(created[0].coordinates, [2.34, 48.872]);
  assert.equal(created[0].coordinateUpdates, 4);
  assert.equal(created[1].coordinateUpdates, 3);

  clock.tick(100);
  assert.deepEqual(created[1].coordinates, [2.35, 48.87]);
  assert.equal(created[1].coordinateUpdates, 4);
});

test('une nouvelle position repart de la position affichée vers la cible la plus récente', () => {
  const { created, clock, markers } = createMarkers({ animationDuration: 300 });
  markers.upsert(position('car-001'));
  markers.upsert(position('car-001', { lat: 48.872, heading: 180, ts: 200 }));
  clock.tick(150);
  assertCoordinatesClose(created[0], [2.34, 48.871]);
  assert.equal(created[0].element.icon.style.transform, 'rotate(135deg)');

  markers.upsert(position('car-001', { lat: 48.876, heading: 270, ts: 300 }));
  assertCoordinatesClose(created[0], [2.34, 48.871]);
  assert.equal(created[0].element.icon.style.transform, 'rotate(135deg)');

  clock.tick(150);
  assertCoordinatesClose(created[0], [2.34, 48.8735]);
  assert.equal(created[0].element.icon.style.transform, 'rotate(202.5deg)');

  clock.tick(150);
  assertCoordinatesClose(created[0], [2.34, 48.876]);
  assert.equal(created[0].element.icon.style.transform, 'rotate(270deg)');
  assert.equal(clock.pendingFrames, 0);
});

test('le retrait des véhicules annule leurs animations en cours', () => {
  const { created, clock, markers } = createMarkers({ animationDuration: 300 });
  markers.sync([position('car-001'), position('car-002')]);
  markers.upsert(position('car-001', { lat: 48.872, ts: 200 }));
  markers.upsert(position('car-002', { lat: 48.873, ts: 200 }));
  assert.equal(clock.pendingFrames, 2);

  markers.sync([]);

  assert.equal(clock.pendingFrames, 0);
  assert.ok(created.every(({ removed }) => removed));
  const coordinateUpdates = created.map((marker) => marker.coordinateUpdates);
  clock.tick(300);
  assert.deepEqual(created.map((marker) => marker.coordinateUpdates), coordinateUpdates);
});

test('les états dégradés priment sur la vitesse et les marqueurs obsolètes sont retirés', () => {
  assert.equal(getVehicleState(position('car-001', { speed: 20, error: true })), 'error');
  assert.equal(getVehicleState(position('car-001', { speed: 0, status: 'error' })), 'error');

  const { created, markers } = createMarkers();
  markers.sync([position('car-001'), position('car-002')]);
  markers.sync([position('car-002')]);

  assert.equal(created[0].removed, true);
  assert.equal(created[1].removed, undefined);
});
