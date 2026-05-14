'use client';

/* ══════════════════════════════════════════════════════════════════════════
   ProductActiveToggleClient — /admin/products/[slug]/edit 헤더 활성 토글

   책임 (S231-4 보강):
   - 상품 활성/비공개 Switch (toggleProductActiveAction 답습 · 목록 토글과 동일)
   - 라벨 동기화: "상품 공개" (활성) / "상품 비공개" (비활성)
   - optimistic UI (rollback 처리 · ProductsTableClient 답습)

   배치: edit/page.tsx 헤더의 타이틀 우측 정렬.
   ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Switch } from '@/components/admin/ui/switch';
import { toggleProductActiveAction } from '../../actions';

type Props = {
  productId: string;
  initialActive: boolean;
};

export default function ProductActiveToggleClient({
  productId,
  initialActive,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [optimisticActive, setOptimisticActive] = useState(initialActive);

  /* SSR 재진입 시 외부 상태 sync (pending 아닐 때만) */
  useEffect(() => {
    if (!pending) setOptimisticActive(initialActive);
  }, [initialActive, pending]);

  function handleToggle() {
    const next = !optimisticActive;
    setOptimisticActive(next);
    startTransition(async () => {
      const result = await toggleProductActiveAction({
        id: productId,
        isActive: next,
      });
      if (!result.ok) {
        setOptimisticActive(!next);
        const msg =
          result.error === 'unauthorized'
            ? '권한이 없습니다. 다시 로그인해주세요.'
            : result.error === 'not_found'
              ? '상품을 찾을 수 없습니다.'
              : result.error === 'validation_failed'
                ? '입력값이 올바르지 않습니다.'
                : '처리 중 오류가 발생했습니다.';
        toast.error(msg);
        return;
      }
      toast.success(
        next ? '상품을 공개했습니다' : '상품을 비공개로 전환했습니다',
      );
    });
  }

  return (
    <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
      {/* 라벨 좌 / Switch 우 — 텍스트 길이 차이 ("상품 공개" 5자 vs "상품 비공개" 6자)
          로 Switch 위치 흔들림 방지 위해 라벨 영역 min-w 고정 + text-right. */}
      <span
        className={
          'inline-block text-right min-w-[68px] ' +
          (optimisticActive
            ? 'text-foreground font-medium'
            : 'text-muted-foreground')
        }
      >
        {optimisticActive ? '상품 공개' : '상품 비공개'}
      </span>
      <Switch
        checked={optimisticActive}
        onCheckedChange={handleToggle}
        disabled={pending}
        aria-label={
          optimisticActive
            ? '상품 공개 — 클릭하면 비공개'
            : '상품 비공개 — 클릭하면 공개'
        }
        className="data-[state=unchecked]:bg-[var(--switch-off-bg)]"
      />
    </label>
  );
}
