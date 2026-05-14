'use client';

/* ══════════════════════════════════════════════════════════════════════════
   OrderDetailClient — /admin/orders/[orderNumber] 본체 (S128 B-2/3/4)

   책임:
   - S224: inline style → Tailwind className 토큰화 (ADR-008)
   - 2-col grid (1fr 340px), 좌(상품·결제·배송) · 우(고객·환불·메모·타임라인)
   - Topbar [환불 안내] [발송 처리] (paid 만 활성)
   - "발송 처리" 클릭 → ShippingDialog open
   - 어드민 메모는 읽기 전용 표시 (편집 액션은 carry-over · Group H 와 함께 진행 예정)
   ══════════════════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import { AdminBackLink } from '@/components/admin/AdminBackLink';
import { Button } from '@/components/admin/ui/button';
import { Badge as ShadcnBadge } from '@/components/admin/ui/badge';
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
  neutral: { bg: 'var(--neutral-soft)', fg: 'var(--neutral-soft-fg)', dot: 'var(--foreground-muted)' },
  success: { bg: 'var(--success-soft)', fg: 'var(--success)', dot: 'var(--success)' },
  warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)', dot: 'var(--warning)' },
  info:    { bg: 'var(--info-soft)',    fg: 'var(--info)',    dot: 'var(--info)' },
  primary: { bg: 'var(--primary-soft)', fg: 'var(--primary-soft-fg)', dot: 'var(--primary)' },
};

/* TODO: URL 확인 필요 — Toss 콘솔 결제 내역 경로 미검증 */
const TOSS_CONSOLE_URL = 'https://my.tosspayments.com/sales-history';
/* TODO: URL 확인 필요 — docs.tosspayments.com 경로 변경됨 */
const TOSS_REFUND_GUIDE_URL =
  'https://docs.tosspayments.com/guides/v2/payment-widget/refund';

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
        <Button
          type="button"
          size="sm"
          className="!h-7"
          onClick={() => isPaid && setShipOpen(true)}
          disabled={!isPaid}
          title={isPaid ? '발송 처리' : '결제 완료(신규) 상태에서만 출고 가능합니다'}
        >
          <TruckIcon />
          발송 처리
        </Button>
      </AdminTopbarActions>

      {/* page header */}
      <div className="mb-6">
        <AdminBackLink href="/admin/orders" label="주문 목록으로" />

        <div className="flex items-baseline gap-3.5 flex-wrap">
          <h2 className="m-0 text-2xl font-semibold tracking-tight">
            주문 상세
          </h2>
          <span className="gtr-mono text-sm text-primary font-medium">
            {detail.orderNumber}
          </span>
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
        </div>
        <div className="mt-1.5 text-xs text-muted-foreground flex gap-2.5 items-center flex-wrap">
          <span className="tabular-nums">
            주문일시 · {formatKstFullDate(detail.createdAtIso)}
          </span>
          <span className="text-[var(--foreground-subtle)]">·</span>
          <Badge tone={detail.customer.isMember ? 'info' : 'neutral'}>
            {detail.customer.isMember ? '회원' : '비회원'}
          </Badge>
        </div>
      </div>

      {/* 2-col grid */}
      <div className="grid gap-5 items-start" style={{ gridTemplateColumns: '1fr 340px' }}>
        {/* ── LEFT MAIN ── */}
        <div className="flex flex-col gap-3.5">
          {/* A — 주문 상품 */}
          <Card>
            <SectionHeader title="주문 상품" meta={`${detail.items.length}개`} />
            <div>
              {detail.items.map((it, i) => (
                <div
                  key={`${it.productSlug}-${i}`}
                  className="grid gap-3.5 items-center px-5 py-3.5 border-t border-border"
                  style={{ gridTemplateColumns: '52px 1fr 80px 80px 100px' }}
                >
                  <div
                    className="size-10 rounded-md border border-border"
                    style={{ background: 'repeating-linear-gradient(135deg, var(--placeholder-pattern-1) 0 5px, var(--placeholder-pattern-2) 5px 10px)' }}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium flex items-center gap-1.5 flex-wrap">
                      {it.productName}
                      {it.itemType === 'subscription' && it.subscriptionPeriod && (
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-[var(--primary-soft)] text-[var(--primary-soft-fg)]">
                          정기 · {it.subscriptionPeriod}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--foreground-subtle)] flex gap-2 flex-wrap">
                      {it.productVolume && <span>{it.productVolume}</span>}
                      {it.productVolume && <span>·</span>}
                      <span className="gtr-mono">{it.productSlug}</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground text-right tabular-nums">
                    × {it.quantity}
                  </div>
                  <div className="text-xs text-muted-foreground text-right tabular-nums">
                    {it.unitPrice.toLocaleString()}원
                  </div>
                  <div className="text-sm font-medium text-right tabular-nums">
                    {it.lineTotal.toLocaleString()}원
                  </div>
                </div>
              ))}
            </div>

            {/* totals */}
            <div className="border-t border-border px-5 py-3.5 bg-[#FAFAF9] flex flex-col gap-1.5 tabular-nums text-sm">
              <Row label="소계">{detail.summary.subtotal.toLocaleString()}원</Row>
              <Row label="배송비">
                {detail.summary.shippingFee === 0
                  ? '무료'
                  : `${detail.summary.shippingFee.toLocaleString()}원`}
              </Row>
              {detail.summary.discountAmount > 0 && (
                <Row label="할인" valueClassName="text-primary">
                  −{detail.summary.discountAmount.toLocaleString()}원
                </Row>
              )}
              <div className="h-px bg-border my-1" />
              <Row
                label="총 결제금액"
                labelClassName="font-medium text-foreground"
                valueClassName="text-base font-semibold"
              >
                {detail.summary.totalAmount.toLocaleString()}원
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
                  className="text-xs text-primary inline-flex items-center no-underline cursor-pointer"
                >
                  Toss 콘솔에서 보기 <ExtIcon />
                </a>
              }
            />
            <div className="px-5 py-4 grid grid-cols-2 gap-y-3 gap-x-6">
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
            <div className="px-5 py-4 grid grid-cols-2 gap-y-3 gap-x-6">
              <KV k="받는 이" v={detail.shipping.name} />
              <KV k="연락처" v={detail.shipping.phone} mono />
              <KV
                k="주소"
                full
                v={
                  <span>
                    <span className="gtr-mono text-muted-foreground">
                      ({detail.shipping.zipcode})
                    </span>{' '}
                    {detail.shipping.addr1}
                    {detail.shipping.addr2 && (
                      <>
                        <br />
                        <span className="text-muted-foreground">
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
                        <span className="ml-1.5 text-xs px-1.5 py-px rounded bg-[var(--surface-muted)] text-[var(--foreground-subtle)]">
                          {shippingMsg.presetCode}
                        </span>
                      )}
                    </span>
                  }
                />
              )}
            </div>

            {/* 출고 영역 */}
            <div className="border-t border-border mx-5" />
            <div className="px-5 py-5 flex items-center justify-between gap-3.5">
              {isShippedOrLater ? (
                <>
                  <div className="flex gap-3 items-start">
                    <div className="size-9 rounded-lg bg-[var(--success-soft)] text-[var(--success)] flex items-center justify-center shrink-0">
                      <TruckIcon />
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        {detail.dispatch.carrier} · {' '}
                        <span className="gtr-mono text-primary">
                          {detail.dispatch.trackingNumber}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">
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
                  <div className="flex gap-3 items-center">
                    <div className="size-9 rounded-lg bg-[var(--primary-soft)] text-primary flex items-center justify-center shrink-0">
                      <TruckIcon />
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        아직 발송되지 않았습니다
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        송장번호 입력 후 발송 처리를 진행해주세요
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="!h-7"
                    onClick={() => setShipOpen(true)}
                  >
                    <TruckIcon />
                    발송 처리
                  </Button>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">
                  {isCancelled
                    ? '취소·환불된 주문입니다.'
                    : '결제가 완료되면 발송 처리할 수 있습니다.'}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ── RIGHT SIDE ── */}
        <div className="flex flex-col gap-3.5">
          {/* D — 고객 정보 */}
          <Card>
            <SectionHeader title="고객 정보" />
            <div className="px-[18px] py-3.5">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="size-9 rounded-full bg-[var(--neutral-soft)] flex items-center justify-center text-sm font-semibold">
                  {customerInitial}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {detail.customer.name}
                  </div>
                  <div className="text-xs text-[var(--foreground-subtle)]">
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
              <div className="flex flex-col gap-2 text-xs">
                <KVMini k="이메일" v={detail.customer.email} />
                <KVMini k="전화" v={detail.customer.phone} mono />
                {detail.customer.isMember && (
                  <KVMini k="누적 주문" v={`${detail.customer.totalOrders}건`} />
                )}
              </div>
              {detail.customer.isMember && (
                <span
                  title="고객 페이지 — Group C 추후 구현"
                  className="mt-3 inline-flex items-center text-xs text-[var(--foreground-subtle)] no-underline cursor-not-allowed"
                >
                  고객 페이지 열기 <ExtIcon />
                </span>
              )}
            </div>
          </Card>

          {/* E — 환불·취소 */}
          <Card>
            <SectionHeader title="환불·취소" />
            <div className="px-[18px] py-3.5 text-xs text-muted-foreground leading-relaxed">
              환불은 <strong className="text-foreground">Toss 콘솔</strong>에서
              직접 처리합니다.
              <ol className="mt-2.5 mb-0 pl-[18px] flex flex-col gap-1">
                <li>Toss 콘솔에서 결제 ID 검색</li>
                <li>전체/부분 환불 선택 후 사유 입력</li>
                <li>주문 상태 자동 동기화 (최대 5분)</li>
              </ol>
              <a
                href={TOSS_REFUND_GUIDE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary inline-flex items-center no-underline mt-3 cursor-pointer"
              >
                Toss 환불 가이드 <ExtIcon />
              </a>
            </div>
          </Card>

          {/* F — 어드민 메모 (편집 carry-over) */}
          <Card>
            <SectionHeader title="어드민 메모" meta="편집 구현 예정 (출시 후)" />
            <div className="px-[18px] pt-3 pb-4">
              <textarea
                value={detail.adminNotes ?? ''}
                readOnly
                placeholder="작성된 메모가 없습니다"
                title="편집 구현 예정 (출시 후)"
                className="w-full min-h-[76px] resize-y px-2.5 py-2 border border-input rounded-md text-xs leading-relaxed text-foreground outline-none bg-[var(--surface-muted)] cursor-not-allowed"
                style={{ fontFamily: 'inherit' }}
              />
              <div className="mt-1.5 text-xs text-[var(--foreground-subtle)]">
                메모 편집 기능은 출시 후 추가됩니다
              </div>
            </div>
          </Card>

          {/* G — 타임라인 */}
          <Card>
            <SectionHeader title="타임라인" />
            <div className="px-[18px] pt-3.5 pb-4">
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
    <div className="bg-[var(--surface)] border border-border rounded-[var(--radius)] overflow-hidden">
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
    <div className="px-5 py-3.5 flex items-center justify-between gap-3">
      <div className="flex items-baseline gap-2">
        <h3 className="m-0 text-xs font-semibold tracking-[0.06em] uppercase text-muted-foreground">
          {title}
        </h3>
        {meta && <span className="text-xs text-[var(--foreground-subtle)]">{meta}</span>}
      </div>
      {right}
    </div>
  );
}

