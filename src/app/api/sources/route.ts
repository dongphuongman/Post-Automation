import { sql, initDb } from '@/lib/db';
import { ok, fail } from '@/lib/api-response';
import { getSession } from '@/lib/auth';

// Quản lý Nguồn thu thập tin (bảng `sources`). type ∈ 'rss' | 'social'.
// Gắn theo user: admin thấy tất cả, user thường chỉ thấy nguồn của mình.

export async function GET(req: Request) {
  try {
    await initDb();
    const s = getSession(req);
    if (!s) return fail('Chưa đăng nhập', 401);
    const sources = s.role === 'admin'
      ? await sql`SELECT * FROM sources ORDER BY created_at ASC, id ASC`
      : await sql`SELECT * FROM sources WHERE owner_id = ${s.uid} ORDER BY created_at ASC, id ASC`;
    return ok({ sources });
  } catch (error) {
    return fail(String(error));
  }
}

export async function POST(req: Request) {
  try {
    const s = getSession(req);
    if (!s) return fail('Chưa đăng nhập', 401);
    const { name, url, type = 'rss', rss_url } = await req.json();
    if (!name) return fail('Thiếu tên nguồn', 400);
    if (type === 'rss' && !rss_url) return fail('Nguồn RSS cần rss_url', 400);

    const id = 'src_' + crypto.randomUUID().slice(0, 12);
    await sql`
      INSERT INTO sources (id, name, url, type, rss_url, active, owner_id)
      VALUES (${id}, ${name}, ${url || null}, ${type}, ${rss_url || null}, 1, ${s.uid})
    `;
    return ok({ id });
  } catch (error) {
    return fail(String(error));
  }
}

export async function PATCH(req: Request) {
  try {
    const s = getSession(req); if (!s) return fail('Chưa đăng nhập', 401);
    const { id, name, url, type, rss_url, active } = await req.json();
    if (!id) return fail('Thiếu id', 400);
    if (s.role !== 'admin') { const [r] = await sql`SELECT owner_id FROM sources WHERE id=${id}`; if (!r || r.owner_id !== s.uid) return fail('Không có quyền', 403); }
    await sql`
      UPDATE sources SET
        name = COALESCE(${name ?? null}, name),
        url = COALESCE(${url ?? null}, url),
        type = COALESCE(${type ?? null}, type),
        rss_url = COALESCE(${rss_url ?? null}, rss_url),
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
    if (s.role !== 'admin') { const [r] = await sql`SELECT owner_id FROM sources WHERE id=${id}`; if (!r || r.owner_id !== s.uid) return fail('Không có quyền', 403); }
    await sql`DELETE FROM sources WHERE id = ${id}`;
    return ok({});
  } catch (error) {
    return fail(String(error));
  }
}
