'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/useToast';
import { extractKrName } from '@/lib/utils';
import { useSiteSettings } from '@/components/providers/SiteSettingsProvider';
import { CopyIcon } from '@/components/ui/Icons';
import { useOrdersQuery } from '@/hooks/useOrders';
import { useMyPageOpenOrders, toggleOrder } from '@/lib/myPageUiStore';
import type { Order, OrderStatus } from '@/types/order';
import OrderItemCard from '@/components/order/OrderItemCard';
import ToggleIcon from './ToggleIcon';

type OrderHistoryProps = {
  /** S282-P1: SSR prefetch initialOrders → useOrdersQuery initialData.
     첫 진입 시 client fetch spinner 폐기 (orders mutation 0 — stale 위험 0). */
  initialOrders?: Order[];
};

/* status → 뱃지 클래스 매핑 (S172: paid·refund_* 노출 추가, S173: cancelled 추가) */
const STATUS_CLASS: Record<OrderStatus, string> = {
  '배송준비': 'mp-order-status--prep',
  '배송중':   'mp-order-status--shipping',
  '배송완료': 'mp-order-status--delivered',
  '취소됨':   'mp-order-status--cancelled',
  '환불요청': 'mp-order-status--refund-req',
  '환불중':   'mp-order-status--refund-proc',
  '환불완료': 'mp-order-status--refunded',
};

export default function OrderHistory({ initialOrders }: OrderHistoryProps = {}) {
  const router = useRouter();
  const { show: toast } = useToast();
  const { shipping: shippingPolicy } = useSiteSettings();
  const freeShippingThreshold = shippingPolicy.enabled
    ? shippingPolicy.free_threshold
    : Infinity;

  const { orders, isLoading } = useOrdersQuery(initialOrders);
  const openOrders = useMyPageOpenOrders();

  const copyText = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${label}가 복사되었습니다.`);
    } catch {
      toast('복사에 실패했습니다.');
    }
  }, [toast]);

  return (
    <>
      <div className="mp-section-body">
        <div className="mp-order-list">
          {isLoading ? (
            <div className="mp-empty-state">불러오는 중…</div>
          ) : orders.length === 0 ? (
            <div className="mp-empty-state">주문 내역이 아직 없습니다.</div>
          ) : (
            orders.map((order) => (
              <div
                key={order.number}
                className={`mp-order-card${openOrders.has(order.number) ? ' open' : ''}`}
                onClick={() => toggleOrder(order.number)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && toggleOrder(order.number)}
              >
                <div className="mp-order-meta">
                  <div className="mp-order-meta-left">
                    <span className="mp-order-date">{order.date}</span>
                    <div className="mp-order-number-row">
                      <span className="mp-order-number">{order.number}</span>
                      <button
                        className="mp-order-copy-btn"
                        type="button"
                        aria-label="주문번호 복사"
                        onClick={(e) => {
                          e.stopPropagation();
                          void copyText(order.number, '주문번호');
                        }}
                      >
                        <CopyIcon />
                      </button>
                    </div>
                  </div>
                  {/* S283: 공통 ToggleIcon (chevron ↔ X) — 마이페이지 아코디언 통일. */}
                  <span className="mp-order-toggle">
                    <ToggleIcon open={openOrders.has(order.number)} />
                  </span>
                </div>
                <div className="mp-order-content">
                  <div className="mp-order-content-left">
                    <div className="mp-order-summary">
                      {extractKrName(order.name)}
                      <span className="mp-order-detail"> · {order.detail}</span>
                    </div>
                    <div className="mp-order-price-row">
                      <span className="mp-order-price">{order.price}</span>
                      {order.priceNum < freeShippingThreshold && (
                        <span className="mp-order-shipping-note">배송비 포함</span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`mp-order-status ${STATUS_CLASS[order.status]}`}
                  >
                    {order.status}
                  </span>
                </div>
                <div className="mp-order-items">
                  <div className="mp-order-items-inner">
                    {order.items.map((item, idx) => (
                      <OrderItemCard
                        key={idx}
                        item={item}
                        variant="detailed"
                        onImageClick={(slug) => router.push(`/shop/${slug}`)}
                      />
                    ))}
                    {/* 배송정보 — 발송 처리된 주문(배송중/배송완료)에만 노출.
                        carrier/trackingNumber 는 orders_tracking_pair 제약상 항상 동시 존재. */}
                    {(order.status === '배송중' || order.status === '배송완료') &&
                      order.carrier &&
                      order.trackingNumber && (
                        <div className="mp-order-delivery">
                          <span className="mp-order-delivery-label">배송정보</span>
                          <div className="mp-order-delivery-row">
                            <span className="mp-order-delivery-carrier">
                              {order.carrier}
                            </span>
                            <span className="mp-order-delivery-sep">·</span>
                            <span className="mp-order-delivery-tracking">
                              {order.trackingNumber}
                            </span>
                            <button
                              className="mp-order-copy-btn"
                              type="button"
                              aria-label="송장번호 복사"
                              onClick={(e) => {
                                e.stopPropagation();
                                void copyText(order.trackingNumber!, '송장번호');
                              }}
                            >
                              <CopyIcon />
                            </button>
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
