/* ══════════════════════════════════════════
   MyPagePage — /mypage  (Container)
   S197 PR-1.3 V2 §3 재구조화:
   - 좌측 7fr / 우측 5fr (4 섹션 + 주문 sticky) → Hero + NextCard + 2단 grid (220 nav + 동적 패널)
   - 6 nav: orders / subscription / wishlist (placeholder) / profile / addresses / account
   - state: activeNavId (useState · PR-3 에서 별도 라우트 분리 후 hash/segment 동기화)
   ════════════════════════════════════════ */

'use client';

import './MyPagePage.css';
import { useCallback, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { supabase } from '@/lib/supabase';
import type { AuthClaims, AdminLevel } from '@/lib/auth/getClaims';
import type { Subscription } from '@/types/subscription';
import { useToast } from '@/hooks/useToast';
import { useSubscriptionsQuery } from '@/hooks/useSubscriptions';
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
  /** 사이드 nav + HeroGreeting 카운트 표시용 (count-only RPC 결과).
     마이페이지 안에서 주문 mutation 발생 안 함 — stale 위험 0. */
  initialOrdersCount: number;
  /** S264 H-2: admin 인 경우 adminLevel 라벨 ("관리자"/"운영자") 표시.
     일반 사용자 null → metaName / emailHandle 기존 로직. */
  adminLevel: AdminLevel | null;
};

export default function MyPagePage({
  initialClaims,
  initialSubscriptions,
  initialOrdersCount,
  adminLevel,
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

  /* ── Hero 진입 연출 (PR-2 §2.11) — callback ref 직접 처리.
     매 element mount 시 ref 호출 → classList reset → reflow → add 로 transition 재발화.
     useState + useEffect 패턴은 navigate 시 instance reuse 로 재실행 안 되는 케이스 차단. */
  const setBodyEl = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    el.classList.remove('is-loaded');
    void el.offsetHeight;
    el.classList.add('is-loaded');
  }, []);

  /* ── Side nav 활성 항목 ── */
  const [activeNavId, setActiveNavId] = useState<MyPageNavId>('orders');

  /* ── 탭 전환 공통 핸들러 (HeroGreeting 메타 + SideNav 탭바) — 모바일 스크롤 포함.
     데스크탑은 grid layout 으로 한 화면에 보여 스크롤 불필요.
     모바일은 mp-side-nav 가 header 바로 아래에 stuck 되는 위치로 스크롤.
     hero greeting 은 모바일에서 sticky 아니라 자연 스크롤 → 탭바만 sticky 로 유지. */
  const handleNavWithScroll = useCallback((target: MyPageNavId) => {
    setActiveNavId(target);
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    requestAnimationFrame(() => {
      const sideNav = document.querySelector<HTMLElement>('.mp-side-nav');
      if (!sideNav) return;
      const headerHeight =
        parseInt(
          getComputedStyle(document.documentElement).getPropertyValue('--header-height'),
          10,
        ) || 56;
      /* sideNav.top - headerHeight 만큼 스크롤 → 탭바가 header 바로 아래에 stuck.
         이미 stuck 상태면 .top = headerHeight 라 변동 없음 (자연스럽게 idempotent). */
      const top = window.scrollY + sideNav.getBoundingClientRect().top - headerHeight;
      window.scrollTo({ top, behavior: 'smooth' });
    });
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

  /* ── 활성 view 렌더 ── */
  const renderActiveView = () => {
    switch (activeNavId) {
      case 'orders':
        return <OrdersView />;
      case 'subscription':
        return <SubscriptionView />;
      case 'profile':
        return <ProfileView name={profileDisplayName} email={effectiveEmail} />;
      case 'account':
        return <AccountView onLoggedOut={handleLoggedOut} />;
    }
  };

  return (
    <>
      {/* 모바일 오버스크롤 영역: 상단 = ann-bar 색 (#1E1B16) / 하단 = footer 색 (#4A4845 default).
         hero-wrap 이 sticky sand 풀블리드라 상단 overscroll 은 ann-bar 가 보존. */}
      <OverscrollTop top="#1E1B16" bottom="#4A4845" />

      {/* ── mp-page wrapper (S264 H-1) ──
         hero-wrap (viewport 풀폭 sand) 와 mp-body (max-width 1440 centered) 를 묶음.
         setBodyEl ref 는 mp-page 에 박아 진입 연출이 hero 와 grid 모두 트리거. */}
      <div className="mp-page" ref={setBodyEl}>
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
            <MyPageSideNav
              activeId={activeNavId}
              counts={counts}
              onChange={handleNavWithScroll}
            />
            <MyPagePanel title={NAV_LABELS[activeNavId]}>{renderActiveView()}</MyPagePanel>
          </div>
        </div>
      </div>
    </>
  );
}
