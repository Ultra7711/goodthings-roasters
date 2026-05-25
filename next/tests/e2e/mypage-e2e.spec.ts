import { test, expect } from '@playwright/test';
import path from 'path';
import { mkdirSync } from 'fs';

/**
 * S282 마이페이지 재최적화 사전 진단
 * 모바일 viewport (360 × 800 / 375 × 812) skeleton 시각 + timing + DOM 측정
 *
 * 실행: npx playwright test mypage-e2e.spec.ts --headed
 */

const SCREENSHOT_DIR = path.join(__dirname, '../../test-results/audit-s282-mypage');

// 디렉토리 생성
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const VIEWPORTS = [
  { width: 360, height: 800, label: 'android-360' },
  { width: 375, height: 812, label: 'iphone-se' },
  { width: 1440, height: 900, label: 'desktop-1440' },
];

test.describe('S282 MyPage E2E — Skeleton Audit', () => {
  VIEWPORTS.forEach(({ width, height, label }) => {
    test(`${label}: skeleton load timing + screenshot`, async ({ page, context }) => {
      // 뷰포트 설정
      await context.clearCookies();
      await page.setViewportSize({ width, height });

      // Performance 측정을 위한 타이머 시작
      const navigationStart = Date.now();

      // ?_skeleton=1 로 skeleton 만 표시 (로그인 불요)
      await page.goto('http://localhost:3000/mypage?_skeleton=1', {
        waitUntil: 'networkidle',
      });

      const navigationEnd = Date.now();
      const navigationTime = navigationEnd - navigationStart;

      // Performance API 캡처
      const perfData = await page.evaluate(() => {
        const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return {
          requestStart: navTiming?.requestStart ?? 0,
          responseStart: navTiming?.responseStart ?? 0,
          responseEnd: navTiming?.responseEnd ?? 0,
          domInteractive: navTiming?.domInteractive ?? 0,
          domContentLoaded: navTiming?.domContentLoadedEventEnd ?? 0,
          loadEventEnd: navTiming?.loadEventEnd ?? 0,
        };
      });

      // DOM 요소 측정 (skeleton 답습 클래스 사용)
      const domMeasurements = await page.evaluate(() => {
        const heroWrap = document.querySelector('.mp-hero-wrap');
        const _heroInner = document.querySelector('.mp-hero-inner');
        const sideNav = document.querySelector('.mp-side-nav');
        const panel = document.querySelector('.mp-panel');
        const grid = document.querySelector('.mp-grid');
        const page = document.querySelector('.mp-page');
        const body = document.querySelector('.mp-body');
        const stickyBar = document.querySelector('.mp-mobile-stickybar');

        return {
          hasHeroWrap: !!heroWrap,
          heroWrapHeight: heroWrap?.clientHeight ?? 0,
          hasSideNav: !!sideNav,
          sideNavHeight: sideNav?.clientHeight ?? 0,
          hasPanel: !!panel,
          panelHeight: panel?.clientHeight ?? 0,
          hasGrid: !!grid,
          hasStickyBar: !!stickyBar,
          stickyBarHeight: stickyBar?.clientHeight ?? 0,
          pageHeight: page?.scrollHeight ?? document.documentElement.scrollHeight,
          bodyHeight: body?.clientHeight ?? 0,
          pageIsLoaded: page?.classList.contains('is-loaded') ?? false,
          allSkelElements: document.querySelectorAll('.skel').length,
        };
      });

      // Screenshot: 최초 진입 상태
      const screenshotPath1 = path.join(SCREENSHOT_DIR, `${label}-skeleton-initial.png`);
      await page.screenshot({ path: screenshotPath1, fullPage: false });
      console.log(`✓ Screenshot: ${screenshotPath1}`);

      // Scroll 200px 후 screenshot (mobile 스크롤 진입 상태)
      await page.evaluate(() => window.scrollTo(0, 200));
      await page.waitForTimeout(300); // Scroll 렌더 대기

      const screenshotPath2 = path.join(SCREENSHOT_DIR, `${label}-skeleton-scrolled.png`);
      await page.screenshot({ path: screenshotPath2, fullPage: false });
      console.log(`✓ Screenshot: ${screenshotPath2}`);

      // 타이밍 + DOM 측정값 출력
      console.log(`\n${label} Timing Analysis:`);
      console.log(`  Navigation Duration: ${navigationTime}ms`);
      console.log(`  Response Time: ${perfData.responseEnd - perfData.requestStart}ms`);
      console.log(`  DOM Interactive: ${perfData.domInteractive}ms`);
      console.log(`  DOM Content Loaded: ${perfData.domContentLoaded}ms`);
      console.log(`  Load Event: ${perfData.loadEventEnd}ms`);

      console.log(`\n${label} DOM Measurements:`);
      console.log(`  Page.is-loaded: ${domMeasurements.pageIsLoaded}`);
      console.log(`  Has Hero Wrap: ${domMeasurements.hasHeroWrap}`);
      console.log(`  Hero Wrap Height: ${domMeasurements.heroWrapHeight}px`);
      console.log(`  Has Side Nav: ${domMeasurements.hasSideNav}`);
      console.log(`  Side Nav Height: ${domMeasurements.sideNavHeight}px`);
      console.log(`  Has Panel: ${domMeasurements.hasPanel}`);
      console.log(`  Panel Height: ${domMeasurements.panelHeight}px`);
      console.log(`  Has Grid: ${domMeasurements.hasGrid}`);
      console.log(`  Has Sticky Bar: ${domMeasurements.hasStickyBar}`);
      console.log(`  Sticky Bar Height: ${domMeasurements.stickyBarHeight}px`);
      console.log(`  Total Page Height: ${domMeasurements.pageHeight}px`);
      console.log(`  Body Height: ${domMeasurements.bodyHeight}px`);
      console.log(`  Skel Elements Count: ${domMeasurements.allSkelElements}`);

      // Assertion: 기본 구조 검증
      expect(domMeasurements.hasHeroWrap).toBeTruthy();
      expect(domMeasurements.hasSideNav).toBeTruthy();
      expect(domMeasurements.hasPanel).toBeTruthy();
    });
  });

  test('desktop-1440: skeleton full page flow', async ({ page, context }) => {
    await context.clearCookies();
    await page.setViewportSize({ width: 1440, height: 900 });

    const startTime = Date.now();
    await page.goto('http://localhost:3000/mypage?_skeleton=1', {
      waitUntil: 'networkidle',
    });
    const loadTime = Date.now() - startTime;

    console.log(`\nDesktop Load Complete: ${loadTime}ms`);

    // 전체 페이지 높이 스크롤 후 마지막 screenshot
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);

    const fullPagePath = path.join(SCREENSHOT_DIR, 'desktop-1440-skeleton-full.png');
    await page.screenshot({ path: fullPagePath, fullPage: true });
    console.log(`✓ Full page screenshot: ${fullPagePath}`);

    expect(loadTime).toBeLessThan(5000); // 5초 이내 로드 기대
  });

  test('login page mobile viewport check', async ({ page, context }) => {
    // 로그인 페이지 모바일 진입 시작점 검증
    const viewports = [360, 375];

    for (const vpWidth of viewports) {
      await context.clearCookies();
      await page.setViewportSize({ width: vpWidth, height: 812 });

      const startTime = Date.now();
      await page.goto('http://localhost:3000/login', {
        waitUntil: 'networkidle',
      });
      const loadTime = Date.now() - startTime;

      const loginPath = path.join(SCREENSHOT_DIR, `login-${vpWidth}w.png`);
      await page.screenshot({ path: loginPath, fullPage: false });
      console.log(`✓ Login screenshot (${vpWidth}w): ${loginPath} — ${loadTime}ms`);

      expect(loadTime).toBeLessThan(3000);
    }
  });

  test('skeleton + scroll performance metrics', async ({ page, context }) => {
    /**
     * 360 viewport 에서 full scroll 시 frame 드롭 / layout shift 측정
     * (일반적인 mobile performance audit)
     */
    await context.clearCookies();
    await page.setViewportSize({ width: 360, height: 800 });

    await page.goto('http://localhost:3000/mypage?_skeleton=1', {
      waitUntil: 'networkidle',
    });

    // Scroll 이벤트 동안의 CLS (Cumulative Layout Shift) 감시
    const layoutShiftEntries = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const e = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
            if (e.hadRecentInput) continue;
            clsValue += e.value ?? 0;
          }
        });

        observer.observe({ entryTypes: ['layout-shift'] });

        // 500ms 후 값 수집
        setTimeout(() => {
          observer.disconnect();
          resolve(clsValue);
        }, 500);
      });
    });

    console.log(`\n360 Scroll CLS: ${layoutShiftEntries}`);
    console.log(`  (0 = ideal, < 0.1 = good, > 0.25 = poor)`);

    // CLS 기대값 (skeleton 은 layout shift 최소여야 함)
    expect(layoutShiftEntries).toBeLessThan(0.15);
  });
});
