export const VEHICLE_COLORS = {
  moving: '#34A853',
  stopped: '#EA4335',
  error: '#EA4335',
};

const STATE_LABELS = {
  moving: 'en mouvement',
  stopped: "à l'arrêt",
  error: 'en erreur',
};

export function getVehicleState(position) {
  if (position.error || position.status === 'error') return 'error';
  if (position.speed <= 0 || position.status === 'stopped') return 'stopped';
  return 'moving';
}

function createMarkerElement(document, position) {
  const element = document.createElement('div');
  element.className = 'vehicle-marker';
  element.dataset.carId = position.carId;
  element.setAttribute('role', 'img');
  element.innerHTML = `
    <svg class="vehicle-marker__icon" viewBox="0 0 32 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path class="vehicle-marker__body" d="M10 2C7 2 5.2 3.8 4.7 6.7L2.4 18.4C2.1 19.8 2 21.3 2 22.8V38c0 2.8 2.2 5 5 5h1v2c0 1.7 4 1.7 4 0v-2h8v2c0 1.7 4 1.7 4 0v-2h1c2.8 0 5-2.2 5-5V22.8c0-1.5-.1-3-.4-4.4l-2.3-11.7C26.8 3.8 25 2 22 2H10Z"/>
      <path class="vehicle-marker__window" d="M9 8h14c.8 0 1.4.5 1.6 1.3l1.5 7.2c-4.6-1.7-15.6-1.7-20.2 0l1.5-7.2C7.6 8.5 8.2 8 9 8Z"/>
      <path class="vehicle-marker__window" d="M7.1 23.5c4.5 1.3 13.3 1.3 17.8 0l.8 8.5c-5.3 1.1-14.1 1.1-19.4 0l.8-8.5Z"/>
      <path class="vehicle-marker__light" d="M5 5.5h5v2H5zM22 5.5h5v2h-5z"/>
    </svg>
  `;
  return element;
}

function updateMarkerElement(element, position) {
  const state = getVehicleState(position);
  const label = `${position.carId} — ${STATE_LABELS[state]}`;

  element.dataset.state = state;
  element.style.setProperty('--vehicle-color', VEHICLE_COLORS[state]);
  element.title = label;
  element.setAttribute('aria-label', label);
}

function renderMarkerPosition(entry, position) {
  entry.position = position;
  entry.marker.setLngLat([position.lng, position.lat]);
  entry.element.querySelector('.vehicle-marker__icon').style.transform = `rotate(${position.heading}deg)`;
}

function interpolate(from, to, progress) {
  return from + (to - from) * progress;
}

function interpolateHeading(from, to, progress) {
  const delta = ((to - from + 540) % 360) - 180;
  return (from + delta * progress + 360) % 360;
}

export class VehicleMarkers {
  #map;
  #Marker;
  #document;
  #requestAnimationFrame;
  #cancelAnimationFrame;
  #now;
  #animationDuration;
  #markers = new Map();

  constructor({
    map,
    Marker = window.maplibregl.Marker,
    document = window.document,
    requestAnimationFrame = window.requestAnimationFrame.bind(window),
    cancelAnimationFrame = window.cancelAnimationFrame.bind(window),
    now = () => window.performance.now(),
    animationDuration = 300,
  }) {
    this.#map = map;
    this.#Marker = Marker;
    this.#document = document;
    this.#requestAnimationFrame = requestAnimationFrame;
    this.#cancelAnimationFrame = cancelAnimationFrame;
    this.#now = now;
    this.#animationDuration = animationDuration;
  }

  upsert(position) {
    let entry = this.#markers.get(position.carId);

    if (!entry) {
      const element = createMarkerElement(this.#document, position);
      const marker = new this.#Marker({ element, anchor: 'center' }).addTo(this.#map);
      entry = { element, marker, position, animation: null };
      this.#markers.set(position.carId, entry);
      renderMarkerPosition(entry, position);
      updateMarkerElement(element, position);
      return;
    }

    updateMarkerElement(entry.element, position);
    this.#cancelAnimation(entry);

    if (this.#animationDuration <= 0) {
      renderMarkerPosition(entry, position);
      return;
    }

    const animation = {
      from: entry.position,
      to: position,
      startedAt: this.#now(),
      frameId: null,
    };
    entry.animation = animation;
    animation.frameId = this.#requestAnimationFrame((timestamp) => {
      this.#animate(entry, animation, timestamp);
    });
  }

  sync(positions) {
    const visibleCarIds = new Set();

    for (const position of positions) {
      visibleCarIds.add(position.carId);
      this.upsert(position);
    }

    for (const [carId, entry] of this.#markers) {
      if (visibleCarIds.has(carId)) continue;
      this.#cancelAnimation(entry);
      entry.marker.remove();
      this.#markers.delete(carId);
    }
  }

  #cancelAnimation(entry) {
    if (!entry.animation) return;
    this.#cancelAnimationFrame(entry.animation.frameId);
    entry.animation = null;
  }

  #animate(entry, animation, timestamp) {
    if (entry.animation !== animation) return;

    const elapsed = Math.max(0, timestamp - animation.startedAt);
    const progress = Math.min(1, elapsed / this.#animationDuration);
    const { from, to } = animation;
    const position = {
      ...to,
      lat: interpolate(from.lat, to.lat, progress),
      lng: interpolate(from.lng, to.lng, progress),
      heading: interpolateHeading(from.heading, to.heading, progress),
    };
    renderMarkerPosition(entry, position);

    if (progress === 1) {
      entry.animation = null;
      return;
    }

    animation.frameId = this.#requestAnimationFrame((nextTimestamp) => {
      this.#animate(entry, animation, nextTimestamp);
    });
  }
}
