/* ══════════════════════════════════════════════════════════════════════════
   guestCart.ts — 비로그인 사용자 장바구니 localStorage 레이어 (ADR-004 Step B)

   - 저장 키: `gtr-guest-cart`
   - 값: CartItem[] (id: UUID, 서버 미러 없음)
   - 로그인 시 `/api/cart/merge` 로 흡수 후 clear()

   주의:
   - SSR 안전: typeof window 체크.
   - 쓰기/읽기 실패(quota, JSON parse) 는 무시하고 빈 배열 반환/무시.
   ══════════════════════════════════════════════════════════════════════════ */

import type { CartItem } from '@/types/cart';

const STORAGE_KEY = 'gtr-guest-cart';

/* 최소 런타임 구조 가드 (TS M-1).
   localStorage 오염/구버전 스키마 데이터로 인한 런타임 오류 방지.
   필수 필드만 검증 — 타입 강제까지는 zod 도입 시 확장. */
function isCartItemShape(v: unknown): v is CartItem {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.slug === 'string' &&
    typeof o.qty === 'number' &&
    typeof o.priceNum === 'number'
  );
}

export function readGuestCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCartItemShape);
  } catch (err) {
    /* 손상 JSON: 로그 + 키 제거로 추적 가능, 영구 오염 방지 */
    console.warn('[guestCart] parse error — resetting', err);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* removeItem 도 실패하면 무시 */
    }
    return [];
  }
}

export function writeGuestCart(items: CartItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    /* quota exceeded 등 — UX 영향 추적용 로그 */
    console.warn('[guestCart] write failed (quota?)', err);
  }
}

export function clearGuestCart(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[guestCart] clear failed', err);
  }
}
