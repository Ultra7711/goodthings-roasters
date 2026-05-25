'use client';

/* ══════════════════════════════════════════
   AdminTopbarActions — Topbar 우측 actions slot
   - Provider 가 (authed)/layout 트리에서 슬롯 element 보유
   - Topbar 가 SlotAnchor 로 ref 등록 → 페이지가 portal 로 children 주입
   - 페이지에서 `<AdminTopbarActions>` 컴포넌트로 사용 (client only)
   ══════════════════════════════════════════ */

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

type SlotCtx = {
  el: HTMLDivElement | null;
  setEl: (el: HTMLDivElement | null) => void;
};

const TopbarSlotContext = createContext<SlotCtx | null>(null);

export function AdminTopbarActionsProvider({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  return (
    <TopbarSlotContext.Provider value={{ el, setEl }}>
      {children}
    </TopbarSlotContext.Provider>
  );
}

/* Topbar 내부에서 한 번만 렌더 — anchor div 를 컨텍스트에 등록 */
export function AdminTopbarSlotAnchor({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const ctx = useContext(TopbarSlotContext);
  if (!ctx) return null;
  // ref callback = setState dispatch (mount/unmount 시점 호출 · commit 단계 안전).
  // eslint-disable-next-line react-hooks/refs
  return <div ref={ctx.setEl} className={className} style={style} />;
}

/* 페이지에서 사용 — children 을 portal 로 slot anchor 에 그림 */
export function AdminTopbarActions({ children }: { children: ReactNode }) {
  const ctx = useContext(TopbarSlotContext);
  if (!ctx?.el) return null;
  return createPortal(children, ctx.el);
}
