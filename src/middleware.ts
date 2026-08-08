import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Bảo vệ route: chưa có cookie phiên → chuyển tới /login (trang) hoặc 401 (API).
// Chỉ kiểm tra SỰ TỒN TẠI cookie ở đây (Edge). Xác minh chữ ký đầy đủ nằm ở API.
const COOKIE = 'mkt_session';
const PUBLIC = ['/login', '/api/auth/login'];

// Security headers áp cho MỌI response đi qua middleware.
function withSecurityHeaders(res: NextResponse): NextResponse {
  const h = res.headers;
  h.set('X-Frame-Options', 'DENY');
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  h.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  // CSP nới lỏng để không vỡ Next (inline script/style của Next cần 'unsafe-inline'/'unsafe-eval').
  h.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https:",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
    ].join('; ')
  );
  return res;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // CSRF: mutation tới /api/* phải có Origin khớp host. Chặn cross-site request giả mạo.
  const method = req.method.toUpperCase();
  if (
    pathname.startsWith('/api/') &&
    (method === 'POST' || method === 'PATCH' || method === 'DELETE' || method === 'PUT')
  ) {
    const origin = req.headers.get('origin');
    if (origin) {
      const host = req.headers.get('host');
      let originHost = '';
      try { originHost = new URL(origin).host; } catch { /* origin lỗi định dạng */ }
      if (originHost !== host) {
        return withSecurityHeaders(
          NextResponse.json({ success: false, error: 'CSRF: Origin không hợp lệ' }, { status: 403 })
        );
      }
    }
    // Không có Origin (một số client non-browser): bỏ qua CSRF, vẫn cần cookie phiên bên dưới.
  }

  if (PUBLIC.includes(pathname)) return withSecurityHeaders(NextResponse.next());

  const hasSession = !!req.cookies.get(COOKIE);
  if (hasSession) return withSecurityHeaders(NextResponse.next());

  if (pathname.startsWith('/api/')) {
    return withSecurityHeaders(
      NextResponse.json({ success: false, error: 'Chưa đăng nhập' }, { status: 401 })
    );
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  return withSecurityHeaders(NextResponse.redirect(url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
