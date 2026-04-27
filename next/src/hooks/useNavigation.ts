'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { showToast } from '@/lib/toastStore';

const NAV_TIMEOUT_MS = 10_000;

/**
 * router.push() 래퍼 훅.
 * - navigatingTo: 이동 중인 href (null이면 대기 상태)
 * - navigate(href): router.push + 타임아웃 시 에러 토스트 자동 처리
 *
 * BUG-167 후속: navigate / clearTimer 를 useCallback 으로 감싸 매 렌더마다
 * 새 레퍼런스가 생성되지 않도록 보장. 현재 소비자(CartDrawer)는 onClick
 * 핸들러로만 사용해 안전하지만, 향후 useEffect/useCallback deps 로 사용될
 * 경우 회귀(불필요한 재실행) 방지.
 */
export function useNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  useEffect(() => {
    if (!pendingRef.current) return;
    pendingRef.current = false;
    clearTimer();
    setNavigatingTo(null);
  }, [pathname, clearTimer]);

  /* navigate 는 pathname 의존 → pathname 변경마다 새 레퍼런스. effect deps 직접 포함 금지. */
  const navigate = useCallback(
    (href: string) => {
      if (href === pathname) return;
      clearTimer();
      pendingRef.current = true;
      setNavigatingTo(href);
      timerRef.current = setTimeout(() => {
        pendingRef.current = false;
        setNavigatingTo(null);
        showToast('페이지를 불러오지 못했습니다.');
      }, NAV_TIMEOUT_MS);
      router.push(href);
    },
    [pathname, router, clearTimer],
  );

  return { navigate, navigatingTo };
}
