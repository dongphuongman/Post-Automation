'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<{ name: string; email: string; role: string } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => { if (d.success) setMe(d.user); }).catch(() => {});
  }, [pathname]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  // Trang đăng nhập: KHÔNG hiện sidebar (chưa đăng nhập không thấy hệ thống có gì).
  if (pathname === '/login') return null;

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      <header className="mobile-header">
        <button className="mobile-menu-btn" onClick={() => setOpen(true)} aria-label="Mở menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="mobile-header-title">Marketing Automation</span>
      </header>

      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}

      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <h2 className="sidebar-title">Marketing Automation</h2>
          <p className="sidebar-subtitle">AI Content Pipeline</p>
        </div>
        <button className="sidebar-close" onClick={() => setOpen(false)} aria-label="Đóng menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <nav className="sidebar-nav">
          <Link href="/" className={`sidebar-link ${pathname === '/' ? 'active' : ''}`}>
            <span className="sidebar-icon">⚡</span>
            Pipeline
          </Link>
          <Link href="/dashboard" className={`sidebar-link ${pathname === '/dashboard' ? 'active' : ''}`}>
            <span className="sidebar-icon">📊</span>
            Dashboard
          </Link>

          <div className="sidebar-section-label">Quản lý</div>
          <Link href="/manage/sources" className={`sidebar-link ${pathname === '/manage/sources' ? 'active' : ''}`}>
            <span className="sidebar-icon">📰</span>
            Nguồn tin
          </Link>
          <Link href="/manage/groups" className={`sidebar-link ${pathname === '/manage/groups' ? 'active' : ''}`}>
            <span className="sidebar-icon">👥</span>
            Nhóm
          </Link>
          <Link href="/manage/pages" className={`sidebar-link ${pathname === '/manage/pages' ? 'active' : ''}`}>
            <span className="sidebar-icon">📄</span>
            Page
          </Link>
          <Link href="/manage/account" className={`sidebar-link ${pathname === '/manage/account' ? 'active' : ''}`}>
            <span className="sidebar-icon">🙍</span>
            Facebook cá nhân
          </Link>
          <Link href="/manage/settings" className={`sidebar-link ${pathname === '/manage/settings' ? 'active' : ''}`}>
            <span className="sidebar-icon">⚙️</span>
            Cài đặt
          </Link>
          {me?.role === 'admin' && (
            <Link href="/manage/users" className={`sidebar-link ${pathname === '/manage/users' ? 'active' : ''}`}>
              <span className="sidebar-icon">👤</span>
              Quản lý User
            </Link>
          )}

          <div className="sidebar-section-label">Tài khoản</div>
          <Link href="/profile" className={`sidebar-link ${pathname === '/profile' ? 'active' : ''}`}>
            <span className="sidebar-icon">🙍</span>
            Hồ sơ
          </Link>
        </nav>

        {me && (
          <div className="sidebar-user">
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{me.name}</div>
              <div className="sidebar-user-role">{me.email} · {me.role}</div>
            </div>
            <button className="sidebar-logout" onClick={logout}>Đăng xuất</button>
          </div>
        )}
      </aside>
    </>
  );
}
