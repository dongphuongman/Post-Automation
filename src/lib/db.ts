import { neon } from '@neondatabase/serverless';
import { hashPassword } from './auth';

if (!process.env.POSTGRES_URL) {
  console.warn("POSTGRES_URL is not defined in environment variables. Database operations will fail.");
}

export const sql = neon(process.env.POSTGRES_URL || 'postgresql://dummy:dummy@dummy/dummy');

// Chạy DDL (CREATE/ALTER) chỉ MỘT lần mỗi tiến trình — tránh 6+ round-trip DDL
// tới Neon mỗi request (làm chậm 4-19s). Sau lần đầu, initDb() trả về ngay.
let initPromise: Promise<void> | null = null;

export async function initDb() {
  if (initPromise) return initPromise;
  // Nếu init lỗi (DB tạm gián đoạn) → xóa cache để request sau thử lại.
  initPromise = doInitDb().catch((e) => { initPromise = null; throw e; });
  return initPromise;
}

async function doInitDb() {
  await sql`CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    name TEXT,
    url TEXT,
    type TEXT DEFAULT 'rss',
    rss_url TEXT,
    active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;

  await sql`CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    source_id TEXT,
    title TEXT,
    url TEXT UNIQUE,
    summary TEXT,
    original_image_url TEXT,
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'new',
    format TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;

  await sql`CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    article_id TEXT,
    format TEXT,
    content TEXT,
    hashtags TEXT,
    generated_image_url TEXT,
    original_image_url TEXT,
    facebook_post_id TEXT,
    scheduled_time BIGINT,
    status TEXT DEFAULT 'draft',
    create_video BOOLEAN DEFAULT FALSE,
    video_status VARCHAR(20) DEFAULT 'none',
    selected_image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;

  // Cột chọn đích cho từng bài (per-post targeting). ADD COLUMN IF NOT EXISTS để
  // an toàn với DB đã tồn tại.
  await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS target_page_id TEXT`;
  await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS target_group_ids TEXT`;

  // Quản lý đa Page: mỗi Page có token (Graph) + cookie (Playwright) riêng, mã hóa.
  await sql`CREATE TABLE IF NOT EXISTS facebook_pages (
    id TEXT PRIMARY KEY,
    name TEXT,
    url TEXT,
    page_id TEXT,
    access_token_enc TEXT,
    cookies_enc TEXT,
    active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;

  // Nhóm Facebook, gắn với một Page (page_id → facebook_pages.id).
  await sql`CREATE TABLE IF NOT EXISTS facebook_groups (
    id TEXT PRIMARY KEY,
    page_id TEXT,
    url TEXT,
    name TEXT,
    active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;

  // Cấu hình app dạng key/value: LLM/API keys (mã hóa khi is_secret) + cài đặt chung.
  await sql`CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value_enc TEXT,
    is_secret BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;

  // Người dùng + phân quyền (role: 'admin' | 'user').
  await sql`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT,
    password_hash TEXT,
    role TEXT DEFAULT 'user',
    active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;

  // Gắn dữ liệu theo chủ sở hữu (owner_id → users.id). NULL = dữ liệu cũ (gán admin).
  await sql`ALTER TABLE sources ADD COLUMN IF NOT EXISTS owner_id TEXT`;
  await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS owner_id TEXT`;
  await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS owner_id TEXT`;
  await sql`ALTER TABLE facebook_pages ADD COLUMN IF NOT EXISTS owner_id TEXT`;
  await sql`ALTER TABLE facebook_groups ADD COLUMN IF NOT EXISTS owner_id TEXT`;

  // Seed admin mặc định nếu chưa có user nào (đổi mật khẩu ngay sau khi đăng nhập).
  const [{ c }] = (await sql`SELECT count(*)::int AS c FROM users`) as unknown as { c: number }[];
  if (c === 0) {
    await sql`INSERT INTO users (id, email, name, password_hash, role, active)
      VALUES ('u_admin', 'admin@local', 'Admin', ${hashPassword('admin123')}, 'admin', 1)`;
    // Gán toàn bộ dữ liệu hiện có cho admin để không mất khi bật scoping.
    await sql`UPDATE sources SET owner_id = 'u_admin' WHERE owner_id IS NULL`;
    await sql`UPDATE articles SET owner_id = 'u_admin' WHERE owner_id IS NULL`;
    await sql`UPDATE posts SET owner_id = 'u_admin' WHERE owner_id IS NULL`;
    await sql`UPDATE facebook_pages SET owner_id = 'u_admin' WHERE owner_id IS NULL`;
    await sql`UPDATE facebook_groups SET owner_id = 'u_admin' WHERE owner_id IS NULL`;
    console.log("Seeded admin user: admin@local / admin123 (đổi mật khẩu ngay!)");
  }
}

export async function seedDb() {
  await sql`
  INSERT INTO sources (id, name, url, type, rss_url) VALUES
    ('s1', 'TechCrunch', 'https://techcrunch.com/', 'rss', 'https://techcrunch.com/feed/'),
    ('s2', 'NFX', 'https://www.nfx.com/', 'rss', 'https://www.nfx.com/feed/'),
    ('s3', 'Indie Hackers', 'https://www.indiehackers.com/', 'rss', 'https://www.indiehackers.com/feed'),
    ('s4', 'a16z', 'https://a16z.com/', 'rss', 'https://a16z.com/feed/'),
    ('s5', 'Crunchbase News', 'https://news.crunchbase.com/', 'rss', 'https://news.crunchbase.com/feed/'),
    ('s6', 'TechStartups', 'https://techstartups.com/', 'rss', 'https://techstartups.com/feed/')
  ON CONFLICT (id) DO NOTHING;
  `;
}
