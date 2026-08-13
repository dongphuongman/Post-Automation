'use client';

import { useEffect, useState } from 'react';
import { notify } from '@/components/ui/Notify';
import { useSocial, type SocialPlatform, type SocialAccount } from '@/hooks/useSocial';

interface SectionCfg {
  platform: SocialPlatform;
  title: string;
  hint: string;
  field: 'cookies' | 'token';
  fieldLabel: string;
  placeholder: string;
}

const SECTIONS: SectionCfg[] = [
  {
    platform: 'x', title: '𝕏 (Twitter)', field: 'cookies',
    hint: 'Dán Cookies JSON của x.com (cần auth_token + ct0). Bot mở phiên ẩn nạp cookie để đăng. Giới hạn 280 ký tự.',
    fieldLabel: 'Cookies JSON (x.com)', placeholder: '[{"name":"auth_token",...},{"name":"ct0",...}]',
  },
  {
    platform: 'instagram', title: '📸 Instagram', field: 'cookies',
    hint: 'Dán Cookies JSON của instagram.com (cần sessionid...). BẮT BUỘC có ảnh khi đăng. Giới hạn 2200 ký tự.',
    fieldLabel: 'Cookies JSON (instagram.com)', placeholder: '[{"name":"sessionid",...}]',
  },
  {
    platform: 'threads', title: '🧵 Threads', field: 'token',
    hint: 'Dán Access Token của Threads (tạo qua Meta app/OAuth). Đăng qua API chính thức. Giới hạn 500 ký tự. Ảnh cần URL public.',
    fieldLabel: 'Access Token (Threads Graph API)', placeholder: 'THAAxxxxxxxx...',
  },
];

function Section({ cfg, account, save, remove, loading }: {
  cfg: SectionCfg;
  account: SocialAccount | null;
  save: (platform: SocialPlatform, name: string, value: string) => Promise<void>;
  remove: (platform: SocialPlatform) => void;
  loading: boolean;
}) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const connected = cfg.field === 'cookies' ? account?.has_cookies : account?.has_token;

  const submit = async () => {
    if (!account && !value) { notify('Dán ' + cfg.fieldLabel + ' để kết nối', 'warning'); return; }
    await save(cfg.platform, name, value);
    setName(''); setValue('');
  };

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div className="section-title" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {cfg.title}
          <span className="badge" style={{ background: connected ? '#dcfce7' : '#fee2e2', color: connected ? '#166534' : '#991b1b' }}>
            {connected ? '✓ đã kết nối' : 'chưa kết nối'}
          </span>
        </div>
        {account && <button className="btn-danger" onClick={() => remove(cfg.platform)}>Ngắt kết nối</button>}
      </div>
      <p className="form-hint" style={{ marginBottom: 12 }}>{cfg.hint}</p>
      <div className="form-group">
        <label className="form-label">Tên hiển thị (tùy chọn)</label>
        <input className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder={`VD: ${cfg.platform} của tôi`} />
      </div>
      <div className="form-group">
        <label className="form-label">{cfg.fieldLabel}</label>
        <textarea className="input-field" rows={4} value={value} onChange={e => setValue(e.target.value)}
          placeholder={account ? 'Để trống nếu không đổi' : cfg.placeholder} />
      </div>
      <button className="btn-primary" onClick={submit} disabled={loading}>{account ? 'Lưu' : 'Kết nối'}</button>
    </div>
  );
}

export default function ManageSocialPage() {
  const { accounts, loading, fetchAll, saveAccount, deleteAccount } = useSocial();
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const save = async (platform: SocialPlatform, name: string, value: string) => {
    const cfg = SECTIONS.find(s => s.platform === platform)!;
    const payload: any = { platform };
    if (name) payload.name = name;
    if (value) payload[cfg.field] = value;
    await saveAccount(payload);
  };

  return (
    <div className="manage-page">
      <div className="page-header">
        <h1 className="page-title">🌐 Kết nối mạng xã hội</h1>
        <p className="page-subtitle">Kết nối tài khoản X, Instagram, Threads của CHÍNH bạn để bot đăng bài. Cookie/token được mã hóa trong DB và không bao giờ hiển thị lại.</p>
      </div>
      {SECTIONS.map(cfg => (
        <Section key={cfg.platform} cfg={cfg} account={accounts[cfg.platform] || null}
          save={save} remove={deleteAccount} loading={loading} />
      ))}
    </div>
  );
}
