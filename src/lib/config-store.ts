import { sql } from './db';
import { decrypt } from './crypto';

// Đọc cấu hình app từ bảng `app_config` (giải mã nếu là secret), fallback về
// process.env nếu DB chưa có. Có cache ngắn để không truy vấn DB mỗi request.

type Row = { value_enc: string | null; is_secret: boolean };
let cache: { at: number; map: Record<string, Row> } | null = null;
const TTL_MS = 10_000;

async function loadAll(): Promise<Record<string, Row>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.map;
  const map: Record<string, Row> = {};
  try {
    const rows = await sql`SELECT key, value_enc, is_secret FROM app_config`;
    for (const r of rows as unknown as { key: string; value_enc: string | null; is_secret: boolean }[]) {
      map[r.key] = { value_enc: r.value_enc, is_secret: r.is_secret };
    }
  } catch {
    // Bảng chưa tồn tại (chưa chạy initDb) → dùng env.
  }
  cache = { at: Date.now(), map };
  return map;
}

export async function getConfig(key: string): Promise<string | undefined> {
  const map = await loadAll();
  const row = map[key];
  if (row && row.value_enc) {
    try {
      return row.is_secret ? decrypt(row.value_enc) : row.value_enc;
    } catch {
      // Giải mã lỗi (sai khóa?) → rơi về env.
    }
  }
  return process.env[key];
}

export function clearConfigCache() {
  cache = null;
}
