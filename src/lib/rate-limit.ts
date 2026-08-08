// Rate limit đơn giản trong bộ nhớ (đủ cho self-host 1 tiến trình).
// key → danh sách mốc thời gian trong cửa sổ. Vượt ngưỡng → chặn.
const hits = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    hits.set(key, arr);
    return false; // vượt giới hạn
  }
  arr.push(now);
  hits.set(key, arr);
  return true;
}

// Lấy IP client từ header proxy (Next đứng sau proxy/localhost).
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'local';
}

// Dọn định kỳ để Map không phình (mỗi ~10 phút).
setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of hits) {
    const keep = arr.filter((t) => now - t < 600_000);
    if (keep.length) hits.set(k, keep); else hits.delete(k);
  }
}, 600_000).unref?.();
