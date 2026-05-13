'use client';

/* ══════════════════════════════════════════════════════════════════════════
   ShippingDialog — 송장 입력 다이얼로그 (S128 B-3 · S222 PR-3 shadcn 정정)
   - shadcn Dialog 외피 (Portal + Overlay + ESC + outside click + body lock 자동)
   - 택배사 커스텀 드롭다운 + "직접입력" 분기 (custom 로직 유지 · shadcn Select 미사용 — DEC-5)
   - 송장번호 shadcn Input · 12자 이상 권장 안내
   - 제출 → dispatchOrderAction → 결과 처리 (성공: 자동 닫힘 · 에러: inline 표시)
   ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { dispatchOrderAction, type DispatchActionResult } from './actions';
import { Button } from '@/components/admin/ui/button';
import { Input } from '@/components/admin/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/admin/ui/dialog';

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
  const carrierWrapRef = useRef<HTMLDivElement | null>(null);

  /* 다이얼로그 open 시 초기화 + 포커스 (shadcn Dialog ESC + outside click + body lock 자동) */
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

  /* carrier 드롭다운 외부 클릭 닫기 (custom dropdown — shadcn Select 미사용 · DEC-5) */
  useEffect(() => {
    if (!carrierOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!carrierWrapRef.current) return;
      if (!carrierWrapRef.current.contains(e.target as Node)) setCarrierOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [carrierOpen]);

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
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      {/* gooddays 답습 — DialogContent 의 Tailwind p-6 가 admin Portal 안에서
         적용 안 되는 케이스 회피용 inline padding/gap. (B-180b) */}
      <DialogContent
        className="gtr-admin"
        style={{ padding: 0, gap: 0, maxWidth: 480 }}
      >
        <DialogHeader style={{ padding: '18px 22px 14px' }}>
          <DialogTitle style={{ fontSize: 17, letterSpacing: '-0.015em' }}>
            발송 처리
          </DialogTitle>
          <DialogDescription asChild>
            <div
              style={{
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
          </DialogDescription>
        </DialogHeader>

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
                <Input
                  type="text"
                  value={carrierCustom}
                  onChange={(e) => setCarrierCustom(e.target.value)}
                  placeholder="택배사 이름 입력"
                  maxLength={60}
                  className="mt-2"
                />
              )}
            </Field>

            {/* 송장번호 */}
            <Field label="송장번호" required hint="대시 없이 숫자만 입력 · 12자 이상 권장">
              <Input
                ref={trackingRef}
                type="text"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="예: 123456789012"
                maxLength={60}
                className="gtr-mono"
                style={{
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
          <DialogFooter
            style={{
              padding: '14px 22px',
              borderTop: '1px solid var(--border)',
              background: '#FAFAF9',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={pending}
            >
              취소
            </Button>
            <Button type="submit" disabled={!isValid || pending}>
              {pending ? '처리 중…' : '발송 처리'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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

/* S222 PR-3: BTN_BASE / BTN_GHOST / BTN_PRIMARY 폐기 (shadcn Button 으로 대체). */
