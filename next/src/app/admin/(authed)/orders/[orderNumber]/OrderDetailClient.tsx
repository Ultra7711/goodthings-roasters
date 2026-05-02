'use client';

/* ══════════════════════════════════════════════════════════════════════════
   OrderDetailClient — /admin/orders/[orderNumber] 본체 (S128 B-2/3/4)

   책임:
   - 시안 inline style 100% 이식 (S125 결정 — 시안 = ground truth)
   - 2-col grid (1fr 340px), 좌(상품·결제·배송) · 우(고객·환불·메모·타임라인)
   - Topbar [환불 안내] [발송 처리] (paid 만 활성)
   - "발송 처리" 클릭 → ShippingDialog open
   - 어드민 메모는 읽기 전용 표시 (편집 액션은 carry-over · Group H 와 함께 진행 예정)
   ══════════════════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import Link from 'next/link';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import {
  describePayment,
  describeShippingMessage,
  describeStatus,
  formatJoinedAt,
  formatKstDateTime,
  formatKstDateTimeWithSeconds,
  formatKstFullDate,
  type DbOrderStatus,
  type StatusTone,
} from '@/lib/admin/orders';
import type { OrderDetail } from '@/lib/admin/ordersServer';
import ShippingDialog from './ShippingDialog';

const TONES: Record<StatusTone, { bg: string; fg: string; dot: string }> = {
  neutral: { bg: 'var(--neutral-soft)', fg: 'var(--neutral-soft-fg)', dot: '#888' },
  success: { bg: 'var(--success-soft)', fg: 'var(--success)', dot: 'var(--success)' },
  warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)', dot: 'var(--warning)' },
  info:    { bg: 'var(--info-soft)',    fg: 'var(--info)',    dot: 'var(--info)' },
  primary: { bg: 'var(--primary-soft)', fg: 'var(--primary-soft-fg)', dot: 'var(--primary)' },
};

/* Toss 결제 내역 콘솔 (운영자 로그인 필요) — 결제 ID 검색 */
const TOSS_CONSOLE_URL = 'https://my.tosspayments.com/sales-history';
const TOSS_REFUND_GUIDE_URL =
  'https://docs.tosspayments.com/guides/v2/payment-widget/refund';

const extLink: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--primary)',
  display: 'inline-flex',
  alignItems: 'center',
  cursor: 'pointer',
  textDecoration: 'none',
};

