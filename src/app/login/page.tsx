'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const d = await res.json();
      if (d.success) { window.location.href = '/'; }
      else setErr(d.error || 'Đăng nhập thất bại');
    } catch { setErr('Lỗi kết nối'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <form onSubmit={submit} className="card" style={{ width: '100%', maxWidth: 380 }}>
        <h1 className="page-title" style={{ marginBottom: 4, textAlign: 'center' }}>Đăng nhập</h1>
        <p className="page-subtitle" style={{ marginBottom: 20, textAlign: 'center' }}>Marketing Automation</p>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="input-field" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@local" autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">Mật khẩu</label>
          <input className="input-field" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        {err && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{err}</p>}
        <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  );
}
