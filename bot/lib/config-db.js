const { sql } = require('./db');
const { decrypt } = require('./crypto');

// Đọc cấu hình Page/Nhóm/Setting từ DB cho bot (giải mã cookie/token).
// Mọi hàm đều an toàn khi không có DB (trả null/[]/env) để giữ fallback.

async function getPageById(id) {
  if (!sql || !id) return null;
  try {
    const rows = await sql`SELECT id, name, url, page_id, access_token_enc, cookies_enc FROM facebook_pages WHERE id = ${id}`;
    const p = rows[0];
    if (!p) return null;
    let cookies = null, token = null;
    try { if (p.cookies_enc) cookies = JSON.parse(decrypt(p.cookies_enc)); } catch {}
    try { if (p.access_token_enc) token = decrypt(p.access_token_enc); } catch {}
    return { id: p.id, name: p.name, url: p.url, pageGraphId: p.page_id, token, cookies };
  } catch { return null; }
}

// Phiên Facebook CÁ NHÂN của một user (owner) — cookie giải mã để bot đăng lên
// tường cá nhân của chính chủ. Trả { cookies } hoặc null.
async function getAccountByOwner(ownerId) {
  if (!sql || !ownerId) return null;
  try {
    const rows = await sql`SELECT cookies_enc FROM facebook_accounts WHERE owner_id = ${ownerId} AND active = 1 ORDER BY created_at DESC LIMIT 1`;
    const a = rows[0];
    if (!a) return null;
    let cookies = null;
    try { if (a.cookies_enc) cookies = JSON.parse(decrypt(a.cookies_enc)); } catch {}
    return { cookies };
  } catch { return null; }
}

// Credential mạng xã hội (X/Threads/Instagram) của một user (owner) cho 1 platform.
// Trả { cookies, token } đã giải mã (cookies cho X/IG automation, token cho Threads API).
async function getSocialAccount(ownerId, platform) {
  if (!sql || !ownerId || !platform) return null;
  try {
    const rows = await sql`SELECT cookies_enc, token_enc FROM social_accounts WHERE owner_id = ${ownerId} AND platform = ${platform} AND active = 1 ORDER BY created_at DESC LIMIT 1`;
    const a = rows[0];
    if (!a) return null;
    let cookies = null, token = null;
    try { if (a.cookies_enc) cookies = JSON.parse(decrypt(a.cookies_enc)); } catch {}
    try { if (a.token_enc) token = decrypt(a.token_enc); } catch {}
    return { cookies, token };
  } catch { return null; }
}

async function getGroupUrlsByIds(ids) {
  if (!sql || !Array.isArray(ids) || !ids.length) return [];
  try {
    const rows = await sql`SELECT url FROM facebook_groups WHERE id = ANY(${ids}) AND active = 1`;
    return rows.map(r => r.url);
  } catch { return []; }
}

async function getActiveGroupUrlsForPage(pageId) {
  if (!sql || !pageId) return [];
  try {
    const rows = await sql`SELECT url FROM facebook_groups WHERE page_id = ${pageId} AND active = 1 ORDER BY created_at ASC`;
    return rows.map(r => r.url);
  } catch { return []; }
}

async function getSetting(key) {
  if (!sql) return process.env[key];
  try {
    const rows = await sql`SELECT value_enc, is_secret FROM app_config WHERE key = ${key}`;
    const r = rows[0];
    if (r && r.value_enc) return r.is_secret ? decrypt(r.value_enc) : r.value_enc;
  } catch {}
  return process.env[key];
}

module.exports = { getPageById, getAccountByOwner, getSocialAccount, getGroupUrlsByIds, getActiveGroupUrlsForPage, getSetting };
