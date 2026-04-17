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

/* ══════════════════════════════════════════
   서버 미러 (Session 14)
   ADR-004 Step B 에서 TanStack Query 로 대체 시 제거.
   동적 import — store ↔ cartSync 순환 회피.
   ════════════════════════════════════════ */

type MirrorAddContext = {
  addedLocalId: number | null;
  mergedServerId: string | null;
  mergedQty: number;
};

type MirrorAddPayload = {
  slug: string;
  volume: string | null;
  type: CartItem['type'];
  period: string | null;
  qty: number;
};

async function mirrorAddOrPatch(
  payload: MirrorAddPayload,
  ctx: MirrorAddContext,
): Promise<void> {
  if (!payload.volume) return;
  const { pushAddToServer, pushPatchToServer, toSubscriptionPeriod } =
    await import('./cartSync');

  /* 기존 항목 수량 합산인 경우 — PATCH (serverId 이미 존재) */
  if (ctx.mergedServerId) {
    await pushPatchToServer(ctx.mergedServerId, ctx.mergedQty);
    return;
  }

  /* 신규 — POST 후 반환된 serverId 를 해당 로컬 아이템에 기록 */
  const serverId = await pushAddToServer({
    productSlug: payload.slug,
    volume: payload.volume,
    quantity: Math.min(99, Math.max(1, payload.qty)),
    itemType: payload.type,
    subscriptionPeriod:
      payload.type === 'subscription'
        ? toSubscriptionPeriod(payload.period)
        : null,
  });

  if (serverId && ctx.addedLocalId !== null) {
    useCartStore.setState((state) => ({
      items: state.items.map((i) =>
        i.id === ctx.addedLocalId ? { ...i, serverId } : i,
      ),
    }));
  }
}

async function mirrorPatch(serverId: string, qty: number): Promise<void> {
  const { pushPatchToServer } = await import('./cartSync');
  await pushPatchToServer(serverId, qty);
}

async function mirrorDelete(serverId: string): Promise<void> {
  const { pushDeleteToServer } = await import('./cartSync');
  await pushDeleteToServer(serverId);
}

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
  /** items 전체 교체 (서버 하이드레이션 전용 — Session 14) */
  setItems: (items: CartItem[]) => void;
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

  setItems: (items) => set({ items }),

  addItem: (payload) => {
    let addedLocalId: number | null = null;
    let mergedServerId: string | null = null;
    let mergedQty = 0;
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
        const existing = state.items[existIdx];
        mergedServerId = existing.serverId ?? null;
        mergedQty = Math.min(99, existing.qty + payload.qty);
        const updated = state.items.map((item, idx) =>
          idx === existIdx ? { ...item, qty: mergedQty } : item,
        );
        return { items: updated };
      }

      /* 신규 상품 추가 */
      addedLocalId = Date.now();
      const newItem: CartItem = {
        id: addedLocalId,
        serverId: null,
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

    /* 로그인 상태면 서버 미러 — fire-and-forget (Session 14).
       실패해도 로컬 상태는 유지. 다음 하이드레이션 시점에 정합성 복원. */
    if (typeof window !== 'undefined' && useAuthStore.getState().isLoggedIn) {
      void mirrorAddOrPatch(
        {
          slug: payload.slug,
          volume: payload.volume ?? null,
          type: payload.type ?? 'normal',
          period: payload.period ?? null,
          qty: payload.qty,
        },
        { addedLocalId, mergedServerId, mergedQty },
      );
    }
  },

  removeItem: (id) => {
    let targetServerId: string | null = null;
    set((state) => {
      const target = state.items.find((i) => i.id === id);
      targetServerId = target?.serverId ?? null;
      return { items: state.items.filter((i) => i.id !== id) };
    });
    if (
      targetServerId &&
      typeof window !== 'undefined' &&
      useAuthStore.getState().isLoggedIn
    ) {
      void mirrorDelete(targetServerId);
    }
  },

  updateQty: (id, delta) => {
    let targetServerId: string | null = null;
    let nextQty = 0;
    set((state) => ({
      items: state.items.map((item) => {
        if (item.id !== id) return item;
        nextQty = Math.max(1, item.qty + delta);
        targetServerId = item.serverId ?? null;
        return { ...item, qty: nextQty };
      }),
    }));
    if (
      targetServerId &&
      typeof window !== 'undefined' &&
      useAuthStore.getState().isLoggedIn
    ) {
      void mirrorPatch(targetServerId, nextQty);
    }
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
   Auth Store (UI 힌트 레이어)
   ADR-001 3-tier separation:
   - Zustand: UI 힌트 (헤더 라벨, 가드 UX) ← 이 스토어
   - Supabase Session: 세션 원천 (AuthSyncProvider가 동기화)
   - Server + RLS: 보안 경계 (P1-2 getUser(), P2-2 RLS)

   ⚠️  더미 login/register: 개발 데모 전용, 프로덕션 OAuth 플로우 미사용.
       비밀번호 변경: usePasswordChangeForm → supabase.auth.updateUser() 직접 처리 (P2-1B).
       로그아웃/탈퇴: MyPagePage → supabase.auth.signOut() 직접 호출 (P2-1A).
   ════════════════════════════════════════ */

type AuthStore = {
  user: User | null;
  /** 표시 전용 사용자명 — localStorage 영속화 대상 (PII 최소화) */
  displayName: string | null;
  isLoggedIn: boolean;
  isLoading: boolean;

  /** Supabase User로부터 매핑 — AuthSyncProvider(P0-2) 전용 */
  setUser: (user: User) => void;
  /** 세션 종료 시 Zustand 상태 초기화 — AuthSyncProvider SIGNED_OUT 핸들러 전용 */
  clearUser: () => void;
  /** 로딩 상태 */
  setLoading: (loading: boolean) => void;

  /** 로그인 (개발 데모 전용 — OAuth 서비스는 LoginPage 소셜 버튼 사용) */
  login: (email: string, password: string) => Promise<AuthResult>;
  /** 회원가입 (개발 데모 전용 — OAuth 서비스는 소셜 로그인만 지원) */
  register: (
    name: string,
    email: string,
    password: string,
  ) => Promise<AuthResult>;
  /** 기본 배송지 변경 — TODO(Phase 3): Supabase profiles 테이블 연동으로 교체 */
  updateAddress: (address: UserAddress | null) => void;
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

        /* 데모 로그인 — 개발 환경 전용 (프로덕션 빌드에서 실행 안 됨) */
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
