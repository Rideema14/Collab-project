// Dev-only convenience script — inserts a couple of demo team members so you
// have something in the "assign to" picker and something to log in with
// without going through the register endpoint by hand first.
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const DEMO_PASSWORD = 'password123';
const demoUsers = [
  { name: 'Asha Rao', email: 'asha@example.com' },
  { name: 'Ben Fischer', email: 'ben@example.com' },
];

async function seed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    for (const u of demoUsers) {
      const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
      await pool.query(
        `INSERT INTO users (name, email, password_hash)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO NOTHING`,
        [u.name, u.email, passwordHash]
      );
    }
    console.log(`Seed complete. Demo login: ${demoUsers[0].email} / ${DEMO_PASSWORD}`);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seed();
