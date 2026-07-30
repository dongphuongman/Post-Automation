'use client';

import type { Post } from '@/types';

interface PostHistoryProps { posts: Post[]; }

export function PostHistory({ posts }: PostHistoryProps) {
  return (
    <div className="history-section">
      <h3 className="history-title">📋 Lịch sử ({posts.length})</h3>
      {posts.map(p => (
        <div key={p.id} className="history-item">
          <span style={{ color: 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.article_title}
          </span>
          <span className="history-status">
            {p.status === 'ready_for_groups' && <span style={{ color: 'var(--warning)' }}>⏳ Chờ gửi nhóm</span>}
            {p.status === 'groups_posted' && <span style={{ color: 'var(--success)' }}>✅ Đã đăng nhóm</span>}
            {p.status === 'posted' && <span style={{ color: 'var(--success)' }}>✓ Đã đăng trang</span>}
            {p.create_video && p.video_status === 'pending' && <span style={{ color: 'var(--warning)', marginLeft: 8 }}>🎬 Đang tạo video</span>}
            {p.create_video && p.video_status === 'completed' && <span style={{ color: 'var(--success)', marginLeft: 8 }}>✅ Đã tải video</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
