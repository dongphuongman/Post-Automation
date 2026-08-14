'use client';

import { useEffect, useState } from 'react';
import type { PostTarget } from '@/types';

interface PublishActionsProps {
  selectedCount: number;
  loading: boolean;
  onPublish: (target: PostTarget) => void;
  onDelete: () => void;
}

const BUTTONS: { target: PostTarget; bg: string; icon: string; label: string }[] = [
  { target: 'page', bg: '#10b981', icon: '📅', label: 'Trang' },
  { target: 'profile', bg: '#0ea5e9', icon: '🙍', label: 'Trang cá nhân' },
  { target: 'groups', bg: '#8b5cf6', icon: '👥', label: 'Nhóm' },
  { target: 'all', bg: '#f59e0b', icon: '🚀', label: 'Tất cả' },
  { target: 'reels', bg: '#ec4899', icon: '🎬', label: 'Reels' },
  { target: 'x', bg: '#0f1419', icon: '𝕏', label: 'X' },
  { target: 'threads', bg: '#4b5563', icon: '🧵', label: 'Threads' },
  { target: 'instagram', bg: '#d6249f', icon: '📸', label: 'Instagram' },
];

export function PublishActions({ selectedCount, loading, onPublish, onDelete }: PublishActionsProps) {
  // Nhớ target đang chạy để chỉ nút đó hiện spinner, các nút khác chỉ disable.
  const [active, setActive] = useState<PostTarget | null>(null);
  useEffect(() => { if (!loading) setActive(null); }, [loading]);

  return (
    <div className="publish-bar">
      <button className="btn-danger" onClick={onDelete}
        disabled={loading || selectedCount === 0}>
        🗑 Xoá ({selectedCount})
      </button>
      {BUTTONS.map(b => {
        const running = loading && active === b.target;
        return (
          <button key={b.target} className="btn-primary"
            style={{ background: b.bg }}
            onClick={() => { setActive(b.target); onPublish(b.target); }}
            disabled={loading || selectedCount === 0}>
            {running ? '⏳ Đang xử lý…' : `${b.icon} ${b.label} (${selectedCount})`}
          </button>
        );
      })}
    </div>
  );
}
