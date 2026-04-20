// @ts-check
/**
 * 인증 필요 페이지 캡처 — mypage · checkout
 *
 * 선행 조건:
 *   1. capture-auth-setup.mjs 를 먼저 실행해 next/scripts/.auth-state.json 생성
 *   2. 앱이 localhost:3000 에서 기동 중
 *   3. 체크아웃 캡처를 원하면 auth-setup 단계에서 카트에 상품 1건 이상 추가
 *
 * 사용법:
 *   cd next && node scripts/capture-design-baseline-auth.mjs
 *
 * 결과:
 *   docs/design-baseline/01-screenshots-session33/13-mypage.png
 *   docs/design-baseline/01-screenshots-session33/14-checkout.png
 *
 * 옵션 환경변수:
 *   BASE_URL / OUT_DIR / VIEWPORT_WIDTH / VIEWPORT_HEIGHT / SLOW_MS
 *   STATE_PATH (기본 next/scripts/.auth-state.json)
 */

import { chromium } from 'playwright';
import { mkdir, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT_DIR = resolve(
  __dirname,
  process.env.OUT_DIR ?? '../../docs/design-baseline/01-screenshots-session33'
);
const STATE_PATH = resolve(
  __dirname,
  process.env.STATE_PATH ?? '.auth-state.json'
);
const VIEWPORT = {
  width: Number(process.env.VIEWPORT_WIDTH ?? 1440),
  height: Number(process.env.VIEWPORT_HEIGHT ?? 900),
};
const SLOW_MS = Number(process.env.SLOW_MS ?? 500);

/** @type {Array<{ name: string; path: string; note: string }>} */
const AUTH_JOBS = [
  { name: '13-mypage', path: '/mypage', note: '로그인 세션 필요' },
  { name: '14-checkout', path: '/checkout', note: '로그인 + 카트 아이템 1건 이상 필요' },
];

async function run() {
  try {
    await access(STATE_PATH);
  } catch {
    console.error(`[auth-capture] ❌ 상태 파일 없음: ${STATE_PATH}`);
    console.error('[auth-capture]    먼저 실행: node scripts/capture-auth-setup.mjs');
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  console.log(`[auth-capture] STATE = ${STATE_PATH}`);
  console.log(`[auth-capture] OUT_DIR = ${OUT_DIR}`);
  console.log(`[auth-capture] BASE_URL = ${BASE_URL}`);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    storageState: STATE_PATH,
  });

  // IntersectionObserver 오버라이드 — observer 기반 애니메이션 뷰 이탈 리셋 방지.
  await context.addInitScript(() => {
    // @ts-expect-error stub
    window.IntersectionObserver = class {
      constructor(cb) { this._cb = cb; }
      observe(el) {
        const entry = {
          isIntersecting: true,
          intersectionRatio: 1,
          target: el,
          boundingClientRect: el.getBoundingClientRect?.() ?? {},
          intersectionRect: el.getBoundingClientRect?.() ?? {},
          rootBounds: null,
          time: performance.now(),
        };
        setTimeout(() => this._cb([entry], this), 0);
      }
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
    };
  });

  const page = await context.newPage();

  const results = { ok: [], redirected: [], failed: [] };

  for (const job of AUTH_JOBS) {
    const out = resolve(OUT_DIR, `${job.name}.png`);
    try {
      await page.goto(`${BASE_URL}${job.path}`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(SLOW_MS + 800);
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let y = 0;
          const step = 500;
          const timer = setInterval(() => {
            window.scrollTo(0, y);
            y += step;
            if (y >= document.body.scrollHeight) {
              clearInterval(timer);
              window.scrollTo(0, 0);
              setTimeout(resolve, 400);
            }
          }, 120);
        });
      });
      await page.waitForTimeout(2500); // 애니메이션 완료 대기

      const finalUrl = page.url();
      if (!finalUrl.includes(job.path)) {
        console.warn(`[auth-capture] ⚠️  ${job.name} — 리다이렉트 감지 → ${finalUrl}`);
        console.warn(`[auth-capture]    원인: ${job.note}`);
        results.redirected.push(job.name);
        continue;
      }

      await page.screenshot({ path: out, fullPage: true });
      console.log(`[auth-capture] OK  ${job.name} → ${out}`);
      results.ok.push(job.name);
    } catch (err) {
      console.error(`[auth-capture] FAIL ${job.name}: ${err instanceof Error ? err.message : String(err)}`);
      results.failed.push(job.name);
    }
  }

  await browser.close();

  console.log('\n[auth-capture] ═══ Summary ═══');
  console.log(`OK          (${results.ok.length}): ${results.ok.join(', ')}`);
  console.log(`REDIRECTED  (${results.redirected.length}): ${results.redirected.join(', ')}`);
  console.log(`FAILED      (${results.failed.length}): ${results.failed.join(', ')}`);
  if (results.redirected.length > 0 || results.failed.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error('[auth-capture] fatal:', err);
  process.exit(1);
});
