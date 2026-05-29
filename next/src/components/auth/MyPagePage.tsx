/* ══════════════════════════════════════════
   MyPagePage — /mypage  (Container)
   S197 PR-1.3 V2 §3 재구조화:
   - 좌측 7fr / 우측 5fr (4 섹션 + 주문 sticky) → Hero + NextCard + 2단 grid (220 nav + 동적 패널)
   - 6 nav: orders / subscription / wishlist (placeholder) / profile / addresses / account
   - state: activeNavId (useState · PR-3 에서 별도 라우트 분리 후 hash/segment 동기화)
   ════════════════════════════════════════ */

'use client';

import './MyPagePage.css';
import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { supabase } from '@/lib/supabase';
import type { AuthClaims, AdminLevel } from '@/lib/auth/getClaims';
import type { Subscription } from '@/types/subscription';
import type { Order } from '@/types/order';
import type { NewsletterStatusResult } from '@/lib/newsletter';
import { useToast } from '@/hooks/useToast';
import { useSubscriptionsQuery } from '@/hooks/useSubscriptions';
import { resetMyPageUi } from '@/lib/myPageUiStore';
import OverscrollTop from '@/components/ui/OverscrollTop';
import HeroGreeting from '@/components/auth/mypage/HeroGreeting';
import MyPageSideNav, { type MyPageNavId } from '@/components/auth/mypage/MyPageSideNav';
import MyPagePanel from '@/components/auth/mypage/MyPagePanel';

const NAV_LABELS: Record<MyPageNavId, string> = {
  orders: '주문내역',
  subscription: '정기배송',
  profile: '프로필',
  account: '계정관리',
};
import OrdersView from '@/components/auth/mypage/views/OrdersView';
import SubscriptionView from '@/components/auth/mypage/views/SubscriptionView';
import ProfileView from '@/components/auth/mypage/views/ProfileView';
import AccountView from '@/components/auth/mypage/views/AccountView';

type MyPagePageProps = {
  initialClaims: AuthClaims;
  /** SSR prefetch — 정기배송 전체 (TanStack initialData 로 주입 · flash 차단) */
  initialSubscriptions: Subscription[];
  /** S282-P1: orders limit 20 SSR prefetch (default tab=orders client fetch spinner 폐기).
     마이페이지 안 주문 mutation 0 → stale 위험 0. */
  initialOrders: Order[];
  /** 사이드 nav + HeroGreeting 카운트 표시용 (count-only RPC 결과).
     마이페이지 안에서 주문 mutation 발생 안 함 — stale 위험 0. */
  initialOrdersCount: number;
  /** S264 H-2: admin 인 경우 adminLevel 라벨 ("관리자"/"운영자") 표시.
     일반 사용자 null → metaName / emailHandle 기존 로직. */
  adminLevel: AdminLevel | null;
  /** S283: newsletter status SSR prefetch — ProfileView 진입 시 즉시 표시 (loading 폐기). */
  initialNewsletterStatus: NewsletterStatusResult;
};

