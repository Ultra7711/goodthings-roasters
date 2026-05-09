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
   7. PR-2 (S171): 단계·제출·리셋 로직 → useCheckoutFlow 추출
      → 본 컴포넌트는 UI orchestrator 역할.
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCheckoutForm } from '@/hooks/useCheckoutForm';
import { useCheckoutFlow } from '@/hooks/useCheckoutFlow';
import { useAtTop } from '@/hooks/useAtTop';
import { usePhoneFormat } from '@/hooks/usePhoneFormat';
import { openPostcode, preloadPostcode } from '@/lib/daumPostcode';
import { useInputNav } from '@/hooks/useInputNav';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { useCartQuery } from '@/hooks/useCart';
import { useDefaultAddressQuery } from '@/hooks/useDefaultAddress';
import { useCartDrawer } from '@/contexts/CartDrawerContext';
import { useToast } from '@/hooks/useToast';
import { GUEST_PASSWORD_MIN_LENGTH } from '@/lib/validation';
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
  const { show: toast } = useToast();
  const { isLoggedIn, isLoading: sessionLoading, user } = useSupabaseSession();
  const { open: openDrawer } = useCartDrawer();
  const atTop = useAtTop();

  /* ── 마운트 가드: SSR/클라이언트 초기 렌더 일치 (hydration mismatch 방지) */
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => { preloadPostcode(); }, []);

  /* ── 장바구니 (ADR-004 Step B: TanStack Query) ── */
  const {
    items,
    totalQty,
    subtotal,
    shippingFee,
    totalPrice,
    isLoading: cartLoading,
  } = useCartQuery();

  /* ── cart signature — D-1 stale guard 용 (useCheckoutFlow 에 전달) ── */
  const cartSig = useMemo(
    () => items.map((i) => `${i.slug}:${i.qty}`).sort().join('|'),
    [items],
  );

  /* ── 정기배송 여부 ── */
  const hasSubscription = useMemo(() => items.some((i) => i.type === 'subscription'), [items]);

  /* ── Toss orderName (B-2) ──
     영문 suffix 제거 후 20자 이내로 truncate. */
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

  /* ── 기본 배송지 (S174): 로그인 사용자만 fetch. 게스트는 항상 null ── */
  const { data: defaultAddress } = useDefaultAddressQuery();

  /* ── 로그인 유저 자동 진입 (BUG-003) + 기본 배송지 pre-fill (S174)
     - email: 빈 상태일 때만 채움 (사용자 수정 보존)
     - address 5필드: 모두 빈 상태일 때만 일괄 채움 (덮어쓰기 가드).
       사용자가 한 필드라도 수정한 후 재진입해도 덮어쓰지 않음. */
  useEffect(() => {
    if (sessionLoading) return;
    if (!isLoggedIn || !user) return;
    if (isFormRevealed) return;

    if (user.email && !form.email) setField('email', user.email);

    if (
      defaultAddress &&
      !form.firstname &&
      !form.phone &&
      !form.zipcode &&
      !form.addr1 &&
      !form.addr2
    ) {
      setField('firstname', defaultAddress.name);
      setField('phone', defaultAddress.phone);
      setField('zipcode', defaultAddress.zipcode);
      setField('addr1', defaultAddress.addr1);
      setField('addr2', defaultAddress.addr2);
    }

    revealForm();
  }, [
    sessionLoading,
    isLoggedIn,
    user,
    isFormRevealed,
    form.email,
    form.firstname,
    form.phone,
    form.zipcode,
    form.addr1,
    form.addr2,
    defaultAddress,
    setField,
    revealForm,
  ]);

  /* ── 전화번호 ── */
  const { handleChangeValue: handlePhoneChange } = usePhoneFormat(
    useCallback((v: string) => setField('phone', v), [setField]),
  );

  /* ── 배송 메시지 드롭다운 ── */
  const chpFormRef = useRef<HTMLDivElement>(null);
  const chpNav = useInputNav(chpFormRef);

  /* ── 비밀번호 확인 필드 등장 ── */
  const showPw2 = form.guestPw.length >= GUEST_PASSWORD_MIN_LENGTH;

  /* 비밀번호 필드가 사라질 때 pw2 값·에러 초기화 */
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

  /* ── 비회원으로 주문하기 ── */
  const handleGuestContinue = useCallback(() => {
    revealForm();
  }, [revealForm]);

  /* ── 결제 단계 · 제출 · 리셋 가드 ── */
  const { step, orderResult, submitting, handleSubmit, handleBack } = useCheckoutFlow({
    cartSig,
    userId: user?.id,
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
    cartSubtotal: subtotal,
    cartShippingFee: shippingFee,
    cartTotalPrice: totalPrice,
  });

  /* ── 하이드레이션 대기 스켈레톤 ── */
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
              return digits.length >= 10 && digits.length <= 11 ? digits : undefined;
            })()}
            onBack={handleBack}
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
