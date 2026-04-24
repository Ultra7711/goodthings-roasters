/* ══════════════════════════════════════════
   Cart Route — /cart (Stage E / S67 / 2026-04-24)
   BUG-006 Stage E: page 전체 'use client' → server component 로 전환.
   - Client boundary 를 page 경계 → CartClient 단일 island 로 축소
   - (main) route group 의 SiteHeader·SiteFooter 재사용 유지
   - 상호작용 로직(items · qty · remove · modal)은 CartClient 에 전부 위임
   ══════════════════════════════════════════ */

import CartClient from '@/components/cart/CartClient';

export default function CartPage() {
  return <CartClient />;
}
