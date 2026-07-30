require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });
const { neon } = require('@neondatabase/serverless');

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!dbUrl) {
  console.warn('DATABASE_URL / POSTGRES_URL not set. DB operations will fail.');
}

const sql = dbUrl ? neon(dbUrl) : null;

module.exports = { sql, dbUrl };
