// @ts-check
/**
 * 인증 세션 저장 스크립트 — capture-design-baseline-auth 선행 단계
 *
 * 사용법:
 *   1. 앱 기동 (별도 터미널):
 *        cd next && npm run dev
 *
 *   2. 이 스크립트 실행:
 *        cd next && node scripts/capture-auth-setup.mjs
 *
 *   3. 뜨는 브라우저에서 수동으로:
 *        a. 로그인 완료
 *        b. 체크아웃 캡처가 필요하면 → 카트에 상품 1건 이상 추가
 *        c. 준비 끝나면 터미널에서 Enter 키
 *
 *   4. 저장 결과: next/scripts/.auth-state.json
 *      → capture-design-baseline-auth.mjs 가 읽어 사용
 *
 * ⚠️ .auth-state.json 은 .gitignore 에 반드시 추가 (쿠키·세션 포함).
 */

import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const STATE_PATH = resolve(__dirname, '.auth-state.json');
const VIEWPORT = {
  width: Number(process.env.VIEWPORT_WIDTH ?? 1440),
  height: Number(process.env.VIEWPORT_HEIGHT ?? 900),
};

async function run() {
  console.log(`[auth-setup] BASE_URL = ${BASE_URL}`);
  console.log(`[auth-setup] 상태 저장 경로 = ${STATE_PATH}`);
  console.log('[auth-setup] 브라우저를 띄웁니다. 수동 로그인 + 카트 세팅 후 터미널에서 Enter.');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });

  const rl = createInterface({ input, output });
  await rl.question('\n로그인 + 카트 준비 완료 후 Enter 키 → ');
  rl.close();

  await context.storageState({ path: STATE_PATH });
  console.log(`[auth-setup] ✅ 저장 완료: ${STATE_PATH}`);
  console.log('[auth-setup] 다음 단계: node scripts/capture-design-baseline-auth.mjs');

  await browser.close();
}

run().catch((err) => {
  console.error('[auth-setup] fatal:', err);
  process.exit(1);
});
