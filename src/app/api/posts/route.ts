import { sql } from '@/lib/db';
import { ok, fail } from '@/lib/api-response';
import { getSession } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const s = getSession(req);
    if (!s) return fail('Chưa đăng nhập', 401);
    const posts = s.role === 'admin'
      ? await sql`
      SELECT p.*, a.title as article_title, a.url as article_url
      FROM posts p JOIN articles a ON p.article_id = a.id
      ORDER BY p.created_at DESC`
      : await sql`
      SELECT p.*, a.title as article_title, a.url as article_url
      FROM posts p JOIN articles a ON p.article_id = a.id
      WHERE p.owner_id = ${s.uid}
      ORDER BY p.created_at DESC`;
    return ok({ posts });
  } catch (error) {
    return fail(String(error));
  }
}

export async function PATCH(req: Request) {
  try {
    const s = getSession(req); if (!s) return fail('Chưa đăng nhập', 401);
    const { id, content, hashtags } = await req.json();
    if (!id) return fail('Missing post id', 400);
    if (s.role !== 'admin') { const [r] = await sql`SELECT owner_id FROM posts WHERE id=${id}`; if (!r || r.owner_id !== s.uid) return fail('Không có quyền', 403); }
    await sql`UPDATE posts SET content = ${content}, hashtags = ${hashtags} WHERE id = ${id}`;
    return ok();
  } catch (error) {
    return fail(String(error));
  }
}
