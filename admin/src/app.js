import { FleetStore } from './fleet-store.js';
import { createMapStyle, PARIS_SECOND_ARRONDISSEMENT } from './map-style.js';
import { VehicleMarkers } from './vehicle-markers.js';

const map = new window.maplibregl.Map({
  container: 'map',
  style: createMapStyle(),
  center: PARIS_SECOND_ARRONDISSEMENT,
  zoom: 15,
  attributionControl: { compact: true },
});
map.addControl(new window.maplibregl.NavigationControl(), 'bottom-left');

const store = new FleetStore();
const vehicleMarkers = new VehicleMarkers({ map });
const fleet = document.querySelector('#fleet');
const message = document.querySelector('#message');
const apiUrl = new URL(window.ADMIN_API_URL ?? `http://${window.location.hostname}:8080`);
const webSocketUrl = new URL('/ws', apiUrl);
webSocketUrl.protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';

function renderPosition(position) {
  let item = [...fleet.children].find((child) => child.dataset.carId === position.carId);

  if (!item) {
    item = document.createElement('li');
    item.dataset.carId = position.carId;
    item.innerHTML = `
      <strong></strong>
      <span></span>
      <small></small>
    `;
    const nextItem = [...fleet.children].find(
      (child) => child.dataset.carId.localeCompare(position.carId) > 0,
    );
    fleet.insertBefore(item, nextItem ?? null);
  }

  item.querySelector('strong').textContent = position.carId;
  item.querySelector('span').textContent = `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`;
  item.querySelector('small').textContent = `${position.routeId} · ${position.speed} km/h · cap ${position.heading}°`;
}

function render(positions, change) {
  message.textContent = positions.length === 0 ? 'Aucune position connue.' : '';

  if (change.type === 'upsert') {
    vehicleMarkers.upsert(change.position);
    renderPosition(change.position);
    return;
  }

  vehicleMarkers.sync(positions);
  fleet.replaceChildren();
  for (const position of positions) renderPosition(position);
}

store.subscribe(render);

const initialPositions = fetch(new URL('/positions', apiUrl))
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((positions) => store.replaceAll(positions))
  .catch((error) => {
    message.textContent = `Impossible de charger les positions initiales : ${error.message}`;
  });

const socket = new WebSocket(webSocketUrl);
socket.addEventListener('message', (event) => {
  store.upsert(JSON.parse(event.data));
});

await initialPositions;
