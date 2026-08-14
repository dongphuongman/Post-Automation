'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

// Hệ thống popup dùng chung thay cho alert()/confirm()/prompt() mặc định của trình duyệt.
// - notify(message, type): toast góc phải, tự biến mất.
// - confirmDialog(message, opts): modal xác nhận đẹp, trả Promise<boolean>.
// - promptDialog(message, opts): modal nhập liệu (hỗ trợ password), trả Promise<string|null>.
// Gọi được từ bất kỳ đâu (hook, event handler) qua API mệnh lệnh; <NotifyHost/>
// mount 1 lần ở layout để render.

export type ToastType = 'success' | 'error' | 'warning' | 'info';
interface Toast { id: number; message: string; type: ToastType }
interface ConfirmState {
  id: number;
  message: string;
  title?: string;
  confirmText: string;
  cancelText: string;
  danger: boolean;
  resolve: (v: boolean) => void;
}
interface PromptState {
  id: number;
  message: string;
  title?: string;
  confirmText: string;
  cancelText: string;
  password: boolean;
  placeholder: string;
  resolve: (v: string | null) => void;
}

// ---- store tối giản (emitter + useSyncExternalStore) ----
let toasts: Toast[] = [];
let confirmState: ConfirmState | null = null;
let promptState: PromptState | null = null;
const MAX_TOASTS = 4;
const listeners = new Set<() => void>();
let seq = 1;

