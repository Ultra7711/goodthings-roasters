/* ══════════════════════════════════════════
   CheckoutLayout
   체크아웃·주문완료는 사이트 헤더·푸터 없이
   자체 미니 헤더만 사용하는 독립 레이아웃.
   ══════════════════════════════════════════ */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import ToastContainer from '@/components/layout/ToastContainer';

/* Session 8 보안 #2 (docs/payments-security-hardening.md §3): HTTP 헤더 실패 시
   대비한 2중 방어 — <meta name="referrer" content="same-origin">. 결제 관련
   민감 URL 이 3rd-party 분석/광고 태그에 누출되는 것을 차단. */
export const metadata: Metadata = {
  referrer: 'same-origin',
};

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ToastContainer />
    </>
  );
}
