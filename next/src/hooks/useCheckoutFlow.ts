'use client';

/* ══════════════════════════════════════════════════════════════════════════
   useCheckoutFlow — 결제 단계 · 제출 · 리셋 가드 (S171 PR-2)

   CheckoutPage 에서 추출. 다음 세 관심사를 캡슐화:
   1. 결제 단계 상태 (step / orderResult / submitting)
   2. 리셋 가드 (D-1 Activity stale + BUG-161 pathname 재진입)
   3. 주문 생성 + Toss 전환 (handleSubmit) / 이전 (handleBack)
   ══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useIsMounted } from '@/hooks/useIsMounted';
import {
  buildOrderPayload,
  createOrder,
  OrderApiError,
  type CreateOrderResponse,
} from '@/lib/api/orderClient';
import { shakeFields } from '@/lib/shakeFields';
import type { CheckoutFormData } from '@/types/checkout';
import type { CartItem } from '@/types/cart';

type Params = {
  cartSig: string;
  userId: string | undefined;
  isLoggedIn: boolean;
  isFormRevealed: boolean;
  sessionLoading: boolean;
  items: CartItem[];
  form: CheckoutFormData;
  agreements: boolean[];
  toast: (msg: string) => void;
  clearErrors: () => void;
  validate: (isLoggedIn: boolean) => boolean;
  resetForm: () => void;
  chpFormRef: React.RefObject<HTMLDivElement | null>;
};

type Return = {
  step: 'form' | 'payment';
  orderResult: CreateOrderResponse | null;
  submitting: boolean;
  handleSubmit: () => Promise<void>;
  handleBack: () => void;
};

export function useCheckoutFlow({
  cartSig,
  userId,
  isLoggedIn,
  isFormRevealed,
  sessionLoading,
  items,
  form,
  agreements,
  toast,
  clearErrors,
  validate,
  resetForm,
  chpFormRef,
}: Params): Return {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMountedRef = useIsMounted();

  const [step, setStep] = useState<'form' | 'payment'>('form');
  const [orderResult, setOrderResult] = useState<CreateOrderResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /* submit 시점의 cart signature — 이후 cart 변경 시 stale reset 발동 (Stage D-1) */
  const orderCartSigRef = useRef<string | null>(null);

  /* ── failUrl 복귀 toast (마운트 1회) ── */
  const failNoticeShownRef = useRef(false);
  useEffect(() => {
    if (failNoticeShownRef.current) return;
    if (searchParams.get('error') === 'payment_failed') {
      failNoticeShownRef.current = true;
      toast('결제가 완료되지 않았습니다. 다시 시도해 주세요.');
    }
  }, [searchParams, toast]);

  /* ── submitting 무한 대기 복구 — bfcache 복원 경로 ── */
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setSubmitting(false);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  /* ── Stage D-1 (BUG-006/161): Activity stale state guard ──
     cacheComponents 로 hidden 보존된 /checkout 이 stale step='payment' + orderResult 를
     유지할 수 있음. cart·user 변화 감지 시 form 으로 복귀. */
  const prevCartSigRef = useRef<string>(cartSig);
  const prevUserIdRef = useRef<string | null>(userId ?? null);
  useEffect(() => {
    const currentUserId = userId ?? null;
    const prevUserId = prevUserIdRef.current;
    const cartChanged = prevCartSigRef.current !== cartSig;
    const userChanged = prevUserId !== currentUserId;

    if (!cartChanged && !userChanged) return;

    prevCartSigRef.current = cartSig;
    prevUserIdRef.current = currentUserId;

    if (userChanged) {
      const loggingIn = prevUserId === null && currentUserId !== null;
      const safeToSkipReset = loggingIn && !isFormRevealed;
      setStep('form');
      setOrderResult(null);
      setSubmitting(false);
      if (!safeToSkipReset) resetForm();
      orderCartSigRef.current = null;
    } else if (
      cartChanged &&
      orderCartSigRef.current !== null &&
      orderCartSigRef.current !== cartSig
    ) {
      setStep('form');
      setOrderResult(null);
      setSubmitting(false);
      /* S170: 로그인 사용자는 cart 변경 시 입력값 유지 (배송지 prefill 미구현 보완).
         비로그인은 게스트 데이터 stale 정리를 위해 resetForm.
         상세: project_checkout_address_prefill.md carry-over */
      if (!isLoggedIn) resetForm();
      orderCartSigRef.current = null;
    }
  }, [cartSig, userId, isFormRevealed, isLoggedIn, resetForm]);

  /* ── 재진입 reset (BUG-112/161) — 비로그인 케이스 ──
     로그인 케이스는 D-1 이 user.id 변화로 처리.
     sessionLoading 가드: isLoggedIn 확정 전 prev 갱신 보류 (race 완화). */
  const prevPathnameRef = useRef(pathname);
  useEffect(() => {
    if (sessionLoading) return;
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;
    if (prev !== '/checkout' && pathname === '/checkout' && !isLoggedIn) {
      resetForm();
    }
  }, [pathname, resetForm, isLoggedIn, sessionLoading]);

  /* ── 주문 생성 + Toss 전환 ── */
  const handleSubmit = useCallback(async () => {
    if (submitting) return;

    clearErrors();
    const ok = validate(isLoggedIn);
    if (!ok) {
      shakeFields(chpFormRef.current);
      const firstErr = chpFormRef.current?.querySelector('.chp-field.input-warn');
      if (firstErr) {
        firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const input = firstErr.querySelector<HTMLElement>('input, select, textarea');
        input?.focus({ preventScroll: true });
      }
      return;
    }

    setSubmitting(true);
    let navigated = false;
    try {
      const payload = buildOrderPayload(form, items, isLoggedIn, agreements);
      const result = await createOrder(payload);

      /* 주문 완료 페이지용 요약 저장 (sessionStorage — 탭 종료 시 자동 폐기) */
      type StoredOrderSummary = {
        number: string;
        createdAt: string;
        guestEmail?: string;
        subscriptionCount: number;
        items: Array<{
          name: string; slug: string; category: string;
          volume: string | null; qty: number; priceNum: number;
          image: { src: string; bg: string };
          type: string; period: string | null;
        }>;
      };
      const summary: StoredOrderSummary = {
        number: result.orderNumber,
        createdAt: result.createdAt,
        guestEmail: isLoggedIn ? undefined : form.email.trim().toLowerCase(),
        subscriptionCount: result.subscriptionCount,
        items: items.map((i) => ({
          name: i.name,
          slug: i.slug,
          category: i.category,
          volume: i.volume,
          qty: i.qty,
          priceNum: i.priceNum,
          image: { src: i.image ?? '', bg: i.color },
          type: i.type,
          period: i.period,
        })),
      };
      sessionStorage.setItem('gtr-last-order', JSON.stringify(summary));

      if (isMountedRef.current) {
        orderCartSigRef.current = cartSig;
        setOrderResult(result);
        setStep('payment');
      }
      navigated = true;
    } catch (err) {
      if (err instanceof OrderApiError) {
        switch (err.code) {
          case 'rate_limited':
            toast('잠시 후 다시 시도해 주세요.');
            break;
          case 'agreement_required':
            toast('필수 약관에 동의해 주세요.');
            break;
          case 'conflict':
            if (err.detail?.includes('duplicate_subscription')) {
              toast('이미 동일 상품을 정기배송 중입니다. 마이페이지에서 확인해 주세요.');
            } else {
              toast('상품 정보가 변경되었습니다. 장바구니를 확인해 주세요.');
            }
            break;
          case 'validation_failed':
            toast('입력 정보를 확인해 주세요.');
            break;
          case 'network_error':
            toast('네트워크 오류가 발생했습니다.');
            break;
          case 'forbidden':
            toast('요청이 차단되었습니다. 페이지를 새로고침해 주세요.');
            break;
          default:
            toast('주문 처리 중 오류가 발생했습니다.');
        }
      } else {
        toast('주문 처리 중 오류가 발생했습니다.');
      }
    } finally {
      if (!navigated && isMountedRef.current) {
        setSubmitting(false);
      }
    }
    /* isMountedRef 는 ref — deps 불필요 */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitting, clearErrors, validate, isLoggedIn, form, items, agreements, cartSig, toast, chpFormRef]);

  const handleBack = useCallback(() => {
    setStep('form');
    setSubmitting(false);
  }, []);

  return { step, orderResult, submitting, handleSubmit, handleBack };
}
