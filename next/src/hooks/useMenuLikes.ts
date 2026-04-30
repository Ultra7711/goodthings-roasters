/* ══════════════════════════════════════════
   useMenuLikes — 카페 메뉴 좋아요 상태 + 토글
   - 마운트 시 GET /api/menu-likes 로 전체 카운트 + 내 likes fetch
   - toggle(menuId): 낙관적 업데이트 → API 동기화 → 실패 시 롤백
   - 비로그인 탭 시 토스트만 표시
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSessionSnapshot } from '@/hooks/useSupabaseSession';
import { showToast } from '@/lib/toastStore';

type MenuLikesResponse = {
  data: {
    counts: Record<string, number>;
    liked: string[];
  };
};

type InitialData = {
  counts: Record<string, number>;
  liked: string[];
};

type ToggleResponse = {
  data: {
    liked: boolean;
    count: number;
  };
};

export function useMenuLikes(initialData?: InitialData) {
  /* initialData 는 마운트 시 1회만 참조 — ref 로 고정해 effect deps 안정화 */
  const initialDataRef = useRef(initialData);

  const [counts, setCounts] = useState<Record<string, number>>(
    initialDataRef.current?.counts ?? {},
  );
  const [liked, setLiked] = useState<Set<string>>(
    new Set(initialDataRef.current?.liked ?? []),
  );
  /* SSR 초기 데이터가 있으면 로딩 완료 상태로 시작 */
  const [loading, setLoading] = useState(!initialDataRef.current);

  useEffect(() => {
    /* SSR 에서 이미 데이터를 받았으면 클라이언트 fetch 생략 */
    if (initialDataRef.current) return;
    fetch('/api/menu-likes')
      .then((r) => r.json() as Promise<MenuLikesResponse>)
      .then(({ data }) => {
        setCounts(data.counts ?? {});
        setLiked(new Set(data.liked ?? []));
      })
      .catch(() => {/* 네트워크 오류 시 빈 상태 유지 */})
      .finally(() => setLoading(false));
  }, []);

  /* 진행 중인 토글 추적 — 동일 아이템 중복 호출 방지 */
  const pendingRef = useRef<Set<string>>(new Set());

  const toggle = useCallback(async (menuId: string) => {
    if (pendingRef.current.has(menuId)) return;

    const { isLoggedIn } = getSessionSnapshot();
    if (!isLoggedIn) {
      showToast('좋아요를 누르려면 로그인이 필요해요');
      return;
    }

    pendingRef.current.add(menuId);

    // 낙관적 업데이트
    const wasLiked = liked.has(menuId);
    const prevCount = counts[menuId] ?? 0;

    setLiked((prev) => {
      const next = new Set(prev);
      if (wasLiked) next.delete(menuId);
      else next.add(menuId);
      return next;
    });
    setCounts((prev) => ({
      ...prev,
      [menuId]: wasLiked ? Math.max(0, prevCount - 1) : prevCount + 1,
    }));

    try {
      const res = await fetch(`/api/menu-likes/${menuId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) throw new Error('toggle failed');

      const json = await (res.json() as Promise<ToggleResponse>);
      const result = json.data;

      setLiked((prev) => {
        const next = new Set(prev);
        if (result.liked) next.add(menuId);
        else next.delete(menuId);
        return next;
      });
      setCounts((prev) => ({ ...prev, [menuId]: result.count }));
    } catch {
      // 롤백
      setLiked((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.add(menuId);
        else next.delete(menuId);
        return next;
      });
      setCounts((prev) => ({ ...prev, [menuId]: prevCount }));
    } finally {
      pendingRef.current.delete(menuId);
    }
  }, [liked, counts]);

  return { counts, liked, toggle, loading };
}
