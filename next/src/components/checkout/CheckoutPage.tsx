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
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useCheckoutForm } from '@/hooks/useCheckoutForm';
import { useAtTop } from '@/hooks/useAtTop';
import { useIsMounted } from '@/hooks/useIsMounted';
import { usePhoneFormat } from '@/hooks/usePhoneFormat';
import { openPostcode } from '@/lib/daumPostcode';
import { useInputNav } from '@/hooks/useInputNav';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { useCartQuery } from '@/hooks/useCart';
import { useCartDrawer } from '@/contexts/CartDrawerContext';
import { useToast } from '@/hooks/useToast';
import { extractKrName, formatPrice } from '@/lib/utils';
import { shakeFields } from '@/lib/shakeFields';
import { TextField } from '@/components/ui/TextField';
import { SearchIcon } from '@/components/ui/InputIcons';
import type { PaymentMethod } from '@/types/checkout';
import {
  buildOrderPayload,
  createOrder,
  OrderApiError,
  type CreateOrderResponse,
} from '@/lib/api/orderClient';
import CheckoutPayment from './CheckoutPayment';

/* ── 배송 메시지 옵션 ── */
const DELIVERY_OPTIONS = [
  { value: '경비실', label: '부재 시 경비실에 맡겨 주세요.' },
  { value: '문앞', label: '부재 시 문 앞에 놓아 주세요.' },
  { value: '택배함', label: '부재 시 택배함에 넣어 주세요.' },
  { value: '직접수령', label: '직접 받겠습니다. 배송 전 연락 부탁드립니다.' },
  { value: '파손주의', label: '파손 위험 상품입니다. 취급에 주의해 주세요.' },
  { value: 'direct', label: '직접 입력' },
] as const;

/* ── 은행 목록 ── */
const BANKS = ['국민은행', '신한은행', '우리은행', '하나은행', '기업은행', '농협은행', '카카오뱅크', '토스뱅크'] as const;

/* ── SVG 아이콘 ── */
function ChevronDown({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6,9l6,6,6-6" />
    </svg>
  );
}

function ChevronRight({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9,18l6-6-6-6" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="chp-card-notice-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" /><path d="M12,16v-4" /><path d="M12,8h0" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg className="hi" viewBox="0 1 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 24, height: 24 }}>
      <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}

function CheckboxIcon({ checked }: { checked: boolean }) {
  if (checked) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <polyline points="9 11 12 14 22 4" />
      </svg>
    );
  }
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    </svg>
  );
}

