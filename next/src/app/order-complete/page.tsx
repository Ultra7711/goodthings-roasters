/* ══════════════════════════════════════════
   Order Complete Route — /order-complete
   RP-7: 주문완료 페이지 이식.
   - 자체 미니 헤더 사용 (사이트 헤더 미표시)
   - sessionStorage 에서 주문 정보 읽기

   Session 11 보안 #3-4b:
   - 프로덕션에서 `?orderNumber=` 쿼리 접근은 404.
   - order_number 는 순차 증분 형식(`GT-YYYYMMDD-NNNNN`) 이라 enumeration 표면.
   - 고객 대면 URL 은 `?token={public_token UUID}` 만 허용.
   - dev/staging 에서는 레거시 링크 디버깅을 위해 유지.
   ══════════════════════════════════════════ */

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import OrderCompletePage from '@/components/checkout/OrderCompletePage';

export const metadata = { title: '주문 완료 — good things' };

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrderCompleteRoute({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  /* 보안 #3-4b — 프로덕션에서 `?orderNumber=` 수신 시 404.
     dev/staging 은 레거시 링크 디버깅용으로 허용. */
  if (process.env.NODE_ENV === 'production' && params?.orderNumber !== undefined) {
    notFound();
  }

  /* Suspense 경계: OrderCompletePage 내부에서 useSearchParams() 호출.
     BUG-006 Phase 2B 선행 조치 — root layout 의 `await headers()` 제거 후
     static prerender 대상이 될 때 CSR bailout 실패로 빌드 오류 방지. */
  return (
    <Suspense fallback={<div className="oc-page" style={{ minHeight: '100dvh' }} />}>
      <OrderCompletePage />
    </Suspense>
  );
}
