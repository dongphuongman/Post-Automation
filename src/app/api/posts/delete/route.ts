import { sql } from '@/lib/db';
import { ok, fail } from '@/lib/api-response';
import { getSession } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const s = getSession(req);
    if (!s) return fail('Chưa đăng nhập', 401);
    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return fail('ids must be a non-empty array', 400);
    }

    // Non-admin chỉ xóa được bài của chính mình.
    if (s.role === 'admin') await sql`DELETE FROM posts WHERE id = ANY(${ids})`;
    else await sql`DELETE FROM posts WHERE id = ANY(${ids}) AND owner_id = ${s.uid}`;
    return ok();
  } catch (error) {
    return fail(String(error));
  }
}
