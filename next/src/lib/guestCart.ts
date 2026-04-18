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

export function readGuestCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as CartItem[];
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
