import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { loadConfig } from '../../simulateur/src/config.js';
import { loadRoutes } from '../../simulateur/src/routes.js';

const root = resolve(import.meta.dirname, '..');
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

let routesPromise;

function getRoutes() {
  routesPromise ??= loadRoutes(loadConfig()).catch((error) => {
    routesPromise = undefined;
    throw error;
  });
  return routesPromise;
}

const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);

  if (request.method === 'GET' && pathname === '/routes') {
    try {
      const routes = await getRoutes();
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(routes));
    } catch (error) {
      console.error(`Impossible de calculer les itinéraires OSRM: ${error.message}`);
      response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'Impossible de calculer les itinéraires OSRM.' }));
    }
    return;
  }

  const filePath = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);

  if (!filePath.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end('Accès interdit');
    return;
  }

  try {
    const file = await stat(filePath);
    if (!file.isFile()) throw new Error('Fichier introuvable');
    response.writeHead(200, { 'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream' });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404).end('Ressource introuvable');
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Vue Admin disponible sur http://localhost:${port}`));
