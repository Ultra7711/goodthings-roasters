'use client';

/* ══════════════════════════════════════════════════════════════════════════
   MenuActiveToggleClient — /admin/menu/[id]/edit 헤더 활성 토글 (S244)
   ProductActiveToggleClient 1:1 답습 (라벨 "메뉴" 로 교체)
   ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Switch } from '@/components/admin/ui/switch';
import { toggleCafeMenuActiveAction } from '../../actions';

type Props = {
  menuId: string;
  initialActive: boolean;
};

export default function MenuActiveToggleClient({
  menuId,
  initialActive,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [optimisticActive, setOptimisticActive] = useState(initialActive);

  useEffect(() => {
    if (!pending) setOptimisticActive(initialActive);
  }, [initialActive, pending]);

  function handleToggle() {
    const next = !optimisticActive;
    setOptimisticActive(next);
    startTransition(async () => {
      const result = await toggleCafeMenuActiveAction({
        id: menuId,
        isActive: next,
      });
      if (!result.ok) {
        setOptimisticActive(!next);
        const msg =
          result.error === 'unauthorized'
            ? '권한이 없습니다. 다시 로그인해 주세요.'
            : result.error === 'not_found'
              ? '메뉴를 찾을 수 없습니다.'
              : result.error === 'validation_failed'
                ? '입력값이 올바르지 않습니다.'
                : '처리 중 오류가 발생했습니다.';
        toast.error(msg);
        return;
      }
      toast.success(
        next ? '메뉴를 공개했습니다' : '메뉴를 비공개로 전환했습니다',
      );
    });
  }

  return (
    <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
      <span
        className={
          'inline-block text-right min-w-[68px] ' +
          (optimisticActive
            ? 'text-foreground font-medium'
            : 'text-muted-foreground')
        }
      >
        {optimisticActive ? '메뉴 공개' : '메뉴 비공개'}
      </span>
      <Switch
        checked={optimisticActive}
        onCheckedChange={handleToggle}
        disabled={pending}
        aria-label={
          optimisticActive
            ? '메뉴 공개 — 클릭하면 비공개'
            : '메뉴 비공개 — 클릭하면 공개'
        }
        className="data-[state=unchecked]:bg-[var(--switch-off-bg)]"
      />
    </label>
  );
}
