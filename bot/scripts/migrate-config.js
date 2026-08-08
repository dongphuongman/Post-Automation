/**
 * migrate-config.js — Nạp cấu hình hardcode hiện tại vào DB (mã hóa secret).
 * Chạy 1 lần: node scripts/migrate-config.js  (từ thư mục bot/)
 *
 * Đọc:  bot/lib/config.js (PAGE_NAME, PAGE_URL, GROUPS)
 *       .env.local        (FACEBOOK_*, LLM_*, IMAGE_*, RAPID/BRAVE/GEMINI/OPENAI keys)
 *       bot/cookies.json  (cookie Playwright)
 * Ghi:  facebook_pages, facebook_groups, app_config
 */

const fs = require('fs');
const path = require('path');
const { sql } = require('../lib/db'); // require này cũng load dotenv (.env.local)
const { encrypt } = require('../lib/crypto');
const { PAGE_NAME, PAGE_URL, GROUPS } = require('../lib/config');

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'x';
const shortHash = (s) =>
  require('crypto').createHash('sha1').update(String(s)).digest('hex').slice(0, 10);

async function ensureTables() {
  await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS target_page_id TEXT`;
  await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS target_group_ids TEXT`;
  await sql`CREATE TABLE IF NOT EXISTS facebook_pages (
    id TEXT PRIMARY KEY, name TEXT, url TEXT, page_id TEXT,
    access_token_enc TEXT, cookies_enc TEXT,
    active INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;
  await sql`CREATE TABLE IF NOT EXISTS facebook_groups (
    id TEXT PRIMARY KEY, page_id TEXT, url TEXT, name TEXT,
    active INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;
  await sql`CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY, value_enc TEXT, is_secret BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;
}

async function migratePage() {
  const pageId = 'pg_' + slug(PAGE_NAME);
  const token = process.env.FACEBOOK_ACCESS_TOKEN || '';
  const graphPageId = process.env.FACEBOOK_PAGE_ID || '';

  let cookiesEnc = null;
  const cookiesPath = path.resolve(__dirname, '../cookies.json');
  if (fs.existsSync(cookiesPath)) {
    cookiesEnc = encrypt(fs.readFileSync(cookiesPath, 'utf8'));
  }
  const tokenEnc = token ? encrypt(token) : null;

  await sql`
    INSERT INTO facebook_pages (id, name, url, page_id, access_token_enc, cookies_enc, active)
    VALUES (${pageId}, ${PAGE_NAME}, ${PAGE_URL}, ${graphPageId}, ${tokenEnc}, ${cookiesEnc}, 1)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, url = EXCLUDED.url, page_id = EXCLUDED.page_id,
      access_token_enc = COALESCE(EXCLUDED.access_token_enc, facebook_pages.access_token_enc),
      cookies_enc = COALESCE(EXCLUDED.cookies_enc, facebook_pages.cookies_enc)
  `;
  console.log(`✅ Page: ${PAGE_NAME} (${pageId}) — token:${token ? 'có' : 'trống'} cookie:${cookiesEnc ? 'có' : 'trống'}`);
  return pageId;
}

async function migrateGroups(pageId) {
  for (const url of GROUPS) {
    const gid = 'grp_' + shortHash(url);
    await sql`
      INSERT INTO facebook_groups (id, page_id, url, name, active)
      VALUES (${gid}, ${pageId}, ${url}, ${url}, 1)
      ON CONFLICT (id) DO UPDATE SET page_id = EXCLUDED.page_id, url = EXCLUDED.url
    `;
  }
  console.log(`✅ Nhóm: ${GROUPS.length} nhóm gắn vào ${pageId}`);
}

async function migrateConfig() {
  // key → { env, secret }
  const map = {
    LLM_PROVIDER: { secret: false },
    LLM_BASE_URL: { secret: false },
    LLM_MODEL: { secret: false },
    LLM_API_KEY: { secret: true },
    IMAGE_BASE_URL: { secret: false },
    IMAGE_MODEL: { secret: false },
    IMAGE_API_KEY: { secret: true },
    OPENAI_API_KEY: { secret: true },
    GEMINI_MODEL: { secret: false },
    GEMINI_API_KEY: { secret: true },
    RAPID_API_KEY: { secret: true },
    BRAVE_API_KEY: { secret: true },
  };
  let count = 0;
  for (const [key, { secret }] of Object.entries(map)) {
    const val = process.env[key];
    if (!val) continue;
    const stored = secret ? encrypt(val) : val;
    await sql`
      INSERT INTO app_config (key, value_enc, is_secret, updated_at)
      VALUES (${key}, ${stored}, ${secret}, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET value_enc = EXCLUDED.value_enc, is_secret = EXCLUDED.is_secret, updated_at = CURRENT_TIMESTAMP
    `;
    count++;
  }
  console.log(`✅ Cấu hình app: ${count} khóa (secret đã mã hóa)`);
}

(async () => {
  if (!sql) return console.error('❌ Không có kết nối DB (POSTGRES_URL/DATABASE_URL).');
  if (!process.env.APP_ENCRYPTION_KEY) return console.error('❌ Thiếu APP_ENCRYPTION_KEY trong .env.local.');
  console.log('🚚 Bắt đầu migrate cấu hình vào DB...\n');
  await ensureTables();
  const pageId = await migratePage();
  await migrateGroups(pageId);
  await migrateConfig();
  console.log('\n🎉 Xong! Cấu hình đã nằm trong DB (secret mã hóa).');
})().catch((e) => console.error('💥 Lỗi migrate:', e.message));