export default function OrderDetailClient({ detail }: { detail: OrderDetail }) {
  const [shipOpen, setShipOpen] = useState(false);
  const status = describeStatus(detail.status);
  const isPaid = detail.status === 'paid';
  const isShippedOrLater =
    detail.status === 'shipping' || detail.status === 'delivered';
  const isCancelled =
    detail.status === 'cancelled' ||
    detail.status === 'refund_requested' ||
    detail.status === 'refund_processing' ||
    detail.status === 'refunded';
  const shippingMsg = describeShippingMessage(
    detail.shipping.messageCode,
    detail.shipping.messageCustom,
  );
  const customerInitial = detail.customer.name?.charAt(0) ?? '·';

  return (
    <>
      <AdminTopbarActions>
        <a
          href={TOSS_REFUND_GUIDE_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={SM_SECONDARY_LINK}
        >
          환불 안내
        </a>
        <button
          type="button"
          onClick={() => isPaid && setShipOpen(true)}
          disabled={!isPaid}
          title={isPaid ? '발송 처리' : '결제 완료(신규) 상태에서만 출고 가능합니다'}
          style={{
            ...SM_PRIMARY,
            opacity: isPaid ? 1 : 0.5,
            cursor: isPaid ? 'pointer' : 'not-allowed',
          }}
        >
          <TruckIcon />
          발송 처리
        </button>
      </AdminTopbarActions>

      {/* page header */}
      <div style={{ marginBottom: 22 }}>
        <Link
          href="/admin/orders"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px 4px 4px',
            marginLeft: -4,
            marginBottom: 8,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--foreground-muted)',
            fontSize: 12.5,
            borderRadius: 4,
            textDecoration: 'none',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          주문 목록으로
        </Link>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>
            주문 상세
          </h2>
          <span className="gtr-mono" style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 500 }}>
            {detail.orderNumber}
          </span>
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 12.5,
            color: 'var(--foreground-muted)',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            주문일시 · {formatKstFullDate(detail.createdAtIso)}
          </span>
          <span style={{ color: 'var(--foreground-subtle)' }}>·</span>
          <Badge tone={detail.customer.isMember ? 'info' : 'neutral'}>
            {detail.customer.isMember ? '회원' : '비회원'}
          </Badge>
        </div>
      </div>

      {/* 2-col grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        {/* ── LEFT MAIN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* A — 주문 상품 */}
          <Card>
            <SectionHeader title="주문 상품" meta={`${detail.items.length}개`} />
            <div>
              {detail.items.map((it, i) => (
                <div
                  key={`${it.productSlug}-${i}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '52px 1fr 80px 80px 100px',
                    gap: 14,
                    alignItems: 'center',
                    padding: '14px 22px',
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 6,
                      background:
                        'repeating-linear-gradient(135deg, #EEEDEB 0 5px, #F5F4F2 5px 10px)',
                      border: '1px solid var(--border)',
                    }}
                    aria-hidden
                  />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        flexWrap: 'wrap',
                      }}
                    >
                      {it.productName}
                      {it.itemType === 'subscription' && it.subscriptionPeriod && (
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 500,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: 'var(--primary-soft)',
                            color: 'var(--primary-soft-fg)',
                          }}
                        >
                          정기 · {it.subscriptionPeriod}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 11.5,
                        color: 'var(--foreground-subtle)',
                        display: 'flex',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      {it.productVolume && <span>{it.productVolume}</span>}
                      {it.productVolume && <span>·</span>}
                      <span className="gtr-mono">{it.productSlug}</span>
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: 'var(--foreground-muted)',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    × {it.quantity}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: 'var(--foreground-muted)',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    ₩{it.unitPrice.toLocaleString()}
                  </div>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 500,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    ₩{it.lineTotal.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            {/* totals */}
            <div
              style={{
                borderTop: '1px solid var(--border)',
                padding: '14px 22px',
                background: '#FAFAF9',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                fontVariantNumeric: 'tabular-nums',
                fontSize: 13,
              }}
            >
              <Row label="소계">₩{detail.summary.subtotal.toLocaleString()}</Row>
              <Row label="배송비">
                {detail.summary.shippingFee === 0
                  ? '무료'
                  : `₩${detail.summary.shippingFee.toLocaleString()}`}
              </Row>
              {detail.summary.discountAmount > 0 && (
                <Row label="할인" valueStyle={{ color: 'var(--primary)' }}>
                  −₩{detail.summary.discountAmount.toLocaleString()}
                </Row>
              )}
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              <Row
                label="총 결제금액"
                labelStyle={{ fontWeight: 500, color: 'var(--foreground)' }}
                valueStyle={{ fontSize: 15, fontWeight: 600 }}
              >
                ₩{detail.summary.totalAmount.toLocaleString()}
              </Row>
            </div>
          </Card>

          {/* B — 결제 정보 */}
          <Card>
            <SectionHeader
              title="결제 정보"
              right={
                <a
                  href={TOSS_CONSOLE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={extLink}
                >
                  Toss 콘솔에서 보기 <ExtIcon />
                </a>
              }
            />
            <div
              style={{
                padding: '16px 22px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                rowGap: 12,
                columnGap: 24,
              }}
            >
              <KV k="결제수단" v={detail.payment.methodLabel} />
              <KV
                k="결제 시각"
                v={
                  detail.payment.paidAtIso
                    ? formatKstDateTimeWithSeconds(detail.payment.paidAtIso)
                    : '—'
                }
                mono
              />
              <KV
                k="결제 ID"
                v={detail.payment.providerPaymentKey ?? '—'}
                mono
                full
              />
            </div>
          </Card>

          {/* C — 배송 정보 */}
          <Card>
            <SectionHeader title="배송 정보" />
            <div
              style={{
                padding: '16px 22px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                rowGap: 12,
                columnGap: 24,
              }}
            >
              <KV k="받는 이" v={detail.shipping.name} />
              <KV k="연락처" v={detail.shipping.phone} mono />
              <KV
                k="주소"
                full
                v={
                  <span>
                    <span className="gtr-mono" style={{ color: 'var(--foreground-muted)' }}>
                      ({detail.shipping.zipcode})
                    </span>{' '}
                    {detail.shipping.addr1}
                    {detail.shipping.addr2 && (
                      <>
                        <br />
                        <span style={{ color: 'var(--foreground-muted)' }}>
                          {detail.shipping.addr2}
                        </span>
                      </>
                    )}
                  </span>
                }
              />
              {shippingMsg && (
                <KV
                  k="배송 메시지"
                  full
                  v={
                    <span>
                      {shippingMsg.text}
                      {shippingMsg.presetCode && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 10.5,
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: 'var(--surface-muted)',
                            color: 'var(--foreground-subtle)',
                          }}
                        >
                          {shippingMsg.presetCode}
                        </span>
                      )}
                    </span>
                  }
                />
              )}
            </div>

            {/* 출고 영역 */}
            <div style={{ borderTop: '1px solid var(--border)', margin: '0 22px' }} />
            <div
              style={{
                padding: '20px 22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 14,
              }}
            >
              {isShippedOrLater ? (
                <>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: 'var(--success-soft)',
                        color: 'var(--success)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <TruckIcon />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {detail.dispatch.carrier} · {' '}
                        <span className="gtr-mono" style={{ color: 'var(--primary)' }}>
                          {detail.dispatch.trackingNumber}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--foreground-muted)',
                          marginTop: 2,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        출고 ·{' '}
                        {detail.dispatch.shippedAtIso
                          ? formatKstDateTime(detail.dispatch.shippedAtIso)
                          : '—'}
                      </div>
                    </div>
                  </div>
                </>
              ) : isPaid ? (
                <>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: 'var(--primary-soft)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <TruckIcon />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        아직 발송되지 않았습니다
                      </div>
                      <div
                        style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 2 }}
                      >
                        송장번호 입력 후 발송 처리를 진행해주세요
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShipOpen(true)}
                    style={SM_PRIMARY}
                  >
                    <TruckIcon />
                    발송 처리
                  </button>
                </>
              ) : (
                <div style={{ fontSize: 12.5, color: 'var(--foreground-muted)' }}>
                  {isCancelled
                    ? '취소·환불된 주문입니다.'
                    : '결제가 완료되면 발송 처리할 수 있습니다.'}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ── RIGHT SIDE ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* D — 고객 정보 */}
          <Card>
            <SectionHeader title="고객 정보" />
            <div style={{ padding: '14px 18px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    background: 'var(--neutral-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {customerInitial}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                    {detail.customer.name}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--foreground-subtle)' }}>
                    {detail.customer.isMember
                      ? `회원 · 가입 ${
                          detail.customer.joinedAtIso
                            ? formatJoinedAt(detail.customer.joinedAtIso)
                            : '—'
                        }`
                      : '비회원 주문'}
                  </div>
                </div>
              </div>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}
              >
                <KVMini k="이메일" v={detail.customer.email} />
                <KVMini k="전화" v={detail.customer.phone} mono />
                {detail.customer.isMember && (
                  <KVMini k="누적 주문" v={`${detail.customer.totalOrders}건`} />
                )}
              </div>
              {detail.customer.isMember && (
                <span
                  title="고객 페이지 — Group C 추후 구현"
                  style={{
                    ...extLink,
                    marginTop: 12,
                    display: 'inline-flex',
                    color: 'var(--foreground-subtle)',
                    cursor: 'not-allowed',
                  }}
                >
                  고객 페이지 열기 <ExtIcon />
                </span>
              )}
            </div>
          </Card>

          {/* E — 환불·취소 */}
          <Card>
            <SectionHeader title="환불·취소" />
            <div
              style={{
                padding: '14px 18px',
                fontSize: 12.5,
                color: 'var(--foreground-muted)',
                lineHeight: 1.6,
              }}
            >
              환불은 <strong style={{ color: 'var(--foreground)' }}>Toss 콘솔</strong>에서
              직접 처리합니다.
              <ol
                style={{
                  margin: '10px 0 0',
                  padding: '0 0 0 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <li>Toss 콘솔에서 결제 ID 검색</li>
                <li>전체/부분 환불 선택 후 사유 입력</li>
                <li>주문 상태 자동 동기화 (최대 5분)</li>
              </ol>
              <a
                href={TOSS_REFUND_GUIDE_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...extLink, marginTop: 12, display: 'inline-flex' }}
              >
                Toss 환불 가이드 <ExtIcon />
              </a>
            </div>
          </Card>

          {/* F — 어드민 메모 (편집 carry-over) */}
          <Card>
            <SectionHeader title="어드민 메모" meta="편집 준비 중" />
            <div style={{ padding: '12px 18px 16px' }}>
              <textarea
                value={detail.adminNotes ?? ''}
                readOnly
                placeholder="작성된 메모가 없습니다"
                style={{
                  width: '100%',
                  minHeight: 76,
                  resize: 'vertical',
                  padding: '8px 10px',
                  border: '1px solid var(--input)',
                  borderRadius: 6,
                  fontSize: 12.5,
                  lineHeight: 1.6,
                  fontFamily: 'inherit',
                  color: 'var(--foreground)',
                  outline: 'none',
                  background: 'var(--surface-muted)',
                  cursor: 'not-allowed',
                }}
              />
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--foreground-subtle)' }}>
                메모 편집 기능은 다음 단계에서 추가됩니다
              </div>
            </div>
          </Card>

          {/* G — 타임라인 */}
          <Card>
            <SectionHeader title="타임라인" />
            <div style={{ padding: '14px 18px 18px' }}>
              <Timeline events={buildTimeline(detail)} />
            </div>
          </Card>
        </div>
      </div>

      {/* 다이얼로그 */}
      <ShippingDialog
        open={shipOpen}
        onClose={() => setShipOpen(false)}
        orderNumber={detail.orderNumber}
        customerName={detail.customer.name}
      />
    </>
  );
}

/* ── 타임라인 빌더 ──────────────────────────────────────────────────── */

type TimelineEvent = { label: string; time: string; done: boolean; current?: boolean };

function buildTimeline(detail: OrderDetail): TimelineEvent[] {
  const status = detail.status;
  const created = formatKstDateTime(detail.createdAtIso);
  const paid = detail.payment.paidAtIso
    ? formatKstDateTime(detail.payment.paidAtIso)
    : '대기 중';
  const shipped = detail.dispatch.shippedAtIso
    ? formatKstDateTime(detail.dispatch.shippedAtIso)
    : '대기 중';

  const orderDone = true;
  const paidDone =
    status === 'paid' ||
    status === 'shipping' ||
    status === 'delivered' ||
    status === 'refund_requested' ||
    status === 'refund_processing' ||
    status === 'refunded';
  const shippedDone = status === 'shipping' || status === 'delivered';
  const deliveredDone = status === 'delivered';

  return [
    {
      label: '주문 생성',
      time: created,
      done: orderDone,
      current: status === 'pending',
    },
    {
      label: '결제 완료',
      time: paid,
      done: paidDone,
      current: status === 'paid',
    },
    {
      label: '출고 처리',
      time: shipped,
      done: shippedDone,
      current: status === 'shipping',
    },
    {
      label: '배송 완료',
      time: deliveredDone ? '완료' : '대기 중',
      done: deliveredDone,
      current: status === 'delivered',
    },
  ];
}

/* ── 로컬 컴포넌트 ─────────────────────────────────────────────────── */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  title,
  meta,
  right,
}: {
  title: string;
  meta?: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: '13px 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--foreground-muted)',
          }}
        >
          {title}
        </h3>
        {meta && <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>{meta}</span>}
      </div>
      {right}
    </div>
  );
}

function Row({
  label,
  labelStyle,
  valueStyle,
  children,
}: {
  label: string;
  labelStyle?: React.CSSProperties;
  valueStyle?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--foreground-muted)', ...labelStyle }}>{label}</span>
      <span style={valueStyle}>{children}</span>
    </div>
  );
}

function KV({
  k,
  v,
  mono,
  full,
}: {
  k: string;
  v: React.ReactNode;
  mono?: boolean;
  full?: boolean;
}) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
      <div
        style={{
          fontSize: 11,
          color: 'var(--foreground-subtle)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: 4,
        }}
      >
        {k}
      </div>
      <div
        className={mono ? 'gtr-mono' : ''}
        style={{
          fontSize: mono ? 12.5 : 13,
          color: 'var(--foreground)',
          lineHeight: 1.55,
          wordBreak: 'break-all',
        }}
      >
        {v}
      </div>
    </div>
  );
}

function KVMini({
  k,
  v,
  mono,
}: {
  k: string;
  v: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ color: 'var(--foreground-muted)' }}>{k}</span>
      <span
        className={mono ? 'gtr-mono' : ''}
        style={{
          color: 'var(--foreground)',
          textAlign: 'right',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {v}
      </span>
    </div>
  );
}

function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {events.map((e, i) => (
        <div
          key={e.label}
          style={{ display: 'flex', gap: 12, position: 'relative', minHeight: 32 }}
        >
          {i < events.length - 1 && (
            <div
              style={{
                position: 'absolute',
                left: 5,
                top: 14,
                bottom: -8,
                width: 1.5,
                background: events[i + 1].done ? 'var(--primary)' : 'var(--border)',
              }}
            />
          )}
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              marginTop: 4,
              flexShrink: 0,
              border: '2px solid ' + (e.done ? 'var(--primary)' : 'var(--border-strong)'),
              background: e.current
                ? 'var(--primary)'
                : e.done
                  ? 'var(--primary-soft)'
                  : 'var(--surface)',
            }}
          />
          <div style={{ flex: 1, paddingBottom: 12 }}>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: e.current ? 600 : 500,
                color: e.done ? 'var(--foreground)' : 'var(--foreground-muted)',
              }}
            >
              {e.label}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--foreground-subtle)',
                fontVariantNumeric: 'tabular-nums',
                marginTop: 1,
              }}
            >
              {e.time}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Badge({
  tone,
  children,
  dot,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  dot?: boolean;
}) {
  const t = TONES[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        fontSize: 11.5,
        fontWeight: 500,
        letterSpacing: '-0.005em',
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
      }}
    >
      {dot && (
        <span
          aria-hidden
          style={{ width: 5, height: 5, borderRadius: 999, background: t.dot }}
        />
      )}
      {children}
    </span>
  );
}

function ExtIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ marginLeft: 3 }}
    >
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ marginRight: 4 }}
    >
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  );
}

/* ── Topbar 버튼 inline style (size=sm, OrdersTableClient 와 정합) ── */

const SM_BASE: React.CSSProperties = {
  padding: '5px 10px',
  fontSize: 12,
  height: 28,
  gap: 5,
  borderRadius: 6,
  fontWeight: 500,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  letterSpacing: '-0.005em',
};

const SM_SECONDARY_LINK: React.CSSProperties = {
  ...SM_BASE,
  background: 'var(--surface)',
  color: 'var(--foreground)',
  border: '1px solid var(--border)',
  textDecoration: 'none',
};

const SM_PRIMARY: React.CSSProperties = {
  ...SM_BASE,
  background: 'var(--primary)',
  color: '#fff',
  border: '1px solid var(--primary)',
};
