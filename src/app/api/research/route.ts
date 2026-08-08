import { sql, initDb, seedDb } from '@/lib/db';
import { scrapeAllRSSFeeds, ScrapedArticle } from '@/lib/research/rss-scraper';
import { searchSocialMedia } from '@/lib/research/social-scraper';
import { ok, fail } from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const s = getSession(req);
    if (!s) return fail('Chưa đăng nhập', 401);
    if (!rateLimit(`research:${s.uid}`, 10, 60_000)) {
      return fail('Quá nhiều yêu cầu. Vui lòng đợi một chút.', 429);
    }
    try {
      await initDb();
      await seedDb();
    } catch (e) {
      console.error('DB Init Error:', e);
    }

    const { sourceFilter } = await req.json();
    let articles: ScrapedArticle[] = [];

    if (sourceFilter === 'all' || sourceFilter === 'news') {
      const rssSources = s.role === 'admin'
        ? await sql`SELECT name, rss_url FROM sources WHERE type = 'rss' AND active = 1`
        : await sql`SELECT name, rss_url FROM sources WHERE type = 'rss' AND active = 1 AND owner_id = ${s.uid}`;
      const rssData = await scrapeAllRSSFeeds(rssSources as any);
      articles = [...articles, ...rssData];
    }

    if (sourceFilter === 'all' || sourceFilter === 'x') {
      const xData = await searchSocialMedia('x');
      console.log(`[RESEARCH] X scan returned ${xData.length} results`);
      articles = [...articles, ...xData];
    }

    if (sourceFilter === 'all' || sourceFilter === 'instagram') {
      const igData = await searchSocialMedia('instagram');
      articles = [...articles, ...igData];
    }

    let count = 0;

    for (const a of articles) {
      let [source] = await sql`SELECT id FROM sources WHERE name = ${a.sourceName}`;
      if (!source) {
        const newSourceId = 's_' + crypto.randomUUID().slice(0, 12);
        await sql`INSERT INTO sources (id, name, type, owner_id) VALUES (${newSourceId}, ${a.sourceName}, 'social', ${s.uid})`;
        source = { id: newSourceId };
      }

      try {
        const id = 'a_' + crypto.randomUUID().slice(0, 12);
        let imageData = a.imageUrl;
        if (a.imageUrl && a.imageUrl.startsWith('http')) {
          const referer = a.sourceName === 'Instagram'
            ? 'https://www.instagram.com/'
            : a.sourceName === 'X (Twitter)'
              ? 'https://twitter.com/'
              : undefined;

          try {
            const imgRes = await fetch(a.imageUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                ...(referer ? { Referer: referer } : {}),
              },
              signal: AbortSignal.timeout(5000),
            });
            if (imgRes.ok) {
              const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
              const buf = await imgRes.arrayBuffer();
              const base64 = Buffer.from(buf).toString('base64');
              imageData = `data:${contentType};base64,${base64}`;
            }
          } catch { /* keep original URL on fetch failure */ }
        }
        await sql`INSERT INTO articles (id, source_id, title, url, summary, original_image_url, owner_id) VALUES (${id}, ${source.id}, ${a.title}, ${a.url}, ${a.summary}, ${imageData}, ${s.uid}) ON CONFLICT DO NOTHING`;
        count++;
      } catch { /* ignore duplicate URL */ }
    }

    return ok({ count });
  } catch (error) {
    return fail(String(error));
  }
}
