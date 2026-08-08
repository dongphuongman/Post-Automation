import { sql, initDb } from '@/lib/db';
import { ok, fail } from '@/lib/api-response';
import { getSession, hashPassword, revokeUserSessions } from '@/lib/auth';

// Quản lý user — CHỈ admin. User thường không truy cập được.
async function requireAdmin(req: Request) {
  const s = getSession(req);
  if (!s) return { err: fail('Chưa đăng nhập', 401) };
  if (s.role !== 'admin') return { err: fail('Chỉ admin', 403) };
  return { s };
}

export async function GET(req: Request) {
  try {
    await initDb();
    const { err } = await requireAdmin(req);
    if (err) return err;
    const users = await sql`SELECT id, email, name, role, active, created_at FROM users ORDER BY created_at ASC`;
    return ok({ users });
  } catch (e) { return fail(String(e)); }
}

export async function POST(req: Request) {
  try {
    const { err } = await requireAdmin(req);
    if (err) return err;
    const { email, name, password, role = 'user' } = await req.json();
    if (!email || !password) return fail('Cần email và mật khẩu', 400);
    const id = 'u_' + crypto.randomUUID().slice(0, 12);
    try {
      await sql`INSERT INTO users (id, email, name, password_hash, role, active)
        VALUES (${id}, ${String(email).toLowerCase()}, ${name || email}, ${hashPassword(password)}, ${role === 'admin' ? 'admin' : 'user'}, 1)`;
    } catch { return fail('Email đã tồn tại', 400); }
    return ok({ id });
  } catch (e) { return fail(String(e)); }
}

export async function PATCH(req: Request) {
  try {
    const { err } = await requireAdmin(req);
    if (err) return err;
    const { id, name, role, active, password } = await req.json();
    if (!id) return fail('Thiếu id', 400);
    const pwHash = password ? hashPassword(password) : null;
    await sql`UPDATE users SET
      name = COALESCE(${name ?? null}, name),
      role = COALESCE(${role ?? null}, role),
      active = COALESCE(${active ?? null}, active),
      password_hash = COALESCE(${pwHash}, password_hash)
      WHERE id = ${id}`;
    // Đổi mật khẩu (hoặc khóa/mở tài khoản) → vô hiệu mọi phiên hiện tại của user đó.
    if (pwHash || active === 0) revokeUserSessions(id);
    return ok({});
  } catch (e) { return fail(String(e)); }
}

export async function DELETE(req: Request) {
  try {
    const { s, err } = await requireAdmin(req);
    if (err) return err;
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return fail('Thiếu id', 400);
    if (id === s!.uid) return fail('Không thể tự xóa mình', 400);
    await sql`DELETE FROM users WHERE id = ${id}`;
    return ok({});
  } catch (e) { return fail(String(e)); }
}
