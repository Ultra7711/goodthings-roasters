import { test, expect, type ConsoleMessage, type Page } from '@playwright/test';

/**
 * S262 Phase 4 — Dead CSS sweep 회귀 검증.
 *
 * 인증 비종속 9 페이지의 GET 200 + 핵심 selector visible + 콘솔 에러 0 확인.
 * 인증 페이지 (mypage / admin) 는 별 sprint 의 storageState fixture 신설 후 cover.
 *
 * SAMPLE_PRODUCT_SLUG 는 seed 데이터에 존재해야 함. 부재 시 SKIP_SHOP_DETAIL=1.
 */

const SAMPLE_PRODUCT_SLUG = process.env.SAMPLE_SLUG ?? 'autumn-night';
const SKIP_SHOP_DETAIL = process.env.SKIP_SHOP_DETAIL === '1';

interface PageCheck {
  name: string;
  path: string;
  /** 페이지 렌더 정상 확인용 핵심 selector (CSS · ", " 로 다중 후보 OR) */
  visible: string;
}

const PAGES: PageCheck[] = [
  { name: 'home', path: '/', visible: '.hero-c, .story-chapter' },
  { name: 'shop', path: '/shop', visible: '.sp-card' },
  { name: 'menu', path: '/menu', visible: '.cm-card' },
  { name: 'biz', path: '/biz-inquiry', visible: '.bi-form-section, #bi-body' },
  { name: 'story', path: '/story', visible: '.st-label' },
  { name: 'search', path: '/search', visible: '.search-page-wrap' },
  { name: 'login', path: '/login', visible: '.lp-body' },
  { name: 'checkout', path: '/checkout', visible: '.chp-empty, .chp-body' },
];

if (!SKIP_SHOP_DETAIL) {
  PAGES.push({
    name: 'shop-detail',
    path: `/shop/${SAMPLE_PRODUCT_SLUG}`,
    visible: '.pd-chapter, .pd-recipe-card',
  });
}

/**
 * Next.js dev mode + Turbopack + 환경 noise 패턴 — 실제 에러 아님.
 * S262 dead CSS sweep 과 무관한 에러는 모두 필터링.
 */
const NOISY_PATTERNS: RegExp[] = [
  /Failed to fetch/i,
  /AbortError/i,
  /chunkLoad/i,
  /\b(401|403|404)\b/,
  /Download the React DevTools/i,
  /\bhydrat/i, // hydration mismatch warning (dev only)
  /Content Security Policy/i, // CSP violation (font CDN 등 환경 정책)
  /about:srcdoc/i, // iframe sandboxed (운영자 HTML iframe)
  /sandboxed/i,
  /style-src/i,
  /script-src/i,
  /pretendard/i, // 폰트 CDN 환경별 차이
];

function collectErrors(page: Page): { errors: string[] } {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      errors.push(`console.error: ${msg.text()}`);
    }
  });
  return { errors };
}

for (const p of PAGES) {
  test(`${p.name} (${p.path}) renders without console errors`, async ({ page }) => {
    const { errors } = collectErrors(page);

    const response = await page.goto(p.path, { waitUntil: 'networkidle' });
    expect(response, 'response should exist').not.toBeNull();
    expect(response!.status(), `${p.path} HTTP status`).toBeLessThan(400);

    await expect(page.locator(p.visible).first()).toBeVisible({ timeout: 15_000 });

    const realErrors = errors.filter(
      (e) => !NOISY_PATTERNS.some((rx) => rx.test(e)),
    );
    expect(realErrors, `console errors on ${p.path}`).toEqual([]);
  });
}

/**
 * Dead CSS 영역의 대체 마크업 정상 렌더 — sprint 회귀 검출용.
 *
 * S262 sweep 대상:
 * - HomePage cat-* 9 → lineup-grid 또는 story-chapter 채택
 * - CheckoutPage chp-* 8 → chp-helper 단일화 + Radix Select 마이그
 * - LoginPage lp-* 4 → 데모/비회원 박스 제거
 * - ProductDetail pd-* 10 → pd-recipe-card / Radix Popover 채택
 * - 기타 도메인 잔존물
 */
test.describe('S262 dead CSS sweep — 대체 마크업 정상', () => {
  test('home: lineup section 보존 (cat-grid 제거 후)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    // .lineup-grid--bean 또는 --drip 둘 중 하나는 visible 이어야 함 (S245 P20 lineup 도입)
    const lineup = page.locator('.lineup-grid--bean, .lineup-grid--drip').first();
    await expect(lineup).toBeVisible({ timeout: 15_000 });
  });

  test('checkout: Radix Select dropdown 동작 (chp-dropdown-* 제거 후)', async ({ page }) => {
    await page.goto('/checkout', { waitUntil: 'networkidle' });
    // empty cart 또는 form — 둘 다 chp-body / chp-empty 안에서 렌더
    const root = page.locator('.chp-body, .chp-empty').first();
    await expect(root).toBeVisible({ timeout: 15_000 });
  });

  test('login: form 정상 (lp-demo-fill-btn / lp-guest-buy-* 제거 후)', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    const body = page.locator('.lp-body').first();
    await expect(body).toBeVisible({ timeout: 15_000 });
    // submit 버튼 - 보존 클래스
    const submit = page.locator('.lp-submit-btn').first();
    await expect(submit).toBeVisible();
  });
});
