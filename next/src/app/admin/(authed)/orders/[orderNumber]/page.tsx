/* ══════════════════════════════════════════
   AdminOrderDetailPage (서버 컴포넌트)
   - URL 파라미터 orderNumber 검증 → fetchOrderDetail
   - not_found 시 notFound() 호출 (Next.js 표준)
   - 인터랙티브 영역은 OrderDetailClient (client) 위임

   Next.js 16 cacheComponents 호환:
   동적 데이터 접근 (params · DB fetch) 은 inner async 컴포넌트로 분리하여
   Suspense 경계 안쪽에 둠. (authed)/layout.tsx 에서 이미 Suspense 로 children 감싸지만,
   동적 [param] 라우트는 추가로 페이지 레벨에서도 Suspense 경계 명시 필요.
   (mypage 등 동일 패턴 — 하지만 여기는 cacheComponents 가 strict 하게 검출)
   ══════════════════════════════════════════ */

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { OrderNumberSchema } from '@/lib/schemas/order';
import { fetchOrderDetail } from '@/lib/admin/ordersServer';
import OrderDetailClient from './OrderDetailClient';

type PageProps = {
  params: Promise<{ orderNumber: string }>;
};

export default function AdminOrderDetailPage({ params }: PageProps) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <AdminOrderDetailInner params={params} />
    </Suspense>
  );
}

async function AdminOrderDetailInner({ params }: PageProps) {
  const { orderNumber } = await params;
  const numberParsed = OrderNumberSchema.safeParse(orderNumber);
  if (!numberParsed.success) notFound();

  const detail = await fetchOrderDetail(numberParsed.data);
  if (!detail) notFound();

  return <OrderDetailClient detail={detail} />;
}

function DetailSkeleton() {
  return (
    <div style={{ minHeight: 360 }} aria-hidden>
      <div
        style={{
          height: 24,
          width: 200,
          background: 'var(--surface-muted)',
          borderRadius: 4,
          marginBottom: 24,
        }}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: 20,
        }}
      >
        <div
          style={{
            height: 280,
            background: 'var(--surface-muted)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}
        />
        <div
          style={{
            height: 200,
            background: 'var(--surface-muted)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}
        />
      </div>
    </div>
  );
}
