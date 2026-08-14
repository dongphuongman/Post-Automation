'use client';

import { useEffect, useState, useCallback } from 'react';
import { notifyError } from '@/components/ui/Notify';

interface RecentPost {
  id: string; status: string; video_status: string;
  target_page_id: string | null; target_group_ids: string | null;
  scheduled_time: number | null; created_at: string;
  article_title: string | null; page_name: string | null;
}

interface DashboardData {
  statusCounts: Record<string, number>;
  videoCounts: Record<string, number>;
  totals: { pages: number; groups: number; sources: number };
  recentPosted: RecentPost[];
  recentPending: RecentPost[];
}

// Nhãn tiếng Việt + màu cho từng trạng thái hàng đợi.
const STATUS_META: Record<string, { label: string; color: string }> = {
  draft: { label: 'Nháp', color: '#64748b' },
  ready_for_page: { label: 'Chờ đăng Page', color: '#0ea5e9' },
  ready_for_groups: { label: 'Chờ đăng Nhóm', color: '#8b5cf6' },
  ready_for_profile: { label: 'Chờ đăng cá nhân', color: '#0ea5e9' },
  profile_posting: { label: 'Đang đăng cá nhân', color: '#f59e0b' },
  page_posting: { label: 'Đang đăng Page', color: '#f59e0b' },
  groups_posting: { label: 'Đang đăng Nhóm', color: '#f59e0b' },
  posted: { label: 'Đã đăng (Page)', color: '#10b981' },
  groups_posted: { label: 'Đã đăng (Nhóm)', color: '#10b981' },
  ready_for_x: { label: 'Chờ đăng X', color: '#0f172a' },
  x_posting: { label: 'Đang đăng X', color: '#f59e0b' },
  ready_for_threads: { label: 'Chờ đăng Threads', color: '#111827' },
  threads_posting: { label: 'Đang đăng Threads', color: '#f59e0b' },
  ready_for_instagram: { label: 'Chờ đăng Instagram', color: '#d6249f' },
  instagram_posting: { label: 'Đang đăng Instagram', color: '#f59e0b' },
};

function statusLabel(s: string) { return STATUS_META[s]?.label || s; }
function statusColor(s: string) { return STATUS_META[s]?.color || '#64748b'; }

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dashboard');
      const d = await res.json();
      if (d.success) setData(d);
      else { setError(d.error || 'Không tải được dashboard'); notifyError(d.error || 'Không tải được dashboard'); }
    } catch {
      setError('Lỗi mạng khi tải dashboard');
      notifyError('Lỗi mạng khi tải dashboard');
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const orderedStatuses = ['ready_for_page', 'ready_for_profile', 'ready_for_groups', 'ready_for_x', 'ready_for_threads', 'ready_for_instagram', 'page_posting', 'profile_posting', 'groups_posting', 'x_posting', 'threads_posting', 'instagram_posting', 'posted', 'groups_posted', 'draft'];

  const renderPost = (p: RecentPost) => {
    let groupCount = 0;
    try { groupCount = p.target_group_ids ? JSON.parse(p.target_group_ids).length : 0; } catch {}
    return (
      <div key={p.id} className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{p.article_title || p.id}</div>
            <div className="form-hint">
              {p.page_name ? `→ ${p.page_name}` : ''}{groupCount ? ` · ${groupCount} nhóm` : ''}
              {p.scheduled_time ? ` · hẹn ${new Date(p.scheduled_time * 1000).toLocaleString('vi-VN')}` : ''}
            </div>
          </div>
          <span className="badge" style={{ background: statusColor(p.status) + '22', color: statusColor(p.status), flexShrink: 0 }}>
            {statusLabel(p.status)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="manage-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">📊 Dashboard</h1>
          <p className="page-subtitle">Theo dõi hàng đợi bot &amp; cấu hình đang hoạt động.</p>
        </div>
        <button className="btn-secondary" onClick={load} disabled={loading}>{loading ? '↻ Đang tải…' : '↻ Làm mới'}</button>
      </div>

      {!data ? (
        error ? (
          <div className="empty-state">
            <div className="empty-icon">⚠️</div>
            <p>{error}</p>
            <button className="btn-secondary" style={{ marginTop: 12 }} onClick={load} disabled={loading}>
              {loading ? 'Đang thử lại…' : '↻ Thử lại'}
            </button>
          </div>
        ) : (
          <div className="empty-state"><div className="empty-icon">⏳</div><p>Đang tải…</p></div>
        )
      ) : (
        <>
          <div className="stat-grid">
            {orderedStatuses.filter(s => data.statusCounts[s]).map(s => (
              <div key={s} className="stat-tile" style={{ borderLeft: `4px solid ${statusColor(s)}` }}>
                <div className="stat-value">{data.statusCounts[s]}</div>
                <div className="stat-label">{statusLabel(s)}</div>
              </div>
            ))}
            {data.videoCounts.pending ? (
              <div className="stat-tile" style={{ borderLeft: '4px solid var(--pink)' }}>
                <div className="stat-value">{data.videoCounts.pending}</div>
                <div className="stat-label">Video chờ render</div>
              </div>
            ) : null}
            {data.videoCounts.error ? (
              <div className="stat-tile" style={{ borderLeft: '4px solid var(--danger)' }}>
                <div className="stat-value">{data.videoCounts.error}</div>
                <div className="stat-label">Video lỗi</div>
              </div>
            ) : null}
          </div>

          <div className="stat-grid">
            <div className="stat-tile"><div className="stat-value">{data.totals.pages}</div><div className="stat-label">Page đang bật</div></div>
            <div className="stat-tile"><div className="stat-value">{data.totals.groups}</div><div className="stat-label">Nhóm đang bật</div></div>
            <div className="stat-tile"><div className="stat-value">{data.totals.sources}</div><div className="stat-label">Nguồn đang bật</div></div>
          </div>

          <div className="section-header">
            <span className="section-title">🕓 Chưa đăng</span>
            <span className="section-count">{data.recentPending.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.recentPending.map(renderPost)}
            {data.recentPending.length === 0 && <div className="empty-state"><div className="empty-icon">📭</div>Không có bài chờ đăng.</div>}
          </div>

          <div className="section-header" style={{ marginTop: 24 }}>
            <span className="section-title">✅ Đã đăng</span>
            <span className="section-count">{data.recentPosted.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.recentPosted.map(renderPost)}
            {data.recentPosted.length === 0 && <div className="empty-state"><div className="empty-icon">📭</div>Chưa có bài nào được đăng.</div>}
          </div>
        </>
      )}
    </div>
  );
}
