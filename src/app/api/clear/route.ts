import { sql } from '@/lib/db';
import { ok, fail } from '@/lib/api-response';
import { getSession } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const s = getSession(req);
    if (!s) return fail('Chưa đăng nhập', 401);
    // Chỉ xóa dữ liệu CỦA CHÍNH MÌNH (admin cũng chỉ xóa của mình để tránh xóa nhầm
    // toàn hệ thống). Articles trước (khóa ngoại), rồi sources.
    await sql`DELETE FROM articles WHERE owner_id = ${s.uid}`;
    await sql`DELETE FROM sources WHERE owner_id = ${s.uid}`;
    return ok({ message: 'Đã xóa dữ liệu của bạn' });
  } catch (error) {
    return fail(String(error));
  }
}
