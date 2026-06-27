/* ══════════════════════════════════════════
   /billing/reattach — 결제수단 재등록 트리거 (R-3d)

   끊긴/정지 구독의 "결제수단 재등록" CTA 대상.
   ?subscriptionId 쿼리를 받아 토스 빌링 위젯을 띄운다.
   소유권 검증은 콜백(/billing/reattach/success → reattach-billing API)에서 수행.
   ══════════════════════════════════════════ */

'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import BillingReattachWidget from '@/components/billing/BillingReattachWidget';
import BillingShell from '@/components/billing/BillingShell';

function ReattachInner() {
  const search = useSearchParams();
  const subscriptionId = search.get('subscriptionId');

  if (!subscriptionId) {
    return (
      <div style={{ textAlign: 'center' }}>
        <h1
          style={{
            fontSize: 'var(--type-h2-size)',
            fontWeight: 400,
            color: 'var(--color-text-primary)',
            marginBottom: '12px',
          }}
        >
          잘못된 접근입니다
        </h1>
        <p
          style={{
            fontSize: 'var(--type-body-m-size)',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.6,
            marginBottom: '24px',
          }}
        >
          재등록할 정기배송 정보를 찾을 수 없습니다.
        </p>
        <Link
          href="/mypage"
          className="cta-btn cta-btn-light-outline"
          style={{
            height: 48,
            padding: '0 24px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          data-gtr-tap
        >
          마이페이지로
        </Link>
      </div>
    );
  }

  return <BillingReattachWidget subscriptionId={subscriptionId} />;
}

export default function BillingReattachPage() {
  return (
    <BillingShell>
      <div style={{ maxWidth: '480px', width: '100%' }}>
        <Suspense
          fallback={
            <p
              style={{
                textAlign: 'center',
                fontSize: 'var(--type-body-m-size)',
                color: 'var(--color-text-secondary)',
              }}
            >
              불러오는 중…
            </p>
          }
        >
          <ReattachInner />
        </Suspense>
      </div>
    </BillingShell>
  );
}
