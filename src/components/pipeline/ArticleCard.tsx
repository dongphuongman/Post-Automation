'use client';

import type { Article, ArticleFormat } from '@/types';

interface ArticleCardProps {
  article: Article;
  selected: boolean;
  format?: ArticleFormat;
  onToggle: (id: string) => void;
  onSetFormat: (id: string, format: ArticleFormat) => void;
}

export function ArticleCard({ article, selected, format, onToggle, onSetFormat }: ArticleCardProps) {
  return (
    <div
      className={`card mobile-col ${selected ? 'card-selected' : ''}`}
      style={{ padding: 24, display: 'flex', gap: 16, alignItems: 'flex-start', cursor: 'pointer' }}
      role="checkbox" aria-checked={selected} tabIndex={0}
      onClick={() => onToggle(article.id)}
      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggle(article.id); } }}
    >
      <div className="checkbox-wrapper">
        <input type="checkbox" className="checkbox" checked={selected} readOnly tabIndex={-1} aria-hidden />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="article-meta" style={{ marginBottom: 10 }}>
          <span className="badge badge-source">{article.source_name}</span>
          <span className="meta-time">
            {new Date(article.published_at).toLocaleString('vi-VN')}
          </span>
          <a href={article.url} target="_blank" rel="noreferrer" className="meta-link"
            onClick={e => e.stopPropagation()}>
            Xem bài gốc →
          </a>
        </div>
        <h4 style={{ marginBottom: 8, fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>
          {article.title}
        </h4>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
          {article.summary && article.summary.length > 200 ? article.summary.substring(0, 200) + '…' : article.summary}
        </p>
        <div className="mobile-wrap" style={{ display: 'flex', gap: 10 }} onClick={e => e.stopPropagation()}>
          <button className={`tag ${format === 'pov' ? 'active' : ''}`}
            onClick={() => { onSetFormat(article.id, 'pov'); if (!selected) onToggle(article.id); }}>
            📝 POV (Góc nhìn)
          </button>
          <button className={`tag ${format === 'info' ? 'active' : ''}`}
            onClick={() => { onSetFormat(article.id, 'info'); if (!selected) onToggle(article.id); }}>
            📊 Info (Tin tức)
          </button>
        </div>
      </div>
    </div>
  );
}
