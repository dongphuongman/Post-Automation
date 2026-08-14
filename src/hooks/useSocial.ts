import { useState, useCallback } from 'react';
import { notifyError, notifySuccess, confirmDialog } from '@/components/ui/Notify';

export type SocialPlatform = 'x' | 'threads' | 'instagram';

export interface SocialAccount {
  id: string;
  platform: SocialPlatform;
  name: string;
  active: number;
  has_cookies: boolean;
  has_token: boolean;
}

export interface SocialInput {
  platform: SocialPlatform;
  name?: string;
  cookies?: string;
  token?: string;
}

export function useSocial() {
  const [accounts, setAccounts] = useState<Record<string, SocialAccount | null>>({});
  const [loading, setLoading] = useState(false);

  const fetchAccount = useCallback(async (platform: SocialPlatform) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/social-accounts?platform=${platform}`);
      const data = await res.json();
      setAccounts(prev => ({ ...prev, [platform]: data.account || null }));
    } catch {
      console.error('Failed to fetch social account');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    await Promise.all((['x', 'threads', 'instagram'] as SocialPlatform[]).map(p => fetchAccount(p)));
  }, [fetchAccount]);

  const saveAccount = useCallback(async (payload: SocialInput) => {
    const res = await fetch('/api/social-accounts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) { notifyError(data.error || 'Lỗi lưu tài khoản'); return false; }
    notifySuccess(`Đã lưu ${payload.platform.toUpperCase()}`);
    await fetchAccount(payload.platform);
    return true;
  }, [fetchAccount]);

  const deleteAccount = useCallback(async (platform: SocialPlatform) => {
    if (!(await confirmDialog(`Ngắt kết nối ${platform.toUpperCase()}?`, { title: 'Ngắt kết nối', confirmText: 'Ngắt', danger: true }))) return;
    await fetch(`/api/social-accounts?platform=${platform}`, { method: 'DELETE' });
    notifySuccess(`Đã ngắt kết nối ${platform.toUpperCase()}`);
    await fetchAccount(platform);
  }, [fetchAccount]);

  return { accounts, loading, fetchAccount, fetchAll, saveAccount, deleteAccount };
}
