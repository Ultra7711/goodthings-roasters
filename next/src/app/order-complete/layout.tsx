/* ══════════════════════════════════════════
   OrderCompleteLayout
   주문완료는 자체 미니 헤더만 사용하는 독립 레이아웃.
   ══════════════════════════════════════════ */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import ToastContainer from '@/components/layout/ToastContainer';
import OverscrollTop from '@/components/ui/OverscrollTop';

/* Session 8 보안 #2 (docs/payments-security-hardening.md §3): HTTP 헤더 실패 시
   대비한 2중 방어 — <meta name="referrer" content="same-origin">. order_number
   가 Referer 로 3rd-party 스크립트에 누출되는 것을 차단. */
export const metadata: Metadata = {
  referrer: 'same-origin',
};

export default function OrderCompleteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* BUG-165 (S88): 독립 레이아웃 (자체 미니 헤더 + light bg) — 기본
          OverscrollTop 색(#1E1B16/#4A4845)이 부조화 → light 통일. */}
      <OverscrollTop top="#FBF8F3" bottom="#FBF8F3" />
      {children}
      <ToastContainer />
    </>
  );
}
