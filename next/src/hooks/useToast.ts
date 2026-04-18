/* ══════════════════════════════════════════
   useToast  (ADR-004 Step C-4)
   클라이언트 전용 훅 — 스토어 본체는 @/lib/toastStore.
   ══════════════════════════════════════════ */

'use client';

import { useSyncExternalStore } from 'react';
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  showToast,
  dismissToast,
  type ToastEntry,
} from '@/lib/toastStore';

/** ToastContainer 전용 — 전체 toasts 배열 구독 */
export function useToasts(): ToastEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** 컴포넌트에서 사용할 편의 훅 — 기존 API 호환 (`useToast().show(...)`) */
export function useToast() {
  return { show: showToast };
}

/* 비-훅 경로 호환 재수출 (컴포넌트 핸들러 내부에서 직접 호출 가능) */
export { showToast, dismissToast };
