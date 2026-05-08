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
import { useOrdersQuery } from '@/hooks/useOrders';
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
  /** SSR prefetch 데이터 — TanStack Query initialData 로 주입 (S197 PR-2 §2.6).
     SSR HTML 이 정확한 카드(NextDelivery / RecentOrder / Welcome)로 즉시 렌더되어
     hydration 후 점진 채워지는 flash 차단. */
  initialSubscriptions: Subscription[];
  initialOrders: Order[];
};

export default function MyPagePage({
  initialClaims,
  initialSubscriptions,
  initialOrders,
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

  /* ── Side nav 활성 항목 ── */
  const [activeNavId, setActiveNavId] = useState<MyPageNavId>('orders');

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

  /* ── 데이터: 정기배송 + 주문 (counts + Next 카드)
     initialData = SSR prefetch (page.tsx) → flash 차단 */
  const { subscriptions } = useSubscriptionsQuery(initialSubscriptions);
  const { orders } = useOrdersQuery(initialOrders);

  const activeSubsCount = useMemo(
    () => subscriptions.filter((s) => s.status === 'active').length,
    [subscriptions],
  );

  const counts = useMemo<Partial<Record<MyPageNavId, number>>>(
    () => ({
      orders: orders.length,
      subscription: subscriptions.length,
    }),
    [orders.length, subscriptions.length],
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
      {/* BUG-165: 마이페이지 light bg (#FBF8F3) — (main) 셸의 OverscrollColor default(dark) 부조화 차단.
         cleanup 시 resetColors → 다른 라우트로 navigate 시 default 색상 복귀. */}
      <OverscrollTop top="#FBF8F3" bottom="#FBF8F3" />

      {/* ── V2 §3.2 재구조화 본문 ── */}
      <div className="mp-body">
        <HeroGreeting
          name={displayName}
          ordersCount={orders.length}
          activeSubscriptionsCount={activeSubsCount}
          membershipText={membershipText}
          onLogout={() => void handleLogout()}
          onNavigate={handleHeroNavigate}
        />

        {/* PR-2 §2.3 + §2.13: Hero 카드 분기 — manual override (메타 클릭) ?? auto */}
        {(() => {
          const heroType: HeroCardType =
            manualHeroCard ?? (nextSub ? 'next' : orders.length > 0 ? 'recent' : 'welcome');
          if (heroType === 'next' && nextSub) {
            return (
              <NextDeliveryCard
                sub={nextSub}
                onManage={() => setActiveNavId('subscription')}
              />
            );
          }
          if (heroType === 'recent' && orders.length > 0) {
            return (
              <RecentOrderCard
                order={orders[0]}
                onViewOrders={() => setActiveNavId('orders')}
              />
            );
          }
          return <WelcomeCard userName={displayName} />;
        })()}

        <div className="mp-grid">
          <MyPageSideNav
            activeId={activeNavId}
            counts={counts}
            onChange={setActiveNavId}
          />
          <MyPagePanel title={NAV_LABELS[activeNavId]}>{renderActiveView()}</MyPagePanel>
        </div>
      </div>
    </>
  );
}
