/* ══════════════════════════════════════════════════════════════════════════
   admin-product-images.spec.ts — S264-D LOW-C 회귀 검증 (3 시나리오)

   ProductImageReorderClient (next/src/app/admin/(authed)/products/[slug]/edit/)
   의 3 edge case 가 audit_s263_p4a 의 "의도된 mitigation / 설계 safe" 판정
   대로 동작하는지 자동 검증.

   1. orphan_storage: 업로드 후 페이지 떠나도 DB row + Storage 파일 잔존 (의도)
   2. race: sequential 2개 파일 업로드 → sort_order 0, 1 정확
   3. revalidate: 삭제 + 토글 후 DB + storage 정합

   ▸ env 부재 / storageState 부재 시 SKIP (describe.skip).
   ▸ 시나리오마다 cleanupProductImages 로 시작 → 독립 보장.
   ══════════════════════════════════════════════════════════════════════════ */

import { test, expect, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import {
  seedTestProduct,
  cleanupTestProduct,
  cleanupProductImages,
  listProductImageRows,
  listProductStorageFiles,
  type SeedProduct,
} from './fixtures/product-seed';

const ADMIN_STORAGE_STATE = path.resolve(__dirname, '.auth/admin.json');
const hasAdminAuth =
  !!process.env.E2E_ADMIN_USER_ID && existsSync(ADMIN_STORAGE_STATE);

const describeAdmin = hasAdminAuth ? test.describe : test.describe.skip;

describeAdmin('S264-D LOW-C — admin ProductImageReorderClient 회귀', () => {
  let seed: SeedProduct;
  let tinyPng: Buffer;
  let tinyPng2: Buffer;

  test.beforeAll(async () => {
    seed = await seedTestProduct();
    /* sharp 로 64x64 단색 PNG 두 종 — race 시나리오에서 두 이미지가
       해시 충돌 없이 분리되도록 색상 다르게 */
    tinyPng = await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 3,
        background: { r: 220, g: 90, b: 50 },
      },
    })
      .png()
      .toBuffer();
    tinyPng2 = await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 3,
        background: { r: 60, g: 140, b: 220 },
      },
    })
      .png()
      .toBuffer();
  });

  test.afterAll(async () => {
    if (seed) await cleanupTestProduct(seed);
  });

  test.beforeEach(async ({ context }) => {
    /* admin cookies 주입 (config 가 storageState 미설정 — file 부재 시 throw 회피) */
    const parsed = JSON.parse(readFileSync(ADMIN_STORAGE_STATE, 'utf8')) as {
      cookies?: unknown;
    };
    /* Playwright Cookie 타입과 동일 shape. globalSetup 이 보장. */
    await context.addCookies(
      (parsed.cookies ?? []) as Parameters<typeof context.addCookies>[0],
    );

    /* 시나리오 격리 — 직전 시나리오의 image 잔존 정리 */
    await resetProductImages(seed.id, seed.slug);
  });

  test('orphan_storage — 업로드 후 페이지 떠나도 DB row + Storage 파일 잔존 (의도)', async ({
    page,
  }) => {
    await openEditPage(page, seed.slug);

    await uploadFiles(page, [
      { name: 'orphan-test.png', mimeType: 'image/png', buffer: tinyPng },
    ]);
    await expectImageCount(page, 1);

    /* DB + Storage 모두 1개 — pre-condition */
    const rowsBefore = await listProductImageRows(seed.id);
    const filesBefore = await listProductStorageFiles(seed.slug);
    expect(rowsBefore).toHaveLength(1);
    expect(filesBefore).toHaveLength(1);

    /* 페이지 떠남 — 어드민 목록으로 */
    await page.goto('/admin/products', { waitUntil: 'networkidle' });

    /* 의도된 mitigation — orphan 그대로 잔존 (운영자 책임) */
    const rowsAfter = await listProductImageRows(seed.id);
    const filesAfter = await listProductStorageFiles(seed.slug);
    expect(rowsAfter, '업로드된 DB row 가 페이지 이동 후에도 잔존').toHaveLength(1);
    expect(filesAfter, '업로드된 Storage 파일이 페이지 이동 후에도 잔존').toHaveLength(1);
    expect(rowsAfter[0].id).toBe(rowsBefore[0].id);
  });

  test('race — 2개 파일 동시 업로드 → 둘 다 정상 등록 + sort_order 0,1', async ({
    page,
  }) => {
    await openEditPage(page, seed.slug);

    /* file input 에 2개 파일 동시 전달 — handleFiles 의 for-await 가 직렬화 */
    await uploadFiles(page, [
      { name: 'race-1.png', mimeType: 'image/png', buffer: tinyPng },
      { name: 'race-2.png', mimeType: 'image/png', buffer: tinyPng2 },
    ]);
    await expectImageCount(page, 2);

    const rows = await listProductImageRows(seed.id);
    const files = await listProductStorageFiles(seed.slug);
    expect(rows, 'DB row 2개').toHaveLength(2);
    expect(files, 'Storage 파일 2개').toHaveLength(2);

    /* sort_order 0, 1 — 빈 테이블 시작이므로 (max+1 = 0 시작) */
    const sortOrders = rows.map((r) => r.sort_order).sort((a, b) => a - b);
    expect(sortOrders).toEqual([0, 1]);
  });

  test('revalidate — 삭제 + 활성 토글 → DB + storage 정합', async ({ page }) => {
    await openEditPage(page, seed.slug);

    await uploadFiles(page, [
      { name: 'rev-1.png', mimeType: 'image/png', buffer: tinyPng },
      { name: 'rev-2.png', mimeType: 'image/png', buffer: tinyPng2 },
    ]);
    await expectImageCount(page, 2);

    /* 첫 번째 이미지 카드의 삭제 버튼 클릭 → ConfirmModal "삭제" */
    await page
      .getByRole('button', { name: '이미지 삭제', exact: true })
      .first()
      .click();
    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible();
    await confirmDialog
      .getByRole('button', { name: '삭제', exact: true })
      .click();
    await expectImageCount(page, 1);

    /* 남은 이미지의 활성 토글 ON — ProductImageReorderClient 의 Switch
       aria-label 사용 ("공개로 전환" — 비공개 상태일 때). ProductActiveToggleClient
       의 product 자체 switch ("상품 비공개 — 클릭하면 공개") 와 분리. */
    const switchControl = page.getByRole('switch', { name: '공개로 전환' });
    await expect(switchControl).toHaveCount(1);
    await switchControl.click();
    await expect
      .poll(
        async () => {
          const rs = await listProductImageRows(seed.id);
          return rs[0]?.is_active === true;
        },
        { timeout: 20_000, message: 'is_active=true DB 반영 대기' },
      )
      .toBe(true);

    /* DB + storage 정합 */
    const rows = await listProductImageRows(seed.id);
    const files = await listProductStorageFiles(seed.slug);
    expect(rows, '삭제 후 DB row 1개').toHaveLength(1);
    expect(files, '삭제 후 Storage 파일 1개').toHaveLength(1);
    expect(rows[0].is_active, '활성 토글 반영').toBe(true);

    /* 새로고침 후에도 동일 — revalidate path 정합 */
    await page.reload({ waitUntil: 'networkidle' });
    await expectImageCount(page, 1);
  });
});

