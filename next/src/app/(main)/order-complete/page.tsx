/* ══════════════════════════════════════════
   Order Complete Route — /order-complete
   RP-7: 주문완료 페이지 이식. S200 PR-B.5: (main) route group 으로 이동
   (SiteHeader + AnnouncementBar 사용. SiteFooter 는 라우트별 분기로 비표시).
   - sessionStorage 에서 주문 정보 읽기

   Session 11 보안 #3-4b:
   - 프로덕션에서 `?orderNumber=` 쿼리 접근은 404.
   - order_number 는 순차 증분 형식(`GT-YYYYMMDD-NNNNN`) 이라 enumeration 표면.
   - 고객 대면 URL 은 `?token={public_token UUID}` 만 허용.
   - dev/staging 에서는 레거시 링크 디버깅을 위해 유지.

   Session 8 보안 #2 (docs/payments-security-hardening.md §3):
   - referrer: 'same-origin' — order_number 가 Referer 로 3rd-party 스크립트에
     누출되는 것을 차단. 기존 OrderCompleteLayout 의 metadata 를 page 로 이전.

   BUG-006 Stage C (D-011, 2026-04-24):
   - cacheComponents 활성화로 searchParams await 가 Suspense 경계 밖이면
     빌드 에러. 쿼리 검증을 inner async 컴포넌트로 이동.
   ══════════════════════════════════════════ */

import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import OrderCompletePage from '@/components/checkout/OrderCompletePage';
import OverscrollTop from '@/components/ui/OverscrollTop';
import OverscrollAnchor from '@/components/ui/OverscrollAnchor';

export const metadata: Metadata = {
  title: '주문 완료',
  referrer: 'same-origin',
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function OrderCompleteInner({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  /* 보안 #3-4b — 프로덕션에서 `?orderNumber=` 수신 시 404.
     dev/staging 은 레거시 링크 디버깅용으로 허용. */
  if (process.env.NODE_ENV === 'production' && params?.orderNumber !== undefined) {
    notFound();
  }
  return <OrderCompletePage />;
}

export default function OrderCompleteRoute({ searchParams }: PageProps) {
  return (
    <>
      {/* (main) layout 의 dark/stone overscroll 기본값을 cream 으로 override.
          /order-complete 는 SiteFooter 비표시 + cream bg 라 stone bottom bar 노출 시 부조화. */}
      <OverscrollTop top="#1E1B16" bottom="#FBF8F3" />
      <Suspense fallback={<div className="oc-page" style={{ minHeight: '100svh' }} />}>
        <OrderCompleteInner searchParams={searchParams} />
      </Suspense>
      {/* S298: footer 없는 페이지 — 흐름끝 anchor 로 iOS rubber-band 색 활성화 (하단 = page bg sand). */}
      <OverscrollAnchor />
    </>
  );
}