function emit() {
  // tạo tham chiếu mảng mới để useSyncExternalStore nhận thay đổi
  toasts = [...toasts];
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

const TTL: Record<ToastType, number> = { success: 3500, info: 3500, warning: 4500, error: 5000 };

export function notify(message: string, type: ToastType = 'info') {
  const id = seq++;
  toasts.push({ id, message, type });
  if (toasts.length > MAX_TOASTS) toasts = toasts.slice(-MAX_TOASTS); // chặn tràn màn hình
  emit();
  setTimeout(() => dismissToast(id), TTL[type]);
  return id;
}
export const notifySuccess = (m: string) => notify(m, 'success');
export const notifyError = (m: string) => notify(m, 'error');

function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function confirmDialog(
  message: string,
  opts: { title?: string; confirmText?: string; cancelText?: string; danger?: boolean } = {},
): Promise<boolean> {
  return new Promise((resolve) => {
    // Nếu đang có confirm khác, tự huỷ cái cũ (false).
    if (confirmState) confirmState.resolve(false);
    confirmState = {
      id: seq++,
      message,
      title: opts.title,
      confirmText: opts.confirmText || 'Đồng ý',
      cancelText: opts.cancelText || 'Huỷ',
      danger: opts.danger ?? false,
      resolve,
    };
    emit();
  });
}

function settleConfirm(value: boolean) {
  const c = confirmState;
  confirmState = null;
  emit();
  c?.resolve(value);
}

export function promptDialog(
  message: string,
  opts: { title?: string; confirmText?: string; cancelText?: string; password?: boolean; placeholder?: string } = {},
): Promise<string | null> {
  return new Promise((resolve) => {
    if (promptState) promptState.resolve(null); // huỷ prompt cũ nếu có
    promptState = {
      id: seq++,
      message,
      title: opts.title,
      confirmText: opts.confirmText || 'Xác nhận',
      cancelText: opts.cancelText || 'Huỷ',
      password: opts.password ?? false,
      placeholder: opts.placeholder || '',
      resolve,
    };
    emit();
  });
}

function settlePrompt(value: string | null) {
  const p = promptState;
  promptState = null;
  emit();
  p?.resolve(value);
}

const ICONS: Record<ToastType, string> = { success: '✓', error: '✕', warning: '!', info: 'i' };
const COLORS: Record<ToastType, string> = {
  success: 'var(--success)', error: 'var(--danger)', warning: 'var(--warning)', info: 'var(--primary)',
};

function useStore<T>(get: () => T): T {
  return useSyncExternalStore(subscribe, get, get);
}

export function NotifyHost() {
  const list = useStore(() => toasts);
  const confirm = useStore(() => confirmState);
  const prompt = useStore(() => promptState);
  const [promptValue, setPromptValue] = useState('');

  // Reset ô nhập mỗi khi có prompt mới.
  useEffect(() => { setPromptValue(''); }, [prompt?.id]);

  return (
    <>
      <style>{`
        @keyframes notify-in { from { opacity: 0; transform: translateX(24px) } to { opacity: 1; transform: none } }
        @keyframes notify-fade { from { opacity: 0; transform: scale(0.96) } to { opacity: 1; transform: none } }
        @media (prefers-reduced-motion: reduce) {
          [data-notify-anim] { animation: none !important }
        }
      `}</style>

      {/* Toast stack */}
      <div role="status" aria-live="polite" style={{
        position: 'fixed', top: 'calc(16px + var(--safe-top))', right: 'calc(16px + var(--safe-right))',
        zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10,
        maxWidth: 'min(92vw, 420px)', pointerEvents: 'none',
      }}>
        {list.map((t) => (
          <div key={t.id} data-notify-anim onClick={() => dismissToast(t.id)} style={{
            pointerEvents: 'auto', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12,
            background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
            borderLeft: `4px solid ${COLORS[t.type]}`, borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)', padding: '12px 14px', fontSize: 14, lineHeight: 1.45,
            animation: 'notify-in 0.22s cubic-bezier(0.4,0,0.2,1)', whiteSpace: 'pre-line',
          }}>
            <span style={{
              flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: COLORS[t.type],
              color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, marginTop: 1,
            }}>{ICONS[t.type]}</span>
            <span style={{ flex: 1, fontWeight: 500 }}>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Confirm modal */}
      {confirm && (
        <div onClick={() => settleConfirm(false)} style={{
          position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(17,24,39,0.45)',
          display: 'grid', placeItems: 'center', padding: 20,
        }}>
          <div data-notify-anim onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{
            width: 'min(92vw, 420px)', background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)', padding: 24, animation: 'notify-fade 0.18s cubic-bezier(0.4,0,0.2,1)',
          }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              {confirm.title || 'Xác nhận'}
            </div>
            <div style={{ fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.55, whiteSpace: 'pre-line', marginBottom: 22 }}>
              {confirm.message}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              {/* Dialog nguy hiểm: focus mặc định vào Huỷ để tránh Enter lỡ tay xác nhận. */}
              <button onClick={() => settleConfirm(false)} autoFocus={confirm.danger} style={{
                padding: '9px 18px', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>{confirm.cancelText}</button>
              <button onClick={() => settleConfirm(true)} autoFocus={!confirm.danger} style={{
                padding: '9px 18px', borderRadius: 'var(--radius)', border: 'none',
                background: confirm.danger ? 'var(--danger)' : 'var(--primary)', color: '#fff',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>{confirm.confirmText}</button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt modal (nhập liệu) */}
      {prompt && (
        <div onClick={() => settlePrompt(null)} style={{
          position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(17,24,39,0.45)',
          display: 'grid', placeItems: 'center', padding: 20,
        }}>
          <form data-notify-anim onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
            onSubmit={(e) => { e.preventDefault(); settlePrompt(promptValue); }}
            style={{
              width: 'min(92vw, 420px)', background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)', padding: 24, animation: 'notify-fade 0.18s cubic-bezier(0.4,0,0.2,1)',
            }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              {prompt.title || 'Nhập'}
            </div>
            <div style={{ fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.55, whiteSpace: 'pre-line', marginBottom: 14 }}>
              {prompt.message}
            </div>
            <input autoFocus className="input-field" type={prompt.password ? 'password' : 'text'}
              value={promptValue} placeholder={prompt.placeholder}
              onChange={(e) => setPromptValue(e.target.value)}
              style={{ marginBottom: 22 }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => settlePrompt(null)} style={{
                padding: '9px 18px', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>{prompt.cancelText}</button>
              <button type="submit" disabled={!promptValue.trim()} style={{
                padding: '9px 18px', borderRadius: 'var(--radius)', border: 'none',
                background: promptValue.trim() ? 'var(--primary)' : 'var(--text-muted)', color: '#fff',
                fontSize: 14, fontWeight: 600, cursor: promptValue.trim() ? 'pointer' : 'not-allowed',
              }}>{prompt.confirmText}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
