'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { showToast } from '@/lib/toastStore';

const NAV_TIMEOUT_MS = 10_000;

/**
 * router.push() 래퍼 훅.
 * - navigatingTo: 이동 중인 href (null이면 대기 상태)
 * - navigate(href): router.push + 타임아웃 시 에러 토스트 자동 처리
 */
export function useNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimer() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => () => clearTimer(), []);

  useEffect(() => {
    if (!pendingRef.current) return;
    pendingRef.current = false;
    clearTimer();
    setNavigatingTo(null);
  }, [pathname]);

  function navigate(href: string) {
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
  }

  return { navigate, navigatingTo };
}
