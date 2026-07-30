'use client';

import type { Article, ArticleFormat } from '@/types';
import { ArticleCard } from './ArticleCard';

interface StepSelectArticlesProps {
  articles: Article[];
  selectedArticles: Set<string>;
  selectedFormat: Record<string, ArticleFormat>;
  loading: boolean;
  onToggle: (id: string) => void;
  onSetFormat: (id: string, format: ArticleFormat) => void;
  onBatchWrite: () => void;
}

export function StepSelectArticles({
  articles, selectedArticles, selectedFormat, loading, onToggle, onSetFormat, onBatchWrite,
}: StepSelectArticlesProps) {
  return (
    <div className="animate-in">
      <div className="section-header">
        <h3 className="section-title">
          Tin mới chờ xử lý
          <span className="section-count">{articles.length}</span>
        </h3>
        <button className="btn-primary" onClick={onBatchWrite}
          disabled={loading || selectedArticles.size === 0}>
          {loading ? '⏳ Đang viết bài & tạo ảnh...'
            : `🤖 AI viết bài & tạo ảnh (${selectedArticles.size})`}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {articles.map(a => (
          <ArticleCard key={a.id} article={a} selected={selectedArticles.has(a.id)}
            format={selectedFormat[a.id]} onToggle={onToggle} onSetFormat={onSetFormat} />
        ))}
        {articles.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <p>Chưa có tin mới. Quay lại bước 1 để quét tin.</p>
          </div>
        )}
      </div>
    </div>
  );
}
