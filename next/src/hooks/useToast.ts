/* ══════════════════════════════════════════
   useToast
   글로벌 토스트 알림 상태 관리
   프로토타입 showToast() 패턴 이식
   ══════════════════════════════════════════ */

import { create } from 'zustand';

type ToastEntry = {
  id: string;
  message: string;
  duration: number;
};

type ToastStore = {
  toasts: ToastEntry[];
  show: (message: string, duration?: number) => void;
  dismiss: (id: string) => void;
};

const MAX_TOASTS = 3;
const DEFAULT_DURATION = 2500;

export const useToastStore = create<ToastStore>((set) => {
  let counter = 0;

  return {
    toasts: [],

    show: (message, duration = DEFAULT_DURATION) => {
      const id = `toast-${++counter}`;
      set((state) => ({
        toasts: [...state.toasts, { id, message, duration }].slice(-MAX_TOASTS),
      }));
    },

    dismiss: (id) => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    },
  };
});

/** 컴포넌트에서 사용할 편의 훅 */
export function useToast() {
  const show = useToastStore((s) => s.show);
  return { show };
}
