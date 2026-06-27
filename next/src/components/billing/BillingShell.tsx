/* ══════════════════════════════════════════
   BillingShell — 결제 빌링 콜백 페이지 공통 셸 (R-3d)

   /checkout 흐름과 시각 통일: MiniHeader(로고) + 상단 정렬 body.
   SiteHeader/공지바/푸터 없는 결제 전용 셸(app/billing/layout.tsx 에서
   ToastContainer·OverscrollTop·referrer 정책 제공).

   CheckoutPage 컨테이너 패턴 답습: flex column · minHeight 100svh ·
   MiniHeader(sticky) + flex:1 body(상단 정렬).
   ══════════════════════════════════════════ */

'use client';

import type { ReactNode } from 'react';
import MiniHeader from '@/components/checkout/MiniHeader';
import { useAtTop } from '@/hooks/useAtTop';

export default function BillingShell({ children }: { children: ReactNode }) {
  const atTop = useAtTop();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh' }}>
      <MiniHeader atTop={atTop} />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: '48px 24px 64px',
          fontFamily: 'var(--font-kr)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