export default function MyPagePage({
  initialClaims,
  initialSubscriptions,
  initialOrders,
  initialOrdersCount,
  adminLevel,
  initialNewsletterStatus,
}: MyPagePageProps) {
  const router = useRouter();
  const { show: toast } = useToast();
  const { bypassRedirect } = useAuthGuard();

  const { user: supabaseUser } = useSupabaseSession();
  const meta = (supabaseUser?.user_metadata ?? initialClaims.metadata) as Record<string, unknown>;
  const metaName = (meta.full_name as string | undefined) ?? (meta.name as string | undefined);
  const effectiveEmail = supabaseUser?.email ?? initialClaims.email;
  const emailHandle = effectiveEmail.split('@')[0];
  /* S264 H-2: admin 계정은 metaName 미설정 시 emailHandle (예: "idealizer77+admin") 노출 회귀.
     hero 인사말 displayName: 환영 컨텍스트라 adminLevel 라벨 ("관리자"/"운영자") 우선.
     일반 사용자 = 기존 로직. */
  const displayName =
    adminLevel === 'owner'
      ? '관리자'
      : adminLevel === 'staff'
        ? '운영자'
        : (metaName ?? emailHandle ?? '');

  /* S264 H-2 옵션 B: 프로필 영역은 본인 정보 영역 → 본명 우선 + fallback 라벨.
     metaName 있으면 본명, 없으면 admin 라벨, 그것도 없으면 emailHandle. */
  const profileDisplayName =
    metaName ??
    (adminLevel === 'owner'
      ? '관리자'
      : adminLevel === 'staff'
        ? '운영자'
        : (emailHandle ?? ''));

  /* 가입 기간 — < 30일 이면 일 단위, 이상이면 개월 단위 */
  const createdAtIso =
    supabaseUser?.created_at ??
    (initialClaims as unknown as { createdAt?: string }).createdAt ??
    null;
  const membershipText = useMemo<string | null>(() => {
    if (!createdAtIso) return null;
    const created = new Date(createdAtIso);
    if (isNaN(created.getTime())) return null;
    const now = new Date();
    const days = Math.floor(
      (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (days < 0) return null;
    if (days < 30) return `가입 ${days}일째`;
    const months =
      (now.getFullYear() - created.getFullYear()) * 12 +
      (now.getMonth() - created.getMonth());
    return `가입 ${Math.max(months, 1)}개월`;
  }, [createdAtIso]);

  /* ── Hero 진입 연출 + 모바일 scroll progress (S266) ──
     매 element mount 시 ref 호출 → classList reset → reflow → add 로 transition 재발화.
     useState + useEffect 패턴은 navigate 시 instance reuse 로 재실행 안 되는 케이스 차단.
     S266: 동일 ref 가 mp-page root 의 보관도 담당 — scroll listener 가 --mp-scroll-p
     를 inline style 로 갱신. */
  const pageRef = useRef<HTMLDivElement | null>(null);
  const setBodyEl = useCallback((el: HTMLDivElement | null) => {
    pageRef.current = el;
    if (!el) return;
    el.classList.remove('is-loaded');
    void el.offsetHeight;
    el.classList.add('is-loaded');
  }, []);

  /* ── S299 모바일 hero collapse 폐기 (Legal 단일 sticky 답습) ──
     S266~S282-P3-M JS scroll collapse + S299 nested sticky 모두 폐기.
     [근거] nested sticky(2중) 는 iOS WebKit #106062 버그로 진동·조기 풀림 발생
     (Chromium 정상 → PC 에뮬에선 미발현). Legal 페이지(단일 sticky·hero 일반흐름)는
     iOS 정상 = 검증된 자체 패턴 → 답습. hero 일반 흐름(스크롤로 사라짐) + tabbar 단일 sticky.
     JS scroll 제어 일절 없음 → 떨림 근원 자체 소멸. */

  /* ── Side nav 활성 항목 ── */
  const [activeNavId, setActiveNavId] = useState<MyPageNavId>('orders');

  /* ── S282-P3-M: 초기화 이벤트 2종 (옵션 C · A+B 둘 다) ──
     (A) `app:mypage-reset` — 동일 라우트 재클릭 시 dispatch (Shop/Menu/GoodDays 답습 · lessons.md §8):
         SiteHeader (데스크탑 아이콘) + MobileNavDrawer (모바일 링크) 에서 발화.
         → activeNavId 'orders' + resetMyPageUi() + scrollY 0
     (B) `gtr:route-change` — 다른 페이지 이동 후 복귀 시도 초기화:
         myPageUiStore 는 이미 store reset 박혀 있음. activeNavId 는 별 local state 라 동기 추가.
         leave-reset 패턴: mypage→other 이동 시 setActiveNavId('orders') → 다음 mypage 진입 시 default. */
  useEffect(() => {
    function onMypageReset() {
      setActiveNavId('orders');
      resetMyPageUi();
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    }
    function onRouteChange() {
      /* leave-reset — mypage 떠날 때 activeNavId 'orders' 로 reset.
         myPageUiStore 의 store reset 과 동기 → 다음 진입 시 완전 default. */
      setActiveNavId('orders');
    }
    window.addEventListener('app:mypage-reset', onMypageReset);
    window.addEventListener('gtr:route-change', onRouteChange);
    return () => {
      window.removeEventListener('app:mypage-reset', onMypageReset);
      window.removeEventListener('gtr:route-change', onRouteChange);
    };
  }, []);

  /* ── 탭 전환 공통 핸들러 — S299 (탭바 sticky 상태 기준 A/B 정렬 · 사용자 결정) ──
     - 탭바가 아직 sticky 안 됨(hero 보이는 최초 상태) → A: 페이지 top (hero 부터).
     - 탭바가 sticky 로 천장에 붙음(스크롤 내려간 상태) → B: panel 을 탭바 직하로 정렬
       (= 탭바가 막 천장에 붙는 scrollY 로 이동 → 새 panel 콘텐츠를 위에서부터 보임).
     데스크탑은 grid layout(nav 항상 보임)이라 스크롤 불필요 → mql 가드. */
  const handleNavWithScroll = useCallback((target: MyPageNavId) => {
    const isMobile =
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 767px)').matches;
    if (!isMobile) {
      setActiveNavId(target);
      return;
    }
    /* 모바일: panel 교체를 flushSync 로 동기 커밋 → 새 panel height 반영된 안정 DOM 에서
       측정+scrollTo. (동기 scrollTo 는 panel 교체 전 발화되어, 긴 주문내역→짧은 탭 전환 시
       문서 height 급변 중 smooth scroll 이 어긋남.) */
    flushSync(() => setActiveNavId(target));
    const grid = pageRef.current?.querySelector<HTMLElement>('.mp-grid');
    if (!grid) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    /* tabbar(= mp-grid 첫 자식)가 천장(header)에 붙기 시작하는 scrollY.
       mp-grid 는 일반 흐름이라 (scrollY + rect.top) 으로 절대 위치 정확 (scrollY 상쇄 → 고정값). */
    const headerH =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--header-height'),
      ) || 56;
    const stickThreshold = window.scrollY + grid.getBoundingClientRect().top - headerH;
    /* 이미 sticky(붙음) → panel 직하 정렬(B) / 아직 안 붙음 → 페이지 top(A).
       경계 2px 여유: B 이동 후 scrollY ≈ threshold 에서 재선택 시 `>` 가 false 되어
       다시 A(첫 화면)로 빠지는 버그 방지 (smooth scroll 도달 오차 흡수). */
    const dest = window.scrollY > stickThreshold - 2 ? stickThreshold : 0;
    window.scrollTo({ top: Math.max(dest, 0), behavior: 'smooth' });
  }, []);

  /* ── 데이터: 정기배송 (SSR initialData) + 주문 (S253 lazy)
     - subscriptions: SSR prefetch initialData (flash 차단)
     - orders: useOrdersQuery 호출은 OrderHistory 컴포넌트가 담당 (lazy mount).
       MyPagePage 에서 호출 안 함 — 중복 fetch 트리거 회피.
       카운트 표시는 SSR 의 initialOrdersCount 사용. 마이페이지 안에서 주문 mutation
       발생 안 함 (= stale 위험 0). */
  const { subscriptions } = useSubscriptionsQuery(initialSubscriptions);

  const activeSubsCount = useMemo(
    () => subscriptions.filter((s) => s.status === 'active').length,
    [subscriptions],
  );

  const counts = useMemo<Partial<Record<MyPageNavId, number>>>(
    () => ({
      orders: initialOrdersCount,
      subscription: subscriptions.length,
    }),
    [initialOrdersCount, subscriptions.length],
  );

  /* ── 로그아웃 ── */
  const handleLogout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast('로그아웃 중 오류가 발생했습니다. 다시 시도해 주세요.');
      return;
    }
    bypassRedirect();
    router.replace('/');
  }, [bypassRedirect, router, toast]);

  const handleLoggedOut = useCallback(() => {
    bypassRedirect();
    router.replace('/');
  }, [bypassRedirect, router]);

  /* ── 활성 view 렌더 (S282-P1: useMemo · 탭 전환 INP 단축) ── */
  const activeView = useMemo(() => {
    switch (activeNavId) {
      case 'orders':
        return <OrdersView initialOrders={initialOrders} />;
      case 'subscription':
        return <SubscriptionView />;
      case 'profile':
        return (
          <ProfileView
            name={profileDisplayName}
            email={effectiveEmail}
            initialNewsletterStatus={initialNewsletterStatus}
          />
        );
      case 'account':
        return <AccountView onLoggedOut={handleLoggedOut} />;
    }
  }, [
    activeNavId,
    initialOrders,
    profileDisplayName,
    effectiveEmail,
    handleLoggedOut,
    initialNewsletterStatus,
  ]);

  return (
    <>
      {/* 모바일 오버스크롤 영역: 상단 = ann-bar 색 (#1E1B16) / 하단 = footer 색 (#4A4845 default).
         hero-wrap 이 sticky sand 풀블리드라 상단 overscroll 은 ann-bar 가 보존. */}
      <OverscrollTop top="#1E1B16" bottom="#4A4845" />

      {/* ── mp-page wrapper (S264 H-1) ──
         hero-wrap (viewport 풀폭 sand) 와 mp-body (max-width 1440 centered) 를 묶음.
         setBodyEl ref 는 mp-page 에 박아 진입 연출이 hero 와 grid 모두 트리거. */}
      <div className="mp-page" ref={setBodyEl}>
        {/* ── S299 hero (Legal 답습 · 데스크탑/모바일 공통 일반 흐름) ──
           hero 는 sticky 아님. 스크롤하면 자연스럽게 위로 사라지고 tabbar 만 천장 sticky. */}
        <div className="mp-hero-wrap">
          <div className="mp-hero-inner">
            <HeroGreeting
              name={displayName}
              ordersCount={initialOrdersCount}
              activeSubscriptionsCount={activeSubsCount}
              membershipText={membershipText}
              onLogout={() => void handleLogout()}
              onNavigate={handleNavWithScroll}
            />
          </div>
        </div>

        <div className="mp-body">
          <div className="mp-grid">
            {/* S266 → S282-P3-M: 모바일 sticky bar wrapper. 데스크탑 = display:contents
               (자식이 grid item 으로 직접 동작 · 기존 grid 레이아웃 보존).
               모바일 = SideNav 만 sticky (hero 가 별 sticky 영역으로 stack).
               S282-P3-M: mp-mobile-greeting 폐기 — hero-wrap 자체가 sticky + collapsed 1줄로 변환.
               sticky bar 의 bg 는 absolute child 로 분리 (iOS 26 Liquid Glass tinting fix). */}
            <div className="mp-mobile-stickybar">
              <MyPageSideNav
                activeId={activeNavId}
                counts={counts}
                onChange={handleNavWithScroll}
              />
            </div>
            <MyPagePanel title={NAV_LABELS[activeNavId]}>{activeView}</MyPagePanel>
          </div>
        </div>
      </div>
    </>
  );
}
