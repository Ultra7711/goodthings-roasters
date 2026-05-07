/* ══════════════════════════════════════════
   MyPagePage — /mypage  (Container)
   설계 결정:
   1. mp-* 클래스: 프로토타입 원본 클래스명 유지 (globals.css)
   2. 좌측(3fr): AccountInfoRow + AddressSection + SubscriptionEditor + AccountManagement
   3. 우측(2fr): OrderHistory (sticky)
   4. useAuthGuard: 미로그인 시 /login 리다이렉트
   5. BUG-168 Fix C: initialClaims SSR fallback
   ════════════════════════════════════════ */

'use client';

import './MyPagePage.css';
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { useDefaultAddressQuery, useSaveDefaultAddress } from '@/hooks/useDefaultAddress';
import { supabase } from '@/lib/supabase';
import type { AuthClaims } from '@/lib/auth/getClaims';
import type { UserAddress } from '@/types/address';
import { useToast } from '@/hooks/useToast';
import { setAddrOpen } from '@/lib/myPageUiStore';
import SiteHeader from '@/components/layout/SiteHeader';
import AccountInfoRow from '@/components/auth/mypage/AccountInfoRow';
import AddressSection from '@/components/auth/mypage/AddressSection';
import SubscriptionEditor from '@/components/auth/mypage/SubscriptionEditor';
import AccountManagement from '@/components/auth/mypage/AccountManagement';
import OrderHistory from '@/components/auth/mypage/OrderHistory';

type MyPagePageProps = {
  /** 서버 가드(`requireAuth`) 결과 — SSR 단계 fallback 으로 사용
   *  (BUG-168 Fix C: hydration 전에도 사용자 데이터 즉시 표시) */
  initialClaims: AuthClaims;
};

/* ══════════════════════════════════════════ */
export default function MyPagePage({ initialClaims }: MyPagePageProps) {
  const router = useRouter();
  const { show: toast } = useToast();
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

  /* 기본 배송지: addresses 테이블에 persist (S174).
     - useDefaultAddressQuery: GET /api/account/addresses (RLS) → default 1건
     - useSaveDefaultAddress: PUT /api/account/addresses → upsert
     - close/toast 는 mutation 결과에 따라 본 컴포넌트가 처리. */
  /* isPending: enabled=false 이거나 첫 fetch 진행 중 (data === undefined) 인
     모든 상태를 포괄. isLoading 은 enabled=false 시 false 라 placeholder 누락. */
  const { data: addressData, isPending: isAddressLoading } = useDefaultAddressQuery();
  const saveAddress = useSaveDefaultAddress();
  const handleSaveAddress = useCallback(
    (addr: UserAddress) => {
      saveAddress.mutate(addr, {
        onSuccess: () => {
          setAddrOpen(false);
          toast('배송지가 저장되었습니다.');
        },
        onError: (err) => {
          console.error('[mypage.address] save failed', err);
          toast('배송지 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        },
      });
    },
    [saveAddress, toast],
  );

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

  /* AccountManagement onLoggedOut callback — 탈퇴 성공 후 redirect */
  const handleLoggedOut = useCallback(() => {
    bypassRedirect();
    router.replace('/');
  }, [bypassRedirect, router]);

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
              <AccountInfoRow name={metaName ?? emailHandle ?? ''} email={effectiveEmail} />
              <AddressSection
                initialAddress={addressData ?? null}
                isLoading={isAddressLoading}
                onSaved={handleSaveAddress}
              />
            </div>
          </div>

          {/* ── 정기배송 관리 ── */}
          <SubscriptionEditor />

          {/* ── 계정 관리 ── */}
          <AccountManagement onLoggedOut={handleLoggedOut} />
        </div>

        {/* ══ 우측: 주문 내역 ══ */}
        <div className="mp-right">
          <OrderHistory />
        </div>
      </div>
    </div>
  );
}
