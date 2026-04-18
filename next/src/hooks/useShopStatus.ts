'use client';

import { useEffect, useState } from 'react';
import { getShopStatus, type ShopStatus } from '@/lib/shopHours';

/**
 * 매장의 현재 영업 상태를 반환하는 훅.
 *
 * - SSR/첫 렌더링: `null` (hydration 안전)
 * - 마운트 직후 1회 계산 + 60초 간격 자동 갱신
 *   (오픈/마감 시각 경계를 넘는 순간 라벨이 자연스럽게 전환됨)
 */
export function useShopStatus(): ShopStatus | null {
  const [status, setStatus] = useState<ShopStatus | null>(null);

  useEffect(() => {
    const update = () => setStatus(getShopStatus(new Date()));
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, []);

  return status;
}
