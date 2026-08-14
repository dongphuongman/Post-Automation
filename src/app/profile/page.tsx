'use client';

import { useEffect, useState } from 'react';
import { notifySuccess, notifyError } from '@/components/ui/Notify';

export default function ProfilePage() {
  const [me, setMe] = useState<{ email: string; name: string; role: string } | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.success) { setMe(d.user); setName(d.user.name || ''); }
    }).catch(() => notifyError('Không tải được hồ sơ'));
  }, []);

  const save = async () => {
    const body: any = {};
    if (name) body.name = name;
    if (password) body.password = password;
    if (!body.name && !body.password) { notifyError('Chưa có thay đổi nào để lưu.'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (d.success) { setPassword(''); notifySuccess('Đã lưu hồ sơ!'); }
      else notifyError(d.error || 'Không lưu được hồ sơ');
    } catch { notifyError('Lỗi mạng khi lưu hồ sơ'); }
    finally { setSaving(false); }
  };

  return (
    <div className="manage-page">
      <div className="page-header"><h1 className="page-title">🙍 Hồ sơ của tôi</h1><p className="page-subtitle">Cập nhật tên hiển thị &amp; đổi mật khẩu.</p></div>
      <div className="card" style={{ maxWidth: 480 }}>
        <div className="form-group"><label className="form-label">Email</label><input className="input-field" value={me?.email || ''} disabled /></div>
        <div className="form-group"><label className="form-label">Quyền</label><input className="input-field" value={me?.role || ''} disabled /></div>
        <div className="form-group"><label className="form-label">Tên hiển thị</label><input className="input-field" value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Mật khẩu mới (để trống nếu không đổi)</label><input className="input-field" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" /></div>
        <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Đang lưu…' : '💾 Lưu'}</button>
      </div>
    </div>
  );
}
