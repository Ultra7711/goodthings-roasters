/* ══════════════════════════════════════════════════════════════════════════
   cartMerge.ts — 로그인 직후 guest cart 흡수 (클라 전용, ADR-004 Step B)

   - 게스트 카트는 `localStorage['gtr-guest-cart']` (guestCart.ts).
   - sessionStorage 플래그로 탭 생애 중 1회만 실행 (중복 방지).
   - 성공 시 clearGuestCart() 로 localStorage 카트 비움.
   - 실패 시 플래그 미설정 → 다음 인증 이벤트에서 재시도.

   호출 시점:
   - AuthSyncProvider 가 SIGNED_IN / INITIAL_SESSION / TOKEN_REFRESHED 수신 시.
   ══════════════════════════════════════════════════════════════════════════ */

import type { CartItem } from '@/types/cart';
import { CartMergeSchema, type CartMergeInput } from '@/lib/schemas/cart';
import { readGuestCart, clearGuestCart } from '@/lib/guestCart';

const FLAG_PREFIX = 'gtr-cart-merged';

function flagKey(userId: string): string {
  return `${FLAG_PREFIX}:${userId}`;
}

function hasVolume(item: CartItem): item is CartItem & { volume: string } {
  return typeof item.volume === 'string' && item.volume.length > 0;
}

export function toMergePayload(items: CartItem[]): CartMergeInput | null {
  /* 단일 type-guard filter 로 hasVolume + qty>0 동시 처리 (TS M-3) */
  const mapped = items
    .filter((i): i is CartItem & { volume: string } => hasVolume(i) && i.qty > 0)
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
  if (!parsed.success) {
    /* 스키마 변경/데이터 이상 감지용 — silent merge 탈락 방지 (silent F-05) */
    console.warn('[cartMerge] schema validation failed', parsed.error.flatten());
    return null;
  }
  return parsed.data;
}

export type MergeResult =
  | { status: 'skipped'; reason: 'no-items' | 'already-merged' | 'ssr-env' }
  | { status: 'ok'; merged: number; skipped: number }
  | { status: 'error'; detail: string };

/**
 * 게스트 localStorage 카트를 서버로 흡수. 성공/스킵 시에만 플래그 set.
 * 호출 직전 guestCart 를 읽어 payload 를 구성하고, 성공 시 clearGuestCart().
 */
export async function mergeGuestCartToServer(
  userId: string,
): Promise<MergeResult> {
  if (typeof window === 'undefined') {
    return { status: 'skipped', reason: 'ssr-env' };
  }

  const key = flagKey(userId);
  if (window.sessionStorage.getItem(key) === '1') {
    return { status: 'skipped', reason: 'already-merged' };
  }

  const items = readGuestCart();
  const payload = toMergePayload(items);
  if (!payload) {
    /* 담긴 아이템 없음 — 플래그 세팅해 재확인 생략 */
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
      return { status: 'error', detail: `http_${res.status}` };
    }

    const body = (await res.json()) as {
      data?: { merged?: number; skipped?: number };
    };
    const merged = body.data?.merged ?? 0;
    const skipped = body.data?.skipped ?? 0;

    clearGuestCart();
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
