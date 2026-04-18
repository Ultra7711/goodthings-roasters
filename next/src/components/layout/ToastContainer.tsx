/* ══════════════════════════════════════════
   ToastContainer
   프로토타입 #global-toast 이식.
   - 단일 DOM 엘리먼트 + .show 토글 (프로토타입과 동일한 애니메이션 패턴)
   - useToasts() 의 toasts 배열 중 가장 마지막 항목만 노출
     (프로토타입이 단일 토스트만 큐잉 없이 재생하는 방식과 동일)
   - duration 경과 후 자동 dismiss
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef } from 'react';
import { useToasts, dismissToast } from '@/hooks/useToast';

export default function ToastContainer() {
  const toasts = useToasts();
  const latest = toasts[toasts.length - 1];
  const elRef = useRef<HTMLDivElement>(null);

  /* latest 가 바뀌면 duration 만큼 뒤 dismiss.
     dep 을 latest 객체 자체로 두면 다른 토스트가 push 될 때 참조가 바뀌면서
     이미 노출 중인 토스트의 카운트다운이 리셋된다. id/duration 으로 고정하면
     같은 토스트가 유지되는 한 timeout 도 유지된다. (Session 17 code M-2) */
  useEffect(() => {
    if (!latest) return;
    const id = latest.id;
    const duration = latest.duration;
    const t = window.setTimeout(() => dismissToast(id), duration);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest?.id, latest?.duration]);

  return (
    <div
      id="global-toast"
      ref={elRef}
      className={latest ? 'show' : ''}
      aria-live="polite"
      aria-atomic="true"
    >
      {latest?.message ?? ''}
    </div>
  );
}
