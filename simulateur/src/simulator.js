import { createRoute } from './routes.js';

function toRadians(value) {
  return value * Math.PI / 180;
}

function distanceInMeters(from, to) {
  const earthRadius = 6371000;
  const latDelta = toRadians(to.lat - from.lat);
  const lngDelta = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

function heading(from, to) {
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const lngDelta = toRadians(to.lng - from.lng);
  const y = Math.sin(lngDelta) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat)
    - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(lngDelta);

  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function interpolate(from, to, ratio) {
  return {
    lat: from.lat + (to.lat - from.lat) * ratio,
    lng: from.lng + (to.lng - from.lng) * ratio,
  };
}

export class SimulatedVehicle {
  constructor(index, intervalMs) {
    this.carId = `car-${String(index + 1).padStart(3, '0')}`;
    this.route = createRoute(index);
    this.routeId = this.route.routeId;
    this.intervalMs = intervalMs;
    this.speed = 8 + (index % 5);
    this.segmentIndex = 0;
    this.distanceOnSegment = 0;
  }

  nextPosition(now = Date.now()) {
    const coordinates = this.route.coordinates;
    const from = coordinates[this.segmentIndex];
    const to = coordinates[(this.segmentIndex + 1) % coordinates.length];
    const segmentLength = distanceInMeters(from, to);

    this.distanceOnSegment += this.speed * this.intervalMs / 1000;

    if (this.distanceOnSegment >= segmentLength) {
      this.distanceOnSegment %= segmentLength;
      this.segmentIndex = (this.segmentIndex + 1) % coordinates.length;
      return this.nextPosition(now);
    }

    const position = interpolate(from, to, this.distanceOnSegment / segmentLength);

    return {
      carId: this.carId,
      lat: position.lat,
      lng: position.lng,
      heading: heading(from, to),
      speed: this.speed,
      routeId: this.routeId,
      ts: now,
    };
  }
}

export function createFleet({ vehicleCount = 7, positionIntervalMs = 50 } = {}) {
  return Array.from(
    { length: vehicleCount },
    (_, index) => new SimulatedVehicle(index, positionIntervalMs),
  );
}

export class FleetSimulator {
  constructor(config, onPosition = () => {}) {
    this.vehicles = createFleet(config);
    this.intervalMs = config.positionIntervalMs ?? 50;
    this.onPosition = onPosition;
    this.timers = [];
  }

  start() {
    if (this.timers.length > 0) return;

    this.timers = this.vehicles.map((vehicle) => setInterval(
      () => this.onPosition(vehicle.nextPosition()),
      this.intervalMs,
    ));
  }

  stop() {
    this.timers.forEach(clearInterval);
    this.timers = [];
  }
}
