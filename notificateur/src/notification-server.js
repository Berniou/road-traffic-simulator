import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { PositionBroadcaster } from './position-broadcaster.js';

const MAX_BODY_SIZE = 1024 * 1024;

function json(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_SIZE) {
      throw new Error('Corps de requête trop volumineux.');
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    throw new Error('Corps de requête vide.');
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function createNotificationServer(config, dependencies = {}) {
  const httpServer = createServer(async (request, response) => {
    const { pathname } = new URL(request.url, 'http://localhost');

    if (request.method === 'GET' && pathname === '/positions') {
      try {
        const positions = await dependencies.positionRepository?.findAll() ?? [];
        json(response, 200, positions);
      } catch (error) {
        console.error(`Impossible de charger les positions initiales: ${error.message}`);
        json(response, 500, { error: 'Impossible de charger les positions initiales.' });
      }
      return;
    }

    if (request.method === 'POST' && pathname === '/notify') {
      try {
        const position = await readJsonBody(request);
        broadcaster.broadcast(position);
        json(response, 202, { status: 'notified' });
      } catch (error) {
        console.error(`Position non diffusée: ${error.message}`);
        json(response, 400, { error: `Position non diffusée: ${error.message}` });
      }
      return;
    }

    if (request.method === 'GET' && pathname === '/health') {
      json(response, 200, { status: 'ok' });
      return;
    }

    json(response, 404, { error: 'Ressource introuvable.' });
  });

  const server = new WebSocketServer({
    server: httpServer,
    path: config.webSocketPath,
  });
  const broadcaster = new PositionBroadcaster({
    clients: server.clients,
    onError: (error, carId) => {
      console.error(`Échec de diffusion WebSocket pour ${carId}: ${error.message}`);
    },
  });

  server.on('connection', (socket) => {
    socket.on('error', (error) => {
      console.error(`Client WebSocket Admin indisponible: ${error.message}`);
    });
  });

  httpServer.listen(config.port, config.host);
  await new Promise((resolve, reject) => {
    httpServer.once('listening', resolve);
    httpServer.once('error', reject);
  });

  return {
    broadcaster,
    address: () => server.address(),
    close: async () => {
      for (const client of server.clients) client.terminate();
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await new Promise((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
