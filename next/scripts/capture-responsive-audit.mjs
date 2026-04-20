// @ts-check
/**
 * Responsive Audit Screenshot Capture — Session 37
 *
 * 목적: Session 38 반응형 전환의 Before 비교 자료 (1440 vs 768 vs 360).
 *       타이포·스페이싱·레이아웃 분석용 → fullPage 불필요, above-the-fold 1화면만.
 *
 * 사용법:
 *   1. dev 서버 기동 (별도 터미널):
 *        cd next && npm run dev
 *
 *   2. 3개 viewport 순차 실행:
 *        cd next
 *        node scripts/capture-responsive-audit.mjs 1440
 *        node scripts/capture-responsive-audit.mjs 768
 *        node scripts/capture-responsive-audit.mjs 360
 *
 *   3. 결과:
 *        docs/design-baseline/session37-audit/{width}/*.png
 *
 * 환경변수:
 *   BASE_URL (기본 http://localhost:3000)
 *   FULL_PAGE=1 (기본 0 — above-the-fold 만. 1 지정 시 전체 스크롤)
 */

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const FULL_PAGE = process.env.FULL_PAGE === '1';

const WIDTH = Number(process.argv[2] ?? 1440);
const HEIGHT = WIDTH >= 1024 ? 900 : WIDTH >= 768 ? 1024 : 780;

const OUT_LABEL = process.env.OUT_LABEL ?? 'session37-audit';
const OUT_DIR = resolve(__dirname, `../../docs/design-baseline/${OUT_LABEL}/${WIDTH}`);

/**
 * 홈은 히어로 비디오 인트로 타이포가 페이지 타이포로 오인될 수 있어 별도 처리:
 *  - 01-home: 비디오 인트로 지나간 시점(8s 대기) — 영상 자체의 타이포 최소화
 *  - 01b-home-scrolled: 히어로 아래 섹션 — 실제 페이지 타이포(Featured Beans 등) 확인용
 * @type {Array<{ name: string; path: string; delayMs?: number; scrollY?: number }>}
 */
const JOBS = [
  { name: '01-home', path: '/', delayMs: 8000 },
  { name: '01b-home-scrolled', path: '/', delayMs: 2000, scrollY: 900 },
  { name: '02-story', path: '/story' },
  { name: '03-shop', path: '/shop' },
  { name: '04-product-detail', path: '/shop/autumn-night' },
  { name: '05-cart-fullpage', path: '/cart' },
  { name: '06-menu', path: '/menu' },
  { name: '07-login', path: '/login' },
];

/** @param {import('playwright').Page} page */
async function waitForMedia(page) {
  await page.evaluate(async () => {
    const imgs = Array.from(document.images);
    await Promise.all(
      imgs.map((img) => {
        if (img.complete && img.naturalHeight > 0) return Promise.resolve();
        return new Promise((res) => {
          img.addEventListener('load', res, { once: true });
          img.addEventListener('error', res, { once: true });
          setTimeout(res, 6000);
        });
      })
    );
  });
  await page.waitForTimeout(500);
}

async function capture() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`[audit] ${WIDTH}x${HEIGHT} — OUT=${OUT_DIR} fullPage=${FULL_PAGE}`);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2,
  });

  // IntersectionObserver override — lazy 섹션이 비어있지 않게
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
  const results = { ok: [], failed: [] };

  for (const job of JOBS) {
    const out = resolve(OUT_DIR, `${job.name}.png`);
    try {
      await page.goto(`${BASE_URL}${job.path}`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(1000);
      await waitForMedia(page);
      await page.waitForTimeout(job.delayMs ?? 1500);
      if (typeof job.scrollY === 'number') {
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), job.scrollY);
        await page.waitForTimeout(400);
      }
      await page.screenshot({ path: out, fullPage: FULL_PAGE });
      console.log(`[audit] OK  ${job.name}`);
      results.ok.push(job.name);
    } catch (err) {
      console.error(`[audit] FAIL ${job.name}: ${err instanceof Error ? err.message : String(err)}`);
      results.failed.push(job.name);
    }
  }

  await browser.close();
  console.log(`\n[audit] ${WIDTH}: OK ${results.ok.length} / FAIL ${results.failed.length}`);
  if (results.failed.length > 0) process.exitCode = 1;
}

capture().catch((err) => {
  console.error('[audit] fatal:', err);
  process.exit(1);
});
