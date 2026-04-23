/* ══════════════════════════════════════════
   CheckoutPayment — 결제위젯 (Session 3.5 B-2)

   역할:
   - TossPayments v2 결제위젯 렌더
   - widgets.requestPayment → Toss 결제창 리다이렉트
   - 성공 → successUrl (/order-complete?paymentKey=…&orderId=…&amount=…)
   - 실패 → failUrl (/checkout?error=payment_failed)

   설계 결정 (payments-flow.md §1.3 · ADR-002 §3 기반):
   1. customerKey = ANONYMOUS — MVP 단계 게스트 결제 우선, 사용자별 키는 Phase 3 deferred
   2. React 19 Strict Mode 이중 초기화 방지:
      - `cancelled` flag 로 async 경로 guard
      - cleanup 에서 selector innerHTML 비우기 (widgets duplicate mount 방지)
   3. 금액 위조 방어: 여기서는 표기용. 실제 검증은 B-3 confirm API 에서 DB 교차검증
   4. 에러 핸들링: UserCancelError silent / 약관·결제수단 미선택은 안내 toast
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ANONYMOUS,
  loadTossPayments,
  type TossPaymentsWidgets,
} from '@tosspayments/tosspayments-sdk';
import { useToast } from '@/hooks/useToast';
import { formatPrice } from '@/lib/utils';

const CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? '';

type CheckoutPaymentProps = {
  orderNumber: string;
  orderName: string;
  amount: number;
  customerEmail: string;
  customerName: string;
  /** 하이픈 제거된 숫자만 (예: '01012345678'). 유효하지 않으면 미전달. */
  customerMobilePhone?: string;
  onBack: () => void;
};

