import { sql } from '@/lib/db';
import { ok, fail } from '@/lib/api-response';

export async function POST(req: Request) {
  try {
    const { postId } = await req.json();
    if (!postId) return fail('Missing postId', 400);

    await sql`UPDATE posts SET status = 'ready_for_groups' WHERE id = ${postId}`;
    return ok();
  } catch (error) {
    return fail(String(error));
  }
}
