'use client';

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
  { target: 'x', bg: '#000000', icon: '𝕏', label: 'X' },
  { target: 'threads', bg: '#111827', icon: '🧵', label: 'Threads' },
  { target: 'instagram', bg: '#d6249f', icon: '📸', label: 'Instagram' },
];

export function PublishActions({ selectedCount, loading, onPublish, onDelete }: PublishActionsProps) {
  return (
    <div className="publish-bar">
      <button className="btn-danger" onClick={onDelete}
        disabled={loading || selectedCount === 0}>
        🗑 Xoá ({selectedCount})
      </button>
      {BUTTONS.map(b => (
        <button key={b.target} className="btn-primary"
          style={{ background: b.bg }}
          onClick={() => onPublish(b.target)}
          disabled={loading || selectedCount === 0}>
          {loading ? '...' : `${b.icon} ${b.label} (${selectedCount})`}
        </button>
      ))}
    </div>
  );
}
