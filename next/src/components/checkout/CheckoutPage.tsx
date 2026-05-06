/* ══════════════════════════════════════════
   CheckoutPage — /checkout
   프로토타입 #checkout-page 이식 (RP-7).

   설계 결정:
   1. chp-* 클래스: BizInquiryPage 의 bi-* 와 동일 격리 원칙으로
      프로토타입 원본 클래스명 유지 (globals.css 에 정의).
   2. 폼 상태: useCheckoutForm 훅 (types/checkout.ts 기반)
   3. 장바구니: useCartQuery (TanStack Query) — clearCart 는 OrderCompletePage 에서 호출
   4. 결제 (B-2): submit 성공 → step='payment' 전환 → CheckoutPayment 렌더
      - Toss 결제위젯 리다이렉트 성공 → /order-complete
      - 결제 실패 → /checkout?error=payment_failed 로 돌아와 안내 toast
   5. Daum 주소 검색: openPostcode() (동적 스크립트 로드)
   6. PR-1 (S170): JSX 섹션 4개 + OrderSummary + MiniHeader + EmptyCart 추출
      → 본 컴포넌트는 orchestrator 역할 (상태 hook 은 PR-2 에서 추출 예정).
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCheckoutForm } from '@/hooks/useCheckoutForm';
import { useAtTop } from '@/hooks/useAtTop';
import { useIsMounted } from '@/hooks/useIsMounted';
import { usePhoneFormat } from '@/hooks/usePhoneFormat';
import { openPostcode, preloadPostcode } from '@/lib/daumPostcode';
import { useInputNav } from '@/hooks/useInputNav';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { useCartQuery } from '@/hooks/useCart';
import { useCartDrawer } from '@/contexts/CartDrawerContext';
import { useToast } from '@/hooks/useToast';
import { shakeFields } from '@/lib/shakeFields';
import { GUEST_PASSWORD_MIN_LENGTH } from '@/lib/validation';
import {
  buildOrderPayload,
  createOrder,
  OrderApiError,
  type CreateOrderResponse,
} from '@/lib/api/orderClient';
import { InfoCircleIcon } from '@/components/ui/Icons';
import CheckoutPayment from './CheckoutPayment';
import MiniHeader from './MiniHeader';
import EmptyCart from './EmptyCart';
import OrderSummary from './OrderSummary';
import ContactSection from './sections/ContactSection';
import AddressSection from './sections/AddressSection';
import GuestPasswordSection from './sections/GuestPasswordSection';
import AgreementSection from './sections/AgreementSection';

/* ══════════════════════════════════════════ */
export default function CheckoutPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { show: toast } = useToast();
  const { isLoggedIn, isLoading: sessionLoading, user } = useSupabaseSession();
  const { open: openDrawer } = useCartDrawer();
  const atTop = useAtTop();

  /* ── 마운트 가드: SSR/클라이언트 초기 렌더 일치 (hydration mismatch 방지)
     서버는 cart 상태를 알 수 없으므로 마운트 전에는 항상 로딩 스켈레톤을 표시. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => { preloadPostcode(); }, []);

  /* ── 장바구니 (ADR-004 Step B: TanStack Query) ──
     isLoading: 최초 로드 중 — 스켈레톤 UI. BUG-003 근본 해결. */
  const {
    items,
    totalQty,
    subtotal,
    shippingFee,
    totalPrice,
    isLoading: cartLoading,
  } = useCartQuery();
  /* clearCart 는 OrderCompletePage 에서 호출 (결제 성공 redirect 후) */

  /* ── 결제 단계 상태 (B-2) ──
     'form'    : 주문 정보 입력 단계
     'payment' : createOrder 성공 후 토스 결제위젯 단계
     결제 성공 → /order-complete 로 Toss 가 redirect
     결제 실패 → /checkout?error=payment_failed 로 돌아와 form 단계 유지 */
  const [step, setStep] = useState<'form' | 'payment'>('form');
  const [orderResult, setOrderResult] = useState<CreateOrderResponse | null>(null);

  /* ── Stage D-1 (BUG-006, 2026-04-24): Activity stale state guard ──
     cacheComponents 활성화로 /checkout 이 Activity 에 의해 hidden 상태로 보존됨.
     이전 결제 시도 후 cart 가 변경(품목·수량·로그아웃 후 재담기)되면 step='payment' +
     orderResult 가 stale 하게 유지되어 이전 금액이 Toss 위젯에 표시되는 UX 버그 발생.
     submit 시점의 cart signature 를 ref 에 기록하고, 이후 cart 가 달라지면
     step='form' 으로 자동 복귀한다. */
  const cartSig = useMemo(
    () => items.map((i) => `${i.slug}:${i.qty}`).sort().join('|'),
    [items],
  );
  const orderCartSigRef = useRef<string | null>(null);

  /* failUrl 로부터 돌아온 경우 안내 toast (마운트 1회) */
  const failNoticeShownRef = useRef(false);
  useEffect(() => {
    if (failNoticeShownRef.current) return;
    const error = searchParams.get('error');
    if (error === 'payment_failed') {
      failNoticeShownRef.current = true;
      toast('결제가 완료되지 않았습니다. 다시 시도해 주세요.');
    }
  }, [searchParams, toast]);

  /* ── 정기배송 여부 ── */
  const hasSubscription = useMemo(() => items.some((i) => i.type === 'subscription'), [items]);

  /* ── Toss orderName (B-2) ──
     영문 suffix 제거 후 20자 이내로 truncate.
     Toss UI가 ~25자 이상을 말줄임 없이 하드클립하므로 미리 자른다. */
  const orderName = useMemo(() => {
    if (items.length === 0) return '';
    const MAX_LEN = 20;
    const koreanOnly = (s: string) =>
      s.replace(/\s+[A-Za-z][A-Za-z\s]*$/, '').trim() || s.trim();
    const truncate = (s: string, max: number) =>
      s.length > max ? s.slice(0, max - 1) + '…' : s;
    const first = koreanOnly(items[0].name);
    const rest = items.length - 1;
    if (rest > 0) {
      const suffix = ` 외 ${rest}건`;
      return truncate(first, MAX_LEN - suffix.length) + suffix;
    }
    return truncate(first, MAX_LEN);
  }, [items]);

  /* ── 폼 훅 ── */
  const {
    form, errors, agreements, allAgreed, isFormRevealed,
    setField, toggleAgreement, toggleAllAgreements,
    revealForm, validate, clearErrors, blurEmail, blurPhone,
    reset: resetForm,
  } = useCheckoutForm();

  /* ── 로그인 유저 자동 진입 (BUG-003) ──
     서버 requireAuth() 통과 후에도 클라이언트가 게스트 UI 에 머무는 문제 해결.
     INITIAL_SESSION 수신 후 로그인 상태이면 이메일 prefill + 폼 reveal. */
  useEffect(() => {
    if (sessionLoading) return;
    if (!isLoggedIn || !user) return;
    if (isFormRevealed) return;
    if (user.email && !form.email) setField('email', user.email);
    revealForm();
  }, [sessionLoading, isLoggedIn, user, isFormRevealed, form.email, setField, revealForm]);

  /* ── 전화번호 ── */
  const { handleChangeValue: handlePhoneChange } = usePhoneFormat(
    useCallback((v: string) => setField('phone', v), [setField]),
  );

  /* ── 배송 메시지 드롭다운 ── */
  const chpFormRef = useRef<HTMLDivElement>(null);
  const chpNav = useInputNav(chpFormRef);

  /* ── 비밀번호 확인 필드 등장 ── */
  const showPw2 = form.guestPw.length >= GUEST_PASSWORD_MIN_LENGTH;

  /* 비밀번호 필드가 사라질 때 pw2 값·에러 초기화 — 이전 입력이 잔류하면
     다시 표시될 때 불일치 에러가 의도치 않게 나타날 수 있음 */
  useEffect(() => {
    if (!showPw2 && form.guestPw2) setField('guestPw2', '');
  }, [showPw2, form.guestPw2, setField]);

  /* ── 주소 검색 (Daum Postcode API) ── */
  const handleAddressSearch = useCallback(async () => {
    try {
      const result = await openPostcode();
      if (!result) return;
      setField('addr1', result.addr1);
      setField('zipcode', result.zipcode);
    } catch {
      toast('주소 검색을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.');
    }
  }, [setField, toast]);

  /* ── 비회원으로 주문하기 ──
     버튼 클릭 = 비회원 결제 flow 선언 + 폼 펼치기.
     이메일은 펼쳐진 2단계 폼의 email 필드에서 입력 받고, 최종 검증은
     "결제하기" 제출 시 validate(isLoggedIn=false) 가 일괄 수행.
     (이전 `handleEmailContinue` 는 이메일 빈 값일 때 silent return 하여
     버튼이 동작 안 함처럼 보이는 UX 버그 있었음 — 2026-04-23 수정) */
  const handleGuestContinue = useCallback(() => {
    revealForm();
  }, [revealForm]);

  /* ── 제출 상태 (중복 클릭 방지) ── */
  const [submitting, setSubmitting] = useState(false);

  /* ── submitting 무한 대기 복구 ──
     1단계 "결제하기" 성공 경로는 finally 에서 submitting=false 를 일부러 호출하지
     않음 (라우팅 중 가정). 그러나 2단계 → 1단계 복귀 / Toss 결제창 "이전" 후
     bfcache 복원 경로에서 submitting=true 가 남아 "주문 처리 중…" 버튼이
     무한 대기하던 버그 발생. onBack 콜백(아래 setStep('form') 옆)과
     pageshow persisted=true 두 경로 모두에서 복구한다. */
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setSubmitting(false);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  /* Stage D-1 통합 reset (BUG-006/161).
     user.id 변화 시: 비로그인→로그인 + 폼 닫힘 케이스만 resetForm 생략
     (login auto-fill 이 처리하므로). 그 외(로그아웃·계정전환·게스트폼 펼침)는 reset.
     cart 변화 시: 결제 시도 후(orderCartSigRef≠null)에만 step+form reset.
     상세 race 분석: docs/bug-and-polishing.md BUG-161 */
  const prevCartSigRef = useRef<string>(cartSig);
  const prevUserIdRef = useRef<string | null>(user?.id ?? null);
  useEffect(() => {
    const currentUserId = user?.id ?? null;
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
    } else if (cartChanged && orderCartSigRef.current !== null && orderCartSigRef.current !== cartSig) {
      setStep('form');
      setOrderResult(null);
      setSubmitting(false);
      /* S170: 로그인 사용자는 마이페이지 기본 배송지 prefill 미구현 상태이므로
         cart 변경 시 resetForm 호출하면 받는분/주소가 모두 비워져 재입력 부담.
         step 전환만 수행하고 입력값은 유지. 비로그인은 기존대로 게스트 데이터
         stale 정리를 위해 resetForm. address prefill 통합은 별 sprint
         (project_checkout_address_prefill.md) carry-over. */
      if (!isLoggedIn) resetForm();
      orderCartSigRef.current = null;
    }
  }, [cartSig, user?.id, isFormRevealed, isLoggedIn, resetForm]);

  /* 재진입 reset (BUG-112/161). 비로그인 케이스만 담당.
     로그인 케이스는 D-1 이 user.id 변화로 처리.
     sessionLoading 가드: isLoggedIn 확정 전 prev 갱신 보류 (race 완화).
     상세: docs/bug-and-polishing.md BUG-161 */
  const prevPathnameRef = useRef(pathname);
  useEffect(() => {
    if (sessionLoading) return;
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;
    if (prev !== '/checkout' && pathname === '/checkout' && !isLoggedIn) {
      resetForm();
    }
  }, [pathname, resetForm, isLoggedIn, sessionLoading]);

  /* ── 언마운트 감시 (Pass 1 CODE/H-1, M-11 공용 훅 추출)
     B-2 이후: step 전환은 이 컴포넌트가 살아 있으므로 언마운트 위험은 낮지만,
     비동기 완료 전 사용자가 뒤로가기로 이탈하는 케이스 대비 유지. */
  const isMountedRef = useIsMounted();

  /* ── 제출 ──
     Pass 1 CODE/H-1: try/finally + isMounted + navigated flag 로
     성공/실패/언마운트 경로 모두에서 submit 상태가 일관되게 복구.
  */
  const handleSubmit = useCallback(async () => {
    if (submitting) return;

    clearErrors();
    const ok = validate(isLoggedIn);
    if (!ok) {
      /* shake + 첫 에러 필드로 스크롤 + 포커스 */
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
    /* 성공 경로 여부 — finally 에서 버튼 복구를 스킵하기 위한 플래그 */
    let navigated = false;
    try {
      /* API 호출 — 서버가 가격·총액 재계산 후 order_number 발급 */
      /* Pass 1 CODE/H-3: agreement 하드코딩 제거 — 실제 체크 상태 전달 */
      const payload = buildOrderPayload(form, items, isLoggedIn, agreements);
      const result = await createOrder(payload);

      /* 주문 완료 페이지 표시용 요약 저장 (PII 제외) +
         security H-1/H-3: 게스트 주문은 confirm 시점에 소유권 교차검증을 위해
         이메일을 한 번 더 클라이언트로 전달해야 한다. 로그인 세션은 Supabase 쿠키
         (user_id) 로 소유권을 증명하므로 이메일을 저장하지 않는다.
         sessionStorage 는 탭 종료 시 자동 폐기되어 브라우저에 장기 체류하지 않음. */
      type StoredOrderSummary = {
        number: string;
        /** 서버 기준 주문 생성 시각 (ISO-8601). M-3 — timezone 일관성. */
        createdAt: string;
        /** 게스트 주문만 세팅. 로그인 사용자는 undefined. */
        guestEmail?: string;
        /** 이번 주문으로 생성된 정기배송 건수. 026 마이그레이션 기준. */
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

      /* B-2: 결제 단계로 전환 — 장바구니 비우기는 결제 성공 redirect 후
         OrderCompletePage 에서 처리 (결제 실패 시 cart 유지).
         Stage D-1: cart signature 기록 → 이후 변경 시 stale reset guard 발동. */
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
            /* CSRF 가드 차단 — 정상 사용자에겐 거의 발생하지 않음 */
            toast('요청이 차단되었습니다. 페이지를 새로고침해 주세요.');
            break;
          default:
            toast('주문 처리 중 오류가 발생했습니다.');
        }
      } else {
        toast('주문 처리 중 오류가 발생했습니다.');
      }
    } finally {
      /* 성공 경로는 이미 라우팅 중 → 버튼 유지.
         실패 경로에서만, 그리고 아직 마운트 상태일 때만 복구. */
      if (!navigated && isMountedRef.current) {
        setSubmitting(false);
      }
    }
    /* isMountedRef 는 ref — deps 불필요 (재생성 시 stale 위험 없음) */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitting, clearErrors, validate, isLoggedIn, form, items, agreements, toast]);

  /* ── 하이드레이션 대기 스켈레톤 ──
     ['cart'] 최초 로드 중엔 items 판정 불가. 미니 헤더만 그린다. */
  if (!mounted || cartLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh' }}>
        <MiniHeader atTop={atTop} />
      </div>
    );
  }

  /* ── 빈 장바구니 보호 ── */
  if (items.length === 0) {
    return <EmptyCart atTop={atTop} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh' }}>
      <MiniHeader atTop={atTop} cartCount={totalQty} onCartClick={openDrawer} />

      {/* ── 2열 바디 ── */}
      <div className="chp-body">
        {/* ── 좌측 폼 ── */}
        <div className="chp-left" ref={chpFormRef}>
        {step === 'form' && (
          <>
            <ContactSection
              email={form.email}
              emailError={errors.email}
              isFormRevealed={isFormRevealed}
              isLoggedIn={isLoggedIn}
              sessionLoading={sessionLoading}
              onChangeEmail={(v) => setField('email', v)}
              onClearEmail={() => setField('email', '')}
              onBlurEmail={blurEmail}
              onKeyDown={chpNav}
              onGuestContinue={handleGuestContinue}
            />

            {/* 배송지 이하 — 이메일 확인 후 표시 */}
            {isFormRevealed && (
              <>
                <AddressSection
                  form={form}
                  errors={errors}
                  onChange={setField}
                  onPhoneChange={handlePhoneChange}
                  onBlurPhone={blurPhone}
                  onKeyDown={chpNav}
                  onAddressSearch={handleAddressSearch}
                />

                {!isLoggedIn && (
                  <GuestPasswordSection
                    pw={form.guestPw}
                    pw2={form.guestPw2}
                    pwError={errors.guestPw}
                    pw2Error={errors.guestPw2}
                    showPw2={showPw2}
                    onChangePw={(v) => setField('guestPw', v)}
                    onClearPw={() => setField('guestPw', '')}
                    onChangePw2={(v) => setField('guestPw2', v)}
                    onClearPw2={() => setField('guestPw2', '')}
                    onKeyDown={chpNav}
                  />
                )}

                <AgreementSection
                  agreements={agreements}
                  allAgreed={allAgreed}
                  agreementError={errors.agreement}
                  onToggle={toggleAgreement}
                  onToggleAll={toggleAllAgreements}
                />

                {/* 결제하기 버튼 */}
                <button
                  className="chp-submit-btn"
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  aria-busy={submitting}
                  data-gtr-tap
                >
                  {submitting ? '주문 처리 중…' : '결제하기'}
                </button>

                {/* 정기배송 안내 */}
                {hasSubscription && (
                  <div className="chp-legal-note">
                    <InfoCircleIcon size={18} />
                    <span>정기배송 상품이 포함되어 있습니다. 결제 후 설정된 주기에 따라 자동으로 결제되며, 정기배송은 마이페이지에서 언제든지 일시정지하거나 재개 또는 취소하실 수 있습니다.</span>
                  </div>
                )}

                {/* 법적 링크 */}
                <div className="chp-legal-links">
                  <span className="chp-legal-link">배송 안내</span>
                  <span className="chp-legal-link">개인정보처리방침</span>
                  <span className="chp-legal-link">이용약관</span>
                  <span className="chp-legal-link">전자상거래 법률 고지</span>
                  <span className="chp-legal-link">취소·반품 안내</span>
                </div>
              </>
            )}
          </>
        )}

        {step === 'payment' && orderResult && (
          <CheckoutPayment
            orderNumber={orderResult.orderNumber}
            orderName={orderName}
            amount={orderResult.totalAmount}
            customerEmail={form.email.trim().toLowerCase()}
            customerName={form.firstname.trim()}
            customerMobilePhone={(() => {
              const digits = form.phone.replace(/\D/g, '');
              /* 한국 휴대폰 10~11자리만 Toss 에 전달 (형식 위반 시 Toss 오류) */
              return digits.length >= 10 && digits.length <= 11 ? digits : undefined;
            })()}
            onBack={() => { setStep('form'); setSubmitting(false); }}
          />
        )}
        </div>

        <OrderSummary
          items={items}
          totalQty={totalQty}
          subtotal={subtotal}
          shippingFee={shippingFee}
          totalPrice={totalPrice}
          hasSubscription={hasSubscription}
        />
      </div>
    </div>
  );
}
