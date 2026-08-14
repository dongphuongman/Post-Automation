'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SourceFilter } from '@/types';

interface StepResearchProps {
  sourceFilter: SourceFilter;
  onFilterChange: (filter: SourceFilter) => void;
  onResearch: () => void;
  loading: boolean;
}

const SOURCE_OPTIONS: { value: SourceFilter; icon: string; label: string }[] = [
  { value: 'all', icon: '🌐', label: 'Tất cả' },
  { value: 'news', icon: '📰', label: 'Báo Công nghệ' },
  { value: 'x', icon: '𝕏', label: 'X (Twitter)' },
  { value: 'instagram', icon: '📸', label: 'Instagram' },
];

// Checklist khởi đầu: chỉ hiện khi user MỚI chưa cấu hình nguồn/Page. Tự ẩn khi đã đủ.
function SetupChecklist() {
  const [state, setState] = useState<{ sources: number; pages: number } | null>(null);
  useEffect(() => {
    Promise.all([
      fetch('/api/sources').then(r => r.json()).catch(() => ({})),
      fetch('/api/pages').then(r => r.json()).catch(() => ({})),
    ]).then(([s, p]) => setState({
      sources: (s.sources || []).filter((x: { active: number }) => x.active).length,
      pages: (p.pages || []).length,
    }));
  }, []);
  if (!state || (state.sources > 0 && state.pages > 0)) return null;
  const Item = ({ done, children }: { done: boolean; children: React.ReactNode }) => (
    <li style={{ display: 'flex', gap: 8, alignItems: 'center', color: done ? 'var(--text-secondary)' : 'var(--text)' }}>
      <span aria-hidden style={{ color: done ? 'var(--success)' : 'var(--text-muted)' }}>{done ? '✓' : '○'}</span>
      {children}
    </li>
  );
  return (
    <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--primary)' }}>
      <div className="section-title" style={{ marginBottom: 10 }}>👋 Thiết lập nhanh</div>
      <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, listStyle: 'none' }}>
        <Item done={state.sources > 0}>
          Thêm <Link href="/manage/sources" className="meta-link">nguồn tin</Link> để quét ({state.sources} đang bật)
        </Item>
        <Item done={state.pages > 0}>
          Kết nối <Link href="/manage/pages" className="meta-link">Facebook Page</Link> để đăng ({state.pages} Page)
        </Item>
        <Item done={false}>Quét tin → chọn bài → duyệt & đăng</Item>
      </ul>
    </div>
  );
}

export function StepResearch({ sourceFilter, onFilterChange, onResearch, loading }: StepResearchProps) {
  return (
    <>
      <SetupChecklist />
      <div className="card animate-in">
        <div className="form-group">
          <label className="form-label">Chọn nguồn cào tin</label>
          <div className="source-tags">
            {SOURCE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`tag ${sourceFilter === opt.value ? 'active' : ''}`}
                aria-pressed={sourceFilter === opt.value}
                onClick={() => onFilterChange(opt.value)}
              >
                <span className="tag-icon">{opt.icon}</span> {opt.label}
              </button>
            ))}
          </div>
          <p className="form-hint">
            Hệ thống sẽ quét hàng loạt báo lớn (TechCrunch, a16z...) và mạng xã hội để bóc tách tin mới nhất (trong 24h).
          </p>
        </div>
        <button className="btn-primary" onClick={onResearch} disabled={loading}
          style={{ padding: '14px 32px', fontSize: 14 }}>
          {loading ? '⏳ Đang cào dữ liệu...' : '⚡ Bắt đầu quét tin'}
        </button>
      </div>
    </>
  );
}
