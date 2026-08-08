'use client';

import { useEffect, useState, useCallback } from 'react';

interface U { id: string; email: string; name: string; role: string; active: number; }

export default function ManageUsersPage() {
  const [users, setUsers] = useState<U[]>([]);
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'user' });

  const load = useCallback(async () => {
    const r = await fetch('/api/users'); const d = await r.json();
    if (d.success) setUsers(d.users); else alert(d.error || 'Không tải được');
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.email || !form.password) { alert('Cần email + mật khẩu'); return; }
    const r = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const d = await r.json();
    if (d.success) { setForm({ email: '', name: '', password: '', role: 'user' }); load(); }
    else alert(d.error);
  };
  const patch = async (id: string, body: any) => {
    await fetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) });
    load();
  };
  const del = async (id: string) => { if (confirm('Xóa user này?')) { await fetch(`/api/users?id=${id}`, { method: 'DELETE' }); load(); } };
  const resetPw = async (id: string) => { const p = prompt('Mật khẩu mới:'); if (p) patch(id, { password: p }); };

  return (
    <div className="manage-page">
      <div className="page-header"><h1 className="page-title">👤 Quản lý User</h1><p className="page-subtitle">Chỉ admin. Tạo user, đặt quyền, đặt lại mật khẩu.</p></div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title" style={{ marginBottom: 14 }}>Thêm user</div>
        <div className="form-group"><label className="form-label">Email</label><input className="input-field" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
        <div className="form-group"><label className="form-label">Tên</label><input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
        <div className="form-group"><label className="form-label">Mật khẩu</label><input className="input-field" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
        <div className="form-group"><label className="form-label">Quyền</label>
          <select className="input-field" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
            <option value="user">User</option><option value="admin">Admin</option>
          </select>
        </div>
        <button className="btn-primary" onClick={create}>Thêm user</button>
      </div>

      <div className="section-header"><span className="section-title">Danh sách user</span><span className="section-count">{users.length}</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {users.map(u => (
          <div key={u.id} className="card" style={{ opacity: u.active ? 1 : 0.55 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}>
                  {u.name} <span className="badge" style={{ background: u.role === 'admin' ? '#fef3c7' : 'var(--primary-light)', color: u.role === 'admin' ? '#92400e' : 'var(--primary)' }}>{u.role}</span>
                  {!u.active && <span className="badge">tắt</span>}
                </div>
                <div className="form-hint">{u.email}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn-secondary" onClick={() => patch(u.id, { role: u.role === 'admin' ? 'user' : 'admin' })}>{u.role === 'admin' ? '→ User' : '→ Admin'}</button>
                <button className="btn-secondary" onClick={() => patch(u.id, { active: u.active ? 0 : 1 })}>{u.active ? 'Tắt' : 'Bật'}</button>
                <button className="btn-secondary" onClick={() => resetPw(u.id)}>Đổi MK</button>
                <button className="btn-danger" onClick={() => del(u.id)}>Xóa</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
