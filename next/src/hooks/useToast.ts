/* ══════════════════════════════════════════
   useToast  (ADR-004 Step C-4)
   글로벌 토스트 알림 상태 관리.
   useSyncExternalStore 기반 모듈 싱글톤 (zustand 의존성 제거).
   ══════════════════════════════════════════ */

'use client';

import { useSyncExternalStore } from 'react';

type ToastEntry = {
  id: string;
  message: string;
  duration: number;
};

const MAX_TOASTS = 3;
const DEFAULT_DURATION = 2500;

let toasts: ToastEntry[] = [];
let counter = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ToastEntry[] {
  return toasts;
}

const SERVER_SNAPSHOT: ToastEntry[] = [];
function getServerSnapshot(): ToastEntry[] {
  return SERVER_SNAPSHOT;
}

export function showToast(message: string, duration: number = DEFAULT_DURATION) {
  const id = `toast-${++counter}`;
  toasts = [...toasts, { id, message, duration }].slice(-MAX_TOASTS);
  emit();
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/** ToastContainer 전용 — 전체 toasts 배열 구독 */
export function useToasts(): ToastEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** 컴포넌트에서 사용할 편의 훅 — 기존 API 호환 (`toast({ show }).show(...)`) */
export function useToast() {
  return { show: showToast };
}
