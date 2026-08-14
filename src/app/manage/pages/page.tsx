'use client';

import { useEffect, useState } from 'react';
import { notify } from '@/components/ui/Notify';
import { usePages, type FbPage } from '@/hooks/usePages';

const empty = { name: '', url: '', page_id: '', access_token: '', cookies: '' };

export default function ManagePagesPage() {
  const { pages, loading, fetchPages, createPage, updatePage, toggleActive, deletePage } = usePages();
  const [form, setForm] = useState<Record<string, string>>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  const submit = async () => {
    if (!form.name?.trim() || !form.url?.trim()) { notify('Nhập tên và URL Page', 'warning'); return; }
    // Chỉ gửi secret khi người dùng nhập (tránh ghi đè bằng chuỗi rỗng khi sửa).
    const payload: Record<string, string> = { name: form.name, url: form.url, page_id: form.page_id };
    if (form.access_token) payload.access_token = form.access_token;
    if (form.cookies) payload.cookies = form.cookies;
    setSaving(true);
    const okr = editId ? await updatePage({ ...payload, id: editId }) : await createPage(payload);
    setSaving(false);
    if (okr) { setForm(empty); setEditId(null); }
  };

  const startEdit = (p: FbPage) => {
    setEditId(p.id);
    setForm({ name: p.name, url: p.url, page_id: p.page_id || '', access_token: '', cookies: '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="manage-page">
      <div className="page-header">
        <h1 className="page-title">📄 Quản lý Page</h1>
        <p className="page-subtitle">Mỗi Page có token Graph (đăng Reels/API) và cookie (bot đăng tường). Secret được mã hóa trong DB.</p>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title" style={{ marginBottom: 14 }}>{editId ? 'Sửa Page' : 'Thêm Page mới'}</div>
        <div className="form-group">
          <label className="form-label">Tên Page (khớp tên hiển thị trên FB) <span className="form-req">*</span></label>
          <input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="VD: Linkosys" />
        </div>
        <div className="form-group">
          <label className="form-label">URL Page <span className="form-req">*</span></label>
          <input className="input-field" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://web.facebook.com/YourPage/" />
        </div>
        <div className="form-group">
          <label className="form-label">Page ID (Graph API — cho Reels, tùy chọn)</label>
          <input className="input-field" value={form.page_id} onChange={e => setForm({ ...form, page_id: e.target.value })} placeholder="1234567890" />
        </div>
        <div className="form-group">
          <label className="form-label">Access Token (Graph API — tùy chọn)</label>
          <input className="input-field" type="password" value={form.access_token} onChange={e => setForm({ ...form, access_token: e.target.value })}
            placeholder={editId ? 'Để trống nếu không đổi' : 'EAAB...'} />
        </div>
        <div className="form-group">
          <label className="form-label">Cookies JSON (cho bot đăng tường — dán từ Cookie-Editor)</label>
          <textarea className="input-field" rows={4} value={form.cookies} onChange={e => setForm({ ...form, cookies: e.target.value })}
            placeholder={editId ? 'Để trống nếu không đổi' : '[{"name":"c_user",...}]'} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" onClick={submit} disabled={saving}>{saving ? 'Đang lưu…' : (editId ? 'Lưu' : 'Thêm Page')}</button>
          {editId && <button className="btn-secondary" onClick={() => { setForm(empty); setEditId(null); }}>Hủy</button>}
        </div>
      </div>

      <div className="section-header">
        <span className="section-title">Danh sách Page</span>
        <span className="section-count">{pages.length}</span>
      </div>

      {loading && pages.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">⏳</div>Đang tải danh sách Page…</div>
      ) : !loading && pages.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">📄</div>Chưa có Page nào.</div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {pages.map(p => (
          <div key={p.id} className="card" style={{ opacity: p.active ? 1 : 0.55 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {p.name}
                  <span className="badge" style={{ background: p.has_cookies ? 'var(--success-bg)' : 'var(--danger-bg)', color: p.has_cookies ? 'var(--success-fg)' : 'var(--danger-fg)' }}>
                    {p.has_cookies ? '🍪 cookie' : 'thiếu cookie'}
                  </span>
                  <span className="badge">{p.has_token ? '🔑 token' : 'không token'}</span>
                  {!p.active && <span className="badge">tắt</span>}
                </div>
                <div className="form-hint" style={{ wordBreak: 'break-all' }}>{p.url}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button className="btn-secondary" onClick={() => toggleActive(p)}>{p.active ? 'Tắt' : 'Bật'}</button>
                <button className="btn-secondary" onClick={() => startEdit(p)}>Sửa</button>
                <button className="btn-danger" onClick={() => deletePage(p.id)}>Xóa</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
