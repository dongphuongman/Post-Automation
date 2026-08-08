import { sql, initDb, seedDb } from '@/lib/db';
import { ok, fail } from '@/lib/api-response';
import { getSession } from '@/lib/auth';

// Thẻ thống kê trang chính. Phân quyền: admin thấy tất cả; user thường chỉ dữ liệu của mình.
export async function GET(req: Request) {
  try {
    try {
      await initDb();
      await seedDb();
    } catch { /* ignore on subsequent runs */ }

    const s = getSession(req);
    if (!s) return fail('Chưa đăng nhập', 401);
    const isAdmin = s.role === 'admin';
    const uid = s.uid;

    const [tA] = isAdmin
      ? await sql`SELECT count(*) as c FROM articles`
      : await sql`SELECT count(*) as c FROM articles WHERE owner_id = ${uid}`;
    const [nA] = isAdmin
      ? await sql`SELECT count(*) as c FROM articles WHERE status = 'new'`
      : await sql`SELECT count(*) as c FROM articles WHERE status = 'new' AND owner_id = ${uid}`;
    const [tP] = isAdmin
      ? await sql`SELECT count(*) as c FROM posts`
      : await sql`SELECT count(*) as c FROM posts WHERE owner_id = ${uid}`;
    const [pT] = isAdmin
      ? await sql`SELECT count(*) as c FROM posts WHERE status = 'posted' AND created_at::date = CURRENT_DATE`
      : await sql`SELECT count(*) as c FROM posts WHERE status = 'posted' AND created_at::date = CURRENT_DATE AND owner_id = ${uid}`;

    const recentPosts = isAdmin
      ? await sql`
          SELECT p.id, a.title, p.status, p.format, p.created_at
          FROM posts p JOIN articles a ON p.article_id = a.id
          ORDER BY p.created_at DESC LIMIT 5
        `
      : await sql`
          SELECT p.id, a.title, p.status, p.format, p.created_at
          FROM posts p JOIN articles a ON p.article_id = a.id
          WHERE p.owner_id = ${uid}
          ORDER BY p.created_at DESC LIMIT 5
        `;

    return ok({
      stats: { totalArticles: tA.c, newArticles: nA.c, totalPosts: tP.c, postedToday: pT.c },
      recentPosts,
    });
  } catch (error) {
    return fail(String(error));
  }
}
