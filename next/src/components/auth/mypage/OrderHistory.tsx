'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useToast } from '@/hooks/useToast';
import { extractKrName, formatPrice } from '@/lib/utils';
import { useSiteSettings } from '@/components/providers/SiteSettingsProvider';
import { CopyIcon } from '@/components/ui/Icons';
import { useOrdersQuery } from '@/hooks/useOrders';
import { useMyPageOpenOrders, toggleOrder } from '@/lib/myPageUiStore';

export default function OrderHistory() {
  const router = useRouter();
  const { show: toast } = useToast();
  const { shipping: shippingPolicy } = useSiteSettings();
  const freeShippingThreshold = shippingPolicy.enabled
    ? shippingPolicy.free_threshold
    : Infinity;

  const { orders, isLoading } = useOrdersQuery();
  const openOrders = useMyPageOpenOrders();

  const copyOrderNumber = useCallback(async (num: string) => {
    try {
      await navigator.clipboard.writeText(num);
      toast('주문번호가 복사되었습니다.');
    } catch {
      toast('복사에 실패했습니다.');
    }
  }, [toast]);

  return (
    <>
      <h2 className="mp-section-title">주문 내역</h2>
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
                          void copyOrderNumber(order.number);
                        }}
                      >
                        <CopyIcon />
                      </button>
                    </div>
                  </div>
                  <span className="mp-order-toggle">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9,6l6,6-6,6" />
                    </svg>
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
                    className={`mp-order-status${order.status === '배송중' ? ' mp-order-status--shipping' : ' mp-order-status--delivered'}`}
                  >
                    {order.status}
                  </span>
                </div>
                <div className="mp-order-items">
                  <div className="mp-order-items-inner">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="ocp-item">
                        <div
                          className="ocp-item-img"
                          style={{ background: item.image.bg, position: 'relative' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/shop/${item.slug}`);
                          }}
                        >
                          <Image
                            src={item.image.src}
                            alt={item.name}
                            fill
                            style={{ objectFit: 'cover' }}
                            sizes="80px"
                          />
                        </div>
                        <div className="ocp-item-info">
                          <div className="ocp-item-category">{item.category}</div>
                          <div className="ocp-item-name">
                            <span className="ocp-item-name-kr">
                              {extractKrName(item.name)}
                              <span className="ocp-item-meta-inline"> · {item.volume}</span>
                            </span>
                          </div>
                          <div className="ocp-item-badges">
                            <span className="ocp-item-qty">
                              {[
                                item.type === 'subscription' && item.period
                                  ? `정기배송 ${item.period}`
                                  : null,
                                `수량 ${item.qty}개`,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                            <span className="ocp-item-price">{formatPrice(item.priceNum)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
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
