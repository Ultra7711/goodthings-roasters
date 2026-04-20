// @ts-check
/**
 * Design Baseline Screenshot Capture — Session 33 (Claude Design 2차 테스트용)
 *
 * 사용법:
 *   1. 의존성 설치 (최초 1회):
 *        cd next
 *        npm i -D playwright
 *        npx playwright install chromium
 *
 *   2. 앱 기동 (별도 터미널):
 *        cd next && npm run dev
 *        → http://localhost:3000 대기 확인
 *
 *   3. 캡처 실행:
 *        cd next && node scripts/capture-design-baseline.mjs
 *
 *   4. 결과:
 *        docs/design-baseline/01-screenshots-session33/*.png
 *
 * 옵션 환경변수:
 *   BASE_URL (기본 http://localhost:3000)
 *   OUT_DIR  (기본 ../docs/design-baseline/01-screenshots-session33)
 *   VIEWPORT_WIDTH (기본 1440)
 *   VIEWPORT_HEIGHT (기본 900)
 *   SLOW_MS (기본 500 — 각 페이지 로드 후 대기 ms)
 *
 * ⚠️ 인증 필요 페이지 (checkout, mypage) 는 로그인 세션이 없으면 리다이렉트됨.
 *    직접 로그인 후 쿠키/스토리지를 생성 → playwright storageState 로 주입 방식 확장 가능 (현재 미구현).
 *
 * ⚠️ 동적 인터랙션 (카트 드로어 열기, Good Days lightbox) 은 하단 INTERACTIVE_JOBS 참조.
 */

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT_DIR = resolve(
  __dirname,
  process.env.OUT_DIR ?? '../../docs/design-baseline/01-screenshots-session33'
);
const VIEWPORT = {
  width: Number(process.env.VIEWPORT_WIDTH ?? 1440),
  height: Number(process.env.VIEWPORT_HEIGHT ?? 900),
};
const SLOW_MS = Number(process.env.SLOW_MS ?? 500);

/**
 * 실제 사용 slug — `cartMerge.test.ts` 기준. 필요 시 override.
 * @type {string}
 */
const SAMPLE_SLUG = process.env.SAMPLE_SLUG ?? 'autumn-night';

/**
 * 단순 URL 캡처 작업 목록.
 * @type {Array<{ name: string; path: string; auth?: boolean; note?: string }>}
 */
const SIMPLE_JOBS = [
  { name: '01-home', path: '/' },
  { name: '02-story', path: '/story' },
  { name: '03-menu', path: '/menu' },
  { name: '04-shop', path: '/shop' },
  { name: '05-product-detail', path: `/shop/${SAMPLE_SLUG}` },
  { name: '06-good-days-gallery', path: '/gooddays' },
  { name: '09-cart-fullpage', path: '/cart' },
  { name: '10-login', path: '/login' },
  { name: '12-search-result', path: '/search?q=autumn' },
  { name: '13-mypage', path: '/mypage', auth: true, note: '로그인 필요 — storageState 미주입 시 /login 리다이렉트' },
  { name: '14-checkout', path: '/checkout', auth: true, note: '카트 아이템·로그인 필요' },
];

/**
 * 인터랙션이 필요한 캡처 작업. 각 작업은 Playwright page 로 수동 조작.
 * @type {Array<{ name: string; path: string; action: (page: import('playwright').Page) => Promise<void>; note: string }>}
 */
const INTERACTIVE_JOBS = [
  {
    name: '07-good-days-lightbox',
    path: '/gooddays',
    note: '갤러리 첫 이미지 클릭 → lightbox open',
    action: async (page) => {
      // 갤러리 이미지 셀렉터는 실제 구현 확인 후 조정 필요
      const firstItem = page.locator('[data-gallery-item], .gd-gallery-item, .gooddays-item').first();
      await firstItem.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      await firstItem.click().catch(() => {});
      await page.waitForTimeout(600); // lightbox 페이드인
    },
  },
  {
    name: '08-cart-drawer',
    path: '/',
    note: '헤더 카트 아이콘 클릭 → 드로어 슬라이드인',
    action: async (page) => {
      const cartBtn = page.locator('[aria-label*="장바구니"], [aria-label*="cart" i], #cart-drawer-open-btn').first();
      await cartBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      await cartBtn.click().catch(() => {});
      await page.waitForTimeout(600); // 드로어 트랜지션
    },
  },
  {
    name: '11-register',
    path: '/login',
    note: '회원가입 탭 또는 스위치 링크 클릭 — 구현 방식에 따라 경로 조정 필요',
    action: async (page) => {
      const switchLink = page.locator('.lp-switch-link, [href*="register"], text=회원가입').first();
      await switchLink.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
      await switchLink.click().catch(() => {});
      await page.waitForTimeout(500);
    },
  },
];

