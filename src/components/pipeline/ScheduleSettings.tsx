'use client';

import { useEffect, useState } from 'react';

interface ScheduleSettingsProps {
  scheduleStart: string;
  scheduleInterval: number;
  createVideo: boolean;
  onStartChange: (value: string) => void;
  onIntervalChange: (value: number) => void;
  onCreateVideoChange: (value: boolean) => void;
}

export function ScheduleSettings({
  scheduleStart, scheduleInterval, createVideo, onStartChange, onIntervalChange, onCreateVideoChange,
}: ScheduleSettingsProps) {
  // Tính min = hiện tại + 11 phút (ngưỡng Facebook). Đặt sau khi mount để tránh
  // lệch hydration giữa server và client.
  const [minLocal, setMinLocal] = useState('');
  useEffect(() => {
    const d = new Date(Date.now() + 11 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    setMinLocal(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
  }, []);

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>
        ⏰ Cài đặt lịch đăng
      </h3>
      <div className="schedule-row">
        <div>
          <label className="form-label">Bắt đầu từ</label>
          <input type="datetime-local" className="input-field" min={minLocal || undefined}
            value={scheduleStart} onChange={e => onStartChange(e.target.value)} />
        </div>
        <div>
          <label className="form-label">Cách nhau (giờ)</label>
          <input type="number" className="input-field" min={1} step={1}
            value={scheduleInterval}
            onChange={e => {
              const v = Number(e.target.value);
              onIntervalChange(Number.isFinite(v) && v >= 1 ? v : 1);
            }} />
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, cursor: 'pointer', fontSize: 14, color: 'var(--text)' }}>
        <input type="checkbox" className="checkbox" checked={createVideo} onChange={e => onCreateVideoChange(e.target.checked)} />
        🎬 Tạo kèm video Reels khi đăng (render tự động, mất thêm 2–5 phút/bài)
      </label>
      <p className="form-hint" style={{ marginTop: 12 }}>
        Đăng Page/Tất cả cần giờ hẹn cách hiện tại ít nhất 11 phút (quy định Facebook).
      </p>
    </div>
  );
}
