/* ══════════════════════════════════════════
   useScrollLockOnModal — 모달 열림 시 body 스크롤 잠금

   anyOpen=true 인 동안 document.body.style.overflow='hidden'.
   cleanup 시 prev 값 복원. 여러 모달 source 를 OR 로 묶어 호출.

   사용처:
   - mypage SubscriptionEditor — 3 confirm 모달 중 하나라도 열리면 잠금
   - 기타 mp-modal-* 패턴 컴포넌트 재사용 가능
   ══════════════════════════════════════════ */

import { useEffect } from 'react';

export function useScrollLockOnModal(anyOpen: boolean): void {
  useEffect(() => {
    if (!anyOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [anyOpen]);
}
