/* ══════════════════════════════════════════════════════════════════════════
   admin-cafe-menu-publish.spec.ts — S250-5 E2E (3/4) 메뉴 등록→/menu 노출

   운영자 critical flow: admin 목록에서 메뉴 활성 토글 → 고객 /menu 반영.
   - seed 메뉴(is_active=false) → /menu 비노출 (초기)
   - admin 활성 토글 ON → /menu 노출
   - 활성 토글 OFF → /menu 다시 비노출 (revalidate)

   fetchCafeMenu 는 'use cache' 미사용 → 토글 후 /menu 즉시 fresh fetch.
   메뉴 생성 UI(영양정보·이미지 등 다단계 폼)는 brittle 하여 seed 로 대체,
   노출 보장의 핵심인 활성 토글 운영자 행위에 집중. admin-product-publish 답습.

   ▸ env / storageState 부재 시 SKIP.
   ══════════════════════════════════════════════════════════════════════════ */

import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  seedTestCafeMenu,
  cleanupTestCafeMenu,
  E2E_CAFE_MENU_ID,
  E2E_CAFE_MENU_NAME,
  type SeedCafeMenu,
} from './fixtures/cafe-menu-seed';

const ADMIN_STORAGE_STATE = path.resolve(__dirname, '.auth/admin.json');
const hasAdminAuth =
  !!process.env.E2E_ADMIN_USER_ID && existsSync(ADMIN_STORAGE_STATE);
const describeAdmin = hasAdminAuth ? test.describe : test.describe.skip;

describeAdmin('S250-5 — 메뉴 활성 토글 → /menu 노출', () => {
  let seed: SeedCafeMenu;

  test.beforeAll(async () => {
    seed = await seedTestCafeMenu(); // is_active=false
  });

  test.afterAll(async () => {
    if (seed) await cleanupTestCafeMenu(seed);
  });

  test.beforeEach(async ({ context }) => {
    const parsed = JSON.parse(readFileSync(ADMIN_STORAGE_STATE, 'utf8')) as {
      cookies?: unknown;
    };
    await context.addCookies(
      (parsed.cookies ?? []) as Parameters<typeof context.addCookies>[0],
    );
  });

  test('비활성→활성 토글 시 /menu 노출, 비활성화 시 사라진다', async ({
    page,
  }) => {
    /* 1. 초기 비활성 — /menu 에 없음 */
    await page.goto('/menu', { waitUntil: 'networkidle' });
    await expect(page.getByText(E2E_CAFE_MENU_NAME)).toHaveCount(0);

    /* 2. admin 목록 검색 → 활성 토글 ON */
    await page.goto('/admin/menu', { waitUntil: 'networkidle' });
    await page.getByPlaceholder('ID / 메뉴명 검색').fill(E2E_CAFE_MENU_ID);
    const row = page.getByRole('row', { name: new RegExp(E2E_CAFE_MENU_ID) });
    await expect(row).toBeVisible();
    await row.getByRole('switch').click();
    await expect(page.getByText('메뉴를 공개했습니다')).toBeVisible();

    /* 3. /menu 노출 */
    await page.goto('/menu', { waitUntil: 'networkidle' });
    await expect(page.getByText(E2E_CAFE_MENU_NAME).first()).toBeVisible();

    /* 4. 활성 토글 OFF → /menu 비노출 복귀 */
    await page.goto('/admin/menu', { waitUntil: 'networkidle' });
    await page.getByPlaceholder('ID / 메뉴명 검색').fill(E2E_CAFE_MENU_ID);
    const row2 = page.getByRole('row', { name: new RegExp(E2E_CAFE_MENU_ID) });
    await row2.getByRole('switch').click();
    await expect(page.getByText('메뉴를 비공개로 전환했습니다')).toBeVisible();

    await page.goto('/menu', { waitUntil: 'networkidle' });
    await expect(page.getByText(E2E_CAFE_MENU_NAME)).toHaveCount(0);
  });
});
