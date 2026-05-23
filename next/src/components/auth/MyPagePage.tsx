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
import type { AuthClaims } from '@/lib/auth/getClaims';
import type { Subscription } from '@/types/subscription';
import type { Order } from '@/types/order';
import { useToast } from '@/hooks/useToast';
import { useSubscriptionsQuery } from '@/hooks/useSubscriptions';
import OverscrollTop from '@/components/ui/OverscrollTop';
import HeroGreeting from '@/components/auth/mypage/HeroGreeting';
import NextDeliveryCard from '@/components/auth/mypage/NextDeliveryCard';
import RecentOrderCard from '@/components/auth/mypage/RecentOrderCard';
import WelcomeCard from '@/components/auth/mypage/WelcomeCard';
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
  /** S253: Hero RecentOrderCard 용 1건 (orders[0] 대체).
     OrderHistory 패널이 mount 후 useOrdersQuery 가 자체 fetch 로 전체 가져옴. */
  initialHeroOrder: Order | null;
  /** S253: 사이드 nav + HeroGreeting 카운트 표시용 (count-only RPC 결과).
     마이페이지 안에서 주문 mutation 발생 안 함 — stale 위험 0. */
  initialOrdersCount: number;
};

export default function MyPagePage({
  initialClaims,
  initialSubscriptions,
  initialHeroOrder,
  initialOrdersCount,
}: MyPagePageProps) {
  const router = useRouter();
  const { show: toast } = useToast();
  const { bypassRedirect } = useAuthGuard();

  const { user: supabaseUser } = useSupabaseSession();
  const meta = (supabaseUser?.user_metadata ?? initialClaims.metadata) as Record<string, unknown>;
  const metaName = (meta.full_name as string | undefined) ?? (meta.name as string | undefined);
  const effectiveEmail = supabaseUser?.email ?? initialClaims.email;
  const emailHandle = effectiveEmail.split('@')[0];
  const displayName = metaName ?? emailHandle ?? '';

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

  /* ── 탭 전환 공통 핸들러 (Hero CTA + SideNav 탭바) — 모바일 스크롤 포함 (S198).
     데스크탑은 grid layout 으로 한 화면에 보여 스크롤 불필요.
     모바일은 hero sand bg 의 bottom 이 sticky 헤더의 bottom 에 정확히 정렬되는 위치로 이동 —
     "히어로 sand 배경 끝단과 헤더가 맞닿는 순간". querySelector(.mp-next-card) 로 hero card
     element 의 viewport bottom 좌표 계산 후 window.scrollTo. */
  const handleNavWithScroll = useCallback((target: MyPageNavId) => {
    setActiveNavId(target);
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    requestAnimationFrame(() => {
      const card = document.querySelector<HTMLElement>('.mp-body .mp-next-card');
      if (!card) return;
      const headerHeight =
        parseInt(
          getComputedStyle(document.documentElement).getPropertyValue('--header-height'),
          10,
        ) || 56;
      const top = window.scrollY + card.getBoundingClientRect().bottom - headerHeight;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  }, []);

  /* ── Hero 카드 수동 전환 (메타 항목 클릭 · S197 PR-2 §2.13).
     null = 자동 분기 (정기 ≥1 → next / 주문 ≥1 → recent / 둘 다 0 → welcome).
     사용자가 메타 클릭 시 override. */
  type HeroCardType = 'next' | 'recent' | 'welcome';
  const [manualHeroCard, setManualHeroCard] = useState<HeroCardType | null>(null);

  const handleHeroNavigate = useCallback((id: MyPageNavId) => {
    if (id === 'orders') setManualHeroCard('recent');
    else if (id === 'subscription') setManualHeroCard('next');
    else if (id === 'profile') setManualHeroCard('welcome');
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

  /* Next 카드: nextDate 가 가장 가까운 활성 정기배송 1건 */
  const nextSub = useMemo(() => {
    const candidates = subscriptions.filter((s) => s.status !== 'paused');
    if (candidates.length === 0) {
      /* paused 만 있으면 paused 첫 번째 노출 (Next eyebrow 가 "일시정지 중") */
      return subscriptions[0] ?? null;
    }
    return [...candidates].sort((a, b) => a.nextDate.localeCompare(b.nextDate))[0] ?? null;
  }, [subscriptions]);

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
        return <ProfileView name={metaName ?? emailHandle ?? ''} email={effectiveEmail} />;
      case 'account':
        return <AccountView onLoggedOut={handleLoggedOut} />;
    }
  };

  return (
    <>
      {/* 모바일 오버스크롤 영역: 상단 = ann-bar 색 (#1E1B16) / 하단 = footer 색 (#4A4845 default).
         메인 페이지와 동일 패턴 — 페이지 콘텐츠 영역 (mp-body #FBF8F3) 위/아래로 노출되는
         오버스크롤이 ann-bar / footer 와 시각적으로 연속되게. BUG-165 에서 #FBF8F3 단일색
         적용했던 결정 회귀 (사용자 디자인 변경). */}
      <OverscrollTop top="#1E1B16" />

      {/* ── V2 §3.2 재구조화 본문 ── */}
      <div className="mp-body" ref={setBodyEl}>
        <HeroGreeting
          name={displayName}
          ordersCount={initialOrdersCount}
          activeSubscriptionsCount={activeSubsCount}
          membershipText={membershipText}
          onLogout={() => void handleLogout()}
          onNavigate={handleHeroNavigate}
        />

        {/* PR-2 §2.3 + §2.13: Hero 카드 분기 — manual override (메타 클릭) ?? auto.
           S253: orders[0] → initialHeroOrder (SSR 1건 fetch · OrderHistory 펼침 무관 즉시 노출). */}
        {(() => {
          const heroType: HeroCardType =
            manualHeroCard ?? (nextSub ? 'next' : initialHeroOrder ? 'recent' : 'welcome');
          if (heroType === 'next' && nextSub) {
            return (
              <NextDeliveryCard
                sub={nextSub}
                onManage={() => handleNavWithScroll('subscription')}
              />
            );
          }
          if (heroType === 'recent' && initialHeroOrder) {
            return (
              <RecentOrderCard
                order={initialHeroOrder}
                onViewOrders={() => handleNavWithScroll('orders')}
              />
            );
          }
          return <WelcomeCard userName={displayName} />;
        })()}

        <div className="mp-grid">
          <MyPageSideNav
            activeId={activeNavId}
            counts={counts}
            onChange={handleNavWithScroll}
          />
          <MyPagePanel title={NAV_LABELS[activeNavId]}>{renderActiveView()}</MyPagePanel>
        </div>
      </div>
    </>
  );
}
