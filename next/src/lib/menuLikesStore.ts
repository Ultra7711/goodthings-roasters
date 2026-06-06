/* ══════════════════════════════════════════
   menuLikesStore — 카페 메뉴 좋아요 글로벌 store

   설계 의도 (S116):
   - /menu 가 Static (○) 라우트 → SSR 시점에 likes 못 받음 → 클라이언트 fetch
   - 기존 useMenuLikes(CafeMenuPage 내부 호출) 는 fetch 도착 시 페이지 전체
     리렌더 → 카드 props 변경 → inline transitionDelay 재적용 → 진입 연출 흔들림
   - 격리: likes 를 페이지 props 에서 분리해 외부 store 화. MenuLikeButton /
     MenuPopularBadge 가 menuId 만 받고 자체 구독 → 카드 자체는 likes 모름
     → ShopCard 와 동등 stability

   업계 통상 패턴 (sort/뱃지 = fetch snapshot, 카운트 = optimistic):
   - counts / liked: 항상 live (사용자 토글 즉시 반영)
   - sortCommitted: 페이지 마운트 시점 snapshot. 페이지 떠날 때까지 fixed.
     첫 마운트는 비어있음(NEW only sort) — likes 도착해도 sort 변동 없음.
     재진입(gtr:route-change · gtr:menu-reset) 시 그 시점 popular 으로 갱신.
   - badgesCommitted: 첫 likes 도착 시 자동 1회 fade-in. 재진입 시 갱신.
     사용자 토글로 변동 없음.

   HMR 보호: globalThis 에 store 인스턴스 보존 (toastStore.ts 동일 패턴).
   ══════════════════════════════════════════ */

'use client';

import { useSyncExternalStore } from 'react';
import { getSessionSnapshot } from '@/hooks/useSupabaseSession';
import { showToast } from '@/lib/toastStore';

type Listener = () => void;

type State = {
  counts: Record<string, number>;
  liked: Set<string>;
  sortCommitted: Record<string, 1 | 2 | 3>;
  badgesCommitted: Record<string, 1 | 2 | 3>;
  loading: boolean;
};

type StoreInternal = {
  state: State;
  listeners: Set<Listener>;
  fetched: boolean;
  pending: Set<string>;
};

const STORE_KEY = '__gtr_menu_likes_store__';

function getStore(): StoreInternal {
  const g = globalThis as unknown as Record<string, StoreInternal | undefined>;
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = {
      state: {
        counts: {},
        liked: new Set<string>(),
        sortCommitted: {},
        badgesCommitted: {},
        loading: true,
      },
      listeners: new Set<Listener>(),
      fetched: false,
      pending: new Set<string>(),
    };
  }
  return g[STORE_KEY]!;
}

function emit() {
  const store = getStore();
  store.listeners.forEach((l) => l());
}

function setState(updater: (s: State) => State) {
  const store = getStore();
  store.state = updater(store.state);
  emit();
}

export function subscribe(listener: Listener): () => void {
  const store = getStore();
  store.listeners.add(listener);
  return () => { store.listeners.delete(listener); };
}

export function getSnapshot(): State {
  return getStore().state;
}

const SERVER_SNAPSHOT: State = {
  counts: {},
  liked: new Set<string>(),
  sortCommitted: {},
  badgesCommitted: {},
  loading: true,
};

export function getServerSnapshot(): State {
  return SERVER_SNAPSHOT;
}

/** 인기 카운트 → 1~3위 매핑 */
function computePopularRanks(counts: Record<string, number>): Record<string, 1 | 2 | 3> {
  const sorted = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort(([, a], [, b]) => b - a);
  const ranks: Record<string, 1 | 2 | 3> = {};
  sorted.slice(0, 3).forEach(([id], i) => {
    ranks[id] = (i + 1) as 1 | 2 | 3;
  });
  return ranks;
}

type MenuLikesResponse = {
  data: {
    counts: Record<string, number>;
    liked: string[];
  };
};

type ToggleResponse = {
  data: {
    liked: boolean;
    count: number;
  };
};

/** 마운트 시 1회 호출 — 중복 호출 안전 */
export async function fetchMenuLikes(): Promise<void> {
  const store = getStore();
  if (store.fetched) return;
  store.fetched = true;

  try {
    const res = await fetch('/api/menu-likes');
    const json = (await res.json()) as MenuLikesResponse;
    const counts = json.data?.counts ?? {};
    const liked = new Set<string>(json.data?.liked ?? []);
    const popular = computePopularRanks(counts);

    setState((s) => ({
      ...s,
      counts,
      liked,
      /* 첫 도착 시 badgesCommitted 자동 채움 (fade-in).
         이미 채워져 있다면(재진입 commit 후) 덮지 않음. */
      badgesCommitted: Object.keys(s.badgesCommitted).length > 0
        ? s.badgesCommitted
        : popular,
      loading: false,
    }));
  } catch {
    setState((s) => ({ ...s, loading: false }));
  }
}

/** 재진입 시 호출 — sort + 뱃지 둘 다 그 시점 popular 으로 갱신 */
export function commitMenuRanksOnReentry(): void {
  const { state } = getStore();
  const popular = computePopularRanks(state.counts);
  setState((s) => ({
    ...s,
    sortCommitted: popular,
    badgesCommitted: popular,
  }));
}

