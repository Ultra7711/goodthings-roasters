/* ══════════════════════════════════════════
   Zustand Stores
   ADR-004 Step B: useCartStore 제거. 카트는 TanStack Query `['cart']` 단일 소스.
   - 게스트: localStorage `gtr-guest-cart` (guestCart.ts)
   - 로그인: `/api/cart` (DB + RLS)
   여기 남는 것: useAuthStore (UI 힌트 레이어).
   ══════════════════════════════════════════ */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, AuthResult } from '@/types/auth';
import type { UserAddress } from '@/types/address';
import { clearGuestCart } from './guestCart';
import { DEMO_CREDENTIALS, DEMO_USER } from './mockMyPageData';

/* ── 배송비 기준 (useCart.ts 로 이관, 여기서는 재수출 호환만 유지) ── */
export { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from '@/hooks/useCart';

/* ════════════════════════════════════════
   Auth Store (UI 힌트 레이어)
   ADR-001 3-tier separation:
   - Zustand: UI 힌트 (헤더 라벨, 가드 UX) ← 이 스토어
   - Supabase Session: 세션 원천 (AuthSyncProvider가 동기화)
   - Server + RLS: 보안 경계 (P1-2 getUser(), P2-2 RLS)

   ⚠️  더미 login/register: 개발 데모 전용, 프로덕션 OAuth 플로우 미사용.
   ════════════════════════════════════════ */

type AuthStore = {
  user: User | null;
  /** 표시 전용 사용자명 — localStorage 영속화 대상 (PII 최소화) */
  displayName: string | null;
  isLoggedIn: boolean;
  isLoading: boolean;

  setUser: (user: User) => void;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;

  login: (email: string, password: string) => Promise<AuthResult>;
  register: (
    name: string,
    email: string,
    password: string,
  ) => Promise<AuthResult>;
  updateAddress: (address: UserAddress | null) => void;
};

const MOCK_LATENCY_MS = 400;
const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 세션 종료 공통 처리 — localStorage 잔여 키 삭제 + 게스트 카트 초기화 */
const purgeSession = () => {
  void useAuthStore.persist.clearStorage();
  /* 다음 사용자에게 장바구니 이월 방지 — 게스트 localStorage 비움.
     로그인 모드의 서버 카트는 RLS 로 보호되므로 클라 정리 불필요. */
  clearGuestCart();
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      displayName: null,
      isLoggedIn: false,
      isLoading: false,

      setUser: (user) =>
        set({
          user,
          displayName: user.name,
          isLoggedIn: true,
          isLoading: false,
        }),
      clearUser: () => {
        set({
          user: null,
          displayName: null,
          isLoggedIn: false,
          isLoading: false,
        });
        purgeSession();
      },
      setLoading: (loading) => set({ isLoading: loading }),

      login: async (email, password) => {
        set({ isLoading: true });
        await delay(MOCK_LATENCY_MS);

        if (
          process.env.NODE_ENV === 'development' &&
          email.trim() === DEMO_CREDENTIALS.email &&
          password === DEMO_CREDENTIALS.password
        ) {
          const nextUser: User = { ...DEMO_USER };
          set({
            user: nextUser,
            displayName: nextUser.name,
            isLoggedIn: true,
            isLoading: false,
          });
          return { ok: true };
        }

        set({ isLoading: false });
        return {
          ok: false,
          error: '이메일 또는 비밀번호가 올바르지 않습니다.',
        };
      },

      register: async (name, email) => {
        set({ isLoading: true });
        await delay(MOCK_LATENCY_MS);

        const newUser: User = {
          id: `user-${Date.now()}`,
          email: email.trim(),
          name: name.trim(),
          address: null,
        };
        set({
          user: newUser,
          displayName: newUser.name,
          isLoggedIn: true,
          isLoading: false,
        });
        return { ok: true };
      },

      updateAddress: (address) => {
        const currentUser = get().user;
        if (!currentUser) return;
        set({ user: { ...currentUser, address } });
      },
    }),
    {
      name: 'gtr-auth-store',
      storage: createJSONStorage(() => localStorage),
      /*
       * PII 최소화: user 객체(이메일·전화·주소)는 영속화하지 않는다.
       * Phase 2-F에서 Supabase session 복원으로 user 전체를 서버에서 재조회.
       */
      partialize: (state) => ({
        isLoggedIn: state.isLoggedIn,
        displayName: state.displayName,
      }),
    },
  ),
);
