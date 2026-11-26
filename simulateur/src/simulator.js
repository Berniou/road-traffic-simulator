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
  constructor(index, intervalMs, route) {
    this.carId = `car-${String(index + 1).padStart(3, '0')}`;
    this.route = route;
    this.routeId = this.route.routeId;
    this.intervalMs = intervalMs;
    this.speed = 70 + ((index * 5) % 21);
    this.segmentIndex = 0;
    this.distanceOnSegment = 0;
  }

  #advance(distance) {
    const coordinates = this.route.coordinates;
    let remainingDistance = distance;

    while (remainingDistance > 0) {
      const from = coordinates[this.segmentIndex];
      const to = coordinates[(this.segmentIndex + 1) % coordinates.length];
      const segmentLength = distanceInMeters(from, to);
      const distanceLeft = segmentLength - this.distanceOnSegment;
      const traveledDistance = Math.min(remainingDistance, distanceLeft);

      this.distanceOnSegment += traveledDistance;
      remainingDistance -= traveledDistance;

      if (this.distanceOnSegment >= segmentLength) {
        this.distanceOnSegment = 0;
        this.segmentIndex = (this.segmentIndex + 1) % coordinates.length;
      }
    }
  }

  nextPosition(now = Date.now()) {
    this.#advance((this.speed / 3.6) * this.intervalMs / 1000);

    const coordinates = this.route.coordinates;
    const from = coordinates[this.segmentIndex];
    const to = coordinates[(this.segmentIndex + 1) % coordinates.length];
    const segmentLength = distanceInMeters(from, to);
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

export function createFleet({ vehicleCount = 7, positionIntervalMs = 50, routes } = {}) {
  if (!Array.isArray(routes) || routes.length < vehicleCount) {
    throw new Error('Les itinéraires OSRM doivent être chargés avant de créer la flotte.');
  }

  return Array.from(
    { length: vehicleCount },
    (_, index) => new SimulatedVehicle(index, positionIntervalMs, routes[index]),
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
