import { sql } from '@/lib/db';
import { ok, fail } from '@/lib/api-response';
import { getSession } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const s = getSession(req);
    if (!s) return fail('Chưa đăng nhập', 401);
    const { postId } = await req.json();
    if (!postId) return fail('Missing postId', 400);

    // Non-admin chỉ đánh dấu được bài của chính mình.
    if (s.role !== 'admin') { const [r] = await sql`SELECT owner_id FROM posts WHERE id=${postId}`; if (!r || r.owner_id !== s.uid) return fail('Không có quyền', 403); }
    await sql`UPDATE posts SET status = 'ready_for_groups' WHERE id = ${postId}`;
    return ok();
  } catch (error) {
    return fail(String(error));
  }
}
