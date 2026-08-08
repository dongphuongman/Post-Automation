import { sql, initDb } from '@/lib/db';
import { ok, fail } from '@/lib/api-response';

// Dashboard theo dõi hàng đợi bot: đếm bài theo trạng thái + bài gần đây kèm đích.
export async function GET() {
  try {
    await initDb();

    const statusRows = await sql`SELECT status, count(*)::int AS c FROM posts GROUP BY status`;
    const videoRows = await sql`SELECT video_status, count(*)::int AS c FROM posts WHERE video_status <> 'none' GROUP BY video_status`;

    const [pg] = await sql`SELECT count(*)::int AS c FROM facebook_pages WHERE active = 1`;
    const [gr] = await sql`SELECT count(*)::int AS c FROM facebook_groups WHERE active = 1`;
    const [srcAll] = await sql`SELECT count(*)::int AS c FROM sources WHERE active = 1`;

    const recent = await sql`
      SELECT p.id, p.status, p.video_status, p.target_page_id, p.target_group_ids, p.scheduled_time, p.created_at,
             a.title AS article_title,
             fp.name AS page_name
      FROM posts p
      LEFT JOIN articles a ON p.article_id = a.id
      LEFT JOIN facebook_pages fp ON p.target_page_id = fp.id
      ORDER BY p.created_at DESC LIMIT 15
    `;

    const statusCounts: Record<string, number> = {};
    for (const r of statusRows as any[]) statusCounts[r.status] = r.c;
    const videoCounts: Record<string, number> = {};
    for (const r of videoRows as any[]) videoCounts[r.video_status] = r.c;

    return ok({
      statusCounts,
      videoCounts,
      totals: { pages: pg.c, groups: gr.c, sources: srcAll.c },
      recent,
    });
  } catch (error) {
    return fail(String(error));
  }
}
