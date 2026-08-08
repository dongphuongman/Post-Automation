import { sql } from '@/lib/db';
import { ok, fail } from '@/lib/api-response';
import { getSession, hashPassword, revokeUserSessions, signSession, sessionCookie } from '@/lib/auth';

// User cập nhật hồ sơ CHÍNH MÌNH (tên, mật khẩu).
export async function PATCH(req: Request) {
  try {
    const s = getSession(req);
    if (!s) return fail('Chưa đăng nhập', 401);
    const { name, password } = await req.json();
    const pwHash = password ? hashPassword(password) : null;
    await sql`UPDATE users SET
      name = COALESCE(${name ?? null}, name),
      password_hash = COALESCE(${pwHash}, password_hash)
      WHERE id = ${s.uid}`;
    const res = ok({});
    if (pwHash) {
      // Đổi mật khẩu → vô hiệu MỌI phiên cũ, rồi cấp cookie mới cho chính mình.
      revokeUserSessions(s.uid);
      res.headers.set('Set-Cookie', sessionCookie(signSession(s.uid, s.role)));
    }
    return res;
  } catch (e) { return fail(String(e)); }
}
