import { useState, useCallback } from 'react';
import { notifyError, confirmDialog } from '@/components/ui/Notify';

export interface FbGroup {
  id: string;
  page_id: string;
  url: string;
  name: string | null;
  active: number;
  created_at?: string;
}

export function useGroups() {
  const [groups, setGroups] = useState<FbGroup[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/groups');
      const data = await res.json();
      setGroups(data.groups || []);
    } catch {
      console.error('Failed to fetch groups');
    } finally {
      setLoading(false);
    }
  }, []);

  const createGroup = useCallback(async (payload: Partial<FbGroup>) => {
    const res = await fetch('/api/groups', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) { notifyError(data.error || 'Lỗi tạo nhóm'); return false; }
    await fetchGroups();
    return true;
  }, [fetchGroups]);

  const updateGroup = useCallback(async (payload: Partial<FbGroup> & { id: string }) => {
    const res = await fetch('/api/groups', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) { notifyError(data.error || 'Lỗi cập nhật'); return false; }
    await fetchGroups();
    return true;
  }, [fetchGroups]);

  const toggleActive = useCallback((g: FbGroup) => updateGroup({ id: g.id, active: g.active ? 0 : 1 }), [updateGroup]);

  const deleteGroup = useCallback(async (id: string) => {
    if (!(await confirmDialog('Xoá nhóm này?', { title: 'Xoá nhóm', confirmText: 'Xoá', danger: true }))) return;
    await fetch(`/api/groups?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await fetchGroups();
  }, [fetchGroups]);

  return { groups, loading, fetchGroups, createGroup, updateGroup, toggleActive, deleteGroup };
}
