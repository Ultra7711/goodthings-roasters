/* ══════════════════════════════════════════════════════════════════════════
   global-setup.ts — Playwright globalSetup (S264-D LOW-C)

   책임:
   - .env.local 로드 (next/env 미사용 — dotenv 직접 호출)
   - E2E_ADMIN_USER_ID 미설정 시 storageState 미생성 (admin spec 자동 skip)
   - admin storageState 생성 (createAdminStorageState)

   주의:
   - product seed 는 globalSetup 에서 처리하지 않음 — spec 의 test.beforeAll
     에서 처리해 spec 격리성을 유지하고 실패 케이스의 부분 데이터 누적 방지
   - storageState 경로는 ADMIN_STORAGE_STATE 환경변수로 spec 에 전달
   ══════════════════════════════════════════════════════════════════════════ */

import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import type { FullConfig } from '@playwright/test';
import { createAdminStorageState } from './fixtures/admin-auth';

export const ADMIN_STORAGE_STATE = path.resolve(
  __dirname,
  '.auth/admin.json',
);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default async function globalSetup(_config: FullConfig): Promise<void> {
  /* .env.local 우선 로드, 없으면 .env */
  loadDotenv({ path: path.resolve(__dirname, '../../.env.local') });
  loadDotenv({ path: path.resolve(__dirname, '../../.env') });

  if (!process.env.E2E_ADMIN_USER_ID) {
    console.log(
      '[e2e globalSetup] E2E_ADMIN_USER_ID 미설정 — admin spec SKIP, 비admin spec 만 실행',
    );
    return;
  }

  try {
    const { email } = await createAdminStorageState(ADMIN_STORAGE_STATE);
    console.log(
      `[e2e globalSetup] admin storageState 생성 완료 (email=${maskEmail(email)})`,
    );
  } catch (err) {
    /* setup 실패해도 비admin spec 은 통과시키기 위해 throw 안 함.
       admin spec 은 storageState 부재로 자동 skip. */
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[e2e globalSetup] admin storageState 생성 실패: ${msg}`);
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  const head = local.slice(0, 2);
  return `${head}***@${domain}`;
}
