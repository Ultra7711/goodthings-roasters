/* ══════════════════════════════════════════
   BillingReattachWidget — 결제수단 재등록 토스 빌링 위젯 (R-3d · DEC-S339-2)

   끊긴/정지 구독에 새 빌링키를 발급해 연결하기 위한 일회성 동선.
   CheckoutPayment 의 빌링(γ) 분기 패턴 답습하되 order/amount 의존 제거:
   - payment 객체 + customerKey fetch → requestBillingAuth
   - successUrl = /billing/reattach/success?subscriptionId=… (콜백이 발급+연결+재개)

   ⚠️ 카드 정보는 토스 도메인 위젯에서만 입력 — 우리는 토큰(빌링키)만 저장(ADR-008 §0).
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  loadTossPayments,
  type TossPaymentsPayment,
} from '@tosspayments/tosspayments-sdk';
import { useToast } from '@/hooks/useToast';

/* 빌링(payment 객체) = API 개별 연동 키 (`test_ck_*` / `live_ck_*`).
   위젯 키 전달 시 NOT_SUPPORTED_WIDGET_KEY (S91 매트릭스). 미설정 시 빈 문자열 → loadFailed. */
const BILLING_KEY = process.env.NEXT_PUBLIC_TOSS_API_CLIENT_KEY ?? '';

type Props = { subscriptionId: string };

export default function BillingReattachWidget({ subscriptionId }: Props) {
  const { show: toast } = useToast();
  const paymentRef = useRef<TossPaymentsPayment | null>(null);
  const [ready, setReady] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [billingMethod, setBillingMethod] = useState<'CARD' | 'TRANSFER'>('CARD');
  const [loadFailed, setLoadFailed] = useState(!BILLING_KEY);

  /* bfcache 복구 — 토스 등록창에서 '이전' 시 requesting 무한 대기 차단(CheckoutPayment 답습). */
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setRequesting(false);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);
  useEffect(() => {
    if (!requesting) return;
    const t = setTimeout(() => setRequesting(false), 60_000);
    return () => clearTimeout(t);
  }, [requesting]);

  /* payment 객체 + customerKey 로드 */
  useEffect(() => {
    if (!BILLING_KEY) return;
    let cancelled = false;

    (async () => {
      try {
        const tossPayments = await loadTossPayments(BILLING_KEY);
        if (cancelled) return;

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
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[reattach init] failed:', err);
        }
        if (cancelled) return;
        setLoadFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      paymentRef.current = null;
    };
  }, []);

  const handleRequest = useCallback(async () => {
    if (requesting || !paymentRef.current || !ready) return;
    setRequesting(true);
    try {
      await paymentRef.current.requestBillingAuth({
        method: billingMethod,
        successUrl: `${window.location.origin}/billing/reattach/success?subscriptionId=${encodeURIComponent(subscriptionId)}`,
        failUrl: `${window.location.origin}/mypage?error=reattach_failed`,
      });
      /* 성공 시 successUrl redirect — 이 라인 이후 미실행 */
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const name = err instanceof Error ? err.name : '';
      const cancelledByUser = code === 'USER_CANCEL' || name === 'UserCancelError';
      if (!cancelledByUser) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[reattach requestBillingAuth] failed:', err);
        }
        toast('결제수단 등록 중 오류가 발생했습니다.');
      }
      setRequesting(false);
    }
  }, [requesting, ready, billingMethod, subscriptionId, toast]);

  if (loadFailed) {
    return (
      <div className="chp-section chp-section--no-border">
        <h2 className="chp-section-title">결제수단 재등록</h2>
        <p
          style={{
            fontFamily: 'var(--font-kr)',
            fontSize: 'var(--type-body-m-size)',
            color: 'var(--color-text-secondary)',
            margin: '16px 0 24px',
          }}
        >
          결제 모듈을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="chp-section chp-section--no-border">
      <h2 className="chp-section-title">결제수단 재등록</h2>
      <p
        style={{
          fontFamily: 'var(--font-kr)',
          fontSize: 'var(--type-body-s-size)',
          color: 'var(--color-text-secondary)',
          margin: '4px 0 16px',
          lineHeight: 1.6,
        }}
      >
        새 결제수단을 등록하면 정기배송이 다음 주기부터 자동으로 재개됩니다.<br />
        카드 정보는 토스페이먼츠에서 안전하게 처리되며, 저장되지 않습니다.
      </p>

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
                boxShadow: selected ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
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

      <button
        type="button"
        className="chp-submit-btn"
        onClick={handleRequest}
        disabled={!ready || requesting}
        aria-busy={requesting}
        style={{ width: '100%', marginTop: 24 }}
        data-gtr-tap
      >
        {requesting
          ? billingMethod === 'CARD'
            ? '카드 등록 화면 이동 중…'
            : '계좌 등록 화면 이동 중…'
          : billingMethod === 'CARD'
            ? '카드 등록하기'
            : '계좌 등록하기'}
      </button>
    </div>
  );
}
