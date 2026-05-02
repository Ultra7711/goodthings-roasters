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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { supabase } from '@/lib/supabase';
import type { AuthClaims } from '@/lib/auth/getClaims';
import type { UserAddress } from '@/types/address';
import { useAddressForm } from '@/hooks/useAddressForm';
import { usePasswordChangeForm } from '@/hooks/usePasswordChangeForm';
import { usePhoneFormat } from '@/hooks/usePhoneFormat';
import { useInputNav } from '@/hooks/useInputNav';
import { shakeFields } from '@/lib/shakeFields';
import { useToast } from '@/hooks/useToast';
import { TextField } from '@/components/ui/TextField';
import { SearchIcon } from '@/components/ui/InputIcons';
import { extractKrName, formatPrice } from '@/lib/utils';
import { useSiteSettings } from '@/components/providers/SiteSettingsProvider';
import type { Subscription, SubscriptionCycle } from '@/types/subscription';
import { SUBSCRIPTION_CYCLES } from '@/types/subscription';
import SiteHeader from '@/components/layout/SiteHeader';
import { ChevronRight, CopyIcon, InfoCircleIcon } from '@/components/ui/Icons';
import {
  useMyPageAddrOpen,
  useMyPagePwOpen,
  useMyPageSubEditId,
  useMyPageSubCycleEdit,
  useMyPageCycleDropdownOpen,
  useMyPageWithdrawOpen,
  useMyPageSkipConfirmSubId,
  useMyPageCancelConfirmSubId,
  useMyPagePauseConfirmSubId,
  useMyPageOpenOrders,
  setAddrOpen,
  setPwOpen,
  setSubEditId,
  setSubCycleEdit,
  setCycleDropdownOpen,
  toggleCycleDropdownOpen,
  setWithdrawOpen,
  setSkipConfirmSubId,
  setCancelConfirmSubId,
  setPauseConfirmSubId,
  toggleOrder,
} from '@/lib/myPageUiStore';


type MyPagePageProps = {
  /** 서버 가드(`requireAuth`) 결과 — SSR 단계 fallback 으로 사용
   *  (BUG-168 Fix C: hydration 전에도 사용자 데이터 즉시 표시) */
  initialClaims: AuthClaims;
};

