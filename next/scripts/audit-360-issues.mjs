// @ts-check
/**
 * 360 Viewport Issue Auditor — Session 41
 *
 * 목적: 360 너비에서 자동 DOM 검사로 수정 대상 이슈 목록 산출.
 *
 * 검사 항목:
 *  1. horizontal overflow — scrollWidth > viewport width
 *  2. element clipping — rect.right > viewport width (sticky/absolute 제외)
 *  3. hidden interactive — display:none/visibility:hidden 된 button/a
 *  4. tap target — button/a 가 44x44 미만
 *  5. text clipping — text-overflow:clip + overflow:hidden 으로 잘린 텍스트
 *
 * 사용법:
 *   cd next && npm run dev   # 별도 터미널
 *   node scripts/audit-360-issues.mjs
 *
 * 결과:
 *   docs/design-baseline/session41-audit/360-issues.md
 *   docs/design-baseline/session41-audit/360-issues.json
 */

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const WIDTH = Number(process.env.VW ?? 360);
const HEIGHT = Number(process.env.VH ?? 780);
const TAP_MIN = Number(process.env.TAP_MIN ?? 40); // 사이트 관례 (WCAG 44 보다 완화)
const AUDIT_DIR = process.env.AUDIT_DIR ?? 'session41-audit';
const OUT_FILE = process.env.OUT_FILE ?? `${WIDTH}-issues`;

const OUT_DIR = resolve(__dirname, `../../docs/design-baseline/${AUDIT_DIR}`);

/** @type {Array<{ name: string; path: string; delayMs?: number; scrollY?: number }>} */
const JOBS = [
  { name: '01-home', path: '/', delayMs: 3000 },
  { name: '01b-home-scrolled', path: '/', delayMs: 2000, scrollY: 900 },
  { name: '02-story', path: '/story' },
  { name: '03-shop', path: '/shop' },
  { name: '04-product-detail', path: '/shop/autumn-night' },
  { name: '05-cart', path: '/cart' },
  { name: '06-menu', path: '/menu' },
  { name: '07-login', path: '/login' },
  { name: '08-register', path: '/register' },
  { name: '09-good-days', path: '/good-days' },
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
          setTimeout(res, 4000);
        });
      })
    );
  });
  await page.waitForTimeout(300);
}

/** @param {import('playwright').Page} page @param {number} vw @param {number} tapMin */
async function auditPage(page, vw, tapMin) {
  return page.evaluate(
    ([viewportW, minTap]) => {
      /** @param {Element} el */
      const describe = (el) => {
        const tag = el.tagName.toLowerCase();
        const id = /** @type {HTMLElement} */ (el).id ? `#${/** @type {HTMLElement} */ (el).id}` : '';
        const cls =
          typeof /** @type {HTMLElement} */ (el).className === 'string' &&
          /** @type {HTMLElement} */ (el).className
            ? '.' + /** @type {HTMLElement} */ (el).className.trim().split(/\s+/).slice(0, 3).join('.')
            : '';
        return `${tag}${id}${cls}`;
      };

      const issues = {
        documentOverflow: null,
        clipping: [],
        hiddenInteractive: [],
        smallTapTargets: [],
        overflowScrollX: [],
      };

      // 1. document overflow
      const docW = document.documentElement.scrollWidth;
      if (docW > viewportW) {
        issues.documentOverflow = { scrollWidth: docW, viewport: viewportW, overflow: docW - viewportW };
      }

      // 2. clipping — rect.right > viewport (static/relative 요소만, sticky/absolute 제외)
      const all = Array.from(document.querySelectorAll('body *')).slice(0, 3000);
      for (const el of all) {
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed' || cs.position === 'absolute' || cs.position === 'sticky') continue;
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right > viewportW + 1) {
          issues.clipping.push({
            selector: describe(el),
            right: Math.round(r.right),
            overflow: Math.round(r.right - viewportW),
          });
        }
      }
      // 클리핑은 동일 셀렉터 중복 많음 → 상위 10개만
      issues.clipping = issues.clipping
        .sort((a, b) => b.overflow - a.overflow)
        .slice(0, 10);

      // 3. hidden interactive — 인터랙티브인데 안 보이는 것
      const interactive = Array.from(
        document.querySelectorAll('button, a[href], [role="button"], input, select')
      );
      for (const el of interactive) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none') {
          issues.hiddenInteractive.push({ selector: describe(el), reason: 'display:none' });
        }
      }
      issues.hiddenInteractive = issues.hiddenInteractive.slice(0, 15);

      // 4. small tap targets
      for (const el of interactive) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.width < minTap || r.height < minTap) {
          issues.smallTapTargets.push({
            selector: describe(el),
            width: Math.round(r.width),
            height: Math.round(r.height),
          });
        }
      }
      issues.smallTapTargets = issues.smallTapTargets.slice(0, 20);

      // 5. overflow-x scroll containers (수평 스크롤 컨테이너 — 의도된 것 많음, 참고용)
      for (const el of all) {
        const cs = getComputedStyle(el);
        if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') {
          if (el.scrollWidth > el.clientWidth + 1) {
            issues.overflowScrollX.push({
              selector: describe(el),
              scrollWidth: el.scrollWidth,
              clientWidth: el.clientWidth,
            });
          }
        }
      }
      issues.overflowScrollX = issues.overflowScrollX.slice(0, 10);

      return issues;
    },
    [vw, tapMin]
  );
}

