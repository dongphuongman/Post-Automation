'use client';

import { useEffect, useState } from 'react';
import { useSettings } from '@/hooks/useSettings';

export default function ManageSettingsPage() {
  const { settings, loading, fetchSettings, saveSettings } = useSettings();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const groups = Array.from(new Set(settings.map(s => s.group)));

  const save = async () => {
    const items = Object.entries(edits)
      .filter(([, v]) => v !== '' && v !== undefined)
      .map(([key, value]) => ({ key, value }));
    if (items.length === 0) { alert('Chưa có thay đổi nào để lưu.'); return; }
    setSaving(true);
    const okr = await saveSettings(items);
    setSaving(false);
    if (okr) { setEdits({}); alert('Đã lưu cài đặt!'); }
  };

  return (
    <div className="manage-page">
      <div className="page-header">
        <h1 className="page-title">⚙️ Cài đặt (LLM &amp; API Keys)</h1>
        <p className="page-subtitle">Secret được mã hóa trong DB. Ô secret hiện dạng che — để trống nếu không muốn đổi.</p>
      </div>

      {loading && settings.length === 0 ? <p className="form-hint">Đang tải...</p> : null}

      {groups.map(group => (
        <div key={group} className="card" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ marginBottom: 14 }}>{group}</div>
          {settings.filter(s => s.group === group).map(s => (
            <div key={s.key} className="form-group">
              <label className="form-label">
                {s.label} {s.secret && <span className="badge" style={{ marginLeft: 6 }}>secret</span>}
                {s.has_value && <span className="form-hint" style={{ display: 'inline', marginLeft: 8 }}>đã có {s.secret ? `(${s.value})` : ''}</span>}
              </label>
              <input
                className="input-field"
                type={s.secret ? 'password' : 'text'}
                value={edits[s.key] ?? (s.secret ? '' : s.value)}
                onChange={e => setEdits({ ...edits, [s.key]: e.target.value })}
                placeholder={s.secret ? (s.has_value ? 'Để trống nếu không đổi' : 'Nhập key...') : ''}
              />
            </div>
          ))}
        </div>
      ))}

      <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Đang lưu...' : '💾 Lưu cài đặt'}</button>
    </div>
  );
}
