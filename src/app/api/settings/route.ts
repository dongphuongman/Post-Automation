import { sql, initDb } from '@/lib/db';
import { ok, fail } from '@/lib/api-response';
import { encrypt } from '@/lib/crypto';
import { clearConfigCache } from '@/lib/config-store';
import { getSession } from '@/lib/auth';

// Cài đặt dùng chung toàn hệ thống → CHỈ admin xem/sửa.
function adminOnly(req: Request) {
  const s = getSession(req);
  if (!s) return fail('Chưa đăng nhập', 401);
  if (s.role !== 'admin') return fail('Chỉ admin', 403);
  return null;
}

// Danh mục cấu hình app. secret=true → mã hóa khi lưu, che khi trả về.
const KNOWN: { key: string; secret: boolean; label: string; group: string }[] = [
  { key: 'LLM_PROVIDER', secret: false, label: 'LLM Provider (openai/anthropic)', group: 'LLM' },
  { key: 'LLM_BASE_URL', secret: false, label: 'LLM Base URL', group: 'LLM' },
  { key: 'LLM_MODEL', secret: false, label: 'LLM Model', group: 'LLM' },
  { key: 'LLM_API_KEY', secret: true, label: 'LLM API Key', group: 'LLM' },
  { key: 'IMAGE_BASE_URL', secret: false, label: 'Image Base URL', group: 'Ảnh' },
  { key: 'IMAGE_MODEL', secret: false, label: 'Image Model', group: 'Ảnh' },
  { key: 'IMAGE_API_KEY', secret: true, label: 'Image API Key', group: 'Ảnh' },
  { key: 'OPENAI_API_KEY', secret: true, label: 'OpenAI API Key (TTS video)', group: 'Video' },
  { key: 'GEMINI_MODEL', secret: false, label: 'Gemini Model', group: 'Video' },
  { key: 'GEMINI_API_KEY', secret: true, label: 'Gemini API Key (fallback)', group: 'Video' },
  { key: 'RAPID_API_KEY', secret: true, label: 'RapidAPI Key (X/Instagram)', group: 'Scraping' },
  { key: 'BRAVE_API_KEY', secret: true, label: 'Brave Search Key', group: 'Scraping' },
];

function maskSecret(v: string | null): string {
  if (!v) return '';
  return '••••••••';
}

export async function GET(req: Request) {
  try {
    await initDb();
    const denied = adminOnly(req); if (denied) return denied;
    const rows = await sql`SELECT key, value_enc, is_secret FROM app_config`;
    const stored: Record<string, { value_enc: string | null; is_secret: boolean }> = {};
    for (const r of rows as any[]) stored[r.key] = { value_enc: r.value_enc, is_secret: r.is_secret };

    const settings = KNOWN.map((k) => {
      const row = stored[k.key];
      const hasValue = !!(row && row.value_enc);
      return {
        key: k.key,
        label: k.label,
        group: k.group,
        secret: k.secret,
        has_value: hasValue,
        // secret: chỉ trả giá trị che; non-secret: trả plaintext để hiện trong ô.
        value: k.secret ? (hasValue ? maskSecret(row!.value_enc) : '') : (hasValue ? row!.value_enc || '' : ''),
      };
    });
    return ok({ settings });
  } catch (error) {
    return fail(String(error));
  }
}

export async function PATCH(req: Request) {
  try {
    const denied = adminOnly(req); if (denied) return denied;
    const { items } = await req.json(); // [{ key, value }]
    if (!Array.isArray(items)) return fail('items phải là mảng', 400);

    for (const it of items) {
      const known = KNOWN.find((k) => k.key === it.key);
      if (!known) continue;                 // bỏ qua key lạ
      if (it.value === undefined || it.value === '') continue; // bỏ trống = không đổi (không xóa)
      const stored = known.secret ? encrypt(String(it.value)) : String(it.value);
      await sql`
        INSERT INTO app_config (key, value_enc, is_secret, updated_at)
        VALUES (${it.key}, ${stored}, ${known.secret}, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET value_enc = EXCLUDED.value_enc, is_secret = EXCLUDED.is_secret, updated_at = CURRENT_TIMESTAMP
      `;
    }
    clearConfigCache();
    return ok({});
  } catch (error) {
    return fail(String(error));
  }
}
