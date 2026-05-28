/* ══════════════════════════════════════════
   /billing/success — 빌링 카드 등록 successUrl 콜백 (ADR-008 §3.5 · Phase 3-B γ)

   토스 requestBillingAuth 의 successUrl 리다이렉트 대상.
   query params: authKey · customerKey · orderId (uuid)

   흐름:
   1. authKey + customerKey → POST /api/billing/authorizations
      → billingMethodId 발급 + DB INSERT
   2. orderId + billingMethodId → POST /api/billing/charge
      → 첫 회 charge (정기 + 일반 amount 합산 · γ) + atomic 후처리 (042 RPC)
   3. 성공 → "정기배송 등록 완료" 화면 + 마이페이지 / 홈 링크
   4. 실패 → 에러 안내 + /checkout 복귀

   설계 결정:
   - confirm API 미경유 — 빌링 charge 가 직접 atomic 후처리 (process_billing_charge_success).
   - /order-complete 가 아닌 자체 결과 화면 — OrderCompletePage 의 paymentKey + amount
     URL pattern 과 분리.
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

type Step = 'authorizing' | 'charging' | 'success' | 'error';

type AuthorizationsResponse = {
  data?: { billingMethodId: string; isDefault: boolean };
  error?: { code?: string; detail?: string };
};

type ChargeResponse = {
  data?: { paymentKey: string; status: string; subscriptionIds: string[] };
  error?: { code?: string; detail?: string };
};

function errorMessageFromCode(code?: string, detail?: string): string {
  switch (code) {
    case 'unauthorized':
      return '로그인 정보가 만료되었습니다. 다시 로그인 후 시도해 주세요.';
    case 'forbidden':
      return detail === 'customer_key_mismatch'
        ? '회원 정보 검증에 실패했습니다. 다시 시도해 주세요.'
        : '권한이 없습니다.';
    case 'not_found':
      return detail === 'order_not_found'
        ? '주문 정보를 찾을 수 없습니다.'
        : '결제 정보를 찾을 수 없습니다.';
    case 'conflict':
      return detail === 'duplicate_subscription'
        ? '이미 동일 상품의 정기배송이 진행 중입니다.'
        : detail === 'order_not_pending'
          ? '이미 처리된 주문입니다.'
          : '주문 상태가 결제 가능 상태가 아닙니다.';
    case 'payment_failed':
      return '카드 결제가 거절되었습니다. 다른 카드로 다시 시도해 주세요.';
    case 'validation_failed':
      return '요청 정보가 올바르지 않습니다.';
    default:
      return '결제 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  }
}

export default function BillingSuccessPage() {
  const router = useRouter();
  const search = useSearchParams();

  const authKey = search.get('authKey');
  const customerKey = search.get('customerKey');
  const orderId = search.get('orderId');

  const [step, setStep] = useState<Step>('authorizing');
  const [errorMessage, setErrorMessage] = useState<string>('');
  /* StrictMode 이중 호출 방어 — 동일 마운트에서 두 번 fetch 차단 */
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    if (!authKey || !customerKey || !orderId) {
      setStep('error');
      setErrorMessage('카드 등록 정보가 올바르지 않습니다. 다시 시도해 주세요.');
      return;
    }
    startedRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        /* 1) 빌링키 발급 */
        const authRes = await fetch('/api/billing/authorizations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ authKey, customerKey }),
        });
        const authBody = (await authRes.json()) as AuthorizationsResponse;
        if (cancelled) return;

        if (!authRes.ok || !authBody.data) {
          setStep('error');
          setErrorMessage(
            errorMessageFromCode(authBody.error?.code, authBody.error?.detail),
          );
          return;
        }

        const billingMethodId = authBody.data.billingMethodId;

        /* 2) 첫 회 charge */
        setStep('charging');
        const chargeRes = await fetch('/api/billing/charge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ orderId, billingMethodId }),
        });
        const chargeBody = (await chargeRes.json()) as ChargeResponse;
        if (cancelled) return;

        if (!chargeRes.ok || !chargeBody.data) {
          setStep('error');
          setErrorMessage(
            errorMessageFromCode(chargeBody.error?.code, chargeBody.error?.detail),
          );
          return;
        }

        setStep('success');
      } catch (err) {
        if (cancelled) return;
        if (process.env.NODE_ENV === 'development') {
          console.error('[billing/success] failed:', err);
        }
        setStep('error');
        setErrorMessage('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authKey, customerKey, orderId]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100svh',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'var(--font-kr)',
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        {(step === 'authorizing' || step === 'charging') && (
          <>
            <h1
              style={{
                fontSize: 'var(--type-h2-size)',
                fontWeight: 400,
                color: 'var(--color-text-primary)',
                marginBottom: '12px',
              }}
            >
              정기배송 등록 중
            </h1>
            <p
              style={{
                fontSize: 'var(--type-body-m-size)',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.6,
              }}
            >
              {step === 'authorizing'
                ? '카드 정보를 등록하고 있습니다…'
                : '첫 회차 결제를 진행하고 있습니다…'}
              <br />
              잠시만 기다려 주세요. 페이지를 닫지 마세요.
            </p>
          </>
        )}

        {step === 'success' && (
          <>
            <h1
              style={{
                fontSize: 'var(--type-h2-size)',
                fontWeight: 400,
                color: 'var(--color-text-primary)',
                marginBottom: '12px',
              }}
            >
              정기배송이 등록되었습니다
            </h1>
            <p
              style={{
                fontSize: 'var(--type-body-m-size)',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.6,
                marginBottom: '32px',
              }}
            >
              첫 회차 결제가 완료되었습니다.<br />
              다음 배송일부터 등록하신 카드로 자동 결제됩니다.<br />
              마이페이지 &gt; 정기배송 관리에서 언제든지 일시정지·재개·해지하실 수 있습니다.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Link
                href="/mypage"
                className="cta-btn cta-btn-light-outline"
                style={{
                  height: 48,
                  padding: '0 24px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                data-gtr-tap
              >
                마이페이지로
              </Link>
              <Link
                href="/"
                className="chp-submit-btn"
                style={{
                  height: 48,
                  padding: '0 24px',
                  marginTop: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                data-gtr-tap
              >
                홈으로
              </Link>
            </div>
          </>
        )}

        {step === 'error' && (
          <>
            <h1
              style={{
                fontSize: 'var(--type-h2-size)',
                fontWeight: 400,
                color: 'var(--color-text-primary)',
                marginBottom: '12px',
              }}
            >
              정기배송 등록에 실패했습니다
            </h1>
            <p
              style={{
                fontSize: 'var(--type-body-m-size)',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.6,
                marginBottom: '32px',
              }}
            >
              {errorMessage}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                className="cta-btn cta-btn-light-outline"
                onClick={() => router.push('/cart')}
                style={{ height: 48, padding: '0 24px' }}
                data-gtr-tap
              >
                장바구니로
              </button>
              <button
                type="button"
                className="chp-submit-btn"
                onClick={() => router.push('/checkout')}
                style={{ height: 48, padding: '0 24px', marginTop: 0 }}
                data-gtr-tap
              >
                다시 시도
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
