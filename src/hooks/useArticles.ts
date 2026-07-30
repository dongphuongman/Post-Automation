import { useState, useCallback } from 'react';
import type { Article, SourceFilter, ArticleFormat } from '@/types';

export function useArticles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [selectedFormat, setSelectedFormat] = useState<Record<string, ArticleFormat>>({});

  const fetchArticles = useCallback(async (filter: SourceFilter = 'all') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/articles?filter=${filter}`);
      const data = await res.json();
      setArticles(data.articles || []);
    } catch {
      console.error('Failed to fetch articles');
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedArticles(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        setSelectedFormat(f => f[id] ? f : { ...f, [id]: 'pov' });
      }
      return next;
    });
  }, []);

  const setFormat = useCallback((id: string, format: ArticleFormat) => {
    setSelectedArticles(prev => new Set(prev).add(id));
    setSelectedFormat(prev => ({ ...prev, [id]: format }));
  }, []);

  const batchWrite = useCallback(async () => {
    if (selectedArticles.size === 0) {
      alert('Vui lòng chọn ít nhất 1 bài để viết!');
      return false;
    }
    for (const id of selectedArticles) {
      if (!selectedFormat[id]) {
        alert('Vui lòng chọn định dạng cho tất cả bài đã chọn!');
        return false;
      }
    }

    setLoading(true);
    const selections = Array.from(selectedArticles).map(id => ({ id, format: selectedFormat[id] }));

    try {
      const res = await fetch('/api/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections }),
      });
      const data = await res.json();
      setLoading(false);

      if (res.ok && data.success) {
        setSelectedArticles(new Set());
        return true;
      }
      alert('Lỗi từ AI:\n' + (data.error || 'Lỗi không xác định'));
      return false;
    } catch (e: unknown) {
      setLoading(false);
      alert('Lỗi kết nối mạng: ' + (e instanceof Error ? e.message : String(e)));
      return false;
    }
  }, [selectedArticles, selectedFormat]);

  const newArticles = articles.filter(a => a.status === 'new');

  return {
    articles,
    newArticles,
    loading,
    selectedArticles,
    selectedFormat,
    fetchArticles,
    toggleSelection,
    setFormat,
    batchWrite,
  };
}
