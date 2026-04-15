/* ══════════════════════════════════════════
   MyPagePage — /mypage
   프로토타입 #my-page 이식 (RP-8).

   설계 결정:
   1. mp-* 클래스: 프로토타입 원본 클래스명 유지 (globals.css)
   2. 좌측(3fr): 계정정보 + 정기배송 관리 + 계정관리
   3. 우측(2fr): 주문 내역 (sticky)
   4. 아코디언: 주소 편집, 비밀번호 변경, 정기배송 편집
   5. useAuthGuard: 미로그인 시 /login 리다이렉트
   6. chp-field 시스템 재사용 (체크아웃과 동일 인풋)
   ════════════════════════════════════��═════ */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useAuthStore } from '@/lib/store';
import { useAddressForm } from '@/hooks/useAddressForm';
import { usePasswordChangeForm } from '@/hooks/usePasswordChangeForm';
import { usePhoneFormat } from '@/hooks/usePhoneFormat';
import { useInputNav } from '@/hooks/useInputNav';
import { shakeFields } from '@/lib/shakeFields';
import { useToast } from '@/hooks/useToast';
import { TextField } from '@/components/ui/TextField';
import { MOCK_ORDERS, MOCK_SUBSCRIPTIONS } from '@/lib/mockMyPageData';
import { extractKrName, formatPrice } from '@/lib/utils';
import type { Order } from '@/types/order';
import type { Subscription, SubscriptionCycle } from '@/types/subscription';
import { SUBSCRIPTION_CYCLES } from '@/types/subscription';

/* ── SVG 아이콘 ── */
function AddressIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20,10c0-4.4-3.6-8-8-8S4,5.6,4,10s5.5,10.2,7.4,11.8c.2.1.4.2.6.2s1.6-1.2,1.6-1.2" />
      <circle cx="12" cy="10" r="3" />
      <path d="M19,14v7" /><path d="M22.5,17.5h-7" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12,3h-6c-1.1,0-2,.9-2,2v14c0,1.1.9,2,2,2h12c1.1,0,2-.9,2-2v-6" />
      <path d="M18.4,2.6c.8-.8,2.2-.8,3,0s.8,2.2,0,3l-9,9c-.2.2-.5.4-.9.5l-2.9.8c-.3,0-.5,0-.6-.3v-.3l.8-2.9c0-.3.3-.6.5-.9L18.4,2.6Z" />
    </svg>
  );
}

function PasswordIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <ellipse cx="12" cy="7.7" rx="5.3" ry="5.2" strokeMiterlimit="10" />
      <path d="M12,15c-3.8,0-5.4,2.7-6,6.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.5,19h-6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13,21.5v-2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18.5" cy="19" r="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WithdrawIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <ellipse cx="12" cy="7.7" rx="5.3" ry="5.2" strokeMiterlimit="10" />
      <path d="M12,15c-3.8,0-5.4,2.7-6,6.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16,16l5,5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21,16l-5,5" strokeLinecap="round" strokeLinejoin="round" />
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

function ChevronDown() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6,9l6,6,6-6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19,5l-14,14" /><path d="M5,5l14,14" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

