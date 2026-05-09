/* ══════════════════════════════════════════
   Dev Preview — /dev/order-complete
   주문 완료 페이지(/order-complete)를 결제 흐름 없이 미리 볼 수 있는 더미 라우트.

   - sessionStorage 'gtr-last-order' 에 mock LastOrder 를 useState lazy init 으로
     동기 주입 → child OrderCompletePage useEffect read 시 이미 set 되어 있음.
   - confirmState 'idle' 분기 (Toss 쿼리 없음) → success UI 렌더.
   - 자문안 §editorial confirmation 기준 두 아이템 (가을의 밤 200g + 드립백 10ea).
   ══════════════════════════════════════════ */

'use client';

import { Suspense, useState } from 'react';
import OrderCompletePage from '@/components/checkout/OrderCompletePage';
import type { StoredOrderSummary } from '@/types/order';

const MOCK_ORDER: StoredOrderSummary = {
  number: 'GT-20260509-PRVW1',
  createdAt: '2026-05-09T13:00:00.000Z',
  subscriptionCount: 1,
  items: [
    {
      name: '가을의 밤 Autumn Night',
      slug: 'autumn-night',
      category: 'Coffee Bean',
      volume: '200g',
      qty: 1,
      priceNum: 14000,
      image: {
        src: '/images/products/pd_img_autumn_night.webp',
        bg: '#ebebeb',
      },
      type: 'subscription',
      period: '4주',
    },
    {
      name: '예가체프 드립백 Yega Drip Bag',
      slug: 'yega-drip',
      category: 'Drip Bag',
      volume: '10ea',
      qty: 1,
      priceNum: 12000,
      image: {
        src: '',
        bg: '#e0d8c8',
      },
      type: 'one-time',
      period: null,
    },
  ],
  subtotalAmount: 26000,
  // discountAmount: undefined — 정기배송 할인 정책 확정 전 hide
  shippingFee: 0,
  totalAmount: 26000,
  shipping: {
    recipientName: '조성연',
    recipientPhone: '010-1234-5678',
    zipCode: '02882',
    address: '서울 종로구 종로 12, 5층',
    deliveryNote: '문 앞에 두고 가주세요',
  },
};

export default function OrderCompletePreviewPage() {
  // useState lazy init — 첫 render 동기 실행으로 child useEffect 보다 먼저 sessionStorage set.
  useState(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('gtr-last-order', JSON.stringify(MOCK_ORDER));
    }
    return null;
  });

  /* Next.js 16 cacheComponents — useSearchParams() 등 dynamic hook 사용 컴포넌트는
     Suspense 경계 안에 있어야 prerender/SSR 차단 회피.
     (main)/order-complete/page.tsx 의 Suspense 패턴과 동일. */
  return (
    <Suspense fallback={null}>
      <OrderCompletePage />
    </Suspense>
  );
}
