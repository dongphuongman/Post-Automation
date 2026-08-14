// Kiểm tra client-side chuỗi Cookies JSON người dùng dán, TRƯỚC khi gửi server —
// để báo lỗi ngay tại chỗ thay vì fail âm thầm sau round-trip. Trả message lỗi
// (tiếng Việt) hoặc null nếu hợp lệ.
export function validateCookieJson(raw: string, requiredKeys: string[]): string | null {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { return 'Cookies không phải JSON hợp lệ — dán mảng JSON từ Cookie-Editor.'; }
  if (!Array.isArray(parsed)) return 'Cookies phải là MẢNG JSON (bắt đầu bằng "[").';
  const names = new Set(parsed.map((c) => (c && typeof c === 'object' ? (c as { name?: string }).name : undefined)));
  const missing = requiredKeys.filter((k) => !names.has(k));
  if (missing.length) return `Thiếu cookie bắt buộc: ${missing.join(', ')}.`;
  return null;
}
