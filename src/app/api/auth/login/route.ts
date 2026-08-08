import { NextResponse } from 'next/server';
import { sql, initDb } from '@/lib/db';
import { verifyPassword, signSession, sessionCookie } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    // Chống brute-force: tối đa 5 lần thử/phút theo IP.
    if (!rateLimit(`login:${clientIp(req)}`, 5, 60_000)) {
      return NextResponse.json(
        { success: false, error: 'Quá nhiều lần thử. Vui lòng đợi 1 phút.' },
        { status: 429 }
      );
    }
    await initDb(); // đảm bảo bảng users + admin mặc định tồn tại
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Thiếu email hoặc mật khẩu' }, { status: 400 });
    }
    const [u] = await sql`SELECT * FROM users WHERE email = ${String(email).toLowerCase()} AND active = 1`;
    if (!u || !verifyPassword(password, u.password_hash)) {
      return NextResponse.json({ success: false, error: 'Sai email hoặc mật khẩu' }, { status: 401 });
    }
    const token = signSession(u.id, u.role === 'admin' ? 'admin' : 'user');
    const res = NextResponse.json({ success: true, user: { id: u.id, email: u.email, name: u.name, role: u.role } });
    res.headers.set('Set-Cookie', sessionCookie(token));
    return res;
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
