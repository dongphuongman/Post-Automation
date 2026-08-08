import { sql, initDb } from '@/lib/db';
import { ok, fail } from '@/lib/api-response';
import { getSession } from '@/lib/auth';

// Dashboard theo dõi hàng đợi bot: đếm bài theo trạng thái + bài gần đây kèm đích.
// Phân quyền: admin thấy tất cả; user thường chỉ thấy dữ liệu của chính mình.
export async function GET(req: Request) {
  try {
    await initDb();
    const s = getSession(req);
    if (!s) return fail('Chưa đăng nhập', 401);
    const isAdmin = s.role === 'admin';
    const uid = s.uid;

    const statusRows = isAdmin
      ? await sql`SELECT status, count(*)::int AS c FROM posts GROUP BY status`
      : await sql`SELECT status, count(*)::int AS c FROM posts WHERE owner_id = ${uid} GROUP BY status`;

    const videoRows = isAdmin
      ? await sql`SELECT video_status, count(*)::int AS c FROM posts WHERE video_status <> 'none' GROUP BY video_status`
      : await sql`SELECT video_status, count(*)::int AS c FROM posts WHERE video_status <> 'none' AND owner_id = ${uid} GROUP BY video_status`;

    const [pg] = isAdmin
      ? await sql`SELECT count(*)::int AS c FROM facebook_pages WHERE active = 1`
      : await sql`SELECT count(*)::int AS c FROM facebook_pages WHERE active = 1 AND owner_id = ${uid}`;
    const [gr] = isAdmin
      ? await sql`SELECT count(*)::int AS c FROM facebook_groups WHERE active = 1`
      : await sql`SELECT count(*)::int AS c FROM facebook_groups WHERE active = 1 AND owner_id = ${uid}`;
    const [srcAll] = isAdmin
      ? await sql`SELECT count(*)::int AS c FROM sources WHERE active = 1`
      : await sql`SELECT count(*)::int AS c FROM sources WHERE active = 1 AND owner_id = ${uid}`;

    // Bài "đã đăng" = status posted/groups_posted; "chưa đăng" = còn lại. Mỗi mục lấy 10 bài gần nhất riêng.
    const recentPosted = isAdmin
      ? await sql`
          SELECT p.id, p.status, p.video_status, p.target_page_id, p.target_group_ids, p.scheduled_time, p.created_at,
                 a.title AS article_title, fp.name AS page_name
          FROM posts p
          LEFT JOIN articles a ON p.article_id = a.id
          LEFT JOIN facebook_pages fp ON p.target_page_id = fp.id
          WHERE p.status IN ('posted', 'groups_posted')
          ORDER BY p.created_at DESC LIMIT 10
        `
      : await sql`
          SELECT p.id, p.status, p.video_status, p.target_page_id, p.target_group_ids, p.scheduled_time, p.created_at,
                 a.title AS article_title, fp.name AS page_name
          FROM posts p
          LEFT JOIN articles a ON p.article_id = a.id
          LEFT JOIN facebook_pages fp ON p.target_page_id = fp.id
          WHERE p.status IN ('posted', 'groups_posted') AND p.owner_id = ${uid}
          ORDER BY p.created_at DESC LIMIT 10
        `;

    const recentPending = isAdmin
      ? await sql`
          SELECT p.id, p.status, p.video_status, p.target_page_id, p.target_group_ids, p.scheduled_time, p.created_at,
                 a.title AS article_title, fp.name AS page_name
          FROM posts p
          LEFT JOIN articles a ON p.article_id = a.id
          LEFT JOIN facebook_pages fp ON p.target_page_id = fp.id
          WHERE p.status NOT IN ('posted', 'groups_posted')
          ORDER BY p.created_at DESC LIMIT 10
        `
      : await sql`
          SELECT p.id, p.status, p.video_status, p.target_page_id, p.target_group_ids, p.scheduled_time, p.created_at,
                 a.title AS article_title, fp.name AS page_name
          FROM posts p
          LEFT JOIN articles a ON p.article_id = a.id
          LEFT JOIN facebook_pages fp ON p.target_page_id = fp.id
          WHERE p.status NOT IN ('posted', 'groups_posted') AND p.owner_id = ${uid}
          ORDER BY p.created_at DESC LIMIT 10
        `;

    const statusCounts: Record<string, number> = {};
    for (const r of statusRows as any[]) statusCounts[r.status] = r.c;
    const videoCounts: Record<string, number> = {};
    for (const r of videoRows as any[]) videoCounts[r.video_status] = r.c;

    return ok({
      statusCounts,
      videoCounts,
      totals: { pages: pg.c, groups: gr.c, sources: srcAll.c },
      recentPosted,
      recentPending,
    });
  } catch (error) {
    return fail(String(error));
  }
}
