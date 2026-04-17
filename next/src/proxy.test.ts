/* ══════════════════════════════════════════════════════════════════════════
   proxy.test.ts — shouldOverrideReferrerPolicy 매처 테스트 (Session 8 보안 #2)

   경로 매칭 스펙 (docs/payments-security-hardening.md §3.3):
   - 결제 트랜잭션 경로에서만 Referrer-Policy: same-origin 오버라이드.
   - 정확 매치 + subpath 매치. query string 은 pathname 에 포함되지 않으므로 무관.
   ══════════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import { shouldOverrideReferrerPolicy } from './proxy';

describe('shouldOverrideReferrerPolicy', () => {
  it('[1] /checkout 정확 매치', () => {
    expect(shouldOverrideReferrerPolicy('/checkout')).toBe(true);
  });

  it('[2] /order-complete 정확 매치', () => {
    expect(shouldOverrideReferrerPolicy('/order-complete')).toBe(true);
  });

  it('[3] /orders/lookup 정확 매치', () => {
    expect(shouldOverrideReferrerPolicy('/orders/lookup')).toBe(true);
  });

  it('[4] /api/payments/ 하위 경로 매치', () => {
    expect(shouldOverrideReferrerPolicy('/api/payments/confirm')).toBe(true);
    expect(shouldOverrideReferrerPolicy('/api/payments/webhook')).toBe(true);
  });

  it('[5] /api/orders/guest-lookup 정확 매치', () => {
    expect(shouldOverrideReferrerPolicy('/api/orders/guest-lookup')).toBe(true);
  });

  it('[6] 무관 경로는 false', () => {
    expect(shouldOverrideReferrerPolicy('/')).toBe(false);
    expect(shouldOverrideReferrerPolicy('/shop')).toBe(false);
    expect(shouldOverrideReferrerPolicy('/login')).toBe(false);
    expect(shouldOverrideReferrerPolicy('/menu')).toBe(false);
    expect(shouldOverrideReferrerPolicy('/story')).toBe(false);
  });

  it('[7] 유사하지만 다른 prefix 는 false (경로 경계 검증)', () => {
    /* '/checkout-cancel' 같이 prefix 만 걸치는 경로는 매치 안 됨 */
    expect(shouldOverrideReferrerPolicy('/checkoutxyz')).toBe(false);
    expect(shouldOverrideReferrerPolicy('/order-complete-bak')).toBe(false);
    expect(shouldOverrideReferrerPolicy('/api/payment')).toBe(false);
  });

  it('[8] /checkout/subpath 매치', () => {
    expect(shouldOverrideReferrerPolicy('/checkout/success')).toBe(true);
  });

  it('[9] /api/orders (guest-lookup 아님) 는 false', () => {
    expect(shouldOverrideReferrerPolicy('/api/orders')).toBe(false);
    expect(shouldOverrideReferrerPolicy('/api/orders/create')).toBe(false);
  });
});
