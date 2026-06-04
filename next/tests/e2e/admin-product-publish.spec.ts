/* ══════════════════════════════════════════════════════════════════════════
   admin-product-publish.spec.ts — S250-5 E2E (2/4) 상품 등록→사이트 노출

   운영자 critical flow: admin 목록에서 상품 활성 토글 → 고객 /shop 반영.
   - seed 상품(is_active=false) → /shop 비노출 (초기)
   - admin 활성 토글 ON → /shop 목록 노출 + PDP 정상
   - 활성 토글 OFF → /shop 다시 비노출 (revalidate)

   fetchProducts 는 'use cache' 미사용 → 토글 후 /shop 즉시 fresh fetch.
   상품 생성 UI 폼(옵션·노트·이미지 다단계)은 brittle 하여 seed 로 대체,
   노출 보장의 핵심인 활성 토글 운영자 행위에 집중.

   ▸ env / storageState 부재 시 SKIP.
   ══════════════════════════════════════════════════════════════════════════ */

import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  seedTestProduct,
  cleanupTestProduct,
  E2E_PRODUCT_SLUG,
  type SeedProduct,
} from './fixtures/product-seed';

const ADMIN_STORAGE_STATE = path.resolve(__dirname, '.auth/admin.json');
const hasAdminAuth =
  !!process.env.E2E_ADMIN_USER_ID && existsSync(ADMIN_STORAGE_STATE);
const describeAdmin = hasAdminAuth ? test.describe : test.describe.skip;

/* seedTestProduct 의 상품명 (product-seed.ts 와 동기) — /shop 노출 식별용.
   이미지 없는 seed 상품이라 카드 링크에 접근성 이름이 없어, 노출 식별은
   상품명 텍스트로 한다. */
const E2E_PRODUCT_NAME = 'LOW-C 회귀 테스트 상품';

describeAdmin('S250-5 — 상품 활성 토글 → /shop 노출', () => {
  let seed: SeedProduct;

  test.beforeAll(async () => {
    seed = await seedTestProduct(); // is_active=false
  });

  test.afterAll(async () => {
    if (seed) await cleanupTestProduct(seed);
  });

  test.beforeEach(async ({ context }) => {
    const parsed = JSON.parse(readFileSync(ADMIN_STORAGE_STATE, 'utf8')) as {
      cookies?: unknown;
    };
    await context.addCookies(
      (parsed.cookies ?? []) as Parameters<typeof context.addCookies>[0],
    );
  });

  test('비활성→활성 토글 시 /shop 노출, 비활성화 시 사라진다', async ({
    page,
  }) => {
    /* 1. 초기 비활성 — /shop 목록에 없음 */
    await page.goto('/shop', { waitUntil: 'networkidle' });
    await expect(page.getByText(E2E_PRODUCT_NAME)).toHaveCount(0);

    /* 2. admin 목록에서 검색 → 활성 토글 ON */
    await page.goto('/admin/products', { waitUntil: 'networkidle' });
    await page.getByPlaceholder('slug / 상품명 검색').fill(E2E_PRODUCT_SLUG);
    const row = page.getByRole('row', { name: new RegExp(E2E_PRODUCT_SLUG) });
    await expect(row).toBeVisible();
    await row.getByRole('switch').click();
    await expect(page.getByText('상품을 공개했습니다')).toBeVisible();

    /* 3. /shop 목록 노출 + PDP 정상 */
    await page.goto('/shop', { waitUntil: 'networkidle' });
    await expect(page.getByText(E2E_PRODUCT_NAME).first()).toBeVisible();
    await page.goto(`/shop/${E2E_PRODUCT_SLUG}`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(new RegExp(`/shop/${E2E_PRODUCT_SLUG}`));
    await expect(page.getByText(E2E_PRODUCT_NAME).first()).toBeVisible();

    /* 4. 활성 토글 OFF → /shop 비노출 복귀 */
    await page.goto('/admin/products', { waitUntil: 'networkidle' });
    await page.getByPlaceholder('slug / 상품명 검색').fill(E2E_PRODUCT_SLUG);
    const row2 = page.getByRole('row', { name: new RegExp(E2E_PRODUCT_SLUG) });
    await row2.getByRole('switch').click();
    await expect(page.getByText('상품을 비공개로 전환했습니다')).toBeVisible();

    await page.goto('/shop', { waitUntil: 'networkidle' });
    await expect(page.getByText(E2E_PRODUCT_NAME)).toHaveCount(0);
  });
});
