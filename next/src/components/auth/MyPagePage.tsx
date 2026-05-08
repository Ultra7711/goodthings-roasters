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
import { useToast } from '@/hooks/useToast';
import { useSubscriptionsQuery } from '@/hooks/useSubscriptions';
import { useOrdersQuery } from '@/hooks/useOrders';
import {
  setSubEditId,
  setSkipConfirmSubId,
  setPauseConfirmSubId,
} from '@/lib/myPageUiStore';
import SiteHeader from '@/components/layout/SiteHeader';
import HeroGreeting from '@/components/auth/mypage/HeroGreeting';
import NextDeliveryCard from '@/components/auth/mypage/NextDeliveryCard';
import MyPageSideNav, { type MyPageNavId } from '@/components/auth/mypage/MyPageSideNav';
import MyPagePanel from '@/components/auth/mypage/MyPagePanel';
import OrdersView from '@/components/auth/mypage/views/OrdersView';
import SubscriptionView from '@/components/auth/mypage/views/SubscriptionView';
import ProfileView from '@/components/auth/mypage/views/ProfileView';
import AddressesView from '@/components/auth/mypage/views/AddressesView';
import AccountView from '@/components/auth/mypage/views/AccountView';

type MyPagePageProps = {
  initialClaims: AuthClaims;
};

/** "YYYY.MM.DD" 형식 nextDate → 오늘 기준 D-N (음수면 null) */
function calcDaysUntil(nextDate: string): number | null {
  const [y, m, d] = nextDate.split('.').map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return days >= 0 ? days : null;
}

export default function MyPagePage({ initialClaims }: MyPagePageProps) {
  const router = useRouter();
  const { show: toast } = useToast();
  const { bypassRedirect } = useAuthGuard();

  const { user: supabaseUser } = useSupabaseSession();
  const meta = (supabaseUser?.user_metadata ?? initialClaims.metadata) as Record<string, unknown>;
  const metaName = (meta.full_name as string | undefined) ?? (meta.name as string | undefined);
  const effectiveEmail = supabaseUser?.email ?? initialClaims.email;
  const emailHandle = effectiveEmail.split('@')[0];
  const displayName = metaName ?? emailHandle ?? '';

  /* 가입 개월 수 — supabaseUser.created_at 또는 initialClaims 의 createdAt (있을 시) */
  const createdAtIso =
    supabaseUser?.created_at ??
    (initialClaims as unknown as { createdAt?: string }).createdAt ??
    null;
  const membershipMonths = useMemo(() => {
    if (!createdAtIso) return null;
    const created = new Date(createdAtIso);
    if (isNaN(created.getTime())) return null;
    const now = new Date();
    const months =
      (now.getFullYear() - created.getFullYear()) * 12 +
      (now.getMonth() - created.getMonth());
    return Math.max(months, 0);
  }, [createdAtIso]);

  /* ── Side nav 활성 항목 ── */
  const [activeNavId, setActiveNavId] = useState<MyPageNavId>('orders');

  /* ── 데이터: 정기배송 + 주문 (counts + Next 카드) ── */
  const { subscriptions } = useSubscriptionsQuery();
  const { orders } = useOrdersQuery();

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

  const daysUntilNext = useMemo(() => {
    if (!nextSub) return null;
    return calcDaysUntil(nextSub.nextDate);
  }, [nextSub]);

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

  /* ── NextCard 액션: SubscriptionEditor 의 confirm 모달 활용 ── */
  const handleNextPause = useCallback(() => {
    if (!nextSub) return;
    setPauseConfirmSubId(nextSub.id);
  }, [nextSub]);

  const handleNextSkip = useCallback(() => {
    if (!nextSub) return;
    setSkipConfirmSubId(nextSub.id);
  }, [nextSub]);

  const handleNextEdit = useCallback(() => {
    if (!nextSub) return;
    /* 정기배송 view 로 이동 + 해당 항목 편집 모드 진입 */
    setActiveNavId('subscription');
    setSubEditId(nextSub.id);
  }, [nextSub]);

  /* ── 활성 view 렌더 ── */
  const renderActiveView = () => {
    switch (activeNavId) {
      case 'orders':
        return <OrdersView />;
      case 'subscription':
        return <SubscriptionView />;
      case 'profile':
        return <ProfileView name={metaName ?? emailHandle ?? ''} email={effectiveEmail} />;
      case 'addresses':
        return <AddressesView />;
      case 'account':
        return <AccountView onLoggedOut={handleLoggedOut} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh' }}>
      <SiteHeader />

      {/* ── V2 §3.2 재구조화 본문 ── */}
      <div className="mp-body">
        <HeroGreeting
          name={displayName}
          ordersCount={orders.length}
          activeSubscriptionsCount={activeSubsCount}
          membershipMonths={membershipMonths}
          onLogout={() => void handleLogout()}
        />

        <NextDeliveryCard
          sub={nextSub}
          daysUntilNext={daysUntilNext}
          onPause={handleNextPause}
          onSkip={handleNextSkip}
          onEdit={handleNextEdit}
        />

        <div className="mp-grid">
          <MyPageSideNav
            activeId={activeNavId}
            counts={counts}
            onChange={setActiveNavId}
          />
          <MyPagePanel>{renderActiveView()}</MyPagePanel>
        </div>
      </div>
    </div>
  );
}
