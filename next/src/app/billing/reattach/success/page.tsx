/* ══════════════════════════════════════════
   /billing/reattach/success — 재등록 빌링 콜백 (R-3d)

   토스 requestBillingAuth 의 successUrl 리다이렉트 대상.
   query: authKey · customerKey · subscriptionId

   흐름 (/billing/success 답습 · charge → reattach 치환):
   1. authKey + customerKey → POST /api/billing/authorizations → billingMethodId 발급
   2. billingMethodId + subscriptionId → POST /api/subscriptions/[id]/reattach-billing
      → 구독에 결제수단 연결 + paused 면 자동 재개(DEC-S339-1·2)
   3. 성공 → "재등록 완료" 화면 + 마이페이지 링크
   ══════════════════════════════════════════ */

'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import BillingShell from '@/components/billing/BillingShell';

type Step = 'authorizing' | 'reattaching' | 'success' | 'error';

type AuthorizationsResponse = {
  data?: { billingMethodId: string; isDefault: boolean };
  error?: { code?: string; detail?: string };
};

type ReattachResponse = {
  data?: { id: string; status: string; billingStatus?: string };
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
      return '정기배송 또는 결제수단 정보를 찾을 수 없습니다.';
    case 'conflict':
      return detail === 'not_reattachable'
        ? '이미 해지·만료된 정기배송에는 결제수단을 연결할 수 없습니다.'
        : '현재 상태에서는 재등록할 수 없습니다.';
    case 'payment_failed':
      return '카드 등록이 거절되었습니다. 다른 결제수단으로 다시 시도해 주세요.';
    case 'validation_failed':
      return '요청 정보가 올바르지 않습니다.';
    default:
      return '재등록 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  }
}

function BillingReattachSuccessInner() {
  const router = useRouter();
  const search = useSearchParams();

  const authKey = search.get('authKey');
  const customerKey = search.get('customerKey');
  const subscriptionId = search.get('subscriptionId');

  const [step, setStep] = useState<Step>('authorizing');
  const [errorMessage, setErrorMessage] = useState<string>('');
  /* StrictMode 이중 호출 방어 */
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    if (!authKey || !customerKey || !subscriptionId) {
      setStep('error');
      setErrorMessage('재등록 정보가 올바르지 않습니다. 다시 시도해 주세요.');
      return;
    }
    startedRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        /* 1) 빌링키 발급 (charge 없음) */
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

        /* 2) 구독에 연결 + 자동 재개 */
        setStep('reattaching');
        const reattachRes = await fetch(
          `/api/subscriptions/${encodeURIComponent(subscriptionId)}/reattach-billing`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ billingMethodId }),
          },
        );
        const reattachBody = (await reattachRes.json()) as ReattachResponse;
        if (cancelled) return;

        if (!reattachRes.ok || !reattachBody.data) {
          setStep('error');
          setErrorMessage(
            errorMessageFromCode(reattachBody.error?.code, reattachBody.error?.detail),
          );
          return;
        }

        setStep('success');
      } catch (err) {
        if (cancelled) return;
        if (process.env.NODE_ENV === 'development') {
          console.error('[billing/reattach/success] failed:', err);
        }
        setStep('error');
        setErrorMessage('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authKey, customerKey, subscriptionId]);

  return (
    <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
        {(step === 'authorizing' || step === 'reattaching') && (
          <>
            <h1
              style={{
                fontSize: 'var(--type-h2-size)',
                fontWeight: 400,
                color: 'var(--color-text-primary)',
                marginBottom: '12px',
              }}
            >
              결제수단 재등록 중
            </h1>
            <p
              style={{
                fontSize: 'var(--type-body-m-size)',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.6,
              }}
            >
              {step === 'authorizing'
                ? '결제수단을 등록하고 있습니다…'
                : '정기배송에 연결하고 있습니다…'}
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
              결제수단이 재등록되었습니다
            </h1>
            <p
              style={{
                fontSize: 'var(--type-body-m-size)',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.6,
                marginBottom: '32px',
              }}
            >
              새 결제수단이 정기배송에 연결되었습니다.<br />
              다음 배송 주기부터 등록하신 결제수단으로 자동 결제됩니다.
            </p>
            <Link
              href="/mypage"
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
              마이페이지로
            </Link>
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
              결제수단 재등록에 실패했습니다
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
                onClick={() => router.push('/mypage')}
                style={{ height: 48, padding: '0 24px' }}
                data-gtr-tap
              >
                마이페이지로
              </button>
              <button
                type="button"
                className="chp-submit-btn"
                onClick={() =>
                  router.push(
                    `/billing/reattach?subscriptionId=${encodeURIComponent(subscriptionId ?? '')}`,
                  )
                }
                style={{ height: 48, padding: '0 24px', marginTop: 0 }}
                data-gtr-tap
              >
                다시 시도
              </button>
            </div>
          </>
        )}
    </div>
  );
}

export default function BillingReattachSuccessPage() {
  return (
    <BillingShell>
      <Suspense
        fallback={
          <p
            style={{
              textAlign: 'center',
              fontSize: 'var(--type-body-m-size)',
              color: 'var(--color-text-secondary)',
            }}
          >
            재등록 정보를 확인하는 중…
          </p>
        }
      >
        <BillingReattachSuccessInner />
      </Suspense>
    </BillingShell>
  );
}