/* ══════════════════════════════════════════ */
export default function MyPagePage() {
  const router = useRouter();
  const { show: toast } = useToast();
  const { ready, authorized, bypassRedirect } = useAuthGuard();

  /* ── Auth Store ── */
  const user = useAuthStore((s) => s.user);
  const displayName = useAuthStore((s) => s.displayName);
  const logout = useAuthStore((s) => s.logout);
  const updateAddress = useAuthStore((s) => s.updateAddress);
  const withdraw = useAuthStore((s) => s.withdraw);

  /* ── 아코디언 상태 ── */
  const [addrOpen, setAddrOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [subEditId, setSubEditId] = useState<string | null>(null);

  /* ── 회원 탈퇴 모달 ── */
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  /* ── 주문 카드 열림 상태 ── */
  const [openOrders, setOpenOrders] = useState<Set<string>>(new Set());
  const toggleOrder = useCallback((num: string) => {
    setOpenOrders((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  }, []);

  /* ── 주소 폼 ── */
  const addressForm = useAddressForm({
    initial: user?.address ?? null,
    onSave: (addr) => {
      updateAddress(addr);
      setAddrOpen(false);
      toast('배송지가 저장되었습니다.');
    },
  });

  const { handleChangeValue: handleAddrPhoneChange } = usePhoneFormat(
    useCallback((v: string) => addressForm.setField('phone', v), [addressForm]),
  );

  /* 주소 아코디언 열기 시 현재 값으로 리셋 */
  const openAddrAccordion = useCallback(() => {
    addressForm.reset(user?.address ?? null);
    setAddrOpen(true);
  }, [addressForm, user?.address]);

  /* ── 비밀번호 폼 ── */
  const pwForm = usePasswordChangeForm({
    onSuccess: () => {
      setPwOpen(false);
      toast('비밀번호가 변경되었습니다.');
    },
  });

  const openPwAccordion = useCallback(() => {
    pwForm.reset();
    setPwOpen(true);
  }, [pwForm]);

  /* ── 정기배송 상태 ── */
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(MOCK_SUBSCRIPTIONS);
  const [subCycleEdit, setSubCycleEdit] = useState<SubscriptionCycle | null>(null);
  const [cycleDropdownOpen, setCycleDropdownOpen] = useState(false);
  const cycleDropdownRef = useRef<HTMLDivElement>(null);
  const addrFormRef = useRef<HTMLDivElement>(null);
  const pwFormRef = useRef<HTMLDivElement>(null);
  const addrNav = useInputNav(addrFormRef);
  const pwNav = useInputNav(pwFormRef);

  /* 모달 오픈 시 스크롤 잠금 */
  useEffect(() => {
    if (!withdrawOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [withdrawOpen]);

  /* 커스텀 드롭다운 외부 클릭 닫기 */
  useEffect(() => {
    if (!cycleDropdownOpen) return;
    const close = (e: MouseEvent) => {
      if (cycleDropdownRef.current && !cycleDropdownRef.current.contains(e.target as Node)) {
        setCycleDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [cycleDropdownOpen]);

  const openSubAccordion = useCallback((sub: Subscription) => {
    setSubEditId(sub.id);
    setSubCycleEdit(sub.cycle);
    setCycleDropdownOpen(false);
  }, []);

  const saveSubCycle = useCallback((subId: string) => {
    if (!subCycleEdit) return;
    setSubscriptions((prev) =>
      prev.map((s) => (s.id === subId ? { ...s, cycle: subCycleEdit } : s)),
    );
    setSubEditId(null);
    toast('배송 주기가 변경되었습니다.');
  }, [subCycleEdit, toast]);

  const cancelSub = useCallback((subId: string) => {
    setSubscriptions((prev) => prev.filter((s) => s.id !== subId));
    setSubEditId(null);
    toast('구독이 해지되었습니다.');
  }, [toast]);

  /* ── 로그아웃 ── */
  const handleLogout = useCallback(() => {
    bypassRedirect();
    logout();
    router.replace('/');
  }, [bypassRedirect, logout, router]);

  /* ── 회원 탈퇴 ── */
  const confirmWithdraw = useCallback(async () => {
    setWithdrawOpen(false);
    bypassRedirect();
    await withdraw();
    router.replace('/');
    toast('회원 탈퇴가 완료되었습니다.');
  }, [bypassRedirect, withdraw, router, toast]);

  /* ── 주문번호 복사 ── */
  const copyOrderNumber = useCallback(async (num: string) => {
    try {
      await navigator.clipboard.writeText(num);
      toast('주문번호가 복사되었습니다.');
    } catch {
      toast('복사에 실패했습니다.');
    }
  }, [toast]);

  /* ── 가드 대기 ── */
  if (!ready) return null;
  if (!authorized) return null;

  const hasAddress = !!user?.address;
  const addrDisplay = hasAddress
    ? `(${user!.address!.zipcode}) ${user!.address!.addr1}${user!.address!.addr2 ? ` ${user!.address!.addr2}` : ''}`
    : '등록된 주소가 없습니다.';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      {/* ── 미니 헤더 ── */}
      <div className="chp-hdr-wrap" style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
        <div className="chp-hdr-inner">
          <Link href="/">
            <Image src="/images/icons/logo.svg" alt="GOOD THINGS" width={140} height={28} className="chp-logo-img" />
          </Link>
        </div>
      </div>

      {/* ── 본문 3:2 그리드 ── */}
      <div className="mp-body">
        {/* ══ 좌측 ══ */}
        <div className="mp-left">
          {/* 타이틀 */}
          <div className="mp-title-row">
            <div className="mp-page-title">마이 페이지</div>
          </div>
          <div className="mp-welcome-wrap">
            <span className="mp-welcome-txt">{displayName ?? ''}님, 환영합니다.</span>
            <span
              className="mp-logout-link"
              role="button"
              tabIndex={0}
              onClick={handleLogout}
              onKeyDown={(e) => e.key === 'Enter' && handleLogout()}
            >
              로그아웃
            </span>
          </div>

          {/* ── 계정 정보 ── */}
          <div className="mp-section">
            <h2 className="mp-section-title">계정 정보</h2>
            <div className="mp-info-row">
              <span className="mp-info-label">이름</span>
              <span className="mp-info-value">{user?.name ?? displayName ?? ''}</span>
            </div>
            <div className="mp-info-row">
              <span className="mp-info-label">이메일</span>
              <span className="mp-info-value">{user?.email ?? ''}</span>
            </div>
            {/* 주소 행 */}
            <div className="mp-info-row mp-info-row--addr">
              <div className="mp-info-row-top">
                <span className={`mp-info-label${!hasAddress ? ' mp-addr-empty' : ''}`}>
                  {hasAddress ? '주소' : addrDisplay}
                </span>
                <div className="mp-info-addr-right">
                  {hasAddress && (
                    <span className="mp-info-value mp-info-addr-text">{addrDisplay}</span>
                  )}
                  <button
                    className="mp-addr-icon-btn"
                    type="button"
                    aria-label={addrOpen ? '닫기' : hasAddress ? '주소 편집' : '새 주소 추가'}
                    onClick={() => addrOpen ? setAddrOpen(false) : openAddrAccordion()}
                  >
                    {addrOpen ? <CloseIcon /> : hasAddress ? <EditIcon /> : <AddressIcon />}
                  </button>
                </div>
              </div>
              {/* 주소 아코디언 */}
              <div className={`mp-accordion${addrOpen ? ' open' : ''}`}>
                <div className="mp-accordion-inner" ref={addrFormRef}>
                  <TextField
                    label="이름"
                    value={addressForm.form.name}
                    onChange={(v) => addressForm.setField('name', v)}
                    onClear={() => addressForm.setField('name', '')}
                    onKeyDown={addrNav}
                    error={addressForm.errors.name}
                    helper="이름을 입력하세요."
                  />
                  <TextField
                    type="tel"
                    label="전화번호"
                    value={addressForm.form.phone}
                    onChange={handleAddrPhoneChange}
                    onClear={() => addressForm.setField('phone', '')}
                    onBlur={addressForm.blurPhone}
                    onKeyDown={addrNav}
                    error={addressForm.errors.phone}
                    helper="하이픈이 자동으로 입력됩니다."
                  />
                  <div className="chp-addr-inline">
                    <TextField
                      label="주소 검색"
                      readOnly
                      style={{ cursor: 'pointer', paddingRight: 36 }}
                      value={addressForm.form.addr1}
                      onChange={() => { /* readOnly */ }}
                      onClick={addressForm.lookupAddress}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addressForm.lookupAddress(); } }}
                      wrapperClass={addressForm.form.addr1 ? 'has-value' : ''}
                      customAction={
                        <button
                          className="chp-addr-search-btn"
                          type="button"
                          title="주소 검색"
                          onClick={addressForm.lookupAddress}
                        >
                          <SearchIcon />
                        </button>
                      }
                      error={addressForm.errors.addr1}
                      helper="주소를 검색해 주세요."
                    />
                    <TextField
                      label="우편번호"
                      maxLength={5}
                      inputMode="numeric"
                      value={addressForm.form.zipcode}
                      onChange={(v) => addressForm.setField('zipcode', v)}
                      hideClear
                      error={addressForm.errors.zipcode}
                      helper="주소 검색 시 자동 입력됩니다."
                    />
                  </div>
                  {addressForm.form.addr1 && (
                    <TextField
                      label="상세주소"
                      value={addressForm.form.addr2}
                      onChange={(v) => addressForm.setField('addr2', v)}
                      onClear={() => addressForm.setField('addr2', '')}
                      onKeyDown={addrNav}
                      helper="동·호수 등 상세주소를 입력하세요."
                    />
                  )}
                  <div className="mp-accordion-actions">
                    <button className="mp-save-btn" type="button" onClick={() => { addressForm.submit(); setTimeout(() => shakeFields(addrFormRef.current), 0); }}>저장</button>
                    <button className="mp-cancel-btn" type="button" onClick={() => setAddrOpen(false)}>취소</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── 정기배송 관리 ── */}
          <div className="mp-section mp-section--no-border">
            <h2 className="mp-section-title">정기배송 관리</h2>
            <div className="mp-sub-list">
              {subscriptions.length === 0 ? (
                <div className="mp-empty-state">정기배송 내역이 없습니다.</div>
              ) : (
                subscriptions.map((sub) => (
                  <div className="mp-sub-item" key={sub.id}>
                    <div className="mp-sub-item-top">
                      <div className="mp-sub-item-info">
                        <span className="mp-sub-item-name">
                          {sub.name}
                          <span className="mp-sub-item-vol"> · {sub.volume} · {sub.cycle}</span>
                        </span>
                        <span className="mp-sub-item-status">다음 배송 {sub.nextDate}</span>
                      </div>
                      <button
                        className="mp-icon-btn mp-sub-edit-btn"
                        type="button"
                        aria-label={subEditId === sub.id ? '닫기' : '편집'}
                        onClick={() => subEditId === sub.id ? setSubEditId(null) : openSubAccordion(sub)}
                      >
                        {subEditId === sub.id ? <CloseIcon /> : <EditIcon />}
                      </button>
                    </div>
                    <div className={`mp-accordion mp-sub-accordion${subEditId === sub.id ? ' open' : ''}`}>
                      <div className="mp-accordion-inner">
                        <div className="chp-field has-value mp-cycle-dropdown-wrap" ref={subEditId === sub.id ? cycleDropdownRef : undefined}>
                          <button
                            className="chp-input mp-cycle-trigger"
                            type="button"
                            onClick={() => setCycleDropdownOpen((p) => !p)}
                          >
                            <span>{subCycleEdit ? `${subCycleEdit}마다 배송` : `${sub.cycle}마다 배송`}</span>
                            <svg className={`mp-cycle-chevron${cycleDropdownOpen && subEditId === sub.id ? ' open' : ''}`} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M6,10l6,6,6-6" />
                            </svg>
                          </button>
                          <label className="chp-floating-label">배송 주기</label>
                          <div className={`pd-dropdown-panel${cycleDropdownOpen && subEditId === sub.id ? ' open' : ''}`}>
                            <div className="pd-dropdown-hint">배송 주기 선택</div>
                            {SUBSCRIPTION_CYCLES.map((c) => (
                              <div
                                key={c}
                                className={`pd-dropdown-option${c === subCycleEdit ? ' active' : ''}`}
                                onClick={() => { setSubCycleEdit(c); setCycleDropdownOpen(false); }}
                              >
                                {c}마다 배송
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="mp-info-row" style={{ borderBottom: 'none' }}>
                          <span className="mp-info-label">다음 배송일</span>
                          <span className="mp-info-value">{sub.nextDate}</span>
                        </div>
                        <div className="mp-accordion-actions">
                          <button className="mp-save-btn mp-sub-save-btn" type="button" onClick={() => saveSubCycle(sub.id)}>저장</button>
                          <button className="mp-cancel-btn" type="button" onClick={() => setSubEditId(null)}>취소</button>
                          <button className="mp-sub-unsubscribe" type="button" onClick={() => cancelSub(sub.id)}>구독 해지</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── 계정 관리 ── */}
          <div className="mp-section mp-section--no-border">
            <h2 className="mp-section-title">계정 관리</h2>
            <div className="mp-info-row mp-info-row--action">
              <span className="mp-info-label">비밀번호 변경</span>
              <button
                className="mp-icon-btn"
                type="button"
                aria-label={pwOpen ? '닫기' : '비밀번호 변경'}
                style={{ position: 'relative', top: 4 }}
                onClick={() => pwOpen ? (pwForm.reset(), setPwOpen(false)) : openPwAccordion()}
              >
                {pwOpen ? <CloseIcon /> : <PasswordIcon />}
              </button>
            </div>
            {/* 비밀번호 변경 아코디언 */}
            <div className={`mp-accordion${pwOpen ? ' open' : ''}`}>
              <div className="mp-accordion-inner" ref={pwFormRef}>
                <TextField
                  type="password"
                  label="현재 비밀번호"
                  value={pwForm.current}
                  onChange={pwForm.setCurrent}
                  onKeyDown={pwNav}
                  showPasswordToggle
                  error={pwForm.errors.current}
                  helper="현재 비밀번호를 입력하세요."
                />
                <TextField
                  type="password"
                  label="새 비밀번호"
                  value={pwForm.next}
                  onChange={pwForm.setNext}
                  onBlur={pwForm.blurNext}
                  onKeyDown={pwNav}
                  showPasswordToggle
                  error={pwForm.errors.next}
                  helper="영문 대소문자/숫자/특수문자 중 2가지 이상 조합, 6~16자"
                />
                <TextField
                  type="password"
                  label="새 비밀번호 확인"
                  disabled={pwForm.pw2Disabled}
                  value={pwForm.confirm}
                  onChange={pwForm.setConfirm}
                  onBlur={pwForm.blurConfirm}
                  onKeyDown={pwNav}
                  showPasswordToggle
                  error={pwForm.errors.confirm}
                  helper="비밀번호를 한 번 더 입력하세요."
                  wrapperClass={`pw2-field${pwForm.next ? ' pw2-visible' : ''}`}
                />
                <div className="mp-accordion-actions">
                  <button className="mp-save-btn" type="button" onClick={() => { void pwForm.submit(); setTimeout(() => shakeFields(pwFormRef.current), 0); }}>변경</button>
                  <button className="mp-cancel-btn" type="button" onClick={() => { pwForm.reset(); setPwOpen(false); }}>취소</button>
                </div>
              </div>
            </div>
            <div className={`mp-info-row mp-info-row--withdraw${pwOpen ? ' mp-withdraw-divider' : ''}`} style={{ borderBottom: 'none' }}>
              <span className="mp-info-label">회원 탈퇴</span>
              <button
                className="mp-icon-btn"
                type="button"
                aria-label="회원 탈퇴"
                style={{ position: 'relative', top: 6 }}
                onClick={() => {
                  setAddrOpen(false);
                  setPwOpen(false);
                  setSubEditId(null);
                  setWithdrawOpen(true);
                }}
              >
                <WithdrawIcon />
              </button>
            </div>
          </div>
        </div>

        {/* ══ 우측: 주문 내역 ══ */}
        <div className="mp-right">
          <h2 className="mp-section-title">주문 내역</h2>
          <div className="mp-order-list">
            {MOCK_ORDERS.length === 0 ? (
              <div className="mp-empty-state">주문 내역이 아직 없습니다.</div>
            ) : (
              MOCK_ORDERS.map((order) => (
                <div
                  key={order.number}
                  className={`mp-order-card${openOrders.has(order.number) ? ' open' : ''}`}
                  onClick={() => toggleOrder(order.number)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && toggleOrder(order.number)}
                >
                  <div className="mp-order-meta">
                    <div className="mp-order-meta-left">
                      <span className="mp-order-date">{order.date}</span>
                      <div className="mp-order-number-row">
                        <span className="mp-order-number">{order.number}</span>
                        <button
                          className="mp-order-copy-btn"
                          type="button"
                          aria-label="주문번호 복사"
                          onClick={(e) => { e.stopPropagation(); void copyOrderNumber(order.number); }}
                        >
                          <CopyIcon />
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span className={`mp-order-status${order.status === '배송중' ? ' mp-order-status--shipping' : ' mp-order-status--delivered'}`}>
                        {order.status}
                      </span>
                      <span className="mp-order-toggle"><ChevronDown /></span>
                    </div>
                  </div>
                  <div className="mp-order-summary">{order.name}</div>
                  <div className="mp-order-detail">{order.detail}</div>
                  <div className="mp-order-price-row">
                    <span className="mp-order-price">{order.price}</span>
                  </div>
                  {/* 아이템 아코디언 */}
                  <div className="mp-order-items">
                    <div className="mp-order-items-inner">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="ocp-item" style={{ minWidth: 0, height: 'auto', padding: '16px 0' }}>
                          <div
                            className="ocp-item-img"
                            style={{ width: 80, height: 80, cursor: 'pointer', background: item.image.bg, position: 'relative', flexShrink: 0 }}
                            onClick={(e) => { e.stopPropagation(); router.push(`/shop/${item.slug}`); }}
                          >
                            <Image src={item.image.src} alt={item.name} fill style={{ objectFit: 'cover' }} sizes="80px" />
                          </div>
                          <div className="ocp-item-info">
                            <div className="ocp-item-category">{item.category}</div>
                            <div className="ocp-item-name">{extractKrName(item.name)}</div>
                            <div className="ocp-item-badges">
                              <span className="ocp-item-badge">{item.volume}</span>
                              <span className="ocp-item-qty">수량 {item.qty}개</span>
                              <span className="ocp-item-price">{formatPrice(item.priceNum)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── 회원 탈퇴 모달 ── */}
      {withdrawOpen && (
        <div className="mp-modal-overlay" style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} onClick={() => setWithdrawOpen(false)}>
          <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
            <p className="mp-modal-title">떠나시는 건가요?</p>
            <p className="mp-modal-desc">
              탈퇴하시면 주문 내역, 정기배송, 계정 정보가<br />
              모두 삭제되며 복구할 수 없습니다.
            </p>
            <div className="mp-modal-actions">
              <button className="mp-modal-confirm" type="button" onClick={() => void confirmWithdraw()}>탈퇴</button>
              <button className="mp-modal-cancel" type="button" onClick={() => setWithdrawOpen(false)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
