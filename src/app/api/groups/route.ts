import { sql, initDb } from '@/lib/db';
import { ok, fail } from '@/lib/api-response';
import { getSession } from '@/lib/auth';

// Quản lý Nhóm Facebook, gắn với một Page. Gắn theo user (admin thấy tất cả).

export async function GET(req: Request) {
  try {
    await initDb();
    const s = getSession(req);
    if (!s) return fail('Chưa đăng nhập', 401);
    const groups = s.role === 'admin'
      ? await sql`SELECT * FROM facebook_groups ORDER BY page_id, created_at ASC`
      : await sql`SELECT * FROM facebook_groups WHERE owner_id = ${s.uid} ORDER BY page_id, created_at ASC`;
    return ok({ groups });
  } catch (error) {
    return fail(String(error));
  }
}

export async function POST(req: Request) {
  try {
    const s = getSession(req);
    if (!s) return fail('Chưa đăng nhập', 401);
    const { page_id, url, name } = await req.json();
    if (!page_id) return fail('Cần chọn Page cho nhóm', 400);
    if (!url) return fail('Thiếu URL nhóm', 400);

    const id = 'grp_' + crypto.randomUUID().slice(0, 12);
    await sql`
      INSERT INTO facebook_groups (id, page_id, url, name, active, owner_id)
      VALUES (${id}, ${page_id}, ${url}, ${name || url}, 1, ${s.uid})
    `;
    return ok({ id });
  } catch (error) {
    return fail(String(error));
  }
}

export async function PATCH(req: Request) {
  try {
    const s = getSession(req); if (!s) return fail('Chưa đăng nhập', 401);
    const { id, page_id, url, name, active } = await req.json();
    if (!id) return fail('Thiếu id', 400);
    if (s.role !== 'admin') { const [r] = await sql`SELECT owner_id FROM facebook_groups WHERE id=${id}`; if (!r || r.owner_id !== s.uid) return fail('Không có quyền', 403); }
    await sql`
      UPDATE facebook_groups SET
        page_id = COALESCE(${page_id ?? null}, page_id),
        url = COALESCE(${url ?? null}, url),
        name = COALESCE(${name ?? null}, name),
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
    if (s.role !== 'admin') { const [r] = await sql`SELECT owner_id FROM facebook_groups WHERE id=${id}`; if (!r || r.owner_id !== s.uid) return fail('Không có quyền', 403); }
    await sql`DELETE FROM facebook_groups WHERE id = ${id}`;
    return ok({});
  } catch (error) {
    return fail(String(error));
  }
}
