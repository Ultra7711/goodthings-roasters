/* ══════════════════════════════════════════
   BillingLayout — 결제 빌링 콜백 독립 레이아웃 (R-3d)

   /checkout 과 동일하게 사이트 헤더·공지바·푸터 없이 자체 미니 헤더만
   사용하는 결제 전용 셸. MiniHeader 는 각 페이지(BillingShell)가 렌더.
   ══════════════════════════════════════════ */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import ToastContainer from '@/components/layout/ToastContainer';
import OverscrollTop from '@/components/ui/OverscrollTop';

/* 결제 관련 민감 URL(authKey 등)이 3rd-party 태그에 누출되지 않도록 referrer 제한
   (checkout layout 정합 · docs/payments-security-hardening.md §3). */
export const metadata: Metadata = {
  referrer: 'same-origin',
};

export default function BillingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* 공지바·푸터 없는 독립 레이아웃 — 상/하단 모두 page bg 정합(checkout 답습). */}
      <OverscrollTop top="#FBF8F3" bottom="#FBF8F3" />
      {children}
      <ToastContainer />
    </>
  );
}
