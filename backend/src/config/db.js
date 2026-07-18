const { Pool, types } = require('pg');
const env = require('./env');

// By default node-postgres parses DATE columns into JS Date objects at
// UTC midnight. Postgres DATE has no time/timezone component, so letting it
// become a Date (and later get serialized via toISOString()) risks an
// off-by-one-day bug for anyone in a negative-UTC timezone. Keep it a plain
// 'YYYY-MM-DD' string instead — that's what a due date actually is.
types.setTypeParser(types.builtins.DATE, (val) => val);

const pool = new Pool({
  connectionString: env.databaseUrl,
  // The DB is remote (Supabase), so a cold TLS handshake dominates request
  // latency. Keep connections warm and reused instead of re-opening one per
  // request: TCP keepalive stops idle sockets being dropped, and a longer idle
  // timeout keeps a pooled connection around between (infrequent) logins.
  keepAlive: true,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  max: 10,
});

pool.on('error', (err) => {
  // A background/idle client errored — this is unrecoverable, so fail loudly.
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(1);
});

module.exports = { pool };
