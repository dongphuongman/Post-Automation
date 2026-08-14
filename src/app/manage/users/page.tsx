'use client';

import { useEffect, useState, useCallback } from 'react';
import { notify, notifyError, notifySuccess, confirmDialog, promptDialog } from '@/components/ui/Notify';

interface U { id: string; email: string; name: string; role: string; active: number; }

export default function ManageUsersPage() {
  const [users, setUsers] = useState<U[]>([]);
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'user' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/users'); const d = await r.json();
      if (d.success) setUsers(d.users); else notifyError(d.error || 'Không tải được');
    } catch { notifyError('Lỗi mạng khi tải danh sách user'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => { if (d.success) setMeId(d.user.id); }).catch(() => {});
  }, []);

  const create = async () => {
    if (!form.email || !form.password) { notify('Cần email + mật khẩu', 'warning'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await r.json();
      if (d.success) { setForm({ email: '', name: '', password: '', role: 'user' }); notifySuccess('Đã thêm user'); load(); }
      else notifyError(d.error || 'Không tạo được user');
    } catch { notifyError('Lỗi mạng khi tạo user'); }
    finally { setSaving(false); }
  };
  const patch = async (id: string, body: any) => {
    try {
      const r = await fetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) });
      const d = await r.json();
      if (d.success !== false) { notifySuccess('Đã cập nhật'); load(); }
      else notifyError(d.error || 'Không cập nhật được');
    } catch { notifyError('Lỗi mạng'); }
  };
  const del = async (id: string) => {
    if (!(await confirmDialog('Xóa user này?', { title: 'Xoá người dùng', confirmText: 'Xoá', danger: true }))) return;
    await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
    notifySuccess('Đã xoá user'); load();
  };
  const resetPw = async (id: string) => {
    const p = await promptDialog('Nhập mật khẩu mới cho user này:', { title: 'Đổi mật khẩu', password: true, confirmText: 'Đổi', placeholder: 'Mật khẩu mới' });
    if (p) patch(id, { password: p });
  };

  return (
    <div className="manage-page">
      <div className="page-header"><h1 className="page-title">👤 Quản lý User</h1><p className="page-subtitle">Chỉ admin. Tạo user, đặt quyền, đặt lại mật khẩu.</p></div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title" style={{ marginBottom: 14 }}>Thêm user</div>
        <div className="form-group"><label className="form-label">Email <span className="form-req">*</span></label><input className="input-field" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
        <div className="form-group"><label className="form-label">Tên</label><input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
        <div className="form-group"><label className="form-label">Mật khẩu <span className="form-req">*</span></label><input className="input-field" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
        <div className="form-group"><label className="form-label">Quyền</label>
          <select className="input-field" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
            <option value="user">User</option><option value="admin">Admin</option>
          </select>
        </div>
        <button className="btn-primary" onClick={create} disabled={saving}>{saving ? 'Đang thêm…' : 'Thêm user'}</button>
      </div>

      <div className="section-header"><span className="section-title">Danh sách user</span><span className="section-count">{users.length}</span></div>
      {loading ? (
        <div className="empty-state"><div className="empty-icon">⏳</div><p>Đang tải danh sách user…</p></div>
      ) : users.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">👤</div><p>Chưa có user nào.</p></div>
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {users.map(u => {
          const isSelf = meId === u.id;
          return (
          <div key={u.id} className="card" style={{ opacity: u.active ? 1 : 0.55 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {u.name} <span className="badge" style={{ background: u.role === 'admin' ? 'var(--warning-bg)' : 'var(--primary-light)', color: u.role === 'admin' ? 'var(--warning-fg)' : 'var(--primary)' }}>{u.role}</span>
                  {!u.active && <span className="badge">tắt</span>}
                  {isSelf && <span className="badge" style={{ background: 'var(--info-bg)', color: 'var(--info-fg)' }}>bạn</span>}
                </div>
                <div className="form-hint">{u.email}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn-secondary" disabled={isSelf} title={isSelf ? 'Không thể tự đổi quyền của mình' : ''} onClick={() => patch(u.id, { role: u.role === 'admin' ? 'user' : 'admin' })}>{u.role === 'admin' ? '→ User' : '→ Admin'}</button>
                <button className="btn-secondary" disabled={isSelf} title={isSelf ? 'Không thể tự tắt tài khoản của mình' : ''} onClick={() => patch(u.id, { active: u.active ? 0 : 1 })}>{u.active ? 'Tắt' : 'Bật'}</button>
                <button className="btn-secondary" onClick={() => resetPw(u.id)}>Đổi MK</button>
                <button className="btn-danger" disabled={isSelf} title={isSelf ? 'Không thể tự xoá tài khoản của mình' : ''} onClick={() => del(u.id)}>Xóa</button>
              </div>
            </div>
          </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
