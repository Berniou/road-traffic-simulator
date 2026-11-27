import { FleetStore } from './fleet-store.js';
import { createMapStyle, PARIS_SECOND_ARRONDISSEMENT } from './map-style.js';
import { RealtimeConnection } from './realtime-connection.js';
import { describeVehicle } from './vehicle-info.js';
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
const fleetToggle = document.querySelector('#fleet-toggle');
const message = document.querySelector('#message');
const architectureGif = document.querySelector('#architecture-gif');
const architectureFallback = document.querySelector('#architecture-fallback');

function showArchitectureFallback() {
  architectureGif.hidden = true;
  architectureFallback.hidden = false;
}

architectureGif.addEventListener('error', showArchitectureFallback);
if (architectureGif.complete && architectureGif.naturalWidth === 0) {
  showArchitectureFallback();
}

function setFleetVisible(visible) {
  fleet.hidden = !visible;
  fleetToggle.setAttribute('aria-expanded', String(visible));
  fleetToggle.textContent = visible ? 'Masquer les véhicules' : 'Afficher les véhicules';
}

fleetToggle.addEventListener('click', () => {
  setFleetVisible(fleet.hidden);
});

loadVehicleRoutes({ map, url: '/routes' }).catch((error) => {
  message.textContent = `Impossible de charger les itinéraires : ${error.message}`;
});

const connectionStatus = document.querySelector('#connection-status');
const connectionLabel = document.querySelector('#connection-label');
const apiUrl = new URL(window.ADMIN_API_URL ?? window.location.origin);
const webSocketUrl = new URL('/ws', apiUrl);
webSocketUrl.protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';

function createFleetItem(position) {
  const item = document.createElement('li');
  item.dataset.carId = position.carId;
  item.innerHTML = `
    <div class="fleet-item__header">
      <span class="fleet-item__dot" aria-hidden="true"></span>
      <strong class="fleet-item__id"></strong>
      <span class="fleet-item__state"></span>
    </div>
    <dl class="fleet-item__stats">
      <div class="fleet-item__stat">
        <dt>Vitesse</dt>
        <dd class="fleet-item__speed"></dd>
      </div>
      <div class="fleet-item__stat">
        <dt>Cap</dt>
        <dd class="fleet-item__heading"></dd>
      </div>
      <div class="fleet-item__stat">
        <dt>Itinéraire</dt>
        <dd class="fleet-item__route"></dd>
      </div>
      <div class="fleet-item__stat fleet-item__stat--wide">
        <dt>Position</dt>
        <dd class="fleet-item__coords"></dd>
      </div>
    </dl>
  `;
  return item;
}

function renderPosition(position) {
  let item = [...fleet.children].find((child) => child.dataset.carId === position.carId);

  if (!item) {
    item = createFleetItem(position);
    const nextItem = [...fleet.children].find(
      (child) => child.dataset.carId.localeCompare(position.carId) > 0,
    );
    fleet.insertBefore(item, nextItem ?? null);
  }

  const info = describeVehicle(position);
  item.style.setProperty('--vehicle-color', info.color);
  item.querySelector('.fleet-item__id').textContent = position.carId;

  const state = item.querySelector('.fleet-item__state');
  state.dataset.state = info.state;
  state.textContent = info.stateLabel;

  item.querySelector('.fleet-item__speed').textContent = info.speed;
  item.querySelector('.fleet-item__heading').textContent = info.heading;
  item.querySelector('.fleet-item__route').textContent = info.route;
  item.querySelector('.fleet-item__coords').textContent = info.coords;
  item.setAttribute('aria-label', `${position.carId} — ${info.stateLabel}`);
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
