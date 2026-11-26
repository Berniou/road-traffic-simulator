import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { PositionBroadcaster } from './position-broadcaster.js';

function json(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  response.end(JSON.stringify(body));
}

export async function createAdminWebSocketServer(config, dependencies = {}) {
  const httpServer = createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/positions') {
      try {
        const positions = await dependencies.positionRepository?.findAll() ?? [];
        json(response, 200, positions);
      } catch (error) {
        console.error(`Impossible de charger les positions initiales: ${error.message}`);
        json(response, 500, { error: 'Impossible de charger les positions initiales.' });
      }
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

  httpServer.listen(config.webSocketPort, config.webSocketHost);
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
