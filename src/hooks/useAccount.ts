import { useState, useCallback } from 'react';
import { notifyError, confirmDialog } from '@/components/ui/Notify';

export interface FbAccount {
  id: string;
  name: string;
  active: number;
  has_cookies: boolean;
}

export interface AccountInput {
  name?: string;
  cookies?: string;
}

export function useAccount() {
  const [account, setAccount] = useState<FbAccount | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAccount = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/account');
      const data = await res.json();
      setAccount(data.account || null);
    } catch {
      console.error('Failed to fetch account');
    } finally {
      setLoading(false);
    }
  }, []);

  const saveAccount = useCallback(async (payload: AccountInput) => {
    const res = await fetch('/api/account', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) { notifyError(data.error || 'Lỗi lưu tài khoản'); return false; }
    await fetchAccount();
    return true;
  }, [fetchAccount]);

  const deleteAccount = useCallback(async () => {
    if (!(await confirmDialog('Ngắt kết nối Facebook cá nhân?', { title: 'Ngắt kết nối', confirmText: 'Ngắt', danger: true }))) return;
    await fetch('/api/account', { method: 'DELETE' });
    await fetchAccount();
  }, [fetchAccount]);

  return { account, loading, fetchAccount, saveAccount, deleteAccount };
}
