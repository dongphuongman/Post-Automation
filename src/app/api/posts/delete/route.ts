import { sql } from '@/lib/db';
import { ok, fail } from '@/lib/api-response';

export async function POST(req: Request) {
  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return fail('ids must be a non-empty array', 400);
    }

    await sql`DELETE FROM posts WHERE id = ANY(${ids})`;
    return ok();
  } catch (error) {
    return fail(String(error));
  }
}
