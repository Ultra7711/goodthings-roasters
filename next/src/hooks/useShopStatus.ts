'use client';

import { useEffect, useState } from 'react';
import {
  getShopStatus,
  getWeekSchedule,
  type ShopStatus,
  type DayScheduleView,
} from '@/lib/shopHours';

export type ShopStatusView = {
  status: ShopStatus;
  week: DayScheduleView[];
};

/**
 * 매장의 현재 영업 상태 + 오늘부터 7일 시간표를 반환하는 훅.
 *
 * - SSR/첫 렌더링: `null` (hydration 안전 — 클라 현재시각 의존)
 * - 마운트 직후 1회 계산 + 60초 간격 자동 갱신
 *   (오픈/마감 시각 경계를 넘는 순간 라벨이 자연스럽게 전환됨)
 */
export function useShopStatus(): ShopStatusView | null {
  const [view, setView] = useState<ShopStatusView | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setView({ status: getShopStatus(now), week: getWeekSchedule(now) });
    };
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, []);

  return view;
}
