import { useState, useCallback } from 'react';

export interface SettingItem {
  key: string;
  label: string;
  group: string;
  secret: boolean;
  has_value: boolean;
  value: string; // che nếu secret
}

export function useSettings() {
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings(data.settings || []);
    } catch {
      console.error('Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  }, []);

  // items: [{key, value}] — chỉ gửi các key có giá trị mới (bỏ trống = giữ nguyên).
  const saveSettings = useCallback(async (items: { key: string; value: string }[]) => {
    const res = await fetch('/api/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }),
    });
    const data = await res.json();
    if (!data.success) { alert(data.error || 'Lỗi lưu cài đặt'); return false; }
    await fetchSettings();
    return true;
  }, [fetchSettings]);

  return { settings, loading, fetchSettings, saveSettings };
}
