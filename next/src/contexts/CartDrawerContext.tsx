/* ══════════════════════════════════════════════════════════════════════════
   CartDrawerContext — 카트 드로어 열림 상태 (UI-only, 비영속)
   ADR-004 Step B — 기존 useCartStore.isDrawerOpen 대체.

   S206: useHistoryDismiss hook 으로 통합 (S74 BUG-133 패턴 추출).
   - open: setIsOpen(true) → hook 이 transition 감지하여 pushState({gtrModal:'cart-drawer'})
   - close: setIsOpen(false) → hook 이 transition 감지하여 history.back (marker 살아있을 때)
   - popstate: hook listener 가 onClose (idempotent setIsOpen(false))
   - pageshow event.persisted (bfcache): hook 이 onClose 강제
   - closeForNavigation (navigate 동반): replaceState 로 marker 정리 후 setIsOpen(false).
     hook 의 transition 감지 시점에 readModalScope 가 null → history.back noop.
     router.push 와 race 회피.
   ══════════════════════════════════════════════════════════════════════════ */

'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useHistoryDismiss } from '@/hooks/useHistoryDismiss';

const CART_SCOPE = 'cart-drawer';

type CartDrawerContextValue = {
  isOpen: boolean;
  open: () => void;
  /** X / ESC / backdrop / 사용자 명시적 닫기. marker 있으면 hook 이 history.back. */
  close: () => void;
  /** navigate 동반 닫기 (router.push 전). marker 정리 후 state false. */
  closeForNavigation: () => void;
  toggle: () => void;
};

const CartDrawerContext = createContext<CartDrawerContextValue | null>(null);

export function CartDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const onClose = useCallback(() => setIsOpen(false), []);

  // S206: history marker push/back/popstate/bfcache 통합 처리 (S204 hook 추출).
  useHistoryDismiss({ open: isOpen, onClose, scope: CART_SCOPE });

  const open = useCallback(() => setIsOpen(true), []);

  const close = useCallback(() => setIsOpen(false), []);

  const closeForNavigation = useCallback(() => {
    /* navigate 동반 close — hook 의 transition 감지가 history.back 호출하기 전에
       marker 를 replaceState 로 정리. 이후 setIsOpen(false) → hook 이 marker 부재
       감지 → history.back noop. router.push 와 race 회피. */
    if (typeof window !== 'undefined') {
      const state = window.history.state as { gtrModal?: string } | null;
      if (state?.gtrModal === CART_SCOPE) {
        window.history.replaceState(null, '', window.location.href);
      }
    }
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((p) => !p);
  }, []);

  const value = useMemo(
    () => ({ isOpen, open, close, closeForNavigation, toggle }),
    [isOpen, open, close, closeForNavigation, toggle],
  );
  return <CartDrawerContext.Provider value={value}>{children}</CartDrawerContext.Provider>;
}

export function useCartDrawer(): CartDrawerContextValue {
  const ctx = useContext(CartDrawerContext);
  if (!ctx) {
    throw new Error('useCartDrawer must be used within CartDrawerProvider');
  }
  return ctx;
}
