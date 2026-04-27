/* ══════════════════════════════════════════
   CheckoutLayout
   체크아웃·주문완료는 사이트 헤더·푸터 없이
   자체 미니 헤더만 사용하는 독립 레이아웃.
   ══════════════════════════════════════════ */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import ToastContainer from '@/components/layout/ToastContainer';
import OverscrollTop from '@/components/ui/OverscrollTop';

/* Session 8 보안 #2 (docs/payments-security-hardening.md §3): HTTP 헤더 실패 시
   대비한 2중 방어 — <meta name="referrer" content="same-origin">. 결제 관련
   민감 URL 이 3rd-party 분석/광고 태그에 누출되는 것을 차단. */
export const metadata: Metadata = {
  referrer: 'same-origin',
};

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* BUG-165 (S88): AnnouncementBar/SiteFooter 가 없는 독립 레이아웃이라
          기본 OverscrollTop 색(#1E1B16/#4A4845)이 light 페이지 bg 와 부조화.
          light(#FBF8F3) 로 오버라이드하여 자체 미니 헤더와 시각 통일. */}
      <OverscrollTop top="#FBF8F3" bottom="#FBF8F3" />
      {children}
      <ToastContainer />
    </>
  );
}
