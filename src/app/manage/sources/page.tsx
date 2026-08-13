'use client';

import { useEffect, useState } from 'react';
import { notify } from '@/components/ui/Notify';
import { useSources, type Source } from '@/hooks/useSources';

const empty = { name: '', type: 'rss', rss_url: '', url: '' };

export default function ManageSourcesPage() {
  const { sources, loading, fetchSources, createSource, updateSource, toggleActive, deleteSource } = useSources();
  const [form, setForm] = useState<Partial<Source>>(empty);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  const submit = async () => {
    if (!form.name?.trim()) { notify('Nhập tên nguồn', 'warning'); return; }
    const ok = editId
      ? await updateSource({ ...form, id: editId })
      : await createSource(form);
    if (ok) { setForm(empty); setEditId(null); }
  };

  const startEdit = (s: Source) => {
    setEditId(s.id);
    setForm({ name: s.name, type: s.type, rss_url: s.rss_url || '', url: s.url || '' });
  };

  return (
    <div className="manage-page">
      <div className="page-header">
        <h1 className="page-title">📰 Quản lý Nguồn thu thập tin</h1>
        <p className="page-subtitle">Thêm/sửa nguồn RSS &amp; mạng xã hội. Chỉ nguồn đang bật mới được cào tin.</p>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title" style={{ marginBottom: 14 }}>{editId ? 'Sửa nguồn' : 'Thêm nguồn mới'}</div>
        <div className="form-group">
          <label className="form-label">Tên nguồn</label>
          <input className="input-field" value={form.name || ''}
            onChange={e => setForm({ ...form, name: e.target.value })} placeholder="VD: TechCrunch" />
        </div>
        <div className="form-group">
          <label className="form-label">Loại</label>
          <select className="input-field" value={form.type || 'rss'}
            onChange={e => setForm({ ...form, type: e.target.value })}>
            <option value="rss">RSS (báo/blog)</option>
            <option value="social">Social (X/Instagram)</option>
          </select>
        </div>
        {form.type === 'rss' && (
          <div className="form-group">
            <label className="form-label">RSS URL</label>
            <input className="input-field" value={form.rss_url || ''}
              onChange={e => setForm({ ...form, rss_url: e.target.value })} placeholder="https://.../feed/" />
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Website (tùy chọn)</label>
          <input className="input-field" value={form.url || ''}
            onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" onClick={submit}>{editId ? 'Lưu' : 'Thêm nguồn'}</button>
          {editId && <button className="btn-secondary" onClick={() => { setForm(empty); setEditId(null); }}>Hủy</button>}
        </div>
      </div>

      <div className="section-header">
        <span className="section-title">Danh sách nguồn</span>
        <span className="section-count">{sources.length}</span>
      </div>

      {loading && sources.length === 0 ? <p className="form-hint">Đang tải...</p> : null}
      {!loading && sources.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">📭</div>Chưa có nguồn nào.</div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sources.map(s => (
          <div key={s.id} className="card" style={{ opacity: s.active ? 1 : 0.55 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}>
                  {s.name}
                  <span className="badge badge-source">{s.type}</span>
                  {!s.active && <span className="badge">tắt</span>}
                </div>
                {s.rss_url && <div className="form-hint" style={{ wordBreak: 'break-all' }}>{s.rss_url}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button className="btn-secondary" onClick={() => toggleActive(s)}>{s.active ? 'Tắt' : 'Bật'}</button>
                <button className="btn-secondary" onClick={() => startEdit(s)}>Sửa</button>
                <button className="btn-danger" onClick={() => deleteSource(s.id)}>Xóa</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
