import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
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
