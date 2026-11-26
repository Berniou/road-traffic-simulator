import { FleetStore } from './fleet-store.js';

const store = new FleetStore();
const fleet = document.querySelector('#fleet');
const message = document.querySelector('#message');
const apiUrl = new URL(window.ADMIN_API_URL ?? `http://${window.location.hostname}:8080`);
const webSocketUrl = new URL('/ws', apiUrl);
webSocketUrl.protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';

function render(positions) {
  fleet.replaceChildren();
  message.textContent = positions.length === 0 ? 'Aucune position connue.' : '';

  for (const position of positions) {
    const item = document.createElement('li');
    item.dataset.carId = position.carId;
    item.innerHTML = `
      <strong></strong>
      <span></span>
      <small></small>
    `;
    item.querySelector('strong').textContent = position.carId;
    item.querySelector('span').textContent = `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`;
    item.querySelector('small').textContent = `${position.routeId} · ${position.speed} km/h · cap ${position.heading}°`;
    fleet.append(item);
  }
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
