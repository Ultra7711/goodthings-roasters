'use client';

/* ══════════════════════════════════════════════════════════════════════════
   ConfirmModal — admin 도메인 전용 확인 모달 (S231-4)

   디자인 차별화 — B2C 의 mp-modal-* (warm 톤) 와 구분:
   - 좌측 vertical stripe (4px) — danger=red / default=primary
   - 아이콘 (AlertTriangle for danger · Info for default)
   - admin 토큰 답습 (var(--surface) · var(--border) · admin Button)
   - shadcn Dialog primitive 위 wrapper (focus trap · escape · aria-* 자동)

   답습 패턴:
   - GoodDays / CafeEvents 의 window.confirm 마이그 (carry · S233 폴리싱 후보)
   - 현재 적용: ProductDangerZoneClient 영구 삭제 · ProductImageReorderClient 이미지 삭제

   강한 확인 (requireTextMatch):
   - 운영자가 정확한 텍스트 입력해야 confirm 버튼 활성 (영구 삭제 등 위험 작업)
   - 빈 문자열이면 일반 confirm (yes/no)
   ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useId, useState, type ReactNode } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/admin/ui/dialog';
import { Button } from '@/components/admin/ui/button';
import { Input } from '@/components/admin/ui/input';
import { cn } from '@/lib/utils';

export type ConfirmModalVariant = 'default' | 'danger';

type Props = {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: ConfirmModalVariant;
  /** 강한 확인 — 운영자가 이 텍스트 정확히 입력해야 confirm 활성 (예: 상품명) */
  requireTextMatch?: string;
  /** requireTextMatch 사용 시 입력란 위 안내 라벨 (예: '상품명을 입력하세요') */
  requireTextLabel?: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = '취소',
  variant = 'default',
  requireTextMatch,
  requireTextLabel,
  pending = false,
  onCancel,
  onConfirm,
}: Props) {
  const inputId = useId();
  const [entered, setEntered] = useState('');

  /* open 갱신 시 입력 초기화 */
  useEffect(() => {
    if (!open) setEntered('');
  }, [open]);

  const isDanger = variant === 'danger';
  const stripeColor = isDanger ? 'var(--danger)' : 'var(--primary)';
  const Icon = isDanger ? AlertTriangle : Info;

  const textMatchRequired = Boolean(requireTextMatch && requireTextMatch.length > 0);
  const textMatched = textMatchRequired
    ? entered.trim() === (requireTextMatch ?? '').trim()
    : true;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[440px] p-0 overflow-hidden gap-0"
      >
        {/* 좌측 stripe + 본문 — flex 로 stripe 살짝 강조 */}
        <div className="flex">
          <div
            aria-hidden
            className="w-1 shrink-0"
            style={{ background: stripeColor }}
          />
          <div className="flex-1 p-5">
            <DialogHeader className="text-left gap-2">
              <div className="flex items-center gap-2">
                <Icon
                  size={18}
                  className={cn(
                    isDanger
                      ? 'text-[var(--danger)]'
                      : 'text-[var(--primary)]',
                  )}
                  aria-hidden
                />
                <DialogTitle className="text-base font-semibold">
                  {title}
                </DialogTitle>
              </div>
              {description && (
                <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                  {description}
                </DialogDescription>
              )}
            </DialogHeader>

            {textMatchRequired && (
              <div className="mt-4 flex flex-col gap-1.5">
                {requireTextLabel && (
                  <label
                    htmlFor={inputId}
                    className="text-xs font-medium text-foreground"
                  >
                    {requireTextLabel}
                  </label>
                )}
                {/* placeholder = requireTextMatch — 운영자가 정확한 텍스트 볼 수 있음.
                   Input 아래 별도 helper 폐기 (S231-4 정리). */}
                <Input
                  id={inputId}
                  type="text"
                  autoFocus
                  autoComplete="off"
                  placeholder={requireTextMatch}
                  value={entered}
                  onChange={(e) => setEntered(e.target.value)}
                  className="gtr-mono"
                />
              </div>
            )}

            {/* Footer 버튼 min-w-[96px] — admin-design §5-6/§5-24 답습 (S231-4) */}
            <DialogFooter className="mt-5 sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="!h-8 min-w-[96px]"
                onClick={onCancel}
                disabled={pending}
              >
                {cancelLabel}
              </Button>
              <Button
                type="button"
                size="sm"
                className={cn(
                  '!h-8 min-w-[96px]',
                  isDanger &&
                    '!bg-[var(--danger)] !text-white hover:!bg-[var(--danger)]/90',
                )}
                onClick={onConfirm}
                disabled={pending || !textMatched}
              >
                {pending ? '처리 중…' : confirmLabel}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
