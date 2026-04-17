/* ══════════════════════════════════════════════════════════════════════════
   cartMerge.ts — 로그인 직후 guest cart 흡수 (클라 전용)

   역할:
   - Zustand useCartStore 의 items 를 /api/cart/merge 입력 포맷으로 변환.
   - sessionStorage 플래그로 탭 생애 중 1회만 실행 (중복 방지).
   - 성공 시 useCartStore.clearCart() 로 localStorage 카트 비움.
   - 실패 시 플래그 해제 → 다음 인증 이벤트에서 재시도 가능.

   호출 시점:
   - AuthSyncProvider 가 SIGNED_IN / INITIAL_SESSION / TOKEN_REFRESHED 이벤트
     수신 시 호출. userId 기준으로 플래그 키를 분리해 유저 전환 시 재시도.

   주의:
   - 입력이 비어있으면 API 호출하지 않음 (/api/cart/merge 는 min(1) 강제).
   - period 는 Zustand 상 string | null 이나 DB enum('2주'|'4주') 과 동일 문자열.
   ══════════════════════════════════════════════════════════════════════════ */

import type { CartItem } from '@/types/cart';
import { CartMergeSchema, type CartMergeInput } from '@/lib/schemas/cart';

const FLAG_PREFIX = 'gtr-cart-merged';

function flagKey(userId: string): string {
  return `${FLAG_PREFIX}:${userId}`;
}

/** items → /api/cart/merge 입력 포맷. qty/volume 누락 행은 스킵.
 *  서버 스키마(CartMergeSchema) 로 파싱해 enum 타입을 정규화 + 검증 실패 행은 제외. */
function hasVolume(item: CartItem): item is CartItem & { volume: string } {
  return typeof item.volume === 'string' && item.volume.length > 0;
}

export function toMergePayload(items: CartItem[]): CartMergeInput | null {
  const mapped = items
    .filter((i) => hasVolume(i) && i.qty > 0)
    .filter(hasVolume)
    .map((i) => ({
      productSlug: i.slug,
      volume: i.volume,
      quantity: Math.min(99, Math.max(1, i.qty)),
      itemType: i.type ?? 'normal',
      subscriptionPeriod:
        i.type === 'subscription' ? (i.period ?? null) : null,
    }));

  if (mapped.length === 0) return null;
  const parsed = CartMergeSchema.safeParse({ items: mapped });
  if (!parsed.success) return null;
  return parsed.data;
}

export type MergeResult =
  | { status: 'skipped'; reason: 'no-items' | 'already-merged' | 'ssr-env' }
  | { status: 'ok'; merged: number; skipped: number }
  | { status: 'error'; detail: string };

/**
 * merge 실행. 성공/스킵 시에만 플래그 set. 실패 시 다음 이벤트에서 재시도.
 * onSuccess 콜백으로 Zustand clearCart() 를 받는다 (순환 import 회피).
 */
export async function mergeGuestCartToServer(
  userId: string,
  items: CartItem[],
  onSuccess: () => void,
): Promise<MergeResult> {
  if (typeof window === 'undefined') {
    return { status: 'skipped', reason: 'ssr-env' };
  }

  const key = flagKey(userId);
  if (window.sessionStorage.getItem(key) === '1') {
    return { status: 'skipped', reason: 'already-merged' };
  }

  const payload = toMergePayload(items);
  if (!payload) {
    /* 담긴 아이템 없음 — 플래그는 세팅해 유저 전환 전까지 재확인 생략 */
    window.sessionStorage.setItem(key, '1');
    return { status: 'skipped', reason: 'no-items' };
  }

  try {
    const res = await fetch('/api/cart/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      /* 401/409/5xx — 플래그 미설정 → 다음 이벤트에서 재시도 */
      return { status: 'error', detail: `http_${res.status}` };
    }

    const body = (await res.json()) as {
      data?: { merged?: number; skipped?: number };
    };
    const merged = body.data?.merged ?? 0;
    const skipped = body.data?.skipped ?? 0;

    onSuccess();
    window.sessionStorage.setItem(key, '1');
    return { status: 'ok', merged, skipped };
  } catch (err) {
    return {
      status: 'error',
      detail: err instanceof Error ? err.message : 'unknown',
    };
  }
}

/** 로그아웃 시 플래그 정리 (다음 로그인에서 merge 재확인). */
export function clearMergeFlag(userId: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(flagKey(userId));
}
