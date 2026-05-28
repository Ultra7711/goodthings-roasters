/* ══════════════════════════════════════════
   CheckoutPayment — 결제위젯 / 빌링 분기 (ADR-008 §D-3 γ)

   분기:
   - hasSubscription === false: 기존 결제위젯 (`widgets.requestPayment`).
     successUrl = /order-complete.
   - hasSubscription === true (γ 합산 통합): 빌링 카드 등록창 (`payment.requestBillingAuth`).
     successUrl = /billing/success?orderId=… (authKey 콜백 → billingKey 발급 →
     첫 회 charge 자동 진행. 정기 + 일반 amount 합산 1회 charge — ADR-008 §D-3 A-2).

   설계 결정:
   1. 단일 컴포넌트 안에서 hasSubscription 분기 (helper 중복 회피).
   2. mount effect 에서 분기 — 빌링 시 payment 객체 + customerKey fetch / 위젯 시 기존.
   3. requestBillingAuth 는 redirect 후 /billing/success 가 backend API 호출.
   4. customerKey = profiles.customer_key (회원 한정 · ADR-008 §D-5).

   참조:
   - docs/adr/ADR-008-toss-billing-integration.md §3.5
   - memory/research_billing_mixed_cart.md
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ANONYMOUS,
  loadTossPayments,
  type TossPaymentsPayment,
  type TossPaymentsWidgets,
} from '@tosspayments/tosspayments-sdk';
import { useToast } from '@/hooks/useToast';
import { formatPrice } from '@/lib/utils';

/* Toss SDK 키 — Widget SDK ↔ Payment(빌링) SDK 별도 키 필수.
   - Widget(`widgets()` 일반결제) = 위젯 키 (`test_gck_*` / `live_gck_*`)
   - Payment(`payment()` 빌링) = API 개별 연동 키 (`test_ck_*` / `live_ck_*`)
     ※ S91 사고 매트릭스 (memory/project_production_toss_key_migration.md) 참조.
     payment() 객체에 위젯 키 전달 시 NOT_SUPPORTED_WIDGET_KEY throw.
   미설정 시 빈 문자열 → 해당 분기 진입 시 loadFailed 폴백. */
const WIDGET_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? '';
const BILLING_KEY = process.env.NEXT_PUBLIC_TOSS_API_CLIENT_KEY ?? '';

type CheckoutPaymentProps = {
  /** orders.id (UUID) — 빌링 분기 시 successUrl 쿼리로 전달 → /billing/success 가 charge API 호출. */
  orderId: string;
  orderNumber: string;
  orderName: string;
  amount: number;
  /** cart 에 정기배송 item 포함 시 true — 빌링 분기 (ADR-008 §D-3 γ 합산 통합). */
  hasSubscription: boolean;
  customerEmail: string;
  customerName: string;
  /** 하이픈 제거된 숫자만 (예: '01012345678'). 유효하지 않으면 미전달. */
  customerMobilePhone?: string;
  onBack: () => void;
};