/**
 * counts-only SSR hydrate (S247 폴리싱).
 *
 * /menu 페이지 dynamic 화 회피 — counts 는 SSR 'use cache' snapshot 으로 받고
 * user liked 만 client fetchMyMenuLikes 로 분리. counts/sortCommitted/badgesCommitted
 * 모두 SSR 시점 popular 으로 fix → 정렬·뱃지 점프 0. liked 만 client 도착 후 채워짐.
 *
 * S247 fix: store.fetched=false 명시 reset — 계정 전환 (logout→다른 계정 login)
 * 시 globalThis store 가 잔존하면 이전 사용자 liked 가 그대로 보이는 회귀 발생.
 * hydrate 시점에 fetched 를 reset 하여 fetchMyMenuLikes 가 매번 fresh fetch 하도록.
 * 같은 계정 재진입은 동일 응답 → React selector boolean 동일 → 리렌더 없음 (안전).
 */
export function hydrateMenuLikesCounts(counts: Record<string, number>): void {
  const popular = computePopularRanks(counts);
  setState((s) => ({
    ...s,
    counts,
    sortCommitted: popular,
    badgesCommitted: popular,
    loading: false,
  }));
  getStore().fetched = false;
}

/**
 * client-side user liked 1회 fetch (S247 폴리싱).
 *
 * SSR 에서 counts 만 받은 후, 로그인 사용자의 liked menu_id 목록만 client 에서
 * 적용. counts 는 응답에 포함되어 있어도 무시 — sort/badges 점프 회피.
 *
 * 중복 호출 안전: store.fetched 플래그 사용.
 */
export async function fetchMyMenuLikes(): Promise<void> {
  const store = getStore();
  if (store.fetched) return;
  store.fetched = true;

  try {
    const res = await fetch('/api/menu-likes');
    const json = (await res.json()) as MenuLikesResponse;
    const liked = new Set<string>(json.data?.liked ?? []);

    setState((s) => ({ ...s, liked }));
  } catch {
    // 실패 무시 — liked 미반영 (좋아요 표시만 누락, 정렬/뱃지는 SSR 시점 유효)
  }
}

export async function toggleMenuLike(menuId: string): Promise<void> {
  const store = getStore();
  if (store.pending.has(menuId)) return;

  const { isLoggedIn } = getSessionSnapshot();
  if (!isLoggedIn) {
    showToast('좋아요를 누르려면 로그인이 필요해요');
    return;
  }

  store.pending.add(menuId);

  const wasLiked = store.state.liked.has(menuId);
  const prevCount = store.state.counts[menuId] ?? 0;

  // 낙관적 업데이트 (counts/liked 만 — committed 들은 변동 없음)
  setState((s) => {
    const nextLiked = new Set(s.liked);
    if (wasLiked) nextLiked.delete(menuId);
    else nextLiked.add(menuId);
    return {
      ...s,
      liked: nextLiked,
      counts: {
        ...s.counts,
        [menuId]: wasLiked ? Math.max(0, prevCount - 1) : prevCount + 1,
      },
    };
  });

  try {
    const res = await fetch(`/api/menu-likes/${menuId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('toggle failed');

    const json = (await res.json()) as ToggleResponse;
    const result = json.data;

    setState((s) => {
      const nextLiked = new Set(s.liked);
      if (result.liked) nextLiked.add(menuId);
      else nextLiked.delete(menuId);
      return {
        ...s,
        liked: nextLiked,
        counts: { ...s.counts, [menuId]: result.count },
      };
    });
  } catch {
    // 롤백
    setState((s) => {
      const nextLiked = new Set(s.liked);
      if (wasLiked) nextLiked.add(menuId);
      else nextLiked.delete(menuId);
      return {
        ...s,
        liked: nextLiked,
        counts: { ...s.counts, [menuId]: prevCount },
      };
    });
  } finally {
    store.pending.delete(menuId);
  }
}

/* ════════════════════════════════════════
   React hooks — useSyncExternalStore selector

   selector 가 매 호출마다 같은 reference 를 반환해야 무한 루프가 안 남.
   원시값(number/boolean/null) 은 자동 OK.
   객체 반환 시는 상위 state reference 를 그대로 노출.
   ════════════════════════════════════════ */

export function useMenuLikesCount(menuId: string): number {
  return useSyncExternalStore(
    subscribe,
    () => getStore().state.counts[menuId] ?? 0,
    () => 0,
  );
}

export function useMenuLiked(menuId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => getStore().state.liked.has(menuId),
    () => false,
  );
}

export function useMenuPopularRank(menuId: string): 1 | 2 | 3 | null {
  return useSyncExternalStore(
    subscribe,
    () => getStore().state.badgesCommitted[menuId] ?? null,
    () => null,
  );
}

/** sort 결정용 — CafeMenuPage 가 sortCafeMenu 의 popularIds 인자로 사용 */
export function useMenuSortCommitted(): Record<string, 1 | 2 | 3> {
  return useSyncExternalStore(
    subscribe,
    () => getStore().state.sortCommitted,
    () => SERVER_SNAPSHOT.sortCommitted,
  );
}
