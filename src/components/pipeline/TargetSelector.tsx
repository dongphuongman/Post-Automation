'use client';

import { useEffect } from 'react';
import { usePages } from '@/hooks/usePages';
import { useGroups } from '@/hooks/useGroups';

interface TargetSelectorProps {
  pageIds: string[];
  groupIds: string[];
  onPagesChange: (ids: string[]) => void;
  onGroupsChange: (ids: string[]) => void;
}

export function TargetSelector({ pageIds, groupIds, onPagesChange, onGroupsChange }: TargetSelectorProps) {
  const { pages, fetchPages } = usePages();
  const { groups, fetchGroups } = useGroups();

  useEffect(() => { fetchPages(); fetchGroups(); }, [fetchPages, fetchGroups]);
  // Mặc định chọn Page active đầu tiên nếu chưa chọn gì.
  useEffect(() => {
    if (!pageIds.length && pages.length) {
      const first = pages.find(p => p.active)?.id || pages[0].id;
      onPagesChange([first]);
    }
  }, [pages, pageIds.length, onPagesChange]);

  // Nhóm đang bật thuộc BẤT KỲ Page nào đã chọn (union) — không chỉ Page đầu tiên,
  // để nhóm không bị ẩn khi Page có nhóm không phải Page chính.
  const pageGroups = groups.filter(g => pageIds.includes(g.page_id) && g.active);

  const togglePage = (id: string) => {
    const next = pageIds.includes(id) ? pageIds.filter(x => x !== id) : [...pageIds, id];
    onPagesChange(next);
    // Bỏ chọn nhóm nào thuộc Page vừa bị bỏ chọn (giữ nhóm của các Page còn chọn).
    onGroupsChange(groupIds.filter(gid => {
      const g = groups.find(x => x.id === gid);
      return g && next.includes(g.page_id);
    }));
  };
  const toggleGroup = (id: string) => {
    onGroupsChange(groupIds.includes(id) ? groupIds.filter(x => x !== id) : [...groupIds, id]);
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="section-title" style={{ marginBottom: 12 }}>🎯 Đích đăng</div>

      <div className="form-group">
        <label className="form-label">Page (chọn nhiều — nút "Trang" sẽ đăng vào TẤT CẢ Page đã chọn)</label>
        {pages.length === 0 ? (
          <p className="form-hint">Chưa có Page — thêm ở mục Quản lý → Page.</p>
        ) : (
          <div className="source-tags">
            {pages.map(p => (
              <button key={p.id} disabled={!p.active}
                className={`tag ${pageIds.includes(p.id) ? 'active' : ''}`}
                onClick={() => p.active && togglePage(p.id)}>
                {p.name}{p.active ? '' : ' (tắt)'}
              </button>
            ))}
          </div>
        )}
        {pageIds.length > 1 && (
          <p className="form-hint" style={{ marginTop: 8 }}>
            Đang chọn {pageIds.length} Page. Nút <strong>Trang</strong> đăng cả {pageIds.length} Page; đích <strong>Nhóm/Tất cả</strong> dùng Page chính (đầu tiên).
          </p>
        )}
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Nhóm (chọn nhiều — dùng khi đăng "Nhóm" / "Tất cả", theo các Page đã chọn)</label>
        {pageGroups.length === 0 ? (
          <p className="form-hint">{pageIds.length ? 'Các Page đã chọn chưa có nhóm đang bật.' : 'Chưa chọn Page nào.'}</p>
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
