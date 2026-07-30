'use client';

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

export function StepResearch({ sourceFilter, onFilterChange, onResearch, loading }: StepResearchProps) {
  return (
    <div className="card animate-in">
      <div className="form-group">
        <label className="form-label">Chọn nguồn cào tin</label>
        <div className="source-tags">
          {SOURCE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`tag ${sourceFilter === opt.value ? 'active' : ''}`}
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
  );
}
