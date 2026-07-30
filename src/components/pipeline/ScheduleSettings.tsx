'use client';

interface ScheduleSettingsProps {
  scheduleStart: string;
  scheduleInterval: number;
  onStartChange: (value: string) => void;
  onIntervalChange: (value: number) => void;
}

export function ScheduleSettings({
  scheduleStart, scheduleInterval, onStartChange, onIntervalChange,
}: ScheduleSettingsProps) {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>
        ⏰ Cài đặt lịch đăng
      </h3>
      <div className="schedule-row">
        <div>
          <label className="form-label">Bắt đầu từ</label>
          <input type="datetime-local" className="input-field"
            value={scheduleStart} onChange={e => onStartChange(e.target.value)} />
        </div>
        <div>
          <label className="form-label">Cách nhau (giờ)</label>
          <input type="number" className="input-field"
            value={scheduleInterval} onChange={e => onIntervalChange(Number(e.target.value))} min={1} />
        </div>
      </div>
    </div>
  );
}
