import { FleetStore } from './fleet-store.js';
import { createMapStyle, PARIS_SECOND_ARRONDISSEMENT } from './map-style.js';
import { RealtimeConnection } from './realtime-connection.js';
import { VehicleMarkers } from './vehicle-markers.js';
import { loadVehicleRoutes } from './vehicle-routes.js';

const map = new window.maplibregl.Map({
  container: 'map',
  style: createMapStyle(),
  center: PARIS_SECOND_ARRONDISSEMENT,
  zoom: 14,
  attributionControl: { compact: true },
});
map.addControl(new window.maplibregl.NavigationControl(), 'bottom-left');

const store = new FleetStore();
const vehicleMarkers = new VehicleMarkers({ map });
const fleet = document.querySelector('#fleet');
const message = document.querySelector('#message');

loadVehicleRoutes({ map, url: '/routes' }).catch((error) => {
  message.textContent = `Impossible de charger les itinéraires : ${error.message}`;
});

const connectionStatus = document.querySelector('#connection-status');
const connectionLabel = document.querySelector('#connection-label');
const apiUrl = new URL(window.ADMIN_API_URL ?? window.location.origin);
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

const connectionLabels = {
  connecting: 'Connexion au suivi temps réel…',
  connected: 'Suivi temps réel connecté',
  disconnected: 'Connexion perdue · reconnexion automatique…',
};

async function loadPositions() {
  const response = await fetch(new URL('/positions', apiUrl));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  store.replaceAll(await response.json());
}

const connection = new RealtimeConnection({
  url: webSocketUrl,
  loadPositions,
  onPosition: (position) => store.upsert(position),
  onStatusChange: (status) => {
    connectionStatus.dataset.state = status;
    connectionLabel.textContent = connectionLabels[status];
  },
  onError: (error) => {
    const details = error instanceof Error ? ` : ${error.message}` : '';
    message.textContent = `Connexion temps réel momentanément indisponible${details}`;
  },
});
connection.start();