export default function CheckoutPayment({
  orderId,
  orderNumber,
  orderName,
  amount,
  hasSubscription,
  customerEmail,
  customerName,
  customerMobilePhone,
  onBack,
}: CheckoutPaymentProps) {
  const { show: toast } = useToast();
  const widgetsRef = useRef<TossPaymentsWidgets | null>(null);
  const paymentRef = useRef<TossPaymentsPayment | null>(null);
  /* amount는 위젯 초기화 후에도 변경될 수 있으므로 ref로 최신값 유지 */
  const amountRef = useRef(amount);
  // render body 에서 ref mutation — TossPayments widget 콜백에 최신 amount 전달 (의도된 ref sync)
  // eslint-disable-next-line react-hooks/refs
  amountRef.current = amount;
  const [ready, setReady] = useState(false);
  const [requesting, setRequesting] = useState(false);
  /* 빌링 결제수단 선택 (γ · ADR-008 §D-2 카드 + 계좌이체 둘 다 지원).
     hasSubscription=false 일 때는 무관 (위젯이 다중 결제수단 자체 처리). */
  const [billingMethod, setBillingMethod] = useState<'CARD' | 'TRANSFER'>('CARD');
  /* 분기별 SDK 키 부재는 환경 상수이므로 초기 렌더에서 바로 실패 상태로 시작.
     (effect 내부 setState 금지 규칙 회피) */
  const tossKey = hasSubscription ? BILLING_KEY : WIDGET_KEY;
  const [loadFailed, setLoadFailed] = useState(!tossKey);

  /* ── pending 주문 명시 취소 (PR-B) ──
     fire-and-forget. 실패해도 UX 를 막지 않는다. 서버 측 graceful no-op 처리.
  */
  const cancelPending = useCallback(() => {
    fetch(`/api/orders/${orderNumber}/cancel`, { method: 'POST' }).catch(() => {});
  }, [orderNumber]);

  /* ── requesting 무한 대기 복구 ──
     Toss 결제창에서 '이전' 클릭 시 브라우저 bfcache 로 이 페이지가 복원되면
     requesting=true 상태가 그대로 남아 CTA 가 "결제창 이동 중…" 으로 무한 대기.
     두 경로로 복구:
     1. pageshow persisted=true — bfcache 복원 (이 버그의 근본 경로) + pending cancel
        대부분의 결제창 이탈은 이 경로로 복구된다.
     2. 60초 안전망 — SDK 가 promise reject 없이 결제창이 닫히는 드문 케이스.
        사용자의 정상 결제 조작 시간 (카드 정보 입력 · OTP 등) 은 보통 10~30초이며,
        넉넉히 60초까지 보장. 60초 이후에도 무응답이면 사용자가 결제창 자체를
        잊고 다른 작업 중일 가능성이 높아 CTA 잠금 해제가 자연스럽다.
        (S91 카드 사고 회피: 결제 진행 중에는 절대 reset 하지 않으므로 안전.)
  */
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setRequesting(false);
        cancelPending();
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [cancelPending]);

  useEffect(() => {
    if (!requesting) return;
    const timer = setTimeout(() => setRequesting(false), 60_000);
    return () => clearTimeout(timer);
  }, [requesting]);

  /* ── 위젯 / 빌링 로드 · 마운트 ──
     hasSubscription 분기:
     - true → payment 객체 + customerKey fetch (위젯 mount 안 함)
     - false → 결제위젯 (renderPaymentMethods + renderAgreement)

     Strict Mode 이중 invoke 대응: cancelled flag + cleanup 시 selector 비우기
  */
  useEffect(() => {
    /* 환경변수 미설정 시 effect 스킵 — loadFailed 는 초기값으로 이미 true */
    if (!tossKey) return;

    let cancelled = false;

    (async () => {
      try {
        const tossPayments = await loadTossPayments(tossKey);
        if (cancelled) return;

        if (hasSubscription) {
          /* ── 빌링 분기 (γ) — payment 객체 + customerKey ── */
          const res = await fetch('/api/billing/customer-key', {
            credentials: 'same-origin',
          });
          if (!res.ok) throw new Error(`customer_key_${res.status}`);
          const body = (await res.json()) as { data?: { customerKey?: string } };
          const key = body.data?.customerKey;
          if (!key) throw new Error('customer_key_empty');
          if (cancelled) return;

          paymentRef.current = tossPayments.payment({ customerKey: key });
          setReady(true);
          return;
        }

        /* ── 위젯 분기 (일반결제) — 기존 흐름 ── */
        const widgets = tossPayments.widgets({ customerKey: ANONYMOUS });
        await widgets.setAmount({ currency: 'KRW', value: amountRef.current });
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
        if (process.env.NODE_ENV === 'development') {
          console.error('[Toss init] failed:', err);
        }
        if (cancelled) return;
        setLoadFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      widgetsRef.current = null;
      paymentRef.current = null;
      /* Strict Mode 이중 마운트 시 duplicate DOM 방지 — 위젯 cleanup */
      const pm = document.querySelector('#payment-method');
      const ag = document.querySelector('#agreement');
      if (pm) pm.innerHTML = '';
      if (ag) ag.innerHTML = '';
    };
    // amountRef.current 로 초기값 참조 — amount prop 변경 시 별도 effect 에서 setAmount 호출
    // hasSubscription 변경 시 재마운트 (분기 전환).
  }, [hasSubscription]);

  /* amount 변경 시 기존 위젯에만 setAmount 호출 — 위젯 remount 없이 결제수단 유지.
     빌링 분기는 amount 가 SDK 객체에 미바인딩 (charge API 가 서버 권위) — skip. */
  useEffect(() => {
    if (hasSubscription) return;
    if (!widgetsRef.current || !ready) return;
    widgetsRef.current
      .setAmount({ currency: 'KRW', value: amount })
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Toss setAmount update] failed:', err);
        }
      });
  }, [amount, ready, hasSubscription]);

  /* ── 이전 버튼 ── */
  const handleBack = useCallback(() => {
    cancelPending();
    onBack();
  }, [cancelPending, onBack]);

  /* ── 결제 요청 ──
     hasSubscription 분기:
     - true → requestBillingAuth (카드 등록창 → /billing/success 콜백)
     - false → requestPayment (결제창 → /order-complete 콜백)
     성공 시 Toss 가 successUrl 로 redirect → 이 라인 이후 실행되지 않음.
  */
  const handleRequest = useCallback(async () => {
    if (requesting) return;

    if (hasSubscription) {
      if (!paymentRef.current || !ready) return;
      setRequesting(true);
      try {
        await paymentRef.current.requestBillingAuth({
          method: billingMethod,
          successUrl: `${window.location.origin}/billing/success?orderId=${encodeURIComponent(orderId)}`,
          failUrl: `${window.location.origin}/checkout?error=billing_failed`,
          customerEmail,
          customerName,
        });
      } catch (err) {
        /* 빌링 SDK 사용자 취소 식별자 — widgets 와 다르게 `code: 'USER_CANCEL'` 사용 (위젯은 `name: 'UserCancelError'`).
           위젯 분기와 동일하게 silent 처리. */
        const code = (err as { code?: string })?.code;
        const name = err instanceof Error ? err.name : '';
        const userCancelled = code === 'USER_CANCEL' || name === 'UserCancelError';
        if (!userCancelled && process.env.NODE_ENV === 'development') {
          console.error('[Toss requestBillingAuth] failed:', err);
        }
        if (!userCancelled) {
          toast('카드 등록 중 오류가 발생했습니다.');
        }
        setRequesting(false);
      }
      return;
    }

    /* 일반결제 분기 (기존) */
    if (!widgetsRef.current || !ready) return;
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
      /* S91 사고 진단: silent catch 가 에러를 삼켜 원인 파악 불가했음.
         사용자 취소 외 모든 에러를 콘솔에 노출. */
      if (name !== 'UserCancelError' && process.env.NODE_ENV === 'development') {
        console.error('[Toss requestPayment] failed:', err);
      }
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
    hasSubscription,
    billingMethod,
    ready,
    requesting,
    orderId,
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
          className="cta-btn cta-btn-light-outline"
          onClick={handleBack}
          style={{ width: '100%', height: 48, marginTop: 24 }}
          data-gtr-tap
        >
          이전으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="chp-section chp-section--no-border">
      <h2 className="chp-section-title">{hasSubscription ? '정기배송 결제' : '결제'}</h2>
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

      {hasSubscription ? (
        /* 빌링 분기 — 위젯 미렌더. 결제수단 선택 라디오 + 안내 텍스트 + 카드 등록 trigger 버튼 */
        <>
          <div
            role="radiogroup"
            aria-label="결제수단"
            style={{
              display: 'flex',
              gap: '4px',
              background: 'var(--color-surface-stone-light)',
              borderRadius: 0,
              padding: '2px',
              margin: '16px 0 0',
              fontFamily: 'var(--font-kr)',
            }}
          >
              {(['CARD', 'TRANSFER'] as const).map((m) => {
                const selected = billingMethod === m;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setBillingMethod(m)}
                    disabled={requesting}
                    style={{
                      flex: 1,
                      height: '48px',
                      padding: '0 16px',
                      border: 'none',
                      borderRadius: 0,
                      boxSizing: 'border-box',
                      fontFamily: 'var(--font-kr)',
                      fontSize: 'var(--type-body-m-size)',
                      fontWeight: selected ? 500 : 400,
                      color: selected
                        ? 'var(--color-text-primary)'
                        : 'var(--color-text-secondary)',
                      background: selected
                        ? 'var(--color-background-pure)'
                        : 'transparent',
                      boxShadow: selected
                        ? '0 1px 2px rgba(0,0,0,0.06)'
                        : 'none',
                      cursor: requesting ? 'not-allowed' : 'pointer',
                      transition:
                        'background 150ms ease, color 150ms ease, box-shadow 150ms ease',
                      opacity: requesting ? 0.6 : 1,
                    }}
                    data-gtr-tap
                  >
                    {m === 'CARD' ? '신용·체크카드' : '계좌이체'}
                  </button>
                );
            })}
          </div>
          <p
            style={{
              fontFamily: 'var(--font-kr)',
              fontSize: 'var(--type-body-m-size)',
              color: 'var(--color-text-primary)',
              margin: '8px 0 0',
              padding: '16px',
              background: 'var(--color-surface-1)',
              borderRadius: '8px',
              lineHeight: 1.6,
            }}
          >
            {billingMethod === 'CARD'
              ? '카드 등록과 함께 첫 회차가 결제되며, 다음 배송일부터는 같은 카드로 자동 청구됩니다.'
              : '계좌 등록과 함께 첫 회차가 결제되며, 다음 배송일부터는 같은 계좌에서 자동 출금됩니다.'}
            <br />
            마이페이지 &gt; 정기배송 관리에서 언제든지 일시정지·재개·해지하실 수 있습니다.
          </p>
        </>
      ) : (
        <>
          {/* Toss 결제위젯 마운트 포인트 */}
          <div id="payment-method" style={{ width: '100%' }} />
          <div id="agreement" style={{ width: '100%' }} />
        </>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
        <button
          type="button"
          className="cta-btn cta-btn-light-outline"
          onClick={handleBack}
          disabled={requesting}
          style={{ flex: '0 0 40%', height: 48, marginTop: 0, padding: '0 12px', minWidth: 0 }}
          data-gtr-tap
        >
          <span className="chp-back-full">이전으로 돌아가기</span>
          <span className="chp-back-short">이전</span>
        </button>
        <button
          type="button"
          className="chp-submit-btn"
          onClick={handleRequest}
          disabled={!ready || requesting}
          aria-busy={requesting}
          style={{ flex: 1, marginTop: 0 }}
          data-gtr-tap
        >
          {requesting
            ? hasSubscription
              ? billingMethod === 'CARD'
                ? '카드 등록 화면 이동 중…'
                : '계좌 등록 화면 이동 중…'
              : '결제창 이동 중…'
            : hasSubscription
              ? billingMethod === 'CARD'
                ? '카드 등록 및 결제'
                : '계좌 등록 및 결제'
              : `${formatPrice(amount)} 결제하기`}
        </button>
      </div>
    </div>
  );
}
