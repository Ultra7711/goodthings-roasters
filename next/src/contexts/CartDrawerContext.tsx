/* ══════════════════════════════════════════════════════════════════════════
   CartDrawerContext — 카트 드로어 열림 상태 (UI-only, 비영속)
   ADR-004 Step B — 기존 useCartStore.isDrawerOpen 대체.

   S74 BUG-133: 브라우저 back 버튼으로 드로어 닫기 지원.
   - open: pushState({ gtrCartDrawer: true }) marker + setIsOpen(true)
   - close (X/ESC/backdrop): marker 있으면 history.back(), 없으면 setIsOpen(false)
   - closeForNavigation (navigate 동반): setIsOpen(false) only — router.push 와 충돌 방지
   - popstate listener: 브라우저 back 으로 marker 벗어날 때 setIsOpen(false)

   MobileNavDrawer 와 동일한 3콜백 패턴. same-tick 충돌 회피를 위해
   drawer marker 는 각자 다른 키 (gtrCartDrawer vs gtrMobileNav) 사용.
   ══════════════════════════════════════════════════════════════════════════ */

'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type CartDrawerHistoryState = {
  gtrCartDrawer?: boolean;
} | null;

type CartDrawerContextValue = {
  isOpen: boolean;
  open: () => void;
  /** X / ESC / backdrop / 사용자 명시적 닫기. marker 있으면 history.back() 으로 entry 제거. */
  close: () => void;
  /** navigate 동반 닫기 (router.push 전). history 조작 없이 state 만 false. */
  closeForNavigation: () => void;
  toggle: () => void;
};

const CartDrawerContext = createContext<CartDrawerContextValue | null>(null);

export function CartDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => {
    if (typeof window !== 'undefined') {
      const state = window.history.state as CartDrawerHistoryState;
      // 이미 cart marker 가 있는 경우 중복 push 방지 (이상적으론 발생 안 하지만 방어)
      if (!state?.gtrCartDrawer) {
        window.history.pushState({ gtrCartDrawer: true }, '', window.location.href);
      }
    }
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    const state = typeof window !== 'undefined'
      ? (window.history.state as CartDrawerHistoryState)
      : null;
    if (state?.gtrCartDrawer) {
      /* marker entry 가 있으면 back 으로 제거 → popstate listener 가 setIsOpen(false) 수행 */
      window.history.back();
    } else {
      setIsOpen(false);
    }
  }, []);

  const closeForNavigation = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((p) => !p);
  }, []);

  /* 브라우저 back 으로 cart marker entry 벗어날 때 drawer 닫기. 이미 false 여도 noop. */
  useEffect(() => {
    function onPopState() {
      setIsOpen(false);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
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
