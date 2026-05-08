/* ══════════════════════════════════════════
   MyPagePanel — V2 §3.2 우측 동적 패널 wrapper (S197 PR-1.2 stub)
   - SideNav 활성 항목에 따라 본문(children) 교체
   - PR-1.3 에서 6 view 매핑: OrdersView / SubscriptionView / WishlistView (placeholder) / ProfileView / AddressesView / AccountView
   ══════════════════════════════════════════ */

'use client';

import './MyPagePanel.css';
import type { ReactNode } from 'react';

type Props = {
  /** 활성 view 의 제목 (선택) — h2 노출 */
  title?: string;
  children: ReactNode;
};

export default function MyPagePanel({ title, children }: Props) {
  return (
    <section className="mp-panel" aria-label={title}>
      {title && <h2 className="mp-panel-title">{title}</h2>}
      <div className="mp-panel-body">{children}</div>
    </section>
  );
}
