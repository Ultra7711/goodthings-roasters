/* ══════════════════════════════════════════
   OrderShippingSection — /order-complete §4·§5.1
   배송 정보 (라벨 받는 분 / 배송 주소만 표시 — section h3 제거) + CTA row.

   설계 결정:
   - 섹션 헤더 "배송 정보" 제거. 두 column 라벨 (받는 분 / 배송 주소) 만 표시.
   - CTA 배치 사이트 규칙: primary 우측 / secondary 좌측 (CartDrawer cd-cta-row 와 동일).
   - 타이포·컬러·CTA 모두 GTR 디자인 토큰만 사용 (하드코딩 색·폰트 금지).
   - 모바일: 컬럼 stack + CTA column-reverse → primary 위, secondary 아래.
   ══════════════════════════════════════════ */

'use client';

import Link from 'next/link';
import type { StoredOrderShipping } from '@/types/order';
import './OrderShippingSection.css';

type Props = {
  shipping?: StoredOrderShipping;
};

export default function OrderShippingSection({ shipping }: Props) {
  return (
    <section className="oc-ship">
      {shipping && (
        <div className="oc-ship__cols">
          <div className="oc-ship__col">
            <span className="oc-ship__label">받는 분</span>
            <div className="oc-ship__content">
              <div className="oc-ship__name">{shipping.recipientName}</div>
              <div className="oc-ship__phone">{shipping.recipientPhone}</div>
            </div>
          </div>
          <div className="oc-ship__col">
            <span className="oc-ship__label">배송 주소</span>
            <div className="oc-ship__content">
              <div className="oc-ship__address">
                <span className="oc-ship__zip">({shipping.zipCode})</span> {shipping.address}
              </div>
              {shipping.deliveryNote && (
                <div className="oc-ship__note">&ldquo;{shipping.deliveryNote}&rdquo;</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CTA — primary(주문 내역 보기) 우측 / secondary(쇼핑 계속하기) 좌측 */}
      <div className="oc-ship__cta">
        <Link href="/shop" className="oc-cta oc-cta--secondary" data-gtr-tap>
          쇼핑 계속하기
        </Link>
        <Link href="/mypage" className="oc-cta oc-cta--primary" data-gtr-tap>
          주문 내역 보기
        </Link>
      </div>
    </section>
  );
}
