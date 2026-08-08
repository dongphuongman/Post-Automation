'use client';

import { useEffect } from 'react';
import { usePages } from '@/hooks/usePages';
import { useGroups } from '@/hooks/useGroups';

interface TargetSelectorProps {
  pageId: string;
  groupIds: string[];
  onPageChange: (id: string) => void;
  onGroupsChange: (ids: string[]) => void;
}

export function TargetSelector({ pageId, groupIds, onPageChange, onGroupsChange }: TargetSelectorProps) {
  const { pages, fetchPages } = usePages();
  const { groups, fetchGroups } = useGroups();

  useEffect(() => { fetchPages(); fetchGroups(); }, [fetchPages, fetchGroups]);
  useEffect(() => {
    if (!pageId && pages.length) onPageChange(pages.find(p => p.active)?.id || pages[0].id);
  }, [pages, pageId, onPageChange]);

  const pageGroups = groups.filter(g => g.page_id === pageId && g.active);

  const toggleGroup = (id: string) => {
    onGroupsChange(groupIds.includes(id) ? groupIds.filter(x => x !== id) : [...groupIds, id]);
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="section-title" style={{ marginBottom: 12 }}>🎯 Đích đăng</div>

      <div className="form-group">
        <label className="form-label">Page</label>
        <select className="input-field" value={pageId} onChange={e => { onPageChange(e.target.value); onGroupsChange([]); }}>
          {pages.length === 0 && <option value="">(Chưa có Page — thêm ở mục Quản lý → Page)</option>}
          {pages.map(p => <option key={p.id} value={p.id} disabled={!p.active}>{p.name}{p.active ? '' : ' (tắt)'}</option>)}
        </select>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Nhóm (chọn nhiều — dùng khi đăng "Nhóm" / "Tất cả")</label>
        {pageGroups.length === 0 ? (
          <p className="form-hint">Page này chưa có nhóm đang bật.</p>
        ) : (
          <div className="source-tags">
            {pageGroups.map(g => (
              <button key={g.id} className={`tag ${groupIds.includes(g.id) ? 'active' : ''}`} onClick={() => toggleGroup(g.id)}>
                {g.name || g.url}
              </button>
            ))}
            <button className="tag" onClick={() => onGroupsChange(pageGroups.map(g => g.id))}>Chọn tất cả</button>
          </div>
        )}
      </div>
    </div>
  );
}
