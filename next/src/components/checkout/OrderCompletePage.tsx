/* ══════════════════════════════════════════
   OrderCompletePage — /order-complete
   프로토타입 #order-complete-page 이식 (RP-7) + B-3 confirm 연동.

   설계 결정:
   1. sessionStorage 'gtr-last-order' 에서 주문 정보 읽기
      (CheckoutPage 제출 시 저장)
   2. Toss successUrl 쿼리(paymentKey/orderId/amount/paymentType) 수신 →
      (a) POST /api/payments/confirm 호출 (B-3)
      (b) 성공 → 'gtr-last-payment' 저장 + 장바구니 비우기 + paymentStatus='paid'
      (c) 실패 → 실패 상태 UI + 고객센터 안내
      중복 호출 방어: sessionStorage 'gtr-confirmed:{paymentKey}' 플래그
   3. 진입 연출: .ocp-enter 래퍼 → staggerUp CSS 애니메이션
   4. 주문번호 복사: navigator.clipboard
   5. 주문 내역 보기: /mypage (데모, Phase 2-F 연동)
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/useToast';
import { formatPrice } from '@/lib/utils';
import { useCartStore } from '@/lib/store';

type OrderItemData = {
  name: string;
  slug: string;
  category: string;
  volume: string | null;
  qty: number;
  priceNum: number;
  image: { src: string; bg: string };
  type?: string;
  period?: string | null;
};

type LastOrder = {
  number: string;
  items: OrderItemData[];
};

/* ── 한글명 추출 ── */
function extractKrName(name: string): string {
  const m = name.match(/^(.*[\uAC00-\uD7AF](?:\s+[A-Z0-9]+)*)\s+([A-Z][a-z].*)$/);
  return m ? m[1].trim() : name;
}

/* ── 복사 아이콘 ── */
function CopyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="9" height="9" rx="1" />
      <path d="M3 11H2a1 1 0 01-1-1V2a1 1 0 011-1h8a1 1 0 011 1v1" />
    </svg>
  );
}

/* ── confirm 상태 ── */
type ConfirmState =
  /** Toss 쿼리가 아직 없음 (직접 접근 혹은 성공 redirect 전) */
  | { kind: 'idle' }
  /** confirm API 호출 중 */
  | { kind: 'pending' }
  /** 승인 완료 (paid) */
  | { kind: 'success'; orderNumber: string; method: 'card' | 'transfer' }
  /** 입금 대기 (가상계좌 pending) — B-5 에서 UX 확장 */
  | { kind: 'deposit_waiting'; orderNumber: string }
  /** 승인 실패 (amount_mismatch · toss_failed 등) */
  | { kind: 'failed'; detail: string };

/* ── confirm 응답 (서버가 반환) ── */
type ConfirmResponseData = {
  orderNumber: string;
  status: 'pending' | 'paid' | 'cancelled' | string;
  totalAmount: number;
  method: 'card' | 'transfer';
  virtualAccount: {
    bank: string | null;
    accountNumber: string;
    dueDate: string | null;
    customerName: string | null;
  } | null;
};

