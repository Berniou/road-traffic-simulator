const REQUIRED_NUMERIC_FIELDS = ['lat', 'lng', 'heading', 'speed', 'ts'];

export function validatePosition(position) {
  if (!position || typeof position !== 'object' || Array.isArray(position)) {
    throw new Error('La position doit être un objet.');
  }
  if (typeof position.carId !== 'string' || position.carId.length === 0) {
    throw new Error('La position doit contenir un carId.');
  }
  if (typeof position.routeId !== 'string' || position.routeId.length === 0) {
    throw new Error(`Position invalide pour ${position.carId}: routeId manquant.`);
  }
  for (const field of REQUIRED_NUMERIC_FIELDS) {
    if (typeof position[field] !== 'number' || !Number.isFinite(position[field])) {
      throw new Error(`Position invalide pour ${position.carId}: ${field} invalide.`);
    }
  }
  return position;
}

export class PositionBroadcaster {
  constructor({ clients, onError = (error) => console.error(error.message) }) {
    this.clients = clients;
    this.onError = onError;
  }

  broadcast(position) {
    const payload = JSON.stringify(validatePosition(position));

    for (const client of this.clients) {
      if (client.readyState !== 1) continue;
      try {
        client.send(payload, (error) => {
          if (error) this.onError(error, position.carId);
        });
      } catch (error) {
        this.onError(error, position.carId);
      }
    }
  }
}
