const { sql } = require('../lib/db');

(async () => {
  if (!sql) return console.error('No DB connection');
  const res = await sql`UPDATE posts SET video_status = 'pending' WHERE video_status = 'error' RETURNING id`;
  console.log(`Reset ${res.length} errored videos back to pending.`);
})();
