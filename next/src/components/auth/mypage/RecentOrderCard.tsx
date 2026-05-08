/* ══════════════════════════════════════════
   RecentOrderCard — 정기배송 없을 때 최근 주문 sand 패널 (V2 §3.2 · S197 PR-2 §2.3 상태 C)
   가장 최근 주문 1건 status chip + 주문번호 + 대표 상품명 + 메타 + 정기배송 안내 link.
   sand 패널 layout 은 NextDeliveryCard.css 와 공유 (.mp-next-card).
   ══════════════════════════════════════════ */

'use client';

import Image from 'next/image';
import './NextDeliveryCard.css';
import './RecentOrderCard.css';
import { extractKrName } from '@/lib/utils';
import type { Order } from '@/types/order';

const STATUS_TONE: Record<Order['status'], string> = {
  배송준비: 'mp-recent-status--prep',
  배송중: 'mp-recent-status--shipping',
  배송완료: 'mp-recent-status--delivered',
  취소됨: 'mp-recent-status--cancelled',
  환불요청: 'mp-recent-status--refund-req',
  환불중: 'mp-recent-status--refund-proc',
  환불완료: 'mp-recent-status--refunded',
};

type Props = {
  /** 가장 최근 주문 1건 */
  order: Order;
  /** 사이드바 '주문내역' view 로 전환 (link CTA) */
  onViewOrders: () => void;
};

export default function RecentOrderCard({ order, onViewOrders }: Props) {
  const item = order.items[0];
  const itemCount = order.items.length;
  /* 정기배송(NextDeliveryCard) 동일 패턴 — h2 = "상품명 · 용량" */
  const nameLine = item
    ? item.volume
      ? `${extractKrName(item.name)} · ${item.volume}`
      : extractKrName(item.name)
    : extractKrName(order.name);
  /* 메타 = 날짜 (· 외 N건) + 칩 */
  const summaryParts: string[] = [order.date];
  if (itemCount > 1) summaryParts.push(`외 ${itemCount - 1}건`);
  const summaryLine = summaryParts.join(' · ');
  const imageSrc = item?.image.src ?? null;

  return (
    <section className="mp-next-card mp-next-card--recent" aria-label="최근 주문">
      <div className="mp-next-info">
        <h2 className="mp-next-name">{nameLine}</h2>
        <div className="mp-recent-meta">
          <span className="mp-recent-summary">{summaryLine}</span>
          <span className={`mp-recent-status ${STATUS_TONE[order.status]}`}>
            {order.status}
          </span>
        </div>
        <button
          type="button"
          className="mp-hero-cta"
          onClick={onViewOrders}
          data-gtr-tap
        >
          주문내역 보기 →
        </button>
      </div>
      <div className="mp-next-image" aria-hidden="true">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt=""
            fill
            sizes="(max-width: 767px) 100vw, 40vw"
            className="mp-next-image-img"
          />
        ) : (
          <div className="mp-next-image-placeholder" />
        )}
      </div>
    </section>
  );
}
