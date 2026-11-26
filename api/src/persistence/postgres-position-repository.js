import pg from 'pg';

const { Pool } = pg;

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS car_positions (
    car_id TEXT PRIMARY KEY,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    heading DOUBLE PRECISION NOT NULL,
    speed DOUBLE PRECISION NOT NULL,
    route_id TEXT NOT NULL,
    ts BIGINT NOT NULL
  )
`;

const UPSERT_POSITION = `
  INSERT INTO car_positions (car_id, lat, lng, heading, speed, route_id, ts)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  ON CONFLICT (car_id) DO UPDATE SET
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    heading = EXCLUDED.heading,
    speed = EXCLUDED.speed,
    route_id = EXCLUDED.route_id,
    ts = EXCLUDED.ts
  WHERE car_positions.ts <= EXCLUDED.ts
`;

function toPosition(row) {
  return {
    carId: row.car_id,
    lat: row.lat,
    lng: row.lng,
    heading: row.heading,
    speed: row.speed,
    routeId: row.route_id,
    ts: Number(row.ts),
  };
}

export function createPostgresPositionRepository(databaseUrl, dependencies = {}) {
  const pool = dependencies.pool ?? new Pool({ connectionString: databaseUrl });

  return {
    async initialize() {
      await pool.query(CREATE_TABLE);
    },

    async save(position) {
      await pool.query(UPSERT_POSITION, [
        position.carId,
        position.lat,
        position.lng,
        position.heading,
        position.speed,
        position.routeId,
        position.ts,
      ]);
    },

    async findAll() {
      const result = await pool.query('SELECT * FROM car_positions ORDER BY car_id');
      return result.rows.map(toPosition);
    },

    async close() {
      await pool.end();
    },
  };
}
