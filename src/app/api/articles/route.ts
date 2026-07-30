import { sql } from '@/lib/db';
import { ok, fail } from '@/lib/api-response';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const filter = url.searchParams.get('filter') || 'all';

    const articles = await sql`
      SELECT a.*, s.name as source_name, s.type as source_type
      FROM articles a JOIN sources s ON a.source_id = s.id
      ORDER BY a.published_at DESC LIMIT 50
    `;

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
