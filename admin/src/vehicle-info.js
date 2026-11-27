import { getVehicleState } from './vehicle-markers.js';
import { routeColor } from './route-colors.js';

export const VEHICLE_STATE_LABELS = Object.freeze({
  moving: 'En mouvement',
  stopped: "À l'arrêt",
  error: 'En erreur',
});

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

export function formatHeading(heading) {
  const degrees = Number(heading);
  if (!Number.isFinite(degrees)) return '—';
  const normalized = ((degrees % 360) + 360) % 360;
  const cardinal = CARDINALS[Math.round(normalized / 45) % CARDINALS.length];
  return `${Math.round(normalized)}° ${cardinal}`;
}

export function describeVehicle(position) {
  const state = getVehicleState(position);
  const speed = Number(position.speed);
  const lat = Number(position.lat);
  const lng = Number(position.lng);

  return {
    state,
    stateLabel: VEHICLE_STATE_LABELS[state],
    color: routeColor(position.routeId),
    speed: Number.isFinite(speed) ? `${Math.round(speed)} km/h` : '—',
    heading: formatHeading(position.heading),
    route: position.routeId ? String(position.routeId) : '—',
    coords: Number.isFinite(lat) && Number.isFinite(lng)
      ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      : '—',
  };
}
