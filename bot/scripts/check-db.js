const { sql } = require('../lib/db');

(async () => {
  if (!sql) return console.error('No DB connection');
  const rows = await sql`SELECT id, status, video_status, scheduled_time, created_at FROM posts ORDER BY created_at DESC LIMIT 5`;
  console.table(rows);
})();