/* ── helpers ──────────────────────────────────────────────────────────── */

async function openEditPage(page: Page, slug: string): Promise<void> {
  await page.goto(`/admin/products/${slug}/edit`, { waitUntil: 'networkidle' });
  /* 페이지가 admin/login 으로 redirect 됐다면 cookie 주입 실패 */
  await expect(page).not.toHaveURL(/\/admin\/login/);
}

async function uploadFiles(
  page: Page,
  files: Array<{ name: string; mimeType: string; buffer: Buffer }>,
): Promise<void> {
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(files);
  /* 업로드 완료 = "업로드 중…" 텍스트 사라짐 */
  await expect(page.locator('button:has-text("업로드 중")')).toHaveCount(0, {
    timeout: 30_000,
  });
}

async function expectImageCount(page: Page, expected: number): Promise<void> {
  /* 카드당 1개 — aria-label="앞으로 이동" 버튼 (SVG 만 child, accessible name = aria-label) */
  const cards = page.getByRole('button', { name: '앞으로 이동' });
  await expect(cards).toHaveCount(expected, { timeout: 20_000 });
}

/**
 * 시나리오 격리용 — DB + storage 둘 다 초기화.
 * spec module 안에서 service_role client 를 직접 만들기보다는
 * product-seed.ts 의 helper 를 재사용.
 */
async function resetProductImages(
  productId: string,
  slug: string,
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return;
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await cleanupProductImages(admin, productId, slug);
}