/**
 * 페이지 전체를 단계적으로 스크롤하여 IntersectionObserver 기반 lazy 섹션을 모두 트리거.
 * @param {import('playwright').Page} page
 */
async function autoScroll(page) {
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
      }, 200);
    });
  });
}

/**
 * 모든 <img> 로드 완료 + 비디오 ready 대기.
 * @param {import('playwright').Page} page
 */
async function waitForMedia(page) {
  await page.evaluate(async () => {
    const imgs = Array.from(document.images);
    await Promise.all(
      imgs.map((img) => {
        if (img.complete && img.naturalHeight > 0) return Promise.resolve();
        return new Promise((res) => {
          img.addEventListener('load', res, { once: true });
          img.addEventListener('error', res, { once: true });
          setTimeout(res, 8000); // 안전 타임아웃
        });
      })
    );
    const videos = Array.from(document.querySelectorAll('video'));
    await Promise.all(
      videos.map((v) => {
        if (v.readyState >= 3) return Promise.resolve();
        return new Promise((res) => {
          v.addEventListener('canplay', res, { once: true });
          v.addEventListener('error', res, { once: true });
          setTimeout(res, 5000);
        });
      })
    );
  });
  await page.waitForTimeout(600);
}

async function capture() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`[baseline] OUT_DIR = ${OUT_DIR}`);
  console.log(`[baseline] BASE_URL = ${BASE_URL}`);
  console.log(`[baseline] VIEWPORT = ${VIEWPORT.width}x${VIEWPORT.height}`);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2, // retina
    // TODO: 로그인 세션 필요 시 storageState 주입:
    //   storageState: resolve(__dirname, '.auth-state.json'),
  });

  // IntersectionObserver 오버라이드 — 모든 요소를 항상 intersecting 으로 보고.
  // 이유: roastStage·flavorNote 등 observer 기반 애니메이션이 뷰 이탈 시 리셋되어
  // fullPage 스크린샷에서 빈 상태로 찍히는 문제 방지.
  await context.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OriginalIO = window.IntersectionObserver;
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
    // 원본 보존 (혹 필요 시 복원 가능)
    window.__OriginalIntersectionObserver = OriginalIO;
  });

  const page = await context.newPage();

  const results = { ok: [], skipped: [], failed: [] };

  for (const job of SIMPLE_JOBS) {
    const out = resolve(OUT_DIR, `${job.name}.png`);
    try {
      await page.goto(`${BASE_URL}${job.path}`, { waitUntil: 'load', timeout: 30000 });
      // 인증 리다이렉트 감지
      if (job.auth && !page.url().endsWith(job.path)) {
        console.warn(`[baseline] SKIP ${job.name} — redirected to ${page.url()} (${job.note ?? 'auth required'})`);
        results.skipped.push(job.name);
        continue;
      }
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(SLOW_MS + 800); // 히어로 비디오·폰트·이미지 로드 여유
      await autoScroll(page); // IntersectionObserver lazy 섹션 트리거
      await waitForMedia(page); // 이미지·비디오 완전 로드 대기
      await page.waitForTimeout(2500); // roastStage 등 순차 애니메이션 완료 대기
      await page.screenshot({ path: out, fullPage: true });
      console.log(`[baseline] OK  ${job.name} → ${out}`);
      results.ok.push(job.name);
    } catch (err) {
      console.error(`[baseline] FAIL ${job.name}: ${err instanceof Error ? err.message : String(err)}`);
      results.failed.push(job.name);
    }
  }

  for (const job of INTERACTIVE_JOBS) {
    const out = resolve(OUT_DIR, `${job.name}.png`);
    try {
      await page.goto(`${BASE_URL}${job.path}`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(SLOW_MS + 500);
      await waitForMedia(page);
      await job.action(page);
      await page.screenshot({ path: out, fullPage: true });
      console.log(`[baseline] OK  ${job.name} → ${out} (${job.note})`);
      results.ok.push(job.name);
    } catch (err) {
      console.error(`[baseline] FAIL ${job.name}: ${err instanceof Error ? err.message : String(err)}`);
      results.failed.push(job.name);
    }
  }

  await browser.close();

  console.log('\n[baseline] ═══ Summary ═══');
  console.log(`OK      (${results.ok.length}): ${results.ok.join(', ')}`);
  console.log(`SKIPPED (${results.skipped.length}): ${results.skipped.join(', ')}`);
  console.log(`FAILED  (${results.failed.length}): ${results.failed.join(', ')}`);
  if (results.failed.length > 0 || results.skipped.length > 0) {
    process.exitCode = 1;
  }
}

capture().catch((err) => {
  console.error('[baseline] fatal:', err);
  process.exit(1);
});
