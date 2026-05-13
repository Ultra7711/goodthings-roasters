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
        <DialogHeader className="px-5 pt-5 pb-3.5">
          <DialogTitle className="text-lg tracking-tight">발송 처리</DialogTitle>
          <DialogDescription asChild>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="gtr-mono text-[var(--primary)]">{orderNumber}</span>
              <span className="text-[var(--foreground-subtle)]">·</span>
              <span>{customerName}</span>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* body */}
        <form onSubmit={handleSubmit}>
          <div className="px-5 pb-5 flex flex-col gap-3.5">
            {/* 택배사 */}
            <Field label="택배사" required>
              <div ref={carrierWrapRef} className="relative">
                <button
                  type="button"
                  onClick={() => setCarrierOpen((v) => !v)}
                  aria-haspopup="listbox"
                  aria-expanded={carrierOpen}
                  className={`w-full h-9 px-3 rounded-md bg-card flex items-center justify-between text-sm text-foreground cursor-pointer text-left ${
                    carrierOpen
                      ? 'border border-[var(--primary)]'
                      : 'border border-input'
                  }`}
                  style={{
                    boxShadow: carrierOpen ? '0 0 0 3px rgba(201, 100, 66, 0.12)' : 'none',
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
                    className="text-muted-foreground transition-transform"
                    style={{
                      transform: carrierOpen ? 'rotate(180deg)' : 'none',
                    }}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {carrierOpen && (
                  <ul
                    role="listbox"
                    className="absolute left-0 right-0 bg-card border border-border rounded-lg p-1 z-10 list-none m-0"
                    style={{
                      top: 'calc(100% + 4px)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
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
                            className={`w-full px-2.5 py-1.5 text-sm rounded cursor-pointer flex items-center justify-between border-none text-left ${
                              sel
                                ? 'bg-[var(--primary-soft)] text-[var(--primary-soft-fg)] font-medium'
                                : 'bg-transparent text-foreground font-normal'
                            }`}
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
              className="px-3 py-2.5 rounded-md flex gap-2 items-start text-xs text-[var(--info)] leading-normal"
              style={{
                background: 'var(--info-soft)',
                border: '1px solid #C5DCF1',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
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
                className="px-3 py-2.5 rounded-md text-xs text-[var(--danger)] leading-normal"
                style={{
                  background: 'var(--danger-soft)',
                  border: '1px solid #EFC3C3',
                }}
              >
                {errorMsg}
              </div>
            )}
          </div>

          {/* footer */}
          <DialogFooter
            className="px-5 py-3.5 border-t border-border justify-between gap-2.5"
            style={{ background: '#FAFAF9' }}
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
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
        {label}
        {required && (
          <span className="ml-0.5 text-[var(--primary)]">*</span>
        )}
      </label>
      {children}
      {hint && (
        <div className="mt-1 text-xs text-[var(--foreground-subtle)]">{hint}</div>
      )}
    </div>
  );
}

/* S222 PR-3: BTN_BASE / BTN_GHOST / BTN_PRIMARY 폐기 (shadcn Button 으로 대체). */
