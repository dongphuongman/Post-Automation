import { randomBytes, scryptSync, timingSafeEqual, createHash, createHmac } from 'crypto';

// Xác thực tự viết: mật khẩu băm scrypt; phiên = token HMAC ký bằng khóa dẫn xuất
// từ APP_ENCRYPTION_KEY. Không phụ thuộc thư viện ngoài.

export interface SessionUser {
  uid: string;
  role: 'admin' | 'user';
  exp: number;
  iat: number; // thời điểm phát hành — dùng cho thu hồi phiên
}

function sessionKey(): Buffer {
  const secret = process.env.APP_ENCRYPTION_KEY || 'dev-insecure-key';
  return createHash('sha256').update('session:' + secret).digest();
}

// ---- Mật khẩu ----
export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, 32);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  try {
    const [saltHex, hashHex] = stored.split(':');
    const hash = Buffer.from(hashHex, 'hex');
    const check = scryptSync(plain, Buffer.from(saltHex, 'hex'), 32);
    return hash.length === check.length && timingSafeEqual(hash, check);
  } catch {
    return false;
  }
}

// ---- Phiên (token ký HMAC) ----
const b64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export function signSession(uid: string, role: 'admin' | 'user', days = 7): string {
  const now = Date.now();
  const payload: SessionUser = { uid, role, exp: now + days * 86400_000, iat: now };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac('sha256', sessionKey()).update(body).digest());
  return `${body}.${sig}`;
}

// ---- Thu hồi phiên ----
// Map uid → mốc thời gian: mọi token phát hành TRƯỚC mốc này bị vô hiệu.
// In-memory (reset khi restart tiến trình) — đủ cho self-host 1 tiến trình.
const revokedBefore = new Map<string, number>();

export function revokeUserSessions(uid: string): void {
  revokedBefore.set(uid, Date.now());
}

export function verifySession(token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expect = b64url(createHmac('sha256', sessionKey()).update(body).digest());
  if (sig.length !== expect.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    const p = JSON.parse(fromB64url(body).toString('utf8')) as SessionUser;
    if (!p.exp || p.exp < Date.now()) return null;
    const cutoff = revokedBefore.get(p.uid);
    if (cutoff && (p.iat ?? 0) < cutoff) return null; // token phát hành trước khi thu hồi
    return p;
  } catch {
    return null;
  }
}

// ---- Cookie helpers ----
export const SESSION_COOKIE = 'mkt_session';

export function getSession(req: Request): SessionUser | null {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(new RegExp('(?:^|; )' + SESSION_COOKIE + '=([^;]+)'));
  return verifySession(m ? decodeURIComponent(m[1]) : null);
}

const SECURE = process.env.NODE_ENV === 'production' ? '; Secure' : '';

export function sessionCookie(token: string, days = 7): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${SECURE}; Max-Age=${days * 86400}`;
}

export function clearCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax${SECURE}; Max-Age=0`;
}
