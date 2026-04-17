/* ══════════════════════════════════════════
   toastStore  (ADR-004 Step C-4)
   글로벌 토스트 모듈 싱글톤 — 프레임워크/지시어 독립.

   - showToast / dismissToast: 비-React 경로에서 호출 가능
   - subscribe / getSnapshot: useSyncExternalStore 용 (hooks/useToast.ts 에서 사용)
   - HMR 보호: dev 에서 모듈 재평가 시 globalThis 에 store 를 보존해
     기존 구독자가 고아가 되지 않도록 한다.
   ══════════════════════════════════════════ */

export type ToastEntry = {
  id: string;
  message: string;
  duration: number;
};

const MAX_TOASTS = 3;
export const DEFAULT_TOAST_DURATION = 2500;

type ToastStoreState = {
  toasts: ToastEntry[];
  counter: number;
  listeners: Set<() => void>;
};

const STORE_KEY = '__gtr_toast_store__';

function getStore(): ToastStoreState {
  const g = globalThis as unknown as Record<string, ToastStoreState | undefined>;
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = {
      toasts: [],
      counter: 0,
      listeners: new Set<() => void>(),
    };
  }
  return g[STORE_KEY]!;
}

function emit() {
  const store = getStore();
  store.listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  const store = getStore();
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

export function getSnapshot(): ToastEntry[] {
  /* 구독 알림마다 새 배열 참조를 반환해야 useSyncExternalStore 가
     React 18 concurrent 모드에서 안정적으로 변화를 감지한다.
     showToast / dismissToast 가 항상 새 배열로 교체하므로 보장됨. */
  return getStore().toasts;
}

const SERVER_SNAPSHOT: ToastEntry[] = [];
export function getServerSnapshot(): ToastEntry[] {
  return SERVER_SNAPSHOT;
}

export function showToast(
  message: string,
  duration: number = DEFAULT_TOAST_DURATION,
): void {
  const store = getStore();
  const id = `toast-${++store.counter}`;
  store.toasts = [...store.toasts, { id, message, duration }].slice(-MAX_TOASTS);
  emit();
}

export function dismissToast(id: string): void {
  const store = getStore();
  if (!store.toasts.some((t) => t.id === id)) return; // no-op 시 emit 방지
  store.toasts = store.toasts.filter((t) => t.id !== id);
  emit();
}
