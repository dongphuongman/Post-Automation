import { sql, initDb } from '@/lib/db';
import { ok, fail } from '@/lib/api-response';
import { encrypt } from '@/lib/crypto';
import { getSession } from '@/lib/auth';

// Quản lý đa Facebook Page. KHÔNG BAO GIỜ trả token/cookie thô ra client —
// chỉ trả cờ has_token / has_cookies. Gắn theo user (admin thấy tất cả).

export async function GET(req: Request) {
  try {
    await initDb();
    const s = getSession(req);
    if (!s) return fail('Chưa đăng nhập', 401);
    const rows = s.role === 'admin'
      ? await sql`SELECT id, name, url, page_id, access_token_enc, cookies_enc, active, created_at FROM facebook_pages ORDER BY created_at ASC`
      : await sql`SELECT id, name, url, page_id, access_token_enc, cookies_enc, active, created_at FROM facebook_pages WHERE owner_id = ${s.uid} ORDER BY created_at ASC`;
    const pages = (rows as any[]).map((p) => ({
      id: p.id,
      name: p.name,
      url: p.url,
      page_id: p.page_id,
      active: p.active,
      has_token: !!p.access_token_enc,
      has_cookies: !!p.cookies_enc,
    }));
    return ok({ pages });
  } catch (error) {
    return fail(String(error));
  }
}

export async function POST(req: Request) {
  try {
    const s = getSession(req);
    if (!s) return fail('Chưa đăng nhập', 401);
    const { name, url, page_id, access_token, cookies } = await req.json();
    if (!name || !url) return fail('Cần tên và URL của Page', 400);

    const id = 'pg_' + crypto.randomUUID().slice(0, 12);
    const tokenEnc = access_token ? encrypt(access_token) : null;
    const cookiesEnc = cookies ? encrypt(typeof cookies === 'string' ? cookies : JSON.stringify(cookies)) : null;

    await sql`
      INSERT INTO facebook_pages (id, name, url, page_id, access_token_enc, cookies_enc, active, owner_id)
      VALUES (${id}, ${name}, ${url}, ${page_id || null}, ${tokenEnc}, ${cookiesEnc}, 1, ${s.uid})
    `;
    return ok({ id });
  } catch (error) {
    return fail(String(error));
  }
}

export async function PATCH(req: Request) {
  try {
    const s = getSession(req); if (!s) return fail('Chưa đăng nhập', 401);
    const { id, name, url, page_id, access_token, cookies, active } = await req.json();
    if (!id) return fail('Thiếu id', 400);
    if (s.role !== 'admin') { const [r] = await sql`SELECT owner_id FROM facebook_pages WHERE id=${id}`; if (!r || r.owner_id !== s.uid) return fail('Không có quyền', 403); }

    // Chỉ mã hóa lại secret khi client GỬI giá trị mới (chuỗi không rỗng).
    const tokenEnc = access_token ? encrypt(access_token) : null;
    const cookiesEnc = cookies ? encrypt(typeof cookies === 'string' ? cookies : JSON.stringify(cookies)) : null;

    await sql`
      UPDATE facebook_pages SET
        name = COALESCE(${name ?? null}, name),
        url = COALESCE(${url ?? null}, url),
        page_id = COALESCE(${page_id ?? null}, page_id),
        access_token_enc = COALESCE(${tokenEnc}, access_token_enc),
        cookies_enc = COALESCE(${cookiesEnc}, cookies_enc),
        active = COALESCE(${active ?? null}, active)
      WHERE id = ${id}
    `;
    return ok({});
  } catch (error) {
    return fail(String(error));
  }
}

export async function DELETE(req: Request) {
  try {
    const s = getSession(req); if (!s) return fail('Chưa đăng nhập', 401);
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return fail('Thiếu id', 400);
    if (s.role !== 'admin') { const [r] = await sql`SELECT owner_id FROM facebook_pages WHERE id=${id}`; if (!r || r.owner_id !== s.uid) return fail('Không có quyền', 403); }
    await sql`DELETE FROM facebook_pages WHERE id = ${id}`;
    await sql`DELETE FROM facebook_groups WHERE page_id = ${id}`;
    return ok({});
  } catch (error) {
    return fail(String(error));
  }
}
