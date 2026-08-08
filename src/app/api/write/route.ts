import { sql } from '@/lib/db';
import { writeArticle } from '@/lib/ai/writer';
import { generateImageResponse } from '@/lib/ai/image-generator';
import { ok, fail } from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const s = getSession(req);
    if (!s) return fail('Chưa đăng nhập', 401);
    if (!rateLimit(`write:${s.uid}`, 10, 60_000)) {
      return fail('Quá nhiều yêu cầu. Vui lòng đợi một chút.', 429);
    }
    const { selections } = await req.json();

    for (const { id: articleId, format } of selections) {
      const [article] = await sql`SELECT * FROM articles WHERE id = ${articleId}`;
      if (!article) continue;

      const { content, hashtags } = await writeArticle(article.title, article.summary, format);
      const generatedImage = await generateImageResponse(article.title);

      const postId = 'p_' + crypto.randomUUID().slice(0, 12);
      await sql`INSERT INTO posts (id, article_id, format, content, hashtags, original_image_url, generated_image_url, owner_id) VALUES (${postId}, ${article.id}, ${format}, ${content}, ${hashtags}, ${article.original_image_url}, ${generatedImage}, ${s.uid})`;
      await sql`UPDATE articles SET status = 'written' WHERE id = ${article.id}`;
    }

    return ok({ count: selections.length });
  } catch (error) {
    return fail(String(error));
  }
}
