import { sql } from '@/lib/db';
import { ok, fail } from '@/lib/api-response';
import { getSession } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const s = getSession(req);
    if (!s) return fail('Chưa đăng nhập', 401);
    const [u] = await sql`SELECT id, email, name, role FROM users WHERE id = ${s.uid} AND active = 1`;
    if (!u) return fail('Chưa đăng nhập', 401);
    return ok({ user: u });
  } catch (error) {
    return fail(String(error));
  }
}