function Row({
  label,
  labelClassName = '',
  valueClassName = '',
  children,
}: {
  label: string;
  labelClassName?: string;
  valueClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between">
      <span className={`text-muted-foreground ${labelClassName}`.trim()}>{label}</span>
      <span className={valueClassName}>{children}</span>
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
    <div className={full ? 'col-span-full' : ''}>
      <div className="text-xs text-[var(--foreground-subtle)] uppercase tracking-[0.04em] mb-1">
        {k}
      </div>
      <div className={`${mono ? 'gtr-mono text-xs' : 'text-sm'} text-foreground leading-snug break-all`}>
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
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className={`${mono ? 'gtr-mono ' : ''}text-foreground text-right min-w-0 overflow-hidden text-ellipsis`}>
        {v}
      </span>
    </div>
  );
}

function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="flex flex-col">
      {events.map((e, i) => (
        <div key={e.label} className="flex gap-3 relative min-h-8">
          {i < events.length - 1 && (
            <div
              className={`absolute left-[5px] top-[14px] -bottom-2 w-[1.5px] ${events[i + 1].done ? 'bg-[var(--primary)]' : 'bg-border'}`}
            />
          )}
          <div
            className="size-3 rounded-full mt-1 shrink-0"
            style={{
              border: '2px solid ' + (e.done ? 'var(--primary)' : 'var(--border-strong)'),
              background: e.current
                ? 'var(--primary)'
                : e.done
                  ? 'var(--primary-soft)'
                  : 'var(--surface)',
            }}
          />
          <div className="flex-1 pb-3">
            <div className={`text-xs ${e.current ? 'font-semibold' : 'font-medium'} ${e.done ? 'text-foreground' : 'text-muted-foreground'}`}>
              {e.label}
            </div>
            <div className="text-xs text-[var(--foreground-subtle)] tabular-nums mt-px">
              {e.time}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* S222 PR-3: shadcn Badge variant=outline + tone soft 매트릭스 style override (DEC-2). */
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
    <ShadcnBadge
      variant="outline"
      className="border-transparent gap-1.5"
      style={{ background: t.bg, color: t.fg }}
    >
      {dot && (
        <span
          aria-hidden
          style={{ width: 5, height: 5, borderRadius: 999, background: t.dot }}
        />
      )}
      {children}
    </ShadcnBadge>
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
    >
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  );
}

/* S222 PR-3: SM_BASE / SM_SECONDARY_LINK / SM_PRIMARY 폐기 (shadcn Button 으로 대체). */