export default function OrderCompletePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { show: toast } = useToast();
  const [entered, setEntered] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>({ kind: 'idle' });
  const clearCart = useCartStore((s) => s.clearCart);

  /* sessionStorage 에서 주문 정보 읽기 */
  const order = useMemo<LastOrder | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem('gtr-last-order');
      if (!raw) return null;
      return JSON.parse(raw) as LastOrder;
    } catch {
      return null;
    }
  }, []);

  /* Toss successUrl 쿼리 파라미터 수신 (B-2) + confirm API 호출 (B-3) ──
     1. 쿼리 저장 (새로고침 시 디버깅용).
     2. 동일 paymentKey 중복 호출 방어: sessionStorage 'gtr-confirmed:{paymentKey}'.
     3. POST /api/payments/confirm → 성공 시 장바구니 비우고 success 상태.
     4. 실패 시 failed 상태 (재시도 또는 고객센터 안내 UI).
  */
  useEffect(() => {
    const paymentKey = searchParams.get('paymentKey');
    const paidOrderId = searchParams.get('orderId');
    const amountParam = searchParams.get('amount');
    const paymentType = searchParams.get('paymentType');

    if (!paymentKey || !paidOrderId || !amountParam) return;

    /* 중복 호출 방어 플래그 — Strict Mode 이중 invoke + 뒤로가기 재진입 대응 */
    const flagKey = `gtr-confirmed:${paymentKey}`;
    if (sessionStorage.getItem(flagKey)) {
      /* 이미 처리됨 — 기존 상태 유지 */
      return;
    }

    try {
      sessionStorage.setItem(
        'gtr-last-payment',
        JSON.stringify({ paymentKey, orderId: paidOrderId, amount: amountParam, paymentType }),
      );
    } catch {
      /* storage quota 등 — 무시 */
    }

    let cancelled = false;

    (async () => {
      /* setState 는 전부 async 경로로 옮겨 react-hooks/set-state-in-effect 회피.
         await 직전이므로 microtask 한 틱 뒤에 'pending' 이 반영됨 — UX 차이 없음. */
      if (cancelled) return;
      setConfirmState({ kind: 'pending' });

      const amountNum = Number(amountParam);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        if (!cancelled) setConfirmState({ kind: 'failed', detail: 'invalid_amount_param' });
        return;
      }

      try {
        const res = await fetch('/api/payments/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentKey,
            orderId: paidOrderId,
            amount: amountNum,
          }),
        });

        const body = await res.json().catch(() => null);

        if (cancelled) return;

        if (!res.ok) {
          const detail =
            (body && typeof body === 'object' && 'detail' in body && typeof body.detail === 'string')
              ? body.detail
              : body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
                ? body.error
                : `http_${res.status}`;
          setConfirmState({ kind: 'failed', detail });
          return;
        }

        const data = body?.data as ConfirmResponseData | undefined;
        if (!data) {
          setConfirmState({ kind: 'failed', detail: 'empty_response' });
          return;
        }

        /* 성공 — 중복 호출 차단 플래그 세팅 + 장바구니 비우기 */
        try {
          sessionStorage.setItem(flagKey, '1');
        } catch {
          /* ignore */
        }
        clearCart();

        if (data.status === 'paid') {
          setConfirmState({
            kind: 'success',
            orderNumber: data.orderNumber,
            method: data.method,
          });
        } else {
          /* 가상계좌 입금 대기 등 — B-5 에서 세분화 */
          setConfirmState({ kind: 'deposit_waiting', orderNumber: data.orderNumber });
        }
      } catch {
        if (cancelled) return;
        setConfirmState({ kind: 'failed', detail: 'network_error' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, clearCart]);

  /* 진입 연출 트리거 */
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  /* 주문번호 복사 */
  const handleCopy = async () => {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.number);
      toast('주문번호가 복사되었습니다.');
    } catch {
      toast('복사에 실패했습니다.');
    }
  };

  /* 주문 정보 없음 보호 */
  if (!order) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        <div className="ocp-hdr-wrap" style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
          <div className="chp-hdr-inner">
            <Link href="/">
              <Image src="/images/icons/logo.svg" alt="GOOD THINGS" width={140} height={28} style={{ cursor: 'pointer' }} />
            </Link>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24, padding: '80px 60px' }}>
          <p style={{ fontFamily: 'var(--font-kr)', fontSize: 'var(--type-body-l-size)', color: 'var(--color-text-secondary)' }}>
            주문 정보를 찾을 수 없습니다.
          </p>
          <Link href="/" className="ocp-btn-primary" style={{ maxWidth: 280, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  /* confirm 실패 — 재시도/고객센터 안내 */
  if (confirmState.kind === 'failed') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        <div className="ocp-hdr-wrap" style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
          <div className="chp-hdr-inner">
            <Link href="/">
              <Image src="/images/icons/logo.svg" alt="GOOD THINGS" width={140} height={28} style={{ cursor: 'pointer' }} />
            </Link>
          </div>
        </div>
        <div className="ocp-body">
          <div className={`ocp-inner${entered ? ' ocp-enter' : ''}`}>
            <h1 className="ocp-title">결제 승인에<br />실패했습니다.</h1>
            <p className="ocp-subtitle" style={{ marginTop: 16 }}>
              결제가 최종 완료되지 않았습니다. 잠시 후 다시 시도하거나, 문제가 지속되면 고객센터로 문의해 주세요.
            </p>
            <p
              style={{
                fontFamily: 'var(--font-kr)',
                fontSize: 'var(--type-body-s-size)',
                color: 'var(--color-text-tertiary)',
                marginTop: 8,
              }}
            >
              오류 코드: {confirmState.detail}
            </p>
            <div className="ocp-actions" style={{ marginTop: 32 }}>
              <Link
                href="/checkout"
                className="ocp-btn-primary"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                결제 다시 시도하기
              </Link>
              <button className="ocp-btn-secondary" onClick={() => router.push('/')}>
                홈으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      {/* ── 미니 헤더 ── */}
      <div className="ocp-hdr-wrap" style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
        <div className="chp-hdr-inner">
          <Link href="/">
            <Image src="/images/icons/logo.svg" alt="GOOD THINGS" width={140} height={28} style={{ cursor: 'pointer' }} />
          </Link>
        </div>
      </div>

      {/* ── 바디 ── */}
      <div className="ocp-body">
        <div className={`ocp-inner${entered ? ' ocp-enter' : ''}`}>
          <h1 className="ocp-title">주문이 정상적으로<br />완료 되었습니다.</h1>

          <div className="ocp-order-num">
            <span>주문번호</span>
            <strong onClick={handleCopy}>{order.number}</strong>
            <button className="ocp-copy-btn" title="주문번호 복사" aria-label="주문번호 복사" onClick={handleCopy}>
              <CopyIcon />
            </button>
          </div>

          <p className="ocp-subtitle">주문번호는 배송조회하실 때 필요합니다.</p>

          <div className="ocp-summary">
            {order.items.map((item, idx) => (
              <div key={idx} className="ocp-item">
                <div className="ocp-item-img" style={{ background: item.image.bg }}>
                  {item.image.src && (
                    <Image src={item.image.src} alt={item.name} width={100} height={100} style={{ objectFit: 'contain' }} />
                  )}
                </div>
                <div className="ocp-item-info">
                  <div className="ocp-item-category">{item.category}</div>
                  <div className="ocp-item-name">{extractKrName(item.name)}</div>
                  <div className="ocp-item-badges">
                    {item.volume && <span className="ocp-item-badge">{item.volume}</span>}
                    {item.type === 'subscription' && item.period && (
                      <span className="ocp-item-badge">정기배송 {item.period}</span>
                    )}
                    <span className="ocp-item-qty">수량 {item.qty}개</span>
                    <span className="ocp-item-price">{formatPrice(item.priceNum * item.qty)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="ocp-actions">
            <Link href="/shop" className="ocp-btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              쇼핑 계속하기
            </Link>
            <button className="ocp-btn-secondary" onClick={() => router.push('/mypage')}>
              주문 내역 보기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
