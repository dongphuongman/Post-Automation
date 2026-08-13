import { useState, useCallback } from 'react';
import { notifyError, confirmDialog } from '@/components/ui/Notify';

export interface Source {
  id: string;
  name: string;
  url: string | null;
  type: string; // 'rss' | 'social'
  rss_url: string | null;
  active: number;
  created_at?: string;
}

export function useSources() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sources');
      const data = await res.json();
      setSources(data.sources || []);
    } catch {
      console.error('Failed to fetch sources');
    } finally {
      setLoading(false);
    }
  }, []);

  const createSource = useCallback(async (payload: Partial<Source>) => {
    const res = await fetch('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) { notifyError(data.error || 'Lỗi tạo nguồn'); return false; }
    await fetchSources();
    return true;
  }, [fetchSources]);

  const updateSource = useCallback(async (payload: Partial<Source> & { id: string }) => {
    const res = await fetch('/api/sources', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) { notifyError(data.error || 'Lỗi cập nhật'); return false; }
    await fetchSources();
    return true;
  }, [fetchSources]);

  const toggleActive = useCallback((s: Source) => {
    return updateSource({ id: s.id, active: s.active ? 0 : 1 });
  }, [updateSource]);

  const deleteSource = useCallback(async (id: string) => {
    if (!(await confirmDialog('Xoá nguồn này?', { title: 'Xoá nguồn', confirmText: 'Xoá', danger: true }))) return;
    await fetch(`/api/sources?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await fetchSources();
  }, [fetchSources]);

  return { sources, loading, fetchSources, createSource, updateSource, toggleActive, deleteSource };
}
