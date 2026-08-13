'use client';

import { useEffect, useState } from 'react';
import { notify } from '@/components/ui/Notify';
import { useAccount } from '@/hooks/useAccount';

const empty = { name: '', cookies: '' };

export default function ManageAccountPage() {
  const { account, loading, fetchAccount, saveAccount, deleteAccount } = useAccount();
  const [form, setForm] = useState<Record<string, string>>(empty);

  useEffect(() => { fetchAccount(); }, [fetchAccount]);

  const submit = async () => {
    // Chỉ gửi cookie khi người dùng dán mới (tránh ghi đè bằng chuỗi rỗng khi sửa).
    const payload: Record<string, string> = {};
    if (form.name) payload.name = form.name;
    if (form.cookies) payload.cookies = form.cookies;
    if (!account && !form.cookies) { notify('Dán Cookies JSON để kết nối', 'warning'); return; }
    const okr = await saveAccount(payload);
    if (okr) setForm(empty);
  };

  return (
    <div className="manage-page">
      <div className="page-header">
        <h1 className="page-title">🙍 Facebook cá nhân</h1>
        <p className="page-subtitle">Kết nối phiên Facebook của CHÍNH bạn để bot đăng bài lên tường cá nhân. Cookie được mã hóa trong DB và không bao giờ hiển thị lại.</p>
      </div>

      {account && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {account.name}
              <span className="badge" style={{ background: account.has_cookies ? '#dcfce7' : '#fee2e2', color: account.has_cookies ? '#166534' : '#991b1b' }}>
                {account.has_cookies ? '🍪 đã kết nối' : 'thiếu cookie'}
              </span>
            </div>
            <button className="btn-danger" onClick={deleteAccount}>Ngắt kết nối</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="section-title" style={{ marginBottom: 14 }}>{account ? 'Cập nhật kết nối' : 'Kết nối Facebook cá nhân'}</div>
        <div className="form-group">
          <label className="form-label">Tên hiển thị (tùy chọn)</label>
          <input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="VD: FB của tôi" />
        </div>
        <div className="form-group">
          <label className="form-label">Cookies JSON (dán từ Cookie-Editor trên facebook.com)</label>
          <textarea className="input-field" rows={5} value={form.cookies} onChange={e => setForm({ ...form, cookies: e.target.value })}
            placeholder={account ? 'Để trống nếu không đổi' : '[{"name":"c_user",...}]'} />
        </div>
        <button className="btn-primary" onClick={submit} disabled={loading}>{account ? 'Lưu' : 'Kết nối'}</button>
      </div>
    </div>
  );
}