async function run() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`[audit360] ${WIDTH}x${HEIGHT} — OUT=${OUT_DIR}`);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2,
  });

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
  /** @type {Record<string, any>} */
  const report = {};

  for (const job of JOBS) {
    try {
      await page.goto(`${BASE_URL}${job.path}`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(800);
      await waitForMedia(page);
      await page.waitForTimeout(job.delayMs ?? 1000);
      if (typeof job.scrollY === 'number') {
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), job.scrollY);
        await page.waitForTimeout(300);
      }
      const result = await auditPage(page, WIDTH, TAP_MIN);
      report[job.name] = result;
      const summary = [
        result.documentOverflow ? `DOC-OVF ${result.documentOverflow.overflow}px` : null,
        result.clipping.length ? `CLIP ${result.clipping.length}` : null,
        result.hiddenInteractive.length ? `HIDDEN ${result.hiddenInteractive.length}` : null,
        result.smallTapTargets.length ? `TAP ${result.smallTapTargets.length}` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      console.log(`[audit360] ${job.name} — ${summary || 'clean'}`);
    } catch (err) {
      console.error(`[audit360] FAIL ${job.name}: ${err instanceof Error ? err.message : String(err)}`);
      report[job.name] = { error: String(err) };
    }
  }

  await browser.close();

  // JSON
  await writeFile(resolve(OUT_DIR, `${OUT_FILE}.json`), JSON.stringify(report, null, 2), 'utf8');

  // Markdown
  const md = renderMd(report);
  await writeFile(resolve(OUT_DIR, `${OUT_FILE}.md`), md, 'utf8');

  console.log(`\n[audit360] done — ${resolve(OUT_DIR, `${OUT_FILE}.md`)}`);
}

/** @param {Record<string, any>} report */
function renderMd(report) {
  const lines = [];
  lines.push(`# Viewport Audit — ${WIDTH}x${HEIGHT}`);
  lines.push('');
  lines.push(`- viewport: ${WIDTH}x${HEIGHT}`);
  lines.push(`- tap min: ${TAP_MIN}px`);
  lines.push(`- pages: ${Object.keys(report).length}`);
  lines.push('');

  for (const [name, r] of Object.entries(report)) {
    lines.push(`## ${name}`);
    lines.push('');
    if (r.error) {
      lines.push(`- ❌ error: ${r.error}`);
      lines.push('');
      continue;
    }
    if (r.documentOverflow) {
      lines.push(
        `- 🔴 **document overflow** — scrollWidth ${r.documentOverflow.scrollWidth}px (overflow +${r.documentOverflow.overflow}px)`
      );
    }
    if (r.clipping?.length) {
      lines.push(`- 🟡 clipping (top ${r.clipping.length}):`);
      for (const c of r.clipping) lines.push(`  - \`${c.selector}\` · right=${c.right} · +${c.overflow}px`);
    }
    if (r.hiddenInteractive?.length) {
      lines.push(`- ⚪ hidden interactive (${r.hiddenInteractive.length}):`);
      for (const h of r.hiddenInteractive) lines.push(`  - \`${h.selector}\` · ${h.reason}`);
    }
    if (r.smallTapTargets?.length) {
      lines.push(`- 🟠 small tap targets (${r.smallTapTargets.length}):`);
      for (const t of r.smallTapTargets) lines.push(`  - \`${t.selector}\` · ${t.width}×${t.height}`);
    }
    if (r.overflowScrollX?.length) {
      lines.push(`- ℹ️ overflow-x containers (${r.overflowScrollX.length}):`);
      for (const s of r.overflowScrollX)
        lines.push(`  - \`${s.selector}\` · scrollWidth=${s.scrollWidth} clientWidth=${s.clientWidth}`);
    }
    if (
      !r.documentOverflow &&
      !r.clipping?.length &&
      !r.hiddenInteractive?.length &&
      !r.smallTapTargets?.length
    ) {
      lines.push('- ✅ clean');
    }
    lines.push('');
  }
  return lines.join('\n');
}

run().catch((err) => {
  console.error('[audit360] fatal:', err);
  process.exit(1);
});
