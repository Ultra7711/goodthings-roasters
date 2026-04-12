/* ══════════════════════════════════════════
   ToastContainer
   프로토타입 #global-toast 이식.
   - 단일 DOM 엘리먼트 + .show 토글 (프로토타입과 동일한 애니메이션 패턴)
   - useToastStore 의 toasts 배열 중 가장 마지막 항목만 노출
     (프로토타입이 단일 토스트만 큐잉 없이 재생하는 방식과 동일)
   - duration 경과 후 자동 dismiss
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef } from 'react';
import { useToastStore } from '@/hooks/useToast';

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const latest = toasts[toasts.length - 1];
  const elRef = useRef<HTMLDivElement>(null);

  /* latest 가 바뀌면 duration 만큼 뒤 dismiss */
  useEffect(() => {
    if (!latest) return;
    const id = latest.id;
    const duration = latest.duration;
    const t = window.setTimeout(() => dismiss(id), duration);
    return () => window.clearTimeout(t);
  }, [latest, dismiss]);

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
