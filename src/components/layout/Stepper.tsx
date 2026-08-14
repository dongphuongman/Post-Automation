'use client';

const STEPS = [
  { id: 1, label: 'Thu thập tin', short: 'Thu thập' },
  { id: 2, label: 'Chọn & Định dạng', short: 'Chọn bài' },
  { id: 3, label: 'Duyệt & Đăng bài', short: 'Đăng bài' },
] as const;

interface StepperProps {
  current: number;
  onChange: (step: number) => void;
}

export function Stepper({ current, onChange }: StepperProps) {
  return (
    <div className="stepper">
      {STEPS.map(s => (
        <button
          type="button"
          key={s.id}
          className={`step ${current === s.id ? 'active' : current > s.id ? 'completed' : ''}`}
          onClick={() => onChange(s.id)}
          aria-current={current === s.id ? 'step' : undefined}
          aria-label={`Bước ${s.id}: ${s.label}`}
        >
          <span className="step-number">
            {current > s.id ? '✓' : s.id}
          </span>
          <span className="step-label">{s.label}</span>
          <span className="step-label-short">{s.short}</span>
        </button>
      ))}
    </div>
  );
}
