/* ══════════════════════════════════════════
   Zustand Stores
   장바구니 + 인증 상태 관리
   프로토타입 cartItems / isLoggedIn 로직 이식
   ══════════════════════════════════════════ */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CartItem, AddToCartPayload } from '@/types/cart';
import type { User, AuthResult } from '@/types/auth';
import type { UserAddress } from '@/types/address';
import { parsePrice } from './utils';
import { DEMO_CREDENTIALS, DEMO_USER } from './mockMyPageData';

/* ── 배송비 기준 ── */
export const FREE_SHIPPING_THRESHOLD = 30000;
export const SHIPPING_FEE = 3000;

/* ════════════════════════════════════════
   Cart Store
   ════════════════════════════════════════ */

type CartStore = {
  items: CartItem[];
  /** 드로어 열림 상태 */
  isDrawerOpen: boolean;
  /** 드로어 열기 */
  openDrawer: () => void;
  /** 드로어 닫기 */
  closeDrawer: () => void;
  /** 장바구니에 상품 추가 (동일 상품이면 수량 합산) */
  addItem: (payload: AddToCartPayload) => void;
  /** 장바구니에서 상품 제거 */
  removeItem: (id: number) => void;
  /** 수량 변경 (delta: +1 또는 -1, 최소 1) */
  updateQty: (id: number, delta: number) => void;
  /** 장바구니 전체 비우기 */
  clearCart: () => void;
  /** 총 수량 */
  totalQty: () => number;
  /** 소계 금액 */
  subtotal: () => number;
  /** 배송비 (소계 기준 무료 배송 판단) */
  shippingFee: () => number;
  /** 총 결제 금액 */
  totalPrice: () => number;
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
  items: [],
  isDrawerOpen: false,
  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),

  addItem: (payload) => {
    set((state) => {
      const existIdx = state.items.findIndex(
        (i) =>
          i.slug === payload.slug &&
          i.type === (payload.type ?? 'normal') &&
          i.period === (payload.period ?? null) &&
          i.volume === (payload.volume ?? null),
      );

      if (existIdx >= 0) {
        /* 동일 상품: 수량 합산 (불변 패턴) */
        const updated = state.items.map((item, idx) =>
          idx === existIdx ? { ...item, qty: item.qty + payload.qty } : item,
        );
        return { items: updated };
      }

      /* 신규 상품 추가 */
      const newItem: CartItem = {
        id: Date.now(),
        slug: payload.slug,
        name: payload.name,
        price: payload.price,
        priceNum: payload.priceNum ?? parsePrice(payload.price),
        qty: payload.qty,
        color: payload.color ?? '#ECEAE6',
        image: payload.image ?? null,
        type: payload.type ?? 'normal',
        period: payload.period ?? null,
        category: payload.category ?? '',
        volume: payload.volume ?? null,
      };
      return { items: [...state.items, newItem] };
    });
  },

  removeItem: (id) => {
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
    }));
  },

  updateQty: (id, delta) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? { ...item, qty: Math.max(1, item.qty + delta) }
          : item,
      ),
    }));
  },

  clearCart: () => set({ items: [] }),

  totalQty: () => get().items.reduce((sum, i) => sum + i.qty, 0),

  subtotal: () => get().items.reduce((sum, i) => sum + i.priceNum * i.qty, 0),

  shippingFee: () => {
    const sub = get().subtotal();
    if (sub === 0) return 0;
    return sub >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  },

  totalPrice: () => get().subtotal() + get().shippingFee(),
    }),
    {
      name: 'gtr-cart-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    },
  ),
);

/* ════════════════════════════════════════
   Auth Store
   Supabase Auth 연동 전 더미 구조
   Phase 2-F에서 supabase.auth 호출로 교체
   ════════════════════════════════════════ */

type AuthStore = {
  user: User | null;
  /** 표시 전용 사용자명 — localStorage 영속화 대상 (PII 최소화) */
  displayName: string | null;
  isLoggedIn: boolean;
  isLoading: boolean;

  /** 직접 user 세팅 (내부/테스트용) */
  setUser: (user: User) => void;
  /** 세션 종료 */
  clearUser: () => void;
  /** 로딩 상태 */
  setLoading: (loading: boolean) => void;

  /** 로그인 (더미: 데모 계정만 성공) */
  login: (email: string, password: string) => Promise<AuthResult>;
  /** 회원가입 (더미: 항상 성공) */
  register: (
    name: string,
    email: string,
    password: string,
  ) => Promise<AuthResult>;
  /** 로그아웃 */
  logout: () => void;
  /** 기본 배송지 변경 */
  updateAddress: (address: UserAddress | null) => void;
  /** 비밀번호 변경 (더미: 현재 비번이 DEMO_CREDENTIALS.password와 일치해야 성공) */
  updatePassword: (
    currentPw: string,
    nextPw: string,
  ) => Promise<AuthResult>;
  /** 회원 탈퇴 (더미: 세션 종료) */
  withdraw: () => Promise<AuthResult>;
};

/** 더미 지연 (네트워크 체감) */
const MOCK_LATENCY_MS = 400;
const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 세션 종료 공통 처리 — localStorage 잔여 키 삭제 + 장바구니 비움 */
const purgeSession = () => {
  /* 민감 정보 흔적 제거: partialize 범위 밖 레거시 키 포함 완전 삭제 */
  void useAuthStore.persist.clearStorage();
  /* 세션 연동 장바구니도 비움 — 다음 사용자에게 이월 방지 */
  useCartStore.getState().clearCart();
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

        /* 더미 가입: 입력한 이름/이메일로 로그인 상태 전환 */
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

      logout: () => {
        set({
          user: null,
          displayName: null,
          isLoggedIn: false,
          isLoading: false,
        });
        purgeSession();
      },

      updateAddress: (address) => {
        const currentUser = get().user;
        if (!currentUser) return;
        set({ user: { ...currentUser, address } });
      },

      updatePassword: async (currentPw) => {
        set({ isLoading: true });
        await delay(MOCK_LATENCY_MS);

        /* 데모 사용자 기준: 현재 비번이 데모 비번과 일치해야 성공 */
        if (currentPw !== DEMO_CREDENTIALS.password) {
          set({ isLoading: false });
          return { ok: false, error: '현재 비밀번호가 일치하지 않습니다.' };
        }

        set({ isLoading: false });
        return { ok: true };
      },

      withdraw: async () => {
        set({ isLoading: true });
        await delay(MOCK_LATENCY_MS);
        set({
          user: null,
          displayName: null,
          isLoggedIn: false,
          isLoading: false,
        });
        purgeSession();
        return { ok: true };
      },
    }),
    {
      name: 'gtr-auth-store',
      storage: createJSONStorage(() => localStorage),
      /*
       * PII 최소화: user 객체(이메일·전화·주소)는 영속화하지 않는다.
       * localStorage에는 세션 플래그와 표시 전용 이름만 저장.
       * Phase 2-F에서 Supabase session 복원으로 user 전체를 서버에서 재조회.
       * 데모 단계 한계: 새로고침 시 상세 필드(이메일·주소 등)가 비어 보이며,
       * 이는 Supabase 연동 시 /api/user/me 호출로 자연스럽게 해결됨.
       */
      partialize: (state) => ({
        isLoggedIn: state.isLoggedIn,
        displayName: state.displayName,
      }),
    },
  ),
);
