import { sql, initDb } from '@/lib/db';
import { ok, fail } from '@/lib/api-response';
import { encrypt } from '@/lib/crypto';
import { getSession } from '@/lib/auth';

// Quản lý credential mạng xã hội per-user per-platform (X / Threads / Instagram).
// Mỗi (owner, platform) một hàng. KHÔNG BAO GIỜ trả secret thô — chỉ trả
// has_cookies / has_token / name / active. Gắn theo owner_id, mã hóa cookie/token.

const PLATFORMS = ['x', 'threads', 'instagram'];

function normPlatform(p: string | null): string | null {
  if (!p) return null;
  const v = String(p).toLowerCase();
  return PLATFORMS.includes(v) ? v : null;
}

export async function GET(req: Request) {
  try {
    await initDb();
    const s = getSession(req);
    if (!s) return fail('Chưa đăng nhập', 401);
    const platform = normPlatform(new URL(req.url).searchParams.get('platform'));

    if (platform) {
      const rows = await sql`SELECT id, platform, name, cookies_enc, token_enc, active, created_at FROM social_accounts WHERE owner_id = ${s.uid} AND platform = ${platform} ORDER BY created_at DESC LIMIT 1`;
      const a = (rows as any[])[0];
      const account = a
        ? { id: a.id, platform: a.platform, name: a.name, active: a.active, has_cookies: !!a.cookies_enc, has_token: !!a.token_enc }
        : null;
      return ok({ account });
    }

    // Không có platform → trả danh sách tất cả platform của user.
    const rows = await sql`SELECT id, platform, name, cookies_enc, token_enc, active, created_at FROM social_accounts WHERE owner_id = ${s.uid} ORDER BY created_at DESC`;
    const accounts = (rows as any[]).map((a) => ({
      id: a.id, platform: a.platform, name: a.name, active: a.active, has_cookies: !!a.cookies_enc, has_token: !!a.token_enc,
    }));
    return ok({ accounts });
  } catch (error) {
    return fail(String(error));
  }
}

// POST/PATCH hợp nhất: nếu (owner, platform) đã có → cập nhật, chưa có → tạo mới.
export async function POST(req: Request) {
  try {
    await initDb();
    const s = getSession(req);
    if (!s) return fail('Chưa đăng nhập', 401);
    const { platform: rawPlatform, name, cookies, token } = await req.json();
    const platform = normPlatform(rawPlatform);
    if (!platform) return fail('Nền tảng không hợp lệ (x | threads | instagram)', 400);

    const cookiesEnc = cookies ? encrypt(typeof cookies === 'string' ? cookies : JSON.stringify(cookies)) : null;
    const tokenEnc = token ? encrypt(typeof token === 'string' ? token : JSON.stringify(token)) : null;

    const [existing] = await sql`SELECT id FROM social_accounts WHERE owner_id = ${s.uid} AND platform = ${platform} ORDER BY created_at DESC LIMIT 1`;
    if (existing) {
      await sql`
        UPDATE social_accounts SET
          name = COALESCE(${name ?? null}, name),
          cookies_enc = COALESCE(${cookiesEnc}, cookies_enc),
          token_enc = COALESCE(${tokenEnc}, token_enc)
        WHERE id = ${existing.id}
      `;
      return ok({ id: existing.id });
    }

    const id = 'sa_' + crypto.randomUUID().slice(0, 12);
    await sql`
      INSERT INTO social_accounts (id, owner_id, platform, name, cookies_enc, token_enc, active)
      VALUES (${id}, ${s.uid}, ${platform}, ${name || platform}, ${cookiesEnc}, ${tokenEnc}, 1)
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
    await initDb();
    const s = getSession(req);
    if (!s) return fail('Chưa đăng nhập', 401);
    const platform = normPlatform(new URL(req.url).searchParams.get('platform'));
    if (!platform) return fail('Thiếu platform để ngắt kết nối', 400);
    await sql`DELETE FROM social_accounts WHERE owner_id = ${s.uid} AND platform = ${platform}`;
    return ok({});
  } catch (error) {
    return fail(String(error));
  }
}
