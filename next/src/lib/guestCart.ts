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
  } catch {
    return [];
  }
}

export function writeGuestCart(items: CartItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* quota exceeded — 무시 */
  }
}

export function clearGuestCart(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 무시 */
  }
}
