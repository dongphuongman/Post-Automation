import { sql, initDb } from '@/lib/db';
import { ok, fail } from '@/lib/api-response';
import { encrypt } from '@/lib/crypto';
import { getSession } from '@/lib/auth';

// Quản lý phiên Facebook CÁ NHÂN của user (mỗi user 1 phiên). KHÔNG BAO GIỜ trả
// cookie thô — chỉ trả has_cookies + name. Gắn theo owner_id, mã hóa cookie.

export async function GET(req: Request) {
  try {
    await initDb();
    const s = getSession(req);
    if (!s) return fail('Chưa đăng nhập', 401);
    const rows = await sql`SELECT id, name, cookies_enc, active, created_at FROM facebook_accounts WHERE owner_id = ${s.uid} ORDER BY created_at DESC LIMIT 1`;
    const a = (rows as any[])[0];
    const account = a
      ? { id: a.id, name: a.name, active: a.active, has_cookies: !!a.cookies_enc }
      : null;
    return ok({ account });
  } catch (error) {
    return fail(String(error));
  }
}

// POST/PATCH hợp nhất: nếu user đã có phiên → cập nhật, chưa có → tạo mới.
export async function POST(req: Request) {
  try {
    const s = getSession(req);
    if (!s) return fail('Chưa đăng nhập', 401);
    const { name, cookies } = await req.json();
    const cookiesEnc = cookies ? encrypt(typeof cookies === 'string' ? cookies : JSON.stringify(cookies)) : null;

    const [existing] = await sql`SELECT id FROM facebook_accounts WHERE owner_id = ${s.uid} ORDER BY created_at DESC LIMIT 1`;
    if (existing) {
      await sql`
        UPDATE facebook_accounts SET
          name = COALESCE(${name ?? null}, name),
          cookies_enc = COALESCE(${cookiesEnc}, cookies_enc)
        WHERE id = ${existing.id}
      `;
      return ok({ id: existing.id });
    }

    const id = 'fa_' + crypto.randomUUID().slice(0, 12);
    await sql`
      INSERT INTO facebook_accounts (id, owner_id, name, cookies_enc, active)
      VALUES (${id}, ${s.uid}, ${name || 'Facebook cá nhân'}, ${cookiesEnc}, 1)
    `;
    return ok({ id });
  } catch (error) {
    return fail(String(error));
  }
}

export async function PATCH(req: Request) {
  return POST(req);
}

export async function DELETE(req: Request) {
  try {
    const s = getSession(req);
    if (!s) return fail('Chưa đăng nhập', 401);
    await sql`DELETE FROM facebook_accounts WHERE owner_id = ${s.uid}`;
    return ok({});
  } catch (error) {
    return fail(String(error));
  }
}
