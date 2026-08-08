import { useState, useCallback } from 'react';

export interface FbPage {
  id: string;
  name: string;
  url: string;
  page_id: string | null;
  active: number;
  has_token: boolean;
  has_cookies: boolean;
}

export interface PageInput {
  id?: string;
  name?: string;
  url?: string;
  page_id?: string;
  access_token?: string;
  cookies?: string;
  active?: number;
}

export function usePages() {
  const [pages, setPages] = useState<FbPage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pages');
      const data = await res.json();
      setPages(data.pages || []);
    } catch {
      console.error('Failed to fetch pages');
    } finally {
      setLoading(false);
    }
  }, []);

  const createPage = useCallback(async (payload: PageInput) => {
    const res = await fetch('/api/pages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) { alert(data.error || 'Lỗi tạo Page'); return false; }
    await fetchPages();
    return true;
  }, [fetchPages]);

  const updatePage = useCallback(async (payload: PageInput & { id: string }) => {
    const res = await fetch('/api/pages', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) { alert(data.error || 'Lỗi cập nhật'); return false; }
    await fetchPages();
    return true;
  }, [fetchPages]);

  const toggleActive = useCallback((p: FbPage) => updatePage({ id: p.id, active: p.active ? 0 : 1 }), [updatePage]);

  const deletePage = useCallback(async (id: string) => {
    if (!confirm('Xoá Page này (kèm các nhóm thuộc Page)?')) return;
    await fetch(`/api/pages?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await fetchPages();
  }, [fetchPages]);

  return { pages, loading, fetchPages, createPage, updatePage, toggleActive, deletePage };
}
