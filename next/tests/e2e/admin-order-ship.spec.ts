/* ══════════════════════════════════════════════════════════════════════════
   admin-order-ship.spec.ts — S250-5 E2E (4/4) 주문 발송 처리

   운영자 critical flow: 결제완료(paid) 주문을 ShippingDialog 로 출고 → 배송중.
   - seed 주문(status=paid) → /admin/orders/{orderNumber} 상세 정상 렌더
   - "발송 처리" → 송장번호+택배사 입력 → 발송 → 상태 배지 '배송중' + 송장 표시
   - service_role 재조회로 status=shipping / tracking / carrier 최종 확인

   ship route(api/admin/orders/[orderNumber]/ship)는 ship/route.test.ts 단위 커버.
   E2E 는 ShippingDialog UI flow(다이얼로그 → dispatch action → revalidate) 가치.

   ▸ env / storageState 부재 시 SKIP.
   ══════════════════════════════════════════════════════════════════════════ */

import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  seedTestOrder,
  cleanupTestOrder,
  getOrderShipState,
  type SeedOrder,
} from './fixtures/order-seed';

const ADMIN_STORAGE_STATE = path.resolve(__dirname, '.auth/admin.json');
const hasAdminAuth =
  !!process.env.E2E_ADMIN_USER_ID && existsSync(ADMIN_STORAGE_STATE);
const describeAdmin = hasAdminAuth ? test.describe : test.describe.skip;

const E2E_TRACKING = '123456789012';
const E2E_CARRIER = 'CJ대한통운'; /* ShippingDialog 기본 택배사 */

describeAdmin('S250-5 — 주문 발송 처리 → 배송중', () => {
  let seed: SeedOrder;

  test.beforeAll(async () => {
    seed = await seedTestOrder(); // status=paid
  });

  test.afterAll(async () => {
    if (seed) await cleanupTestOrder(seed);
  });

  test.beforeEach(async ({ context }) => {
    const parsed = JSON.parse(readFileSync(ADMIN_STORAGE_STATE, 'utf8')) as {
      cookies?: unknown;
    };
    await context.addCookies(
      (parsed.cookies ?? []) as Parameters<typeof context.addCookies>[0],
    );
  });

  test('발송 처리 시 상태가 배송중으로 전환되고 송장이 기록된다', async ({
    page,
  }) => {
    /* 1. 상세 진입 — 주문번호 표시 + 발송 처리 버튼 노출(paid) */
    await page.goto(`/admin/orders/${seed.orderNumber}`, {
      waitUntil: 'networkidle',
    });
    await expect(page.getByText(seed.orderNumber).first()).toBeVisible();

    /* 발송 전 대조 — seed 정합성 + RPC 가 실제로 상태를 바꿨음을 사후 대비로 증명.
       (paid·tracking 없음 → 발송 후 shipping·tracking 채워짐 = dispatch RPC 호출 입증) */
    const before = await getOrderShipState(seed.id);
    expect(before.status).toBe('paid');
    expect(before.trackingNumber).toBeNull();
    expect(before.shippedAt).toBeNull();

    const openBtn = page.getByRole('button', { name: '발송 처리' }).first();
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    /* 2. 다이얼로그 — 송장번호 입력(택배사는 기본값 CJ대한통운) */
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder('예: 123456789012').fill(E2E_TRACKING);

    /* 3. 발송 처리 제출 → 다이얼로그 닫힘 + RSC refresh */
    await dialog.getByRole('button', { name: '발송 처리' }).click();
    await expect(dialog).toBeHidden();

    /* 4. 상태 배지 '배송중' + 송장/택배사 노출 */
    await expect(page.getByText('배송중').first()).toBeVisible();
    await expect(page.getByText(E2E_TRACKING).first()).toBeVisible();
    await expect(page.getByText(E2E_CARRIER).first()).toBeVisible();

    /* 5. service_role 재조회 — DB 최종 상태 검증 */
    const shipState = await getOrderShipState(seed.id);
    expect(shipState.status).toBe('shipping');
    expect(shipState.trackingNumber).toBe(E2E_TRACKING);
    expect(shipState.carrier).toBe(E2E_CARRIER);
    expect(shipState.shippedAt).not.toBeNull();
  });

  test('주문 목록(/admin/orders)이 정상 렌더된다', async ({ page }) => {
    await page.goto('/admin/orders', { waitUntil: 'networkidle' });
    /* 목록에 seed 주문번호 노출 (회귀: 목록 쿼리/렌더 정상) */
    await expect(page.getByText(seed.orderNumber).first()).toBeVisible();
  });
});
