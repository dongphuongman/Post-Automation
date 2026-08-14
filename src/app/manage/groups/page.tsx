'use client';

import { useEffect, useState } from 'react';
import { notify } from '@/components/ui/Notify';
import { useGroups, type FbGroup } from '@/hooks/useGroups';
import { usePages } from '@/hooks/usePages';

export default function ManageGroupsPage() {
  const { groups, loading, fetchGroups, createGroup, updateGroup, toggleActive, deleteGroup } = useGroups();
  const { pages, fetchPages } = usePages();
  const [pageId, setPageId] = useState('');
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchGroups(); fetchPages(); }, [fetchGroups, fetchPages]);
  useEffect(() => { if (!pageId && pages.length) setPageId(pages[0].id); }, [pages, pageId]);

  const pageName = (id: string) => pages.find(p => p.id === id)?.name || id;

  const resetForm = () => { setEditId(null); setUrl(''); setName(''); };

  const submit = async () => {
    if (!pageId) { notify('Chọn Page', 'warning'); return; }
    if (!url.trim()) { notify('Nhập URL nhóm', 'warning'); return; }
    setSaving(true);
    const payload = { page_id: pageId, url: url.trim(), name: name.trim() || undefined };
    const okr = editId ? await updateGroup({ ...payload, id: editId }) : await createGroup(payload);
    setSaving(false);
    if (okr) resetForm();
  };

  const startEdit = (g: FbGroup) => {
    setEditId(g.id);
    setPageId(g.page_id);
    setUrl(g.url);
    setName(g.name || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="manage-page">
      <div className="page-header">
        <h1 className="page-title">👥 Quản lý Nhóm Facebook</h1>
        <p className="page-subtitle">Nhóm gắn với một Page (đăng với tư cách Page đó). Chỉ để URL dạng /groups/...</p>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title" style={{ marginBottom: 14 }}>{editId ? 'Sửa nhóm' : 'Thêm nhóm'}</div>
        <div className="form-group">
          <label className="form-label">Đăng với tư cách Page</label>
          <select className="input-field" value={pageId} onChange={e => setPageId(e.target.value)}>
            {pages.length === 0 && <option value="">(Chưa có Page — thêm ở mục Page)</option>}
            {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">URL nhóm <span className="form-req">*</span></label>
          <input className="input-field" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.facebook.com/groups/..." />
        </div>
        <div className="form-group">
          <label className="form-label">Tên gợi nhớ (tùy chọn)</label>
          <input className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder="VD: Group AI Việt Nam" />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" onClick={submit} disabled={pages.length === 0 || saving}>{saving ? 'Đang lưu…' : (editId ? 'Lưu' : 'Thêm nhóm')}</button>
          {editId && <button className="btn-secondary" onClick={resetForm}>Hủy</button>}
        </div>
      </div>

      <div className="section-header">
        <span className="section-title">Danh sách nhóm</span>
        <span className="section-count">{groups.length}</span>
      </div>

      {loading && groups.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">⏳</div>Đang tải danh sách nhóm…</div>
      ) : !loading && groups.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">👥</div>Chưa có nhóm nào.</div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {groups.map(g => (
          <div key={g.id} className="card" style={{ opacity: g.active ? 1 : 0.55 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {g.name || g.url}
                  <span className="badge badge-source">{pageName(g.page_id)}</span>
                  {!g.active && <span className="badge">tắt</span>}
                </div>
                <div className="form-hint" style={{ wordBreak: 'break-all' }}>{g.url}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button className="btn-secondary" onClick={() => toggleActive(g)}>{g.active ? 'Tắt' : 'Bật'}</button>
                <button className="btn-secondary" onClick={() => startEdit(g)}>Sửa</button>
                <button className="btn-danger" onClick={() => deleteGroup(g.id)}>Xóa</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