/* ══════════════════════════════════════════ */
export default function MyPagePage({ initialClaims }: MyPagePageProps) {
  const router = useRouter();
  const { show: toast } = useToast();
  const { shipping: shippingPolicy } = useSiteSettings();
  const freeShippingThreshold = shippingPolicy.enabled
    ? shippingPolicy.free_threshold
    : Infinity;
  /* useAuthGuard: 로그아웃 감지 시 router.replace(/login) 자동 동작.
     BUG-168 Fix B: ready/authorized 분기 제거 — 서버 가드가 이미 인증 보장. */
  const { bypassRedirect } = useAuthGuard();

  /* ── Supabase session 기반 user 정보 ──
     hydration 전: supabaseUser=null → initialClaims 사용 (SSR fallback)
     hydration 후: supabaseUser 우선 사용 */
  const { user: supabaseUser } = useSupabaseSession();
  const meta = (supabaseUser?.user_metadata ?? initialClaims.metadata) as Record<string, unknown>;
  const metaName = (meta.full_name as string | undefined) ?? (meta.name as string | undefined);
  const effectiveEmail = supabaseUser?.email ?? initialClaims.email;
  const emailHandle = effectiveEmail.split('@')[0];
  const displayName = metaName ?? emailHandle ?? null;

  /* 주소는 DB persist 미도입 — 로컬 state (세션 내 임시).
     ADR-004 Step C-2.5: 기존 Zustand 도 partialize 로 persist 안 했으므로 동작 동일. */
  const [address, setAddress] = useState<UserAddress | null>(null);
  const updateAddress = setAddress;

  /* SSR/hydration 양쪽에서 user 가 항상 존재하도록 initialClaims fallback */
  const user = {
    id: supabaseUser?.id ?? initialClaims.userId,
    email: effectiveEmail,
    name: metaName ?? emailHandle ?? '',
    address,
  };

  /* ── UI state — 외부 store (myPageUiStore) ──
     S118: React 19 Activity preserve 회귀 회피용 외부화. 라우트 변경 시 자동 reset.
     - 아코디언: isAddrOpen, isPwOpen, subEditId, subCycleEdit, isCycleDropdownOpen
     - 모달:     isWithdrawOpen, skipConfirmSubId, cancelConfirmSubId, pauseConfirmSubId
     - 컬렉션:   openOrders */
  const isAddrOpen = useMyPageAddrOpen();
  const isPwOpen = useMyPagePwOpen();
  const subEditId = useMyPageSubEditId();
  const isWithdrawOpen = useMyPageWithdrawOpen();
  const skipConfirmSubId = useMyPageSkipConfirmSubId();
  const cancelConfirmSubId = useMyPageCancelConfirmSubId();
  const pauseConfirmSubId = useMyPagePauseConfirmSubId();

  /* 헤더는 SiteHeader 컴포넌트가 sticky/atTop/검색/모바일 드로어/카트 드로어를 자체 관리.
     마이페이지는 메인 라우트와 동일한 로고 + nav + 검색·마이페이지·카트 아이콘 구조. */

  /* ── 주문 내역 ── */
  const [orders, setOrders] = useState<import('@/types/order').Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    fetch('/api/orders', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json: { data: import('@/types/order').Order[] }) => setOrders(json.data ?? []))
      .catch(() => {})
      .finally(() => setOrdersLoading(false));
  }, []);

  /* ── 주문 카드 열림 상태 (store) ── */
  const openOrders = useMyPageOpenOrders();

  /* ── 주소 폼 ── */
  const addressForm = useAddressForm({
    initial: user?.address ?? null,
    onSave: (addr) => {
      updateAddress(addr);
      setAddrOpen(false);
      toast('배송지가 저장되었습니다.');
    },
  });

  const { setField: setAddrField } = addressForm;
  const { handleChangeValue: handleAddrPhoneChange } = usePhoneFormat(
    useCallback((v: string) => setAddrField('phone', v), [setAddrField]),
  );

  /* 주소 아코디언 열기 시 현재 값으로 리셋 */
  const openAddrAccordion = useCallback(() => {
    addressForm.reset(user?.address ?? null);
    setAddrOpen(true);
  }, [addressForm, user]);

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
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/subscriptions', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json: { data: Subscription[] }) => setSubscriptions(json.data ?? []))
      .catch(() => {})
      .finally(() => setSubsLoading(false));
  }, []);
  const subCycleEdit = useMyPageSubCycleEdit();
  const isCycleDropdownOpen = useMyPageCycleDropdownOpen();
  const cycleDropdownRef = useRef<HTMLDivElement>(null);
  const addrFormRef = useRef<HTMLDivElement>(null);
  const pwFormRef = useRef<HTMLDivElement>(null);
  const addrNav = useInputNav(addrFormRef);
  const pwNav = useInputNav(pwFormRef);

  /* S118: 재진입 시 reset 은 myPageUiStore 의 'gtr:route-change' listener 가
     자동 처리 → useState 인스턴스 보존 회귀 회피.
     pwForm/addressForm 의 폼값은 openXxxAccordion · 취소 버튼에서 명시적 reset
     하므로 별도 처리 불필요. */

  /* 모달 오픈 시 스크롤 잠금 */
  useEffect(() => {
    const anyOpen = isWithdrawOpen || !!skipConfirmSubId || !!cancelConfirmSubId || !!pauseConfirmSubId;
    if (!anyOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isWithdrawOpen, skipConfirmSubId, cancelConfirmSubId]);

  /* 커스텀 드롭다운 외부 클릭 닫기
     capture 단계 stopPropagation 으로 하단 아코디언 관통 차단 (BUG-125) */
  useEffect(() => {
    if (!isCycleDropdownOpen) return;
    const onCapture = (e: MouseEvent) => {
      if (cycleDropdownRef.current && !cycleDropdownRef.current.contains(e.target as Node)) {
        e.stopPropagation();
        setCycleDropdownOpen(false);
      }
    };
    document.addEventListener('click', onCapture, true);
    return () => document.removeEventListener('click', onCapture, true);
  }, [isCycleDropdownOpen]);

  const openSubAccordion = useCallback((sub: Subscription) => {
    setSubEditId(sub.id);
    setSubCycleEdit(sub.cycle);
    setCycleDropdownOpen(false);
  }, []);

  /* 배송 주기 변경 시 다음 배송일 미리보기 — 직전 배송일 = nextDate - oldCycle 로
     역산하여 newCycle 적용. 서버 정책과 동일 가정 (단순 cycleDays 가산). */
  const cycleDays: Record<SubscriptionCycle, number> = {
    '2주': 14,
    '4주': 28,
    '6주': 42,
    '8주': 56,
  };
  const previewNextDate = useCallback(
    (nextDate: string, oldCycle: SubscriptionCycle, newCycle: SubscriptionCycle): string => {
      if (oldCycle === newCycle) return nextDate;
      const [y, m, d] = nextDate.split('.').map(Number);
      const base = new Date(y, m - 1, d);
      base.setDate(base.getDate() - cycleDays[oldCycle] + cycleDays[newCycle]);
      return `${base.getFullYear()}.${String(base.getMonth() + 1).padStart(2, '0')}.${String(base.getDate()).padStart(2, '0')}`;
    },
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
    [],
  );

  const saveSubCycle = useCallback(async (subId: string) => {
    if (!subCycleEdit) return;
    /* paused 상태에서 cycle 변경 시 사용자에게 "재개 후 적용" 안내가 필요하므로
       PATCH 전 현재 상태 캡처 (응답으로 받은 status 는 paused 유지됨). */
    const prev = subscriptions.find((s) => s.id === subId);
    const wasPaused = prev?.status === 'paused';
    try {
      const res = await fetch(`/api/subscriptions/${subId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ cycle: subCycleEdit }),
      });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { data: Subscription };
      setSubscriptions((prev) => prev.map((s) => (s.id === subId ? json.data : s)));
      setSubEditId(null);
      toast(
        wasPaused
          ? '배송 주기가 변경되었습니다. 재개 시 새 주기로 배송됩니다.'
          : '배송 주기가 변경되었습니다.',
      );
    } catch {
      toast('주기 변경에 실패했습니다. 다시 시도해 주세요.');
    }
  }, [subCycleEdit, subscriptions, toast]);

  const cancelSub = useCallback(async (subId: string) => {
    try {
      const res = await fetch(`/api/subscriptions/${subId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error();
      setSubscriptions((prev) => prev.filter((s) => s.id !== subId));
      setSubEditId(null);
      setCancelConfirmSubId(null);
      toast('구독이 해지되었습니다.');
    } catch {
      toast('해지에 실패했습니다. 다시 시도해 주세요.');
    }
  }, [toast]);

  const skipDelivery = useCallback(async (subId: string) => {
    try {
      const res = await fetch(`/api/subscriptions/${subId}/skip`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { data: Subscription };
      setSubscriptions((prev) => prev.map((s) => (s.id === subId ? json.data : s)));
      setSkipConfirmSubId(null);
      toast('다음 배송일이 변경되었습니다.');
    } catch {
      toast('건너뛰기에 실패했습니다. 다시 시도해 주세요.');
    }
  }, [toast]);

  const pauseSub = useCallback(async (subId: string) => {
    try {
      const res = await fetch(`/api/subscriptions/${subId}/pause`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { data: Subscription };
      setSubscriptions((prev) => prev.map((s) => (s.id === subId ? json.data : s)));
      setPauseConfirmSubId(null);
      toast('정기배송이 일시정지되었습니다.');
    } catch {
      toast('일시정지에 실패했습니다. 다시 시도해 주세요.');
    }
  }, [toast]);

  const resumeSub = useCallback(async (subId: string) => {
    try {
      const res = await fetch(`/api/subscriptions/${subId}/resume`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { data: Subscription };
      setSubscriptions((prev) => prev.map((s) => (s.id === subId ? json.data : s)));
      toast('정기배송이 재개되었습니다.');
    } catch {
      toast('재개에 실패했습니다. 다시 시도해 주세요.');
    }
  }, [toast]);

  /* ── 로그아웃 ──
     supabase.auth.signOut() 호출 → SIGNED_OUT 이벤트 →
     AuthSyncProvider가 clearUser() 자동 처리 (P0-2).
     signOut 실패 시 리다이렉트 강행하지 않고 토스트 안내. */
  const handleLogout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast('로그아웃 중 오류가 발생했습니다. 다시 시도해 주세요.');
      return;
    }
    bypassRedirect();
    router.replace('/');
  }, [bypassRedirect, router, toast]);

  /* ── 회원 탈퇴 (Session 8-E) ──
     POST /api/account/delete → RPC delete_account + auth.admin.deleteUser.
     409 subscription_active → 정기배송 선 해지 안내.
     429 rate_limited → 재시도 안내.
     성공 시 로컬 signOut + '/' 리다이렉트. */
  const confirmWithdraw = useCallback(async () => {
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: '탈퇴' }),
      });

      if (res.status === 409) {
        const json = (await res.json().catch(() => null)) as
          | { error?: string; detail?: string }
          | null;
        if (json?.detail === 'subscription_active') {
          toast('진행 중인 정기배송을 먼저 해지해 주세요.');
          return;
        }
      }

      if (res.status === 429) {
        toast('요청이 많습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }

      if (!res.ok) {
        toast('탈퇴 처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
        return;
      }

      setWithdrawOpen(false);
      /* 서버에서 이미 signOut 완료 — 로컬 세션 쿠키 정리 (실패해도 무시) */
      await supabase.auth.signOut().catch(() => {});
      toast('탈퇴 처리가 완료되었습니다.');
      bypassRedirect();
      router.replace('/');
    } catch {
      toast('네트워크 오류가 발생했습니다. 다시 시도해 주세요.');
    }
  }, [bypassRedirect, router, toast]);

  /* ── 주문번호 복사 ── */
  const copyOrderNumber = useCallback(async (num: string) => {
    try {
      await navigator.clipboard.writeText(num);
      toast('주문번호가 복사되었습니다.');
    } catch {
      toast('복사에 실패했습니다.');
    }
  }, [toast]);

  /* BUG-168 Fix B: ready/authorized 분기 제거.
     서버 `requireAuth` 가 이미 인증 보장 → 클라 가드 분기는 paranoid check.
     useAuthGuard 의 useEffect 가 logout 시 redirect 자동 처리. */

  const hasAddress = !!user.address;
  const addr = user.address;
  const addrDisplay = addr
    ? `(${addr.zipcode}) ${addr.addr1}${addr.addr2 ? ` ${addr.addr2}` : ''}`
    : '등록된 배송지 정보가 없습니다.';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh' }}>
      <SiteHeader />

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
              onClick={() => void handleLogout()}
              onKeyDown={(e) => e.key === 'Enter' && void handleLogout()}
            >
              로그아웃
            </span>
          </div>

          {/* ── 계정 정보 ── */}
          <div className="mp-section">
            <h2 className="mp-section-title">계정 정보</h2>
            <div className="mp-section-body">
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
              <div
                className="mp-info-row-top"
                role="button"
                tabIndex={0}
                aria-label={isAddrOpen ? '닫기' : hasAddress ? '주소 편집' : '새 주소 추가'}
                onClick={() => isAddrOpen ? setAddrOpen(false) : openAddrAccordion()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (isAddrOpen) setAddrOpen(false);
                    else openAddrAccordion();
                  }
                }}
              >
                <span className="mp-info-label">배송지 정보</span>
                <div className="mp-info-addr-right">
                  <span
                    className="mp-info-value mp-info-addr-text"
                    style={!hasAddress ? { color: '#9C9890' } : undefined}
                  >
                    {addrDisplay}
                  </span>
                  <span className="mp-addr-icon-btn" aria-hidden="true">
                    <span className={`mp-chevron${isAddrOpen ? ' open' : ''}`}><ChevronRight /></span>
                  </span>
                </div>
              </div>
              {/* 주소 아코디언 */}
              <div className={`mp-accordion${isAddrOpen ? ' open' : ''}`}>
                <div className="mp-accordion-inner" ref={addrFormRef}>
                  <TextField
                    label="받는 분"
                    value={addressForm.form.name}
                    onChange={(v) => addressForm.setField('name', v)}
                    onClear={() => addressForm.setField('name', '')}
                    onKeyDown={addrNav}
                    error={addressForm.errors.name}
                    helper="받는 분의 이름을 입력하세요."
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
                    <button className="mp-cancel-btn" type="button" onClick={() => setAddrOpen(false)} data-gtr-tap>취소</button>
                    <button className="mp-save-btn" type="button" onClick={() => { addressForm.submit(); setTimeout(() => shakeFields(addrFormRef.current), 0); }} data-gtr-tap>저장</button>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>

          {/* ── 정기배송 관리 ── */}
          <div className="mp-section mp-section--no-border">
            <h2 className="mp-section-title">정기배송 관리</h2>
            <div className="mp-section-body">
            <div className="mp-sub-list">
              {subsLoading ? (
                <div className="mp-empty-state">불러오는 중…</div>
              ) : subscriptions.length === 0 ? (
                <div className="mp-empty-state">정기배송 내역이 없습니다.</div>
              ) : (
                subscriptions.map((sub) => (
                  <div className="mp-sub-item" key={sub.id}>
                    <div
                      className="mp-sub-item-top"
                      role="button"
                      tabIndex={0}
                      aria-label={subEditId === sub.id ? '닫기' : '편집'}
                      onClick={() => {
                        if (subEditId === sub.id) { setSubEditId(null); setSubCycleEdit(null); }
                        else openSubAccordion(sub);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (subEditId === sub.id) { setSubEditId(null); setSubCycleEdit(null); }
                          else openSubAccordion(sub);
                        }
                      }}
                    >
                      <div className="mp-sub-item-info">
                        <span className="mp-sub-item-name">
                          {extractKrName(sub.name)}
                          <span className="mp-sub-item-vol"> · {sub.volume}</span>
                          <span className="mp-sub-item-vol"> · 정기배송 {sub.cycle}</span>
                        </span>
                        {sub.status === 'paused' ? (
                          <span className="mp-sub-item-status mp-sub-item-status--paused">
                            <InfoCircleIcon size={18} />
                            일시정지 중
                          </span>
                        ) : (
                          <span className="mp-sub-item-status">다음 배송 {sub.nextDate}</span>
                        )}
                      </div>
                      <div className="mp-sub-controls">
                        {subEditId === sub.id && (
                          <button
                            className="mp-cancel-link mp-sub-cancel-inline"
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setCancelConfirmSubId(sub.id); }}
                            data-gtr-tap
                          >
                            구독 해지
                          </button>
                        )}
                        <span className={`mp-icon-btn mp-sub-edit-btn${subEditId === sub.id ? ' open' : ''}`} aria-hidden="true">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path className="mp-sub-toggle-chevron" d="M9 6l6 6-6 6" />
                            <path className="mp-sub-toggle-close" d="M6 6l12 12M18 6L6 18" />
                          </svg>
                        </span>
                      </div>
                    </div>
                    <div className={`mp-accordion mp-sub-accordion${subEditId === sub.id ? ' open' : ''}`}>
                      <div className="mp-accordion-inner">
                        <div className="chp-field has-value mp-cycle-dropdown-wrap" ref={subEditId === sub.id ? cycleDropdownRef : undefined}>
                          <button
                            className="chp-input mp-cycle-trigger"
                            type="button"
                            onClick={toggleCycleDropdownOpen}
                          >
                            <span>{subCycleEdit ? `${subCycleEdit}마다 배송` : `${sub.cycle}마다 배송`}</span>
                            <svg className={`mp-cycle-chevron${isCycleDropdownOpen && subEditId === sub.id ? ' open' : ''}`} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M6,10l6,6,6-6" />
                            </svg>
                          </button>
                          <label className="chp-floating-label">배송 주기</label>
                          <div className={`pd-dropdown-panel${isCycleDropdownOpen && subEditId === sub.id ? ' open' : ''}`}>
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
                        {(() => {
                          const hasCycleChange =
                            subEditId === sub.id && subCycleEdit !== null && subCycleEdit !== sub.cycle;
                          return (
                            <div className="mp-info-row" style={{ borderBottom: 'none' }}>
                              <span className="mp-info-label">
                                다음 배송일
                                {hasCycleChange && (
                                  <span className="mp-sub-cycle-change">
                                    <span className="mp-sub-cycle-divider">|</span>
                                    {sub.cycle} → <span className="mp-sub-accent">{subCycleEdit}</span>
                                  </span>
                                )}
                              </span>
                              <span className="mp-sub-next-right">
                                <span className={`mp-info-value${hasCycleChange ? ' mp-sub-accent' : ''}`}>
                                  {hasCycleChange
                                    ? previewNextDate(sub.nextDate, sub.cycle, subCycleEdit)
                                    : sub.nextDate}
                                </span>
                                {hasCycleChange && (
                                  <button
                                    className="mp-sub-apply-link"
                                    type="button"
                                    onClick={() => saveSubCycle(sub.id)}
                                    data-gtr-tap
                                  >
                                    변경 적용
                                  </button>
                                )}
                              </span>
                            </div>
                          );
                        })()}
                        {sub.status === 'paused' && (
                          <div className="mp-sub-paused-notice">
                            <InfoCircleIcon size={18} />
                            {subEditId === sub.id && subCycleEdit !== null && subCycleEdit !== sub.cycle
                              ? '배송이 일시정지 중입니다. 재개 후 변경된 주기가 적용됩니다.'
                              : '배송이 일시정지 중입니다.'}
                          </div>
                        )}
                        <div className="mp-accordion-actions mp-sub-accordion-actions">
                          <button
                            className="mp-cancel-btn"
                            type="button"
                            disabled={sub.status === 'paused'}
                            onClick={() => setSkipConfirmSubId(sub.id)}
                            data-gtr-tap
                          >
                            배송 건너뛰기
                          </button>
                          {sub.status === 'paused' ? (
                            <button className="mp-save-btn" type="button" onClick={() => resumeSub(sub.id)} data-gtr-tap>배송 재개하기</button>
                          ) : (
                            <button className="mp-cancel-btn" type="button" onClick={() => setPauseConfirmSubId(sub.id)} data-gtr-tap>배송 일시정지</button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            </div>
          </div>

          {/* ── 계정 관리 ── */}
          <div className="mp-section mp-section--no-border">
            <h2 className="mp-section-title">계정 관리</h2>
            <div className="mp-section-body">
            <div
              className="mp-info-row mp-info-row--action"
              role="button"
              tabIndex={0}
              aria-label={isPwOpen ? '닫기' : '비밀번호 변경'}
              onClick={() => isPwOpen ? (pwForm.reset(), setPwOpen(false)) : openPwAccordion()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (isPwOpen) {
                    pwForm.reset();
                    setPwOpen(false);
                  } else {
                    openPwAccordion();
                  }
                }
              }}
            >
              <span className="mp-info-label">비밀번호 변경</span>
              <span className="mp-icon-btn" aria-hidden="true" style={{ position: 'relative', top: 4 }}>
                <span className={`mp-chevron${isPwOpen ? ' open' : ''}`}><ChevronRight /></span>
              </span>
            </div>
            {/* 비밀번호 변경 아코디언 */}
            <div className={`mp-accordion${isPwOpen ? ' open' : ''}`}>
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
                  <button className="mp-cancel-btn" type="button" onClick={() => { pwForm.reset(); setPwOpen(false); }} data-gtr-tap>취소</button>
                  <button className="mp-save-btn" type="button" onClick={() => { void pwForm.submit(); setTimeout(() => shakeFields(pwFormRef.current), 0); }} data-gtr-tap>변경</button>
                </div>
              </div>
            </div>
            <div className={`mp-info-row mp-info-row--withdraw${isPwOpen ? ' mp-withdraw-divider' : ''}`} style={{ borderBottom: 'none' }}>
              <span className="mp-info-label">회원 탈퇴</span>
              <button
                className="mp-icon-btn"
                type="button"
                aria-label="회원 탈퇴"
                style={{ position: 'relative', top: 4 }}
                onClick={() => {
                  setAddrOpen(false);
                  setPwOpen(false);
                  setSubEditId(null);
                  setWithdrawOpen(true);
                }}
              >
                <ChevronRight />
              </button>
            </div>
            </div>
          </div>
        </div>

        {/* ══ 우측: 주문 내역 ══ */}
        <div className="mp-right">
          <h2 className="mp-section-title">주문 내역</h2>
          <div className="mp-section-body">
          <div className="mp-order-list">
            {ordersLoading ? (
              <div className="mp-empty-state">불러오는 중…</div>
            ) : orders.length === 0 ? (
              <div className="mp-empty-state">주문 내역이 아직 없습니다.</div>
            ) : (
              orders.map((order) => (
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
                    <span className="mp-order-toggle">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9,6l6,6-6,6" />
                      </svg>
                    </span>
                  </div>
                  <div className="mp-order-content">
                    <div className="mp-order-content-left">
                      <div className="mp-order-summary">
                        {extractKrName(order.name)}
                        <span className="mp-order-detail"> · {order.detail}</span>
                      </div>
                      <div className="mp-order-price-row">
                        <span className="mp-order-price">{order.price}</span>
                        {order.priceNum < freeShippingThreshold && (
                          <span className="mp-order-shipping-note">배송비 포함</span>
                        )}
                      </div>
                    </div>
                    <span className={`mp-order-status${order.status === '배송중' ? ' mp-order-status--shipping' : ' mp-order-status--delivered'}`}>
                      {order.status}
                    </span>
                  </div>
                  {/* 아이템 아코디언 */}
                  <div className="mp-order-items">
                    <div className="mp-order-items-inner">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="ocp-item">
                          <div
                            className="ocp-item-img"
                            style={{ background: item.image.bg, position: 'relative' }}
                            onClick={(e) => { e.stopPropagation(); router.push(`/shop/${item.slug}`); }}
                          >
                            <Image src={item.image.src} alt={item.name} fill style={{ objectFit: 'cover' }} sizes="80px" />
                          </div>
                          <div className="ocp-item-info">
                            <div className="ocp-item-category">{item.category}</div>
                            <div className="ocp-item-name">
                              <span className="ocp-item-name-kr">
                                {extractKrName(item.name)}
                                <span className="ocp-item-meta-inline"> · {item.volume}</span>
                              </span>
                            </div>
                            <div className="ocp-item-badges">
                              <span className="ocp-item-qty">
                                {[item.type === 'subscription' && item.period ? `정기배송 ${item.period}` : null, `수량 ${item.qty}개`].filter(Boolean).join(' · ')}
                              </span>
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
      </div>

      {/* ── 회원 탈퇴 모달 ── */}
      {isWithdrawOpen && (
        <div className="mp-modal-overlay" onClick={() => setWithdrawOpen(false)}>
          <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
            <p className="mp-modal-title">떠나시는 건가요?</p>
            <p className="mp-modal-desc">
              탈퇴 시 로그아웃 처리되며, 이후 동일 계정으로<br />
              재가입하시더라도 기존 주문 내역은 복구되지 않습니다.
            </p>
            <div className="mp-modal-actions">
              <button className="mp-modal-cancel" type="button" onClick={() => setWithdrawOpen(false)} data-gtr-tap>취소</button>
              <button className="mp-modal-confirm mp-modal-confirm--danger" type="button" onClick={() => void confirmWithdraw()} data-gtr-tap>탈퇴</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 배송 건너뛰기 확인 모달 ── */}
      {skipConfirmSubId && (() => {
        const sub = subscriptions.find((s) => s.id === skipConfirmSubId);
        if (!sub) return null;
        const cycleDays: Record<string, number> = { '2주': 14, '4주': 28, '6주': 42, '8주': 56 };
        const [ny, nm, nd] = sub.nextDate.split('.').map(Number);
        const nextD = new Date(ny, nm - 1, nd);
        nextD.setDate(nextD.getDate() + (cycleDays[sub.cycle] ?? 28));
        const nextDate = `${nextD.getFullYear()}.${String(nextD.getMonth()+1).padStart(2,'0')}.${String(nextD.getDate()).padStart(2,'0')}`;
        return (
          <div className="mp-modal-overlay" onClick={() => setSkipConfirmSubId(null)}>
            <div className="mp-modal mp-modal--calm" onClick={(e) => e.stopPropagation()}>
              <p className="mp-modal-title">배송을 건너뛸까요?</p>
              <p className="mp-modal-desc">
                이번 배송을 건너뛰면 다음 배송일이<br />
                <strong>{nextDate}</strong>으로 변경됩니다.
              </p>
              <div className="mp-modal-actions">
                <button className="mp-modal-cancel" type="button" onClick={() => setSkipConfirmSubId(null)} data-gtr-tap>취소</button>
                <button className="mp-modal-confirm" type="button" onClick={() => skipDelivery(skipConfirmSubId)} data-gtr-tap>건너뛰기</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 구독 해지 확인 모달 ── */}
      {cancelConfirmSubId && (() => {
        const sub = subscriptions.find((s) => s.id === cancelConfirmSubId);
        if (!sub) return null;
        return (
          <div className="mp-modal-overlay" onClick={() => setCancelConfirmSubId(null)}>
            <div className="mp-modal mp-modal--calm" onClick={(e) => e.stopPropagation()}>
              <p className="mp-modal-title">구독을 해지할까요?</p>
              <p className="mp-modal-desc">
                {extractKrName(sub.name)} 정기배송이 해지됩니다.<br />
                해지 후에는 복구되지 않습니다.
              </p>
              <div className="mp-modal-actions">
                <button className="mp-modal-cancel" type="button" onClick={() => setCancelConfirmSubId(null)} data-gtr-tap>취소</button>
                <button className="mp-modal-confirm mp-modal-confirm--danger" type="button" onClick={() => cancelSub(cancelConfirmSubId)} data-gtr-tap>해지</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 일시정지 확인 모달 ── */}
      {pauseConfirmSubId && (() => {
        const sub = subscriptions.find((s) => s.id === pauseConfirmSubId);
        if (!sub) return null;
        return (
          <div className="mp-modal-overlay" onClick={() => setPauseConfirmSubId(null)}>
            <div className="mp-modal mp-modal--calm" onClick={(e) => e.stopPropagation()}>
              <p className="mp-modal-title">배송을 일시정지할까요?</p>
              <p className="mp-modal-desc">
                언제든지 재개할 수 있습니다.<br />
                일시정지 중에는 배송이 이루어지지 않습니다.
              </p>
              <div className="mp-modal-actions">
                <button className="mp-modal-cancel" type="button" onClick={() => setPauseConfirmSubId(null)} data-gtr-tap>취소</button>
                <button className="mp-modal-confirm" type="button" onClick={() => pauseSub(pauseConfirmSubId)} data-gtr-tap>일시정지</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
