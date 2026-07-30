const { sql } = require('../lib/db');

(async () => {
  if (!sql) return console.error('No DB connection');

  const v = await sql`UPDATE posts SET video_status = 'completed' WHERE video_status IN ('pending','error') RETURNING id`;
  console.log(`Flushed ${v.length} stuck videos.`);

  const g = await sql`UPDATE posts SET status = 'groups_posted' WHERE status = 'ready_for_groups' RETURNING id`;
  console.log(`Flushed ${g.length} stuck group posts.`);
})();
