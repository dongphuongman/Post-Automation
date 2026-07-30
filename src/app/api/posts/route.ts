import { sql } from '@/lib/db';
import { ok, fail } from '@/lib/api-response';

export async function GET() {
  try {
    const posts = await sql`
      SELECT p.*, a.title as article_title, a.url as article_url
      FROM posts p JOIN articles a ON p.article_id = a.id
      ORDER BY p.created_at DESC
    `;
    return ok({ posts });
  } catch (error) {
    return fail(String(error));
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, content, hashtags } = await req.json();
    if (!id) return fail('Missing post id', 400);

    await sql`UPDATE posts SET content = ${content}, hashtags = ${hashtags} WHERE id = ${id}`;
    return ok();
  } catch (error) {
    return fail(String(error));
  }
}
