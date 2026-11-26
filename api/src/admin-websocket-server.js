import { WebSocketServer } from 'ws';
import { PositionBroadcaster } from './position-broadcaster.js';

export async function createAdminWebSocketServer(config) {
  const server = new WebSocketServer({
    host: config.webSocketHost,
    port: config.webSocketPort,
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

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  return {
    broadcaster,
    address: () => server.address(),
    close: async () => {
      for (const client of server.clients) client.terminate();
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
