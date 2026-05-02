'use client';

/* ══════════════════════════════════════════════════════════════════════════
   ShippingDialog — 송장 입력 다이얼로그 (S128 B-3)
   - 시안 inline style 100% 이식
   - 택배사 커스텀 드롭다운 + "직접입력" 분기
   - 송장번호 mono input · 12자 이상 권장 안내
   - 제출 → dispatchOrderAction → 결과 처리 (성공: 자동 닫힘 · 에러: inline 표시)
   - ESC · 외부 클릭 닫기 · 포커스 트랩 (간단 버전 — 다이얼로그 첫 입력에 autofocus)
   ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { dispatchOrderAction, type DispatchActionResult } from './actions';

type Props = {
  open: boolean;
  onClose: () => void;
  orderNumber: string;
  customerName: string;
};

const PRESET_CARRIERS = [
  'CJ대한통운',
  '한진택배',
  '롯데택배',
  '로젠택배',
  '우체국택배',
  '직접입력...',
] as const;

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: '권한이 없습니다. 다시 로그인해주세요.',
  not_found: '주문을 찾을 수 없습니다.',
  illegal_state: '이미 발송 처리된 주문입니다.',
  invalid_tracking: '송장번호 또는 택배사가 올바르지 않습니다.',
  validation_failed: '입력값을 확인해주세요.',
  server_error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
};

export default function ShippingDialog({ open, onClose, orderNumber, customerName }: Props) {
  const router = useRouter();
  const [carrierSel, setCarrierSel] = useState<string>('CJ대한통운');
  const [carrierCustom, setCarrierCustom] = useState('');
  const [tracking, setTracking] = useState('');
  const [carrierOpen, setCarrierOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const trackingRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const carrierWrapRef = useRef<HTMLDivElement | null>(null);

  /* 다이얼로그 open 시 초기화 + 포커스 */
  useEffect(() => {
    if (!open) return;
    setCarrierSel('CJ대한통운');
    setCarrierCustom('');
    setTracking('');
    setCarrierOpen(false);
    setErrorMsg(null);
    /* 송장번호 input 으로 자동 포커스 */
    requestAnimationFrame(() => trackingRef.current?.focus());
  }, [open]);

  /* ESC 닫기 + body scroll lock */
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !pending) onClose();
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, pending, onClose]);

  /* carrier 드롭다운 외부 클릭 닫기 */
  useEffect(() => {
    if (!carrierOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!carrierWrapRef.current) return;
      if (!carrierWrapRef.current.contains(e.target as Node)) setCarrierOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [carrierOpen]);

  if (!open) return null;

  const isCustomCarrier = carrierSel === '직접입력...';
  const effectiveCarrier = isCustomCarrier ? carrierCustom.trim() : carrierSel;
  const trackingTrim = tracking.trim();
  const isValid = trackingTrim.length >= 1 && effectiveCarrier.length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || pending) return;
    setErrorMsg(null);

    startTransition(async () => {
      const result: DispatchActionResult = await dispatchOrderAction({
        orderNumber,
        trackingNumber: trackingTrim,
        carrier: effectiveCarrier,
      });
      if (result.ok) {
        onClose();
        /* revalidatePath 가 cache 무효화 했으므로 router.refresh 로 RSC 재호출 */
        router.refresh();
      } else {
        const msg = ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.server_error;
        setErrorMsg(msg);
      }
    });
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(15, 12, 8, 0.42)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-labelledby="ship-dialog-title"
        aria-modal="true"
        className="gtr-admin"
        style={{
          width: 480,
          maxWidth: 'calc(100vw - 32px)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}
      >
        {/* header */}
        <div
          style={{
            padding: '18px 22px 14px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <h2
              id="ship-dialog-title"
              style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: '-0.015em' }}
            >
              발송 처리
            </h2>
            <div
              style={{
                marginTop: 4,
                fontSize: 12.5,
                color: 'var(--foreground-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span className="gtr-mono" style={{ color: 'var(--primary)' }}>
                {orderNumber}
              </span>
              <span style={{ color: 'var(--foreground-subtle)' }}>·</span>
              <span>{customerName}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="닫기"
            title="닫기"
            style={{
              width: 28,
              height: 28,
              border: 'none',
              background: 'transparent',
              borderRadius: 6,
              color: 'var(--foreground-muted)',
              cursor: pending ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pending ? 0.5 : 1,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* body */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '0 22px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* 택배사 */}
            <Field label="택배사" required>
              <div ref={carrierWrapRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setCarrierOpen((v) => !v)}
                  aria-haspopup="listbox"
                  aria-expanded={carrierOpen}
                  style={{
                    width: '100%',
                    height: 36,
                    padding: '0 12px',
                    border: '1px solid ' + (carrierOpen ? 'var(--primary)' : 'var(--input)'),
                    boxShadow: carrierOpen ? '0 0 0 3px rgba(201, 100, 66, 0.12)' : 'none',
                    borderRadius: 6,
                    background: 'var(--surface)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 13,
                    color: 'var(--foreground)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>{carrierSel}</span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      color: 'var(--foreground-muted)',
                      transform: carrierOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform .15s',
                    }}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {carrierOpen && (
                  <ul
                    role="listbox"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
                      padding: 4,
                      zIndex: 10,
                      listStyle: 'none',
                      margin: 0,
                    }}
                  >
                    {PRESET_CARRIERS.map((c) => {
                      const sel = c === carrierSel;
                      return (
                        <li key={c}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={sel}
                            onClick={() => {
                              setCarrierSel(c);
                              setCarrierOpen(false);
                            }}
                            style={{
                              width: '100%',
                              padding: '7px 10px',
                              fontSize: 13,
                              borderRadius: 4,
                              cursor: 'pointer',
                              background: sel ? 'var(--primary-soft)' : 'transparent',
                              color: sel ? 'var(--primary-soft-fg)' : 'var(--foreground)',
                              fontWeight: sel ? 500 : 400,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              border: 'none',
                              textAlign: 'left',
                            }}
                          >
                            <span>{c}</span>
                            {sel && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              {isCustomCarrier && (
                <input
                  type="text"
                  value={carrierCustom}
                  onChange={(e) => setCarrierCustom(e.target.value)}
                  placeholder="택배사 이름 입력"
                  maxLength={60}
                  style={{
                    marginTop: 8,
                    width: '100%',
                    height: 36,
                    padding: '0 12px',
                    border: '1px solid var(--input)',
                    borderRadius: 6,
                    background: 'var(--surface)',
                    fontSize: 13,
                    color: 'var(--foreground)',
                    outline: 'none',
                  }}
                />
              )}
            </Field>

            {/* 송장번호 */}
            <Field label="송장번호" required hint="대시 없이 숫자만 입력 · 12자 이상 권장">
              <input
                ref={trackingRef}
                type="text"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="예: 123456789012"
                maxLength={60}
                style={{
                  width: '100%',
                  height: 36,
                  padding: '0 12px',
                  border: '1px solid var(--input)',
                  borderRadius: 6,
                  background: 'var(--surface)',
                  fontSize: 13,
                  color: 'var(--foreground)',
                  outline: 'none',
                  fontFamily: "'SF Mono', ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace",
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '0.02em',
                }}
              />
            </Field>

            {/* notice */}
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 6,
                background: 'var(--info-soft)',
                border: '1px solid #C5DCF1',
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                fontSize: 12,
                color: 'var(--info)',
                lineHeight: 1.5,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              <div>
                발송 처리 시 주문 상태가 <strong style={{ color: '#1F4F8B' }}>배송중</strong>으로 전환되고,
                고객에게 배송 알림 메일이 자동 발송됩니다.
              </div>
            </div>

            {/* error */}
            {errorMsg && (
              <div
                role="alert"
                style={{
                  padding: '10px 12px',
                  borderRadius: 6,
                  background: 'var(--danger-soft)',
                  border: '1px solid #EFC3C3',
                  color: 'var(--danger)',
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                {errorMsg}
              </div>
            )}
          </div>

          {/* footer */}
          <div
            style={{
              padding: '14px 22px',
              borderTop: '1px solid var(--border)',
              background: '#FAFAF9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              style={{
                ...BTN_GHOST,
                cursor: pending ? 'not-allowed' : 'pointer',
                opacity: pending ? 0.5 : 1,
              }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!isValid || pending}
              style={{
                ...BTN_PRIMARY,
                opacity: !isValid || pending ? 0.5 : 1,
                cursor: !isValid || pending ? 'not-allowed' : 'pointer',
              }}
            >
              {pending ? '처리 중…' : '발송 처리'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── 로컬 컴포넌트 ─────────────────────────────────── */

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--foreground-muted)',
          marginBottom: 6,
        }}
      >
        {label}
        {required && (
          <span style={{ color: 'var(--primary)', marginLeft: 3 }}>*</span>
        )}
      </label>
      {children}
      {hint && (
        <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--foreground-subtle)' }}>{hint}</div>
      )}
    </div>
  );
}

const BTN_BASE: React.CSSProperties = {
  height: 36,
  padding: '0 16px',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  letterSpacing: '-0.005em',
};

const BTN_GHOST: React.CSSProperties = {
  ...BTN_BASE,
  background: 'transparent',
  color: 'var(--foreground-muted)',
  border: 'none',
};

const BTN_PRIMARY: React.CSSProperties = {
  ...BTN_BASE,
  background: 'var(--primary)',
  color: '#fff',
  border: '1px solid var(--primary)',
};
