/* ══════════════════════════════════════════════════════════════════════════
   admin-auth-guard.spec.ts — S250-5 E2E (1/4) admin 인증 가드

   (authed)/layout.tsx 의 getAdminClaims() 가드 검증:
   - 미인증 사용자 → /admin/* 접근 시 /admin/login 리다이렉트
   - 비-admin(일반 회원) 세션 → /admin/* 접근 시 /admin/login 리다이렉트
     (S260: user-auth fixture 로 임시 일반회원 세션 동적 생성 — 권한 가드 실검증)
   - admin 세션 → /admin 대시보드 정상 접근 (리다이렉트 없음)

   ▸ env 부재 / storageState 부재 시 SKIP.
   ══════════════════════════════════════════════════════════════════════════ */

import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  createNonAdminSession,
  deleteNonAdminUser,
} from './fixtures/user-auth';

const ADMIN_STORAGE_STATE = path.resolve(__dirname, '.auth/admin.json');
const hasAdminAuth =
  !!process.env.E2E_ADMIN_USER_ID && existsSync(ADMIN_STORAGE_STATE);
const describeAdmin = hasAdminAuth ? test.describe : test.describe.skip;

function adminCookies(): Parameters<
  import('@playwright/test').BrowserContext['addCookies']
>[0] {
  const parsed = JSON.parse(readFileSync(ADMIN_STORAGE_STATE, 'utf8')) as {
    cookies?: unknown;
  };
  return (parsed.cookies ?? []) as Parameters<
    import('@playwright/test').BrowserContext['addCookies']
  >[0];
}

describeAdmin('S250-5 — admin 인증 가드', () => {
  test('미인증 사용자는 /admin 접근 시 /admin/login 으로 리다이렉트', async ({
    page,
  }) => {
    /* 쿠키 미주입 = 미인증 */
    await page.goto('/admin', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('미인증 사용자는 보호 서브라우트(/admin/subscriptions)도 차단', async ({
    page,
  }) => {
    await page.goto('/admin/subscriptions', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('비-admin(일반 회원) 세션은 /admin 접근 시 /admin/login 으로 리다이렉트', async ({
    context,
    page,
  }) => {
    /* 임시 일반회원 세션 — admin_level 없음 → getAdminClaims null → 거부 */
    const session = await createNonAdminSession();
    try {
      await context.addCookies(session.cookies);
      await page.goto('/admin', { waitUntil: 'networkidle' });
      await expect(page).toHaveURL(/\/admin\/login/);

      await page.goto('/admin/subscriptions', { waitUntil: 'networkidle' });
      await expect(page).toHaveURL(/\/admin\/login/);
    } finally {
      await deleteNonAdminUser(session.userId);
    }
  });

  test('admin 세션은 /admin 대시보드에 접근 가능 (리다이렉트 없음)', async ({
    context,
    page,
  }) => {
    await context.addCookies(adminCookies());
    await page.goto('/admin', { waitUntil: 'networkidle' });
    /* 로그인으로 튕기지 않고 /admin 에 머물러야 함 */
    await expect(page).not.toHaveURL(/\/admin\/login/);
    await expect(page).toHaveURL(/\/admin\/?(\?.*)?$/);
    /* 어드민 사이드바(공통 레이아웃) 존재 = 인증 통과 증거 */
    await expect(page.getByRole('link', { name: '대시보드' })).toBeVisible();
  });

  test('admin 세션은 보호 서브라우트(/admin/subscriptions) 접근 가능', async ({
    context,
    page,
  }) => {
    await context.addCookies(adminCookies());
    await page.goto('/admin/subscriptions', { waitUntil: 'networkidle' });
    await expect(page).not.toHaveURL(/\/admin\/login/);
    await expect(page).toHaveURL(/\/admin\/subscriptions/);
  });
});
