/* ══════════════════════════════════════════════════════════════════════════
   admin-settings-hours.spec.ts — 사이트 설정 영업시간 저장 E2E

   운영자 flow: /admin/settings 영업시간 카드에서 비정기 휴무(날짜+사유) 추가 →
   [변경사항 저장] → site_settings.hours.closures 에 반영(service_role 재조회).

   격리: 기존 hours row 를 beforeAll 백업 → afterAll 원복(없었으면 row 삭제).
   비파괴적(요일별 시간 미변경, 미래 날짜 휴무만 추가).

   ▸ owner 권한 필요(getAdminOwnerClaims) — 저장 버튼 비활성이면 owner 아님.
   ▸ env / storageState 부재 시 SKIP.
   ══════════════════════════════════════════════════════════════════════════ */

import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const ADMIN_STORAGE_STATE = path.resolve(__dirname, '.auth/admin.json');
const hasAdminAuth =
  !!process.env.E2E_ADMIN_USER_ID && existsSync(ADMIN_STORAGE_STATE);
const describeAdmin = hasAdminAuth ? test.describe : test.describe.skip;

const E2E_CLOSURE_DATE = '2026-12-25';
const E2E_CLOSURE_REASON = '[E2E] 테스트 휴무';

function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('settings-hours: Supabase 환경변수 누락');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describeAdmin('영업시간 설정 저장', () => {
  let hadRow = false;
  let backupValue: unknown = null;

  test.beforeAll(async () => {
    const { data } = await adminClient()
      .from('site_settings')
      .select('value')
      .eq('key', 'hours')
      .maybeSingle();
    if (data) {
      hadRow = true;
      backupValue = (data as { value: unknown }).value;
    }
  });

  test.afterAll(async () => {
    const admin = adminClient();
    if (hadRow) {
      await admin
        .from('site_settings')
        .upsert({ key: 'hours', value: backupValue }, { onConflict: 'key' });
    } else {
      await admin.from('site_settings').delete().eq('key', 'hours');
    }
  });

  test.beforeEach(async ({ context }) => {
    const parsed = JSON.parse(readFileSync(ADMIN_STORAGE_STATE, 'utf8')) as {
      cookies?: unknown;
    };
    await context.addCookies(
      (parsed.cookies ?? []) as Parameters<typeof context.addCookies>[0],
    );
  });

  test('비정기 휴무 추가 → 저장 → site_settings.hours 반영', async ({ page }) => {
    await page.goto('/admin/settings', { waitUntil: 'networkidle' });

    /* 영업시간 카드 — 비정기 휴무 추가 */
    await expect(page.getByText('매장 영업시간')).toBeVisible();
    await page.getByRole('button', { name: '+ 추가' }).click();

    await page.getByLabel('휴무 날짜').fill(E2E_CLOSURE_DATE);
    await page.getByLabel('휴무 사유').fill(E2E_CLOSURE_REASON);

    /* 저장 (owner 전용 — 버튼 활성 확인) */
    const saveBtn = page.getByRole('button', { name: '변경사항 저장' });
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();
    await expect(page.getByText('설정을 저장했습니다')).toBeVisible();

    /* service_role 재조회 — closures 에 반영 확인 */
    const { data, error } = await adminClient()
      .from('site_settings')
      .select('value')
      .eq('key', 'hours')
      .single();
    expect(error).toBeNull();

    const value = (data as { value: { closures?: Array<{ date: string; reason: string }> } }).value;
    const closure = value.closures?.find((c) => c.date === E2E_CLOSURE_DATE);
    expect(closure).toBeTruthy();
    expect(closure?.reason).toBe(E2E_CLOSURE_REASON);
  });
});
