import assert from 'node:assert/strict';
import test from 'node:test';
import { getVehicleState, VehicleMarkers, VEHICLE_COLORS } from '../src/vehicle-markers.js';

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

function createMarkers() {
  const created = [];
  const map = {};

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
    markers: new VehicleMarkers({ map, Marker: FakeMarker, document: fakeDocument }),
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

test('un véhicule en mouvement est vert', () => {
  const { created, markers } = createMarkers();
  markers.sync([position('car-001', { speed: 12 })]);

  assert.equal(created[0].element.style['--vehicle-color'], '#34A853');
  assert.equal(created[0].element.dataset.state, 'moving');
});

test('un véhicule à l’arrêt ou en erreur est rouge', () => {
  const { created, markers } = createMarkers();
  markers.sync([
    position('car-001', { speed: 0 }),
    position('car-002', { status: 'error' }),
  ]);

  assert.equal(created[0].element.style['--vehicle-color'], '#EA4335');
  assert.equal(created[0].element.dataset.state, 'stopped');
  assert.equal(created[0].element.title, "car-001 — à l'arrêt");
  assert.equal(created[1].element.style['--vehicle-color'], '#EA4335');
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

test('les états dégradés priment sur la vitesse et les marqueurs obsolètes sont retirés', () => {
  assert.equal(getVehicleState(position('car-001', { speed: 20, error: true })), 'error');
  assert.equal(getVehicleState(position('car-001', { speed: 0, status: 'error' })), 'error');
  assert.equal(VEHICLE_COLORS.error, VEHICLE_COLORS.stopped);

  const { created, markers } = createMarkers();
  markers.sync([position('car-001'), position('car-002')]);
  markers.sync([position('car-002')]);

  assert.equal(created[0].removed, true);
  assert.equal(created[1].removed, undefined);
});
