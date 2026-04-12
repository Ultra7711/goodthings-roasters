/* ══════════════════════════════════════════
   CheckoutPage — /checkout
   프로토타입 #checkout-page 이식 (RP-7).

   설계 결정:
   1. chp-* 클래스: BizInquiryPage 의 bi-* 와 동일 격리 원칙으로
      프로토타입 원본 클래스명 유지 (globals.css 에 정의).
   2. 폼 상태: useCheckoutForm 훅 (types/checkout.ts 기반)
   3. 장바구니: useCartStore (Zustand)
   4. 결제: 데모 단계 — submit 시 OrderComplete 이동 (Phase 2-F 토스페이먼츠 연동)
   5. Daum 주소 검색: 외부 스크립트 동적 로드 (Phase 2-F)
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useCheckoutForm } from '@/hooks/useCheckoutForm';
import { usePhoneFormat } from '@/hooks/usePhoneFormat';
import { useCartStore, useAuthStore, FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from '@/lib/store';
import { useToast } from '@/hooks/useToast';
import { formatPrice } from '@/lib/utils';
import type { PaymentMethod } from '@/types/checkout';

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
function ChevronDown({ size = 20 }: { size?: number }) {
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

function SearchIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <circle cx="7" cy="7" r="4.5" /><line x1="10.5" y1="10.5" x2="14" y2="14" />
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
    <svg className="hi" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 24, height: 24 }}>
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
  const router = useRouter();
  const { show: toast } = useToast();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  /* ── 장바구니 ── */
  const items = useCartStore((s) => s.items);
  const totalQty = useCartStore((s) => s.totalQty);
  const subtotal = useCartStore((s) => s.subtotal);
  const shippingFee = useCartStore((s) => s.shippingFee);
  const totalPrice = useCartStore((s) => s.totalPrice);
  const clearCart = useCartStore((s) => s.clearCart);

  /* ── 정기배송 여부 ── */
  const hasSubscription = useMemo(() => items.some((i) => i.type === 'subscription'), [items]);

  /* ── 폼 훅 ── */
  const {
    form, errors, agreements, allAgreed, isFormRevealed,
    setField, setPaymentMethod, toggleAgreement, toggleAllAgreements,
    revealForm, validate, clearErrors,
  } = useCheckoutForm();

  /* ── 전화번호 ── */
  const { handleChange: handlePhoneChange } = usePhoneFormat(
    useCallback((v: string) => setField('phone', v), [setField]),
  );

  /* ── 배송 메시지 드롭다운 ── */
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const deliveryRef = useRef<HTMLDivElement>(null);
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
  const handlePaymentSwitch = useCallback((method: PaymentMethod) => {
    if (method === form.paymentMethod) return;
    setPaymentMethod(method);
    setPayFade(true);
    const t = setTimeout(() => setPayFade(false), 260);
    return () => clearTimeout(t);
  }, [form.paymentMethod, setPaymentMethod]);

  /* ── 주소 검색 (데모: 더미 데이터) ── */
  const handleAddressSearch = useCallback(() => {
    /* Phase 2-F: Daum Postcode API 연동
       현재는 데모 데이터로 채움 */
    setField('addr1', '서울특별시 강남구 테헤란로 427');
    setField('zipcode', '06159');
    toast('주소가 입력되었습니다.');
  }, [setField, toast]);

  /* ── bank select ── */
  const handleBankChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setField('bankName', e.target.value);
  }, [setField]);

  /* ── 이메일 계속하기 ── */
  const handleEmailContinue = useCallback(() => {
    if (!form.email.trim()) {
      /* 에러 표시는 validate 에서 처리 */
      return;
    }
    revealForm();
  }, [form.email, revealForm]);

  /* ── 제출 ── */
  const handleSubmit = useCallback(() => {
    clearErrors();
    const ok = validate(isLoggedIn);
    if (!ok) {
      /* 첫 에러 필드로 스크롤 */
      const firstErr = document.querySelector('.chp-field.error');
      if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    /* 데모: 주문번호 생성 후 주문완료 이동 */
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const seq = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
    const orderNumber = `GT-${ymd}-${seq}`;

    /* sessionStorage에 주문 정보 저장 (order-complete에서 읽음) */
    sessionStorage.setItem('gtr-last-order', JSON.stringify({
      number: orderNumber,
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
    }));

    clearCart();
    router.push('/order-complete');
  }, [clearErrors, validate, isLoggedIn, items, clearCart, router]);

  /* ── 빈 장바구니 보호 ── */
  if (items.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        <div className="chp-hdr-wrap" style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
          <div className="chp-hdr-inner">
            <Link href="/">
              <Image src="/images/icons/logo.svg" alt="GOOD THINGS" width={140} height={28} className="chp-logo-img" />
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
      <div className="chp-hdr-wrap" style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
        <div className="chp-hdr-inner">
          <Link href="/">
            <Image src="/images/icons/logo.svg" alt="GOOD THINGS" width={140} height={28} className="chp-logo-img" />
          </Link>
          <span className="hdr-icon-btn" style={{ position: 'relative' }}>
            <CartIcon />
            {totalQty() > 0 && <span className="cart-badge">{totalQty()}</span>}
          </span>
        </div>
      </div>

      {/* ── 2열 바디 ── */}
      <div className="chp-body">
        {/* ── 좌측 폼 ── */}
        <div className="chp-left">
          {/* 연락처 */}
          <div className="chp-section">
            <div className="chp-section-header">
              <h2 className="chp-section-title">연락처</h2>
            </div>
            <div className={`chp-field${errors.email ? ' error' : ''}`}>
              <input
                className="chp-input" type="email" placeholder=" "
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
              />
              <label className="chp-floating-label">이메일 주소</label>
              <div className="chp-error-msg">{errors.email}</div>
            </div>
            {!isFormRevealed && (
              <>
                <Link href="/login?from=checkout" className="chp-login-primary-btn">
                  로그인하고 주문하기
                </Link>
                <p className="chp-login-benefit">로그인하면 배송지 정보가 자동으로 채워집니다.</p>
                <div className="chp-guest-link-wrap">
                  <button className="chp-guest-link" type="button" onClick={handleEmailContinue}>
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
              <div className="chp-section">
                <h2 className="chp-section-title">배송지</h2>
                {/* 받는 분 */}
                <div className={`chp-field${errors.firstname ? ' error' : ''}`}>
                  <input
                    className="chp-input" type="text" placeholder=" "
                    value={form.firstname}
                    onChange={(e) => setField('firstname', e.target.value)}
                  />
                  <label className="chp-floating-label">받는 분</label>
                  <div className="chp-error-msg">{errors.firstname}</div>
                </div>
                {/* 전화번호 */}
                <div className={`chp-field${errors.phone ? ' error' : ''}`}>
                  <input
                    className="chp-input" type="tel" placeholder=" "
                    value={form.phone}
                    onChange={handlePhoneChange}
                  />
                  <label className="chp-floating-label">전화번호</label>
                  <div className="chp-error-msg">{errors.phone}</div>
                </div>
                {/* 주소 */}
                <div className="chp-addr-inline">
                  <div className={`chp-field${errors.addr1 ? ' error' : ''}${form.addr1 ? ' has-value' : ''}`}>
                    <input
                      className="chp-input" type="text" placeholder=" " readOnly
                      value={form.addr1}
                      style={{ cursor: 'pointer', paddingRight: 36 }}
                      onClick={handleAddressSearch}
                    />
                    <label className="chp-floating-label">주소 검색</label>
                    <button className="chp-addr-search-btn" type="button" title="주소 검색" onClick={handleAddressSearch}>
                      <SearchIcon />
                    </button>
                    <div className="chp-error-msg">{errors.addr1}</div>
                  </div>
                  <div className="chp-field">
                    <input
                      className="chp-input" type="text" placeholder=" " maxLength={5} inputMode="numeric"
                      value={form.zipcode}
                      onChange={(e) => setField('zipcode', e.target.value.replace(/\D/g, ''))}
                    />
                    <label className="chp-floating-label">우편번호</label>
                  </div>
                </div>
                {/* 상세주소 — 주소 입력 후 표시 */}
                {form.addr1 && (
                  <div className="chp-field">
                    <input
                      className="chp-input" type="text" placeholder=" "
                      value={form.addr2}
                      onChange={(e) => setField('addr2', e.target.value)}
                    />
                    <label className="chp-floating-label">상세주소</label>
                  </div>
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
                    <span className="chp-dropdown-arrow"><ChevronDown /></span>
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
                  <div className="chp-field">
                    <input
                      className="chp-input" type="text" placeholder=" "
                      value={form.deliveryCustom}
                      onChange={(e) => setField('deliveryCustom', e.target.value)}
                    />
                    <label className="chp-floating-label">배송 메시지를 입력해 주세요.</label>
                  </div>
                )}
              </div>

              {/* 비회원 주문조회 비밀번호 */}
              {!isLoggedIn && (
                <div className="chp-section chp-section--no-border chp-section--guest">
                  <h2 className="chp-section-title">비회원 주문조회 비밀번호</h2>
                  <p className="chp-section-desc">비회원 주문 조회 시 주문번호와 입력하신 비밀번호가 필요합니다.</p>
                  <div className={`chp-field${errors.guestPw ? ' error' : ''}`}>
                    <input
                      className="chp-input" type="password" placeholder=" "
                      value={form.guestPw}
                      onChange={(e) => setField('guestPw', e.target.value)}
                    />
                    <label className="chp-floating-label">비밀번호</label>
                    <div className="chp-helper visible">4자 이상 입력해 주세요.</div>
                    <div className="chp-error-msg">{errors.guestPw}</div>
                  </div>
                  <div className={`chp-field pw2-field${showPw2 ? ' pw2-visible' : ''}${errors.guestPw2 ? ' error' : ''}`}>
                    <input
                      className="chp-input" type="password" placeholder=" "
                      disabled={!showPw2}
                      value={form.guestPw2}
                      onChange={(e) => setField('guestPw2', e.target.value)}
                    />
                    <label className="chp-floating-label">비밀번호 확인</label>
                    <div className="chp-error-msg">{errors.guestPw2}</div>
                  </div>
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
                    <div className={`chp-field${form.bankName ? ' has-value' : ''}${errors.bankName ? ' error' : ''}`}>
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
                    <div className={`chp-field${errors.depositorName ? ' error' : ''}`}>
                      <input
                        className="chp-input" type="text" placeholder=" "
                        value={form.depositorName}
                        onChange={(e) => setField('depositorName', e.target.value)}
                      />
                      <label className="chp-floating-label">입금자명</label>
                      <div className="chp-error-msg">{errors.depositorName}</div>
                    </div>
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
                      <span className="chp-agree-arrow"><ChevronRight /></span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 결제하기 버튼 */}
              <button className="chp-submit-btn" type="button" onClick={handleSubmit}>
                결제하기
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
                  <span className="chp-sum-item-qty">{item.qty}</span>
                </div>
                <div className="chp-sum-item-info">
                  <div className="chp-sum-item-name">{item.name}</div>
                  <div className="chp-sum-item-badges">
                    {item.volume && <span className="chp-sum-item-badge">{item.volume}</span>}
                    {item.type === 'subscription' && item.period && (
                      <span className="chp-sum-item-badge">정기 {item.period}</span>
                    )}
                  </div>
                </div>
                <div className="chp-sum-item-price">{formatPrice(item.priceNum * item.qty)}</div>
              </div>
            ))}
          </div>

          <div className="chp-summary-totals">
            <div className="chp-sum-row">
              <span>상품 금액 · 총 {totalQty()}개 상품</span>
              <span>{formatPrice(subtotal())}</span>
            </div>
            <div className="chp-sum-row">
              <span>배송비</span>
              <span>{shippingFee() === 0 ? '무료' : formatPrice(shippingFee())}</span>
            </div>
            <div className="chp-sum-total-row">
              <span>결제예정금액</span>
              <span>{formatPrice(totalPrice())}</span>
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