export default function CheckoutPayment({
  orderNumber,
  orderName,
  amount,
  customerEmail,
  customerName,
  customerMobilePhone,
  onBack,
}: CheckoutPaymentProps) {
  const { show: toast } = useToast();
  const widgetsRef = useRef<TossPaymentsWidgets | null>(null);
  const [ready, setReady] = useState(false);
  const [requesting, setRequesting] = useState(false);
  /* CLIENT_KEY 부재는 환경 상수이므로 초기 렌더에서 바로 실패 상태로 시작.
     (effect 내부 setState 금지 규칙 회피) */
  const [loadFailed, setLoadFailed] = useState(!CLIENT_KEY);

  /* ── 위젯 로드 · 마운트 ──
     Strict Mode 이중 invoke 대응: cancelled flag + cleanup 시 selector 비우기
  */
  useEffect(() => {
    /* 환경변수 미설정 시 effect 스킵 — loadFailed 는 초기값으로 이미 true */
    if (!CLIENT_KEY) return;

    let cancelled = false;

    (async () => {
      try {
        const tossPayments = await loadTossPayments(CLIENT_KEY);
        if (cancelled) return;

        const widgets = tossPayments.widgets({ customerKey: ANONYMOUS });
        await widgets.setAmount({ currency: 'KRW', value: amount });
        if (cancelled) return;

        await Promise.all([
          widgets.renderPaymentMethods({
            selector: '#payment-method',
            variantKey: 'DEFAULT',
          }),
          widgets.renderAgreement({
            selector: '#agreement',
            variantKey: 'AGREEMENT',
          }),
        ]);
        if (cancelled) return;

        widgetsRef.current = widgets;
        setReady(true);
      } catch (err) {
        /* BUG-FIX 2026-04-23: 원래 catch{} 에 error 바인딩이 없어 실패 원인이
           콘솔에 전혀 노출되지 않았음. 진단 완료 후 console.error 는 유지하되
           필요 시 Sentry 등으로 교체. */
        console.error('[CheckoutPayment] Toss 위젯 로드 실패', {
          clientKeyPresent: Boolean(CLIENT_KEY),
          clientKeyPrefix: CLIENT_KEY ? CLIENT_KEY.slice(0, 8) : null,
          amount,
          err,
          errName: err instanceof Error ? err.name : typeof err,
          errMessage: err instanceof Error ? err.message : String(err),
        });
        if (cancelled) return;
        setLoadFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      widgetsRef.current = null;
      /* Strict Mode 이중 마운트 시 duplicate DOM 방지 — cleanup 단계에서 컨테이너 비우기 */
      const pm = document.querySelector('#payment-method');
      const ag = document.querySelector('#agreement');
      if (pm) pm.innerHTML = '';
      if (ag) ag.innerHTML = '';
    };
  }, [amount]);

  /* ── 결제 요청 ──
     성공 시 Toss 가 successUrl 로 redirect → 이 라인 이후 실행되지 않음.
     실패는 예외로 throw. 사용자 취소(UserCancelError)는 silent.
  */
  const handleRequestPayment = useCallback(async () => {
    if (!widgetsRef.current || !ready || requesting) return;
    setRequesting(true);
    try {
      await widgetsRef.current.requestPayment({
        orderId: orderNumber,
        orderName,
        successUrl: `${window.location.origin}/order-complete`,
        failUrl: `${window.location.origin}/checkout?error=payment_failed`,
        customerEmail,
        customerName,
        customerMobilePhone,
      });
      /* 성공 경로는 리다이렉트 — 도달하면 redirect 전 cleanup 으로 처리 */
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'UserCancelError') {
        /* 사용자 취소 — 조용히 복구 */
      } else if (name === 'NotSelectedPaymentMethodError') {
        toast('결제 수단을 선택해 주세요.');
      } else if (name === 'NeedAgreementWithRequiredTermsError') {
        toast('필수 약관에 동의해 주세요.');
      } else if (name === 'NeedCardPaymentDetailError') {
        toast('카드 정보를 입력해 주세요.');
      } else if (name === 'NeedRefundAccountDetailError') {
        toast('환불 계좌 정보를 입력해 주세요.');
      } else {
        toast('결제 요청 중 오류가 발생했습니다.');
      }
      setRequesting(false);
    }
  }, [
    ready,
    requesting,
    orderNumber,
    orderName,
    customerEmail,
    customerName,
    customerMobilePhone,
    toast,
  ]);

  if (loadFailed) {
    return (
      <div className="chp-section chp-section--no-border">
        <h2 className="chp-section-title">결제</h2>
        <p
          style={{
            fontFamily: 'var(--font-kr)',
            fontSize: 'var(--type-body-m-size)',
            color: 'var(--color-text-secondary)',
            margin: '16px 0 24px',
          }}
        >
          결제 위젯을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
        <button
          type="button"
          className="chp-submit-btn"
          onClick={onBack}
          style={{
            background: 'transparent',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-line-light)',
          }}
        >
          이전으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="chp-section chp-section--no-border">
      <h2 className="chp-section-title">결제</h2>
      <p
        style={{
          fontFamily: 'var(--font-kr)',
          fontSize: 'var(--type-body-s-size)',
          color: 'var(--color-text-secondary)',
          margin: '4px 0 16px',
        }}
      >
        주문번호 <strong style={{ color: 'var(--color-text-primary)' }}>{orderNumber}</strong>{' '}
        · 결제금액 <strong style={{ color: 'var(--color-text-primary)' }}>{formatPrice(amount)}</strong>
      </p>

      {/* Toss 결제위젯 마운트 포인트 */}
      <div id="payment-method" style={{ width: '100%' }} />
      <div id="agreement" style={{ width: '100%' }} />

      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button
          type="button"
          className="chp-submit-btn"
          onClick={onBack}
          disabled={requesting}
          style={{
            background: 'transparent',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-line-light)',
            flex: '0 0 40%',
          }}
        >
          이전
        </button>
        <button
          type="button"
          className="chp-submit-btn"
          onClick={handleRequestPayment}
          disabled={!ready || requesting}
          aria-busy={requesting}
          style={{ flex: 1 }}
        >
          {requesting ? '결제창 이동 중…' : `${formatPrice(amount)} 결제하기`}
        </button>
      </div>
    </div>
  );
}
