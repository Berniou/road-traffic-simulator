const DEFAULTS = Object.freeze({
  host: '0.0.0.0',
  port: 8080,
  webSocketPath: '/ws',
  databaseUrl: 'postgresql://postgres:postgres@localhost:5432/fleet',
});

function port(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error('PORT doit être un port valide.');
  }
  return parsed;
}

export function loadConfig(env = process.env) {
  return {
    host: env.HOST ?? DEFAULTS.host,
    port: env.PORT === undefined ? DEFAULTS.port : port(env.PORT),
    webSocketPath: env.WEBSOCKET_PATH ?? DEFAULTS.webSocketPath,
    databaseUrl: env.DATABASE_URL ?? DEFAULTS.databaseUrl,
  };
}