/* ══════════════════════════════════════════ */
export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const { show: toast } = useToast();
  const { isLoggedIn, isLoading: sessionLoading, user } = useSupabaseSession();
  const { open: openDrawer } = useCartDrawer();
  const atTop = useAtTop();

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
     상품 1건 → 상품명 그대로, 여러 건 → "상품명 외 N건" */
  const orderName = useMemo(() => {
    if (items.length === 0) return '';
    const first = items[0];
    const rest = items.length - 1;
    return rest > 0 ? `${first.name} 외 ${rest}건` : first.name;
  }, [items]);

  /* ── 폼 훅 ── */
  const {
    form, errors, agreements, allAgreed, isFormRevealed,
    setField, setPaymentMethod, toggleAgreement, toggleAllAgreements,
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
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const deliveryRef = useRef<HTMLDivElement>(null);
  const chpFormRef = useRef<HTMLDivElement>(null);
  const chpNav = useInputNav(chpFormRef);
  const deliveryLabel = useMemo(() => {
    if (form.deliveryMessage === 'direct') return '직접 입력';
    const opt = DELIVERY_OPTIONS.find((o) => o.value === form.deliveryMessage);
    return opt?.label ?? '';
  }, [form.deliveryMessage]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (deliveryRef.current && !deliveryRef.current.contains(e.target as Node)) {
        setDeliveryOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  /* ── 비밀번호 확인 필드 등장 ── */
  const showPw2 = form.guestPw.length >= 4;

  /* ── 결제수단 전환 fade ── */
  const [payFade, setPayFade] = useState(false);
  const payFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlePaymentSwitch = useCallback((method: PaymentMethod) => {
    if (method === form.paymentMethod) return;
    setPaymentMethod(method);
    setPayFade(true);
    if (payFadeTimerRef.current) clearTimeout(payFadeTimerRef.current);
    payFadeTimerRef.current = setTimeout(() => setPayFade(false), 260);
  }, [form.paymentMethod, setPaymentMethod]);
  useEffect(() => () => { if (payFadeTimerRef.current) clearTimeout(payFadeTimerRef.current); }, []);

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

  /* ── bank select ── */
  const handleBankChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setField('bankName', e.target.value);
  }, [setField]);

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

  /* ── Stage D-1 통합 reset (BUG-006, 2026-04-24) ──
     cacheComponents 활성화로 /checkout 이 Activity hidden 상태로 보존되는 이슈 대응.
     pageshow 이벤트는 Activity 내부 네비게이션에서 발생하지 않으므로
     독립적 감지 경로가 필요하다.

     정책:
     - 로그인 상태 변경 (user.id 변경) → 전체 reset (form 포함).
       로그인→로그아웃 시 개인정보(주소·연락처) 게스트 모드 유출 방지.
     - cart 변경 + orderResult 존재 → 결제 state reset (form 유지).
       이전 주문의 step='payment' · submitting · orderResult 가 stale 유지되어
       잘못된 금액이 Toss 위젯에 표시되는 문제 해결. */
  const prevCartSigRef = useRef<string>(cartSig);
  const prevUserIdRef = useRef<string | null>(user?.id ?? null);
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    const cartChanged = prevCartSigRef.current !== cartSig;
    const userChanged = prevUserIdRef.current !== currentUserId;

    if (!cartChanged && !userChanged) return;

    prevCartSigRef.current = cartSig;
    prevUserIdRef.current = currentUserId;

    if (userChanged) {
      setStep('form');
      setOrderResult(null);
      setSubmitting(false);
      resetForm();
      orderCartSigRef.current = null;
    } else if (cartChanged && orderCartSigRef.current !== null && orderCartSigRef.current !== cartSig) {
      setStep('form');
      setOrderResult(null);
      setSubmitting(false);
      orderCartSigRef.current = null;
    }
  }, [cartSig, user?.id, resetForm]);

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
      /* shake + 첫 에러 필드로 스크롤 */
      shakeFields(chpFormRef.current);
      const firstErr = chpFormRef.current?.querySelector('.chp-field.input-warn');
      if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
            /* product_not_found / volume_not_found / volume_sold_out */
            toast('상품 정보가 변경되었습니다. 장바구니를 확인해 주세요.');
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
  if (cartLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        <div
          className={`chp-hdr-wrap${atTop ? ' hdr-at-top' : ''}`}
          style={{
            backdropFilter: atTop ? 'none' : 'blur(16px)',
            WebkitBackdropFilter: atTop ? 'none' : 'blur(16px)',
          }}
        >
          <div className="chp-hdr-inner">
            <Link href="/">
              <Image src="/images/icons/logo.svg" alt="GOOD THINGS" width={150} height={30} className="chp-logo-img" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── 빈 장바구니 보호 ── */
  if (items.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        <div
          className={`chp-hdr-wrap${atTop ? ' hdr-at-top' : ''}`}
          style={{
            backdropFilter: atTop ? 'none' : 'blur(16px)',
            WebkitBackdropFilter: atTop ? 'none' : 'blur(16px)',
          }}
        >
          <div className="chp-hdr-inner">
            <Link href="/">
              <Image src="/images/icons/logo.svg" alt="GOOD THINGS" width={150} height={30} className="chp-logo-img" />
            </Link>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24, padding: '80px 60px' }}>
          <p style={{ fontFamily: 'var(--font-kr)', fontSize: 'var(--type-body-l-size)', color: 'var(--color-text-secondary)' }}>
            장바구니가 비어 있습니다.
          </p>
          <Link href="/shop" className="ocp-btn-primary" style={{ maxWidth: 280, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            쇼핑하러 가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      {/* ── 미니 헤더 ── */}
      <div
          className={`chp-hdr-wrap${atTop ? ' hdr-at-top' : ''}`}
          style={{
            backdropFilter: atTop ? 'none' : 'blur(16px)',
            WebkitBackdropFilter: atTop ? 'none' : 'blur(16px)',
          }}
        >
        <div className="chp-hdr-inner">
          <Link href="/">
            <Image src="/images/icons/logo.svg" alt="GOOD THINGS" width={150} height={30} className="chp-logo-img" />
          </Link>
          <button
            type="button"
            className="hdr-icon-btn"
            style={{ position: 'relative' }}
            aria-label="장바구니"
            onClick={openDrawer}
          >
            <CartIcon />
            {totalQty > 0 && <span className="cart-badge visible">{totalQty}</span>}
          </button>
        </div>
      </div>

      {/* ── 2열 바디 ── */}
      <div className="chp-body">
        {/* ── 좌측 폼 ── */}
        <div className="chp-left" ref={chpFormRef}>
        {step === 'form' && (
          <>
          {/* 연락처 */}
          <div className="chp-section">
            <div className="chp-section-header">
              <h2 className="chp-section-title">연락처</h2>
            </div>
            <TextField
              type="email"
              label="이메일 주소"
              value={form.email}
              onChange={(v) => setField('email', v)}
              onClear={() => setField('email', '')}
              onBlur={blurEmail}
              onKeyDown={chpNav}
              error={errors.email}
              helper="이메일 주소를 입력하세요."
            />
            {!isFormRevealed && (
              <>
                <Link href="/login?from=checkout" className="chp-login-primary-btn">
                  로그인하고 주문하기
                </Link>
                <p className="chp-login-benefit">로그인하면 배송지 정보가 자동으로 채워집니다.</p>
                <div className="chp-guest-link-wrap">
                  <button className="chp-guest-link" type="button" onClick={handleGuestContinue}>
                    비회원으로 주문하기
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 배송지 이하 — 이메일 확인 후 표시 */}
          {isFormRevealed && (
            <>
              {/* 배송지 */}
              <div className="chp-section chp-section--no-border">
                <h2 className="chp-section-title">배송지</h2>
                {/* 받는 분 */}
                <TextField
                  label="받는 분"
                  value={form.firstname}
                  onChange={(v) => setField('firstname', v)}
                  onClear={() => setField('firstname', '')}
                  onKeyDown={chpNav}
                  error={errors.firstname}
                  helper="받는 분의 이름을 입력하세요."
                />
                {/* 전화번호 */}
                <TextField
                  type="tel"
                  label="전화번호"
                  value={form.phone}
                  onChange={handlePhoneChange}
                  onClear={() => setField('phone', '')}
                  onBlur={blurPhone}
                  onKeyDown={chpNav}
                  error={errors.phone}
                  helper="하이픈이 자동으로 입력됩니다."
                />
                {/* 주소 */}
                <div className="chp-addr-inline">
                  <TextField
                    label="주소 검색"
                    readOnly
                    style={{ cursor: 'pointer', paddingRight: 36 }}
                    value={form.addr1}
                    onChange={() => { /* readOnly */ }}
                    onClick={handleAddressSearch}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddressSearch(); } }}
                    wrapperClass={form.addr1 ? 'has-value' : ''}
                    customAction={
                      <button className="chp-addr-search-btn" type="button" title="주소 검색" onClick={handleAddressSearch}>
                        <SearchIcon />
                      </button>
                    }
                    error={errors.addr1}
                    helper="주소를 검색해 주세요."
                  />
                  <TextField
                    label="우편번호"
                    maxLength={5}
                    inputMode="numeric"
                    value={form.zipcode}
                    onChange={(v) => setField('zipcode', v.replace(/\D/g, ''))}
                    onKeyDown={chpNav}
                    hideClear
                    helper="주소 검색 시 자동 입력됩니다."
                  />
                </div>
                {/* 상세주소 — 주소 입력 후 표시 */}
                {form.addr1 && (
                  <TextField
                    label="상세주소"
                    value={form.addr2}
                    onChange={(v) => setField('addr2', v)}
                    onClear={() => setField('addr2', '')}
                    onKeyDown={chpNav}
                    helper="동·호수 등 상세주소를 입력하세요."
                  />
                )}
                {/* 배송 메시지 드롭다운 */}
                <div
                  ref={deliveryRef}
                  className={`chp-field chp-dropdown-field${deliveryOpen ? ' open' : ''}${form.deliveryMessage ? ' has-value' : ''}`}
                >
                  <button
                    className="chp-dropdown-trigger" type="button"
                    onClick={() => setDeliveryOpen((p) => !p)}
                  >
                    <span className="chp-dropdown-value">{deliveryLabel}</span>
                    <span className="chp-dropdown-arrow" aria-hidden="true"><ChevronDown /></span>
                  </button>
                  <label className="chp-floating-label">배송 메시지 (선택사항)</label>
                  <div className="chp-dropdown-list">
                    <div className="chp-dropdown-title">배송 메시지 선택</div>
                    {DELIVERY_OPTIONS.map((opt) => (
                      <div
                        key={opt.value}
                        className={`chp-dropdown-option${form.deliveryMessage === opt.value ? ' active' : ''}`}
                        onClick={() => {
                          setField('deliveryMessage', opt.value);
                          setDeliveryOpen(false);
                        }}
                      >
                        {opt.label}
                      </div>
                    ))}
                  </div>
                </div>
                {/* 직접 입력 */}
                {form.deliveryMessage === 'direct' && (
                  <TextField
                    label="배송 메시지를 입력해 주세요."
                    value={form.deliveryCustom}
                    onChange={(v) => setField('deliveryCustom', v)}
                    onClear={() => setField('deliveryCustom', '')}
                    onKeyDown={chpNav}
                  />
                )}
              </div>

              {/* 비회원 주문조회 비밀번호 */}
              {!isLoggedIn && (
                <div className="chp-section chp-section--no-border chp-section--guest">
                  <h2 className="chp-section-title">비회원 주문조회 비밀번호</h2>
                  <p className="chp-section-desc">비회원 주문 조회 시 주문번호와 입력하신 비밀번호가 필요합니다.</p>
                  <TextField
                    type="password"
                    label="비밀번호"
                    value={form.guestPw}
                    onChange={(v) => setField('guestPw', v)}
                    onClear={() => setField('guestPw', '')}
                    onKeyDown={chpNav}
                    showPasswordToggle
                    error={errors.guestPw}
                    helper="4자 이상 입력해 주세요."
                  />
                  <TextField
                    type="password"
                    label="비밀번호 확인"
                    disabled={!showPw2}
                    value={form.guestPw2}
                    onChange={(v) => setField('guestPw2', v)}
                    onClear={() => setField('guestPw2', '')}
                    onKeyDown={chpNav}
                    showPasswordToggle
                    error={errors.guestPw2}
                    helper="비밀번호를 한 번 더 입력하세요."
                    wrapperClass={`pw2-field${showPw2 ? ' pw2-visible' : ''}`}
                  />
                </div>
              )}

              {/* 결제수단 */}
              <div className="chp-section chp-section--no-border">
                <h2 className="chp-section-title">결제수단</h2>
                <div className="chp-payment-methods">
                  <div className={`chp-payment-indicator${form.paymentMethod === 'transfer' ? ' to-transfer' : ''}`} />
                  <div className={`chp-payment-item${form.paymentMethod === 'card' ? ' active' : ''}`}>
                    <label className="chp-payment-method">
                      <input type="radio" name="chp-payment" value="card" checked={form.paymentMethod === 'card'} onChange={() => handlePaymentSwitch('card')} />
                      <span>체크 / 신용카드</span>
                    </label>
                  </div>
                  <div className={`chp-payment-item${form.paymentMethod === 'transfer' ? ' active' : ''}`}>
                    <label className="chp-payment-method">
                      <input type="radio" name="chp-payment" value="transfer" checked={form.paymentMethod === 'transfer'} onChange={() => handlePaymentSwitch('transfer')} />
                      <span>계좌이체 / 무통장입금</span>
                    </label>
                  </div>
                </div>

                {/* 카드 안내 */}
                {form.paymentMethod === 'card' && (
                  <div className={`chp-payment-detail${payFade ? ' fade-in' : ''}`}>
                    <p className="chp-card-notice">
                      <InfoIcon />
                      결제하기 버튼 클릭 시 카드 정보를 입력합니다.
                    </p>
                  </div>
                )}

                {/* 계좌이체 */}
                {form.paymentMethod === 'transfer' && (
                  <div className={`chp-payment-detail${payFade ? ' fade-in' : ''}`}>
                    <div className={`chp-field${form.bankName ? ' has-value' : ''}${errors.bankName ? ' input-warn' : ''}`}>
                      <select
                        className="chp-input chp-select"
                        value={form.bankName}
                        onChange={handleBankChange}
                      >
                        <option value="" disabled hidden />
                        {BANKS.map((b) => <option key={b}>{b}</option>)}
                      </select>
                      <label className="chp-floating-label">입금은행</label>
                      <div className="chp-error-msg">{errors.bankName}</div>
                    </div>
                    <TextField
                      label="입금자명"
                      value={form.depositorName}
                      onChange={(v) => setField('depositorName', v)}
                      onClear={() => setField('depositorName', '')}
                      onKeyDown={chpNav}
                      error={errors.depositorName}
                      helper="입금자명을 입력하세요."
                    />
                  </div>
                )}
              </div>

              {/* 약관 동의 */}
              <div className={`chp-section chp-section--no-border chp-agree-section${errors.agreement ? ' error' : ''}`}>
                <label className="chp-agree-all-row" onClick={(e) => { e.preventDefault(); toggleAllAgreements(); }}>
                  <input type="checkbox" checked={allAgreed} readOnly />
                  <span className={`chp-check-icon${allAgreed ? ' checked' : ''}`}>
                    <CheckboxIcon checked={allAgreed} />
                  </span>
                  <span className="chp-agree-all-label">모든 약관 동의</span>
                </label>
                <div className="chp-agree-items">
                  {['[필수] 쇼핑몰 이용약관 동의', '[필수] 개인정보 수집 및 이용 동의'].map((label, idx) => (
                    <label key={idx} className="chp-agree-item" onClick={(e) => { e.preventDefault(); toggleAgreement(idx); }}>
                      <input type="checkbox" checked={agreements[idx]} readOnly />
                      <span className={`chp-check-icon${agreements[idx] ? ' checked' : ''}`}>
                        <CheckboxIcon checked={agreements[idx]} />
                      </span>
                      <span className="chp-agree-item-label">{label}</span>
                      <span className="chp-agree-arrow" aria-hidden="true"><ChevronRight /></span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 결제하기 버튼 */}
              <button
                className="chp-submit-btn"
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                aria-busy={submitting}
              >
                {submitting ? '주문 처리 중…' : '결제하기'}
              </button>

              {/* 정기배송 안내 */}
              {hasSubscription && (
                <p className="chp-legal-note">
                  정기배송 상품이 포함되어 있습니다. 결제 후 설정된 주기에 따라 자동으로 결제되며, 정기배송은 마이페이지에서 언제든지 취소하실 수 있습니다.
                </p>
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
            customerEmail={form.email.trim()}
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

        {/* ── 우측 주문 요약 ── */}
        <div className="chp-right">
          <div className="chp-right-title">주문 요약</div>
          <div>
            {items.map((item) => (
              <div key={item.id} className="chp-sum-item">
                <div className="chp-sum-item-img-wrap">
                  <div className="chp-sum-item-img" style={{ background: item.color }}>
                    {item.image && (
                      <Image src={item.image} alt={item.name} width={56} height={56} style={{ objectFit: 'contain' }} />
                    )}
                  </div>
                </div>
                <div className="chp-sum-item-info">
                  <div className="chp-sum-item-name">{extractKrName(item.name)}</div>
                  <span className="chp-sum-item-qty-txt">× {item.qty}</span>
                </div>
                <div className="chp-sum-item-price">{formatPrice(item.priceNum * item.qty)}</div>
              </div>
            ))}
          </div>

          <div className="chp-summary-totals">
            <div className="chp-sum-row">
              <span>상품 금액 · 총 {totalQty}개 상품</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="chp-sum-row">
              <span>배송비</span>
              <span>{shippingFee === 0 ? '무료' : formatPrice(shippingFee)}</span>
            </div>
            <div className="chp-sum-total-row">
              <span>결제예정금액</span>
              <span>{formatPrice(totalPrice)}</span>
            </div>
            <div className="chp-tax-note">부가세 포함</div>
            {hasSubscription && (
              <div className="chp-sum-sub-block">
                <span>정기배송 금액</span>
                <span>
                  {formatPrice(items.filter((i) => i.type === 'subscription').reduce((s, i) => s + i.priceNum * i.qty, 0))}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
