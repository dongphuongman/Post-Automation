import { sql } from '@/lib/db';
import { ok, fail } from '@/lib/api-response';
import { getSession } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const s = getSession(req);
    if (!s) return fail('Chưa đăng nhập', 401);
    const url = new URL(req.url);
    const filter = url.searchParams.get('filter') || 'all';

    const articles = s.role === 'admin'
      ? await sql`
      SELECT a.*, s.name as source_name, s.type as source_type
      FROM articles a JOIN sources s ON a.source_id = s.id
      ORDER BY a.published_at DESC LIMIT 50`
      : await sql`
      SELECT a.*, s.name as source_name, s.type as source_type
      FROM articles a JOIN sources s ON a.source_id = s.id
      WHERE a.owner_id = ${s.uid}
      ORDER BY a.published_at DESC LIMIT 50`;

    const filtered = articles.filter((a: any) => {
      if (filter === 'news') return a.source_type === 'rss';
      if (filter === 'x') return a.source_name === 'X (Twitter)';
      if (filter === 'instagram') return a.source_name === 'Instagram';
      return true;
    });

    return ok({ articles: filtered });
  } catch (error) {
    return fail(String(error));
  }
}
