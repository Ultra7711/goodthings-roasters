/* ══════════════════════════════════════════════════════════════════════════
   bannerConvert.test.ts — S274 Phase 1 단위 테스트

   범위:
   - parseResponsiveHtml — 4 BP section 추출 + CSS rules map
   - parseCssRules        — selector 별 declarations 분리
   - computeClamp         — slope/intercept 산수 (spec §4 공식)
   - sanitizeProductionHtml — script / viewport meta / body 데모 layout 제거
   ══════════════════════════════════════════════════════════════════════════ */

import { describe, expect, it } from 'vitest';
import {
  BP_WRAPS,
  BP_WIDTHS,
  buildClampMap,
  buildProductionHtml,
  collectTargetSelectors,
  computeClamp,
  parseCssRules,
  parseResponsiveHtml,
  resolveBpDeclarations,
  sanitizeProductionHtml,
} from './bannerConvert';

/* ── 1. parseResponsiveHtml ──────────────────────────────────────────── */

describe('parseResponsiveHtml', () => {
  /* spec §변환 예시 (UBE 배너) 의 핵심 구조만 인라인 fixture 로 축소.
     실 UBE 459 줄 HTML 의 통합 테스트는 Phase 2 (production 조합 + e2e) 에서. */
  const minimalFixture = `
    <!DOCTYPE html>
    <html><head>
      <meta name="viewport" content="width=device-width">
      <title>UBE Banner Demo</title>
      <style>
        .headline { font-size: 64px; color: #5d366a; }
        .landscape-min-wrap .headline { font-size: 38px; }
        .portrait-max-wrap .mobile-text .headline { font-size: 64px; }
        .portrait-min-wrap .mobile-text .headline { font-size: 32px; }
      </style>
    </head><body style="background: #f5f0ea; padding: 40px 20px; gap: 48px;">
      <div class="section">
        <p class="label">label</p>
        <div class="banner-wrap landscape-max-wrap">
          <h1 class="headline">Ube, But Better.</h1>
        </div>
      </div>
      <div class="section">
        <div class="banner-wrap landscape-min-wrap">
          <h2 class="headline">Ube, But Better.</h2>
        </div>
      </div>
      <div class="section">
        <div class="banner-wrap portrait-max-wrap">
          <div class="mobile-text"><h2 class="headline">Ube, But Better.</h2></div>
        </div>
      </div>
      <div class="section">
        <div class="banner-wrap portrait-min-wrap">
          <div class="mobile-text"><h2 class="headline">Ube, But Better.</h2></div>
        </div>
      </div>
    </body></html>
  `;

  it('4 BP section 을 모두 추출한다', () => {
    const result = parseResponsiveHtml(minimalFixture);
    for (const key of BP_WRAPS) {
      expect(result.sections[key]).not.toBeNull();
    }
    expect(result.warnings).toEqual([]);
  });

  it('section 안 클래스를 수집한다', () => {
    const result = parseResponsiveHtml(minimalFixture);
    expect(result.sections['landscape-max']?.classes).toContain('headline');
    expect(result.sections['portrait-max']?.classes).toContain('mobile-text');
  });

  it('<style> 블록의 CSS rules 를 selector 별로 분리한다', () => {
    const result = parseResponsiveHtml(minimalFixture);
    expect(result.cssRules['.headline']?.['font-size']).toBe('64px');
    expect(result.cssRules['.landscape-min-wrap .headline']?.['font-size']).toBe('38px');
    expect(result.cssRules['.portrait-min-wrap .mobile-text .headline']?.['font-size']).toBe('32px');
  });

  it('<title> 을 추출한다', () => {
    const result = parseResponsiveHtml(minimalFixture);
    expect(result.title).toBe('UBE Banner Demo');
  });

  it('BP wrap 누락 시 warnings 에 기록한다', () => {
    const partial = `<html><body>
      <div class="banner-wrap landscape-max-wrap"></div>
      <!-- 나머지 3 wrap 누락 -->
    </body></html>`;
    const result = parseResponsiveHtml(partial);
    expect(result.sections['landscape-max']).not.toBeNull();
    expect(result.sections['landscape-min']).toBeNull();
    expect(result.warnings).toHaveLength(3);
    expect(result.warnings[0]).toContain('landscape-min');
  });
});

/* ── 2. parseCssRules ─────────────────────────────────────────────────── */

describe('parseCssRules', () => {
  it('단일 rule 의 declarations 를 분리한다', () => {
    const rules = parseCssRules('.foo { font-size: 16px; color: red; }');
    expect(rules['.foo']).toEqual({ 'font-size': '16px', color: 'red' });
  });

  it('다중 selector (.a, .b) 에 동일 declarations 를 분배한다', () => {
    const rules = parseCssRules('.a, .b { padding: 8px; }');
    expect(rules['.a']?.padding).toBe('8px');
    expect(rules['.b']?.padding).toBe('8px');
  });

  it('주석을 제거한다', () => {
    const rules = parseCssRules('/* leading */ .foo { font-size: 10px; } /* trailing */');
    expect(rules['.foo']?.['font-size']).toBe('10px');
  });

  it('descendant selector 의 공백을 보존한다', () => {
    const rules = parseCssRules('.wrap .child { display: none; }');
    expect(rules['.wrap .child']).toEqual({ display: 'none' });
  });

  it('Phase 1 한계 — @media nested 안 selector 도 top-level 로 추출됨', () => {
    const rules = parseCssRules(`
      .foo { color: red; }
      @media (max-width: 767px) { .bar { color: blue; } }
    `);
    expect(rules['.foo']).toEqual({ color: 'red' });
    /* Phase 1 정규식 한계 — nested block 인식 안 함. .bar 가 outer 로 박힘.
       실 디자이너 HTML (UBE) 은 nested @media 안 쓰므로 영향 0.
       Phase 2 에서 css-tree 도입 시 정확 처리. */
    expect(rules['.bar']).toEqual({ color: 'blue' });
  });
});

/* ── 3. computeClamp (spec §4 공식) ──────────────────────────────────── */

describe('computeClamp', () => {
  it('spec 예제 — 헤드라인 64/48 (가로형 1440~768)', () => {
    /* spec §4 (29.72) 는 slope 를 먼저 2.38 로 반올림 후 intercept 계산한 cascade 값.
       본 구현은 slope 정밀값 (2.38095...) 으로 intercept 계산 후 반올림 → 29.71.
       수학적으로 정확 (시각 차이 0.01px). */
    const out = computeClamp(64, 48, 1440, 768);
    expect(out).toBe('clamp(48px, 29.71px + 2.38cqw, 64px)');
  });

  it('spec 예제 — 모바일 헤드라인 38/28 (세로형 767~360)', () => {
    /* spec §4 (19.14) 는 cascade 반올림. 본 구현은 정밀값 → 19.15. */
    const out = computeClamp(38, 28, 767, 360);
    expect(out).toBe('clamp(28px, 19.15px + 2.46cqw, 38px)');
  });

  it('max == min 이면 고정값 px 반환', () => {
    expect(computeClamp(20, 20, 1440, 768)).toBe('20px');
  });

  it('wMax === wMin 이면 분모 0 → 에러', () => {
    expect(() => computeClamp(64, 48, 1000, 1000)).toThrow(/wMax/);
  });

  it('BP_WIDTHS 상수가 spec 와 정합', () => {
    expect(BP_WIDTHS['landscape-max']).toBe(1440);
    expect(BP_WIDTHS['landscape-min']).toBe(768);
    expect(BP_WIDTHS['portrait-max']).toBe(767);
    expect(BP_WIDTHS['portrait-min']).toBe(360);
  });
});

/* ── 4. resolveBpDeclarations (cascade resolver · S275 Phase 2) ──────── */

describe('resolveBpDeclarations', () => {
  it('base rule 만 있으면 4 BP 모두 동일 값', () => {
    const rules = parseCssRules('.foo { color: red; }');
    const bp = resolveBpDeclarations(rules, '.foo');
    expect(bp['landscape-max'].color).toBe('red');
    expect(bp['landscape-min'].color).toBe('red');
    expect(bp['portrait-max'].color).toBe('red');
    expect(bp['portrait-min'].color).toBe('red');
  });

  it('landscape-min override 만 적용된다 (다른 BP 는 base)', () => {
    const rules = parseCssRules(`
      .headline { font-size: 64px; }
      .landscape-min-wrap .headline { font-size: 38px; }
    `);
    const bp = resolveBpDeclarations(rules, '.headline');
    expect(bp['landscape-max']['font-size']).toBe('64px');
    expect(bp['landscape-min']['font-size']).toBe('38px');
    expect(bp['portrait-max']['font-size']).toBe('64px'); // base inherit
    expect(bp['portrait-min']['font-size']).toBe('64px'); // base inherit
  });

  it('descendant target selector 도 cascade 지원 (.mobile-text .headline)', () => {
    const rules = parseCssRules(`
      .portrait-max-wrap .mobile-text .headline { font-size: 64px; }
      .portrait-min-wrap .mobile-text .headline { font-size: 32px; }
    `);
    const bp = resolveBpDeclarations(rules, '.mobile-text .headline');
    expect(bp['landscape-max']['font-size']).toBeUndefined();
    expect(bp['landscape-min']['font-size']).toBeUndefined();
    expect(bp['portrait-max']['font-size']).toBe('64px');
    expect(bp['portrait-min']['font-size']).toBe('32px');
  });

  it('여러 property 가 BP 별 다르게 cascade 된다', () => {
    const rules = parseCssRules(`
      .badge { top: 48px; width: 84px; font-size: 15px; }
      .landscape-min-wrap .badge { top: 28px; width: 56px; font-size: 9px; }
    `);
    const bp = resolveBpDeclarations(rules, '.badge');
    expect(bp['landscape-max']).toEqual({ top: '48px', width: '84px', 'font-size': '15px' });
    expect(bp['landscape-min']).toEqual({ top: '28px', width: '56px', 'font-size': '9px' });
  });

  it('UBE 4 BP 양 끝점 fixture cascade (.headline + .mobile-text .headline)', () => {
    const rules = parseCssRules(`
      .headline { font-size: 64px; }
      .landscape-min-wrap .headline { font-size: 38px; }
      .portrait-max-wrap .mobile-text .headline { font-size: 64px; }
      .portrait-min-wrap .mobile-text .headline { font-size: 32px; }
    `);
    /* 가로형 base = .headline */
    const baseBp = resolveBpDeclarations(rules, '.headline');
    expect(baseBp['landscape-max']['font-size']).toBe('64px');
    expect(baseBp['landscape-min']['font-size']).toBe('38px');
    /* 세로형 override target = .mobile-text .headline (다른 entity) */
    const mobileBp = resolveBpDeclarations(rules, '.mobile-text .headline');
    expect(mobileBp['portrait-max']['font-size']).toBe('64px');
    expect(mobileBp['portrait-min']['font-size']).toBe('32px');
  });
});

/* ── 5. collectTargetSelectors ──────────────────────────────────────── */

describe('collectTargetSelectors', () => {
  it('base + wrap prefix override 의 unique target 만 추출', () => {
    const rules = parseCssRules(`
      .headline { font-size: 64px; }
      .landscape-min-wrap .headline { font-size: 38px; }
      .badge { top: 48px; }
      .portrait-max-wrap .mobile-text .headline { font-size: 64px; }
    `);
    const targets = collectTargetSelectors(rules);
    expect(targets).toContain('.headline');
    expect(targets).toContain('.badge');
    expect(targets).toContain('.mobile-text .headline');
    /* wrap prefix 가 붙은 selector 자체는 제외 */
    expect(targets).not.toContain('.landscape-min-wrap .headline');
    expect(targets).not.toContain('.portrait-max-wrap .mobile-text .headline');
  });

  it('UBE 매몰 금지 — 임의 클래스명 일반화 (디자이너 자유 영역)', () => {
    const rules = parseCssRules(`
      .custom-thing { padding: 24px; }
      .landscape-min-wrap .custom-thing { padding: 16px; }
      .arbitrary-name-X { width: 50%; }
    `);
    const targets = collectTargetSelectors(rules);
    expect(targets).toContain('.custom-thing');
    expect(targets).toContain('.arbitrary-name-X');
  });
});

/* ── 6. buildClampMap (BP 양 끝점 → clamp 식 자동 생성) ──────────────── */

describe('buildClampMap', () => {
  it('4 BP 동일 → base 에 고정값 · portrait override 없음', () => {
    const bp = {
      'landscape-max': { color: 'red' },
      'landscape-min': { color: 'red' },
      'portrait-max': { color: 'red' },
      'portrait-min': { color: 'red' },
    } as const;
    const out = buildClampMap(bp);
    expect(out.base.color).toBe('red');
    expect(out.portrait.color).toBeUndefined();
  });

  it('landscape pair 차이 → base 에 가로형 clamp (1440/768)', () => {
    const bp = {
      'landscape-max': { 'font-size': '64px' },
      'landscape-min': { 'font-size': '38px' },
      'portrait-max': { 'font-size': '38px' }, // landscape min inherit
      'portrait-min': { 'font-size': '38px' },
    } as const;
    const out = buildClampMap(bp);
    expect(out.base['font-size']).toMatch(/^clamp\(38px,/);
    expect(out.base['font-size']).toMatch(/64px\)$/);
    /* portrait pair === landscape min → override 생략 */
    expect(out.portrait['font-size']).toBeUndefined();
  });

  it('portrait pair 가 landscape min 과 다름 → @container 안 세로형 clamp', () => {
    const bp = {
      'landscape-max': { 'font-size': '64px' },
      'landscape-min': { 'font-size': '38px' },
      'portrait-max': { 'font-size': '64px' }, // landscape min 38 과 다름
      'portrait-min': { 'font-size': '32px' },
    } as const;
    const out = buildClampMap(bp);
    expect(out.base['font-size']).toMatch(/^clamp\(38px,/);
    expect(out.portrait['font-size']).toMatch(/^clamp\(32px,/);
    expect(out.portrait['font-size']).toMatch(/64px\)$/);
  });

  it('portrait only (landscape undefined) → base 없음 / portrait 만 clamp', () => {
    const bp = {
      'landscape-max': {},
      'landscape-min': {},
      'portrait-max': { 'font-size': '64px' },
      'portrait-min': { 'font-size': '32px' },
    } as const;
    const out = buildClampMap(bp);
    expect(out.base['font-size']).toBeUndefined();
    expect(out.portrait['font-size']).toMatch(/^clamp\(32px,/);
    expect(out.portrait['font-size']).toMatch(/64px\)$/);
  });

  it('% 단위도 clamp 변환 (width: 45% ~ 55%)', () => {
    const bp = {
      'landscape-max': { width: '45%' },
      'landscape-min': { width: '55%' },
      'portrait-max': { width: '55%' },
      'portrait-min': { width: '55%' },
    } as const;
    const out = buildClampMap(bp);
    /* clamp(45%, ..., 55%) — Math.min/max 로 lower/upper 결정 */
    expect(out.base.width).toMatch(/^clamp\(45%,/);
    expect(out.base.width).toMatch(/55%\)$/);
  });

  it('px 외 unit (em · rem) 은 clamp 변환 skip → max 값 채택', () => {
    const bp = {
      'landscape-max': { margin: '1em' },
      'landscape-min': { margin: '0.5em' },
      'portrait-max': { margin: '0.5em' },
      'portrait-min': { margin: '0.5em' },
    } as const;
    const out = buildClampMap(bp);
    /* em 단위는 clamp 변환 unsupported → max value fallback. */
    expect(out.base.margin).toBe('1em');
  });

  it('display: none ↔ block 같은 keyword value 도 BP override 처리', () => {
    const bp = {
      'landscape-max': { display: 'flex' },
      'landscape-min': { display: 'flex' },
      'portrait-max': { display: 'none' },
      'portrait-min': { display: 'none' },
    } as const;
    const out = buildClampMap(bp);
    expect(out.base.display).toBe('flex');
    expect(out.portrait.display).toBe('none');
  });
});

/* ── 7. buildProductionHtml (S275 Phase 2 · 통합) ─────────────────────── */

describe('buildProductionHtml', () => {
  /* 임의 디자이너 fixture — UBE 매몰 회피. 클래스명 / 콘텐츠 모두 generic. */
  const arbitraryFixture = `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Arbitrary Banner</title>
      <style>
        :root {
          --brand-color: #112233;
          --secondary: #ffeeaa;
        }
        body { background: #f5f0ea; padding: 40px; }
        .section { width: 100%; }
        .label { font-size: 13px; color: #999; }
        .banner-wrap { border-radius: 12px; box-shadow: 0 8px 40px rgba(0,0,0,.18); }

        .my-title { font-size: 64px; color: var(--brand-color); }
        .landscape-min-wrap .my-title { font-size: 38px; }

        .my-cta { padding: 16px 32px; }
        .landscape-min-wrap .my-cta { padding: 12px 24px; }
        .portrait-max-wrap .mobile-only { font-size: 24px; }
        .portrait-min-wrap .mobile-only { font-size: 16px; }
      </style>
    </head>
    <body>
      <div class="section">
        <p class="label">label</p>
        <div class="banner-wrap landscape-max-wrap" style="width:1440px; height:504px;">
          <img class="bg" src="arbitrary.png" alt="arbitrary">
          <h1 class="my-title">Arbitrary Title</h1>
          <button class="my-cta">Click</button>
        </div>
      </div>
      <div class="section">
        <div class="banner-wrap landscape-min-wrap" style="width:768px; height:269px;">
          <img class="bg" src="arbitrary.png" alt="arbitrary">
          <h2 class="my-title">Arbitrary Title</h2>
          <button class="my-cta">Click</button>
        </div>
      </div>
      <div class="section">
        <div class="banner-wrap portrait-max-wrap" style="width:767px;">
          <img class="bg" src="arbitrary_mobile.png" alt="arbitrary">
          <p class="mobile-only">Mobile</p>
        </div>
      </div>
      <div class="section">
        <div class="banner-wrap portrait-min-wrap" style="width:360px;">
          <img class="bg" src="arbitrary_mobile.png" alt="arbitrary">
          <p class="mobile-only">Mobile</p>
        </div>
      </div>
    </body></html>
  `;

  it('출력 HTML 의 핵심 구조 (단일 banner-wrap + 3 img placeholder + container-type)', () => {
    const parsed = parseResponsiveHtml(arbitraryFixture);
    const { html } = buildProductionHtml(parsed);
    /* 단일 .banner-wrap (4 wrap stacked 아님). */
    expect((html.match(/<div class="banner-wrap"/g) ?? []).length).toBe(1);
    /* container-type 명시. */
    expect(html).toMatch(/container-type:\s*inline-size/);
    /* 3 img placeholder. */
    expect(html).toMatch(/<img class="bg bg-desktop"[^>]*src="\{\{IMAGE_DESKTOP\}\}"/);
    expect(html).toMatch(/<img class="bg bg-tablet"[^>]*src="\{\{IMAGE_TABLET\}\}"/);
    expect(html).toMatch(/<img class="bg bg-mobile"[^>]*src="\{\{IMAGE_MOBILE\}\}"/);
  });

  it('placeholder 치환 키 4종 정확 (DESKTOP/TABLET/MOBILE/ALT) + LQIP inline style 부착', () => {
    const parsed = parseResponsiveHtml(arbitraryFixture);
    const { html } = buildProductionHtml(parsed);
    expect(html).toMatch(/\{\{IMAGE_DESKTOP\}\}/);
    expect(html).toMatch(/\{\{IMAGE_TABLET\}\}/);
    expect(html).toMatch(/\{\{IMAGE_MOBILE\}\}/);
    expect(html).toMatch(/\{\{IMAGE_ALT\}\}/);
    /* LQIP inline (S246) — 3 BP 모두. */
    expect(html).toMatch(/background-image:url\('\{\{IMAGE_BLUR_DESKTOP\}\}'\)/);
    expect(html).toMatch(/background-image:url\('\{\{IMAGE_BLUR_TABLET\}\}'\)/);
    expect(html).toMatch(/background-image:url\('\{\{IMAGE_BLUR_MOBILE\}\}'\)/);
  });

  it('viewport meta / script / body 데모 layout 제거', () => {
    const parsed = parseResponsiveHtml(arbitraryFixture);
    const { html } = buildProductionHtml(parsed);
    expect(html).not.toMatch(/name="viewport"/);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/body\s*\{[^}]*background:\s*#f5f0ea/);
  });

  it('body transparent + 100% size 명시', () => {
    const parsed = parseResponsiveHtml(arbitraryFixture);
    const { html } = buildProductionHtml(parsed);
    expect(html).toMatch(/body\s*\{[\s\S]*background:\s*transparent/);
    expect(html).toMatch(/html,\s*body\s*\{[^}]*width:\s*100%/);
    expect(html).toMatch(/html,\s*body\s*\{[^}]*height:\s*100%/);
  });

  it('폰트 시스템 정합 (Pretendard CDN + Inter Google Fonts + :root 토큰)', () => {
    const parsed = parseResponsiveHtml(arbitraryFixture);
    const { html } = buildProductionHtml(parsed);
    expect(html).toMatch(/pretendardvariable\.min\.css/);
    expect(html).toMatch(/fonts\.googleapis\.com.*family=Inter/);
    expect(html).toMatch(/--font-en:\s*'Inter'/);
    expect(html).toMatch(/--font-kr:\s*'Pretendard/);
  });

  it('responsive 의 :root 토큰 보존', () => {
    const parsed = parseResponsiveHtml(arbitraryFixture);
    const { html } = buildProductionHtml(parsed);
    expect(html).toMatch(/--brand-color:\s*#112233/);
    expect(html).toMatch(/--secondary:\s*#ffeeaa/);
  });

  it('cascade 변환 — landscape pair 다른 selector 는 가로형 clamp', () => {
    const parsed = parseResponsiveHtml(arbitraryFixture);
    const { html } = buildProductionHtml(parsed);
    /* .my-title font-size 64/38 → clamp(38px, ..., 64px). */
    expect(html).toMatch(/\.my-title\s*\{[\s\S]*?font-size:\s*clamp\(38px,/);
  });

  it('cascade 변환 — portrait only selector 는 @container 안 세로형 clamp', () => {
    const parsed = parseResponsiveHtml(arbitraryFixture);
    const { html } = buildProductionHtml(parsed);
    /* .mobile-only 24/16 → @container (max-width: 767px) 안 clamp(16px, ..., 24px). */
    expect(html).toMatch(/@container\s*\(max-width:\s*767px\)/);
    expect(html).toMatch(/\.mobile-only\s*\{[\s\S]*?font-size:\s*clamp\(16px,/);
  });

  it('UBE 매몰 금지 — 디자이너 임의 클래스 (.my-title · .my-cta · .mobile-only) 보존', () => {
    const parsed = parseResponsiveHtml(arbitraryFixture);
    const { html } = buildProductionHtml(parsed);
    expect(html).toMatch(/class="my-title"/);
    expect(html).toMatch(/class="my-cta"/);
    expect(html).toMatch(/class="mobile-only"/);
  });

  it('가로형 wrap children + 세로형 wrap children 합본 (img.bg 제거 · class dedupe)', () => {
    const parsed = parseResponsiveHtml(arbitraryFixture);
    const { html } = buildProductionHtml(parsed);
    /* my-title 1회만 (가로형 max 에서 가져옴 — landscape-min 의 중복 제거). */
    expect((html.match(/class="my-title"/g) ?? []).length).toBe(1);
    /* my-cta 1회만. */
    expect((html.match(/class="my-cta"/g) ?? []).length).toBe(1);
    /* mobile-only 1회만 (portrait-max 에서). */
    expect((html.match(/class="mobile-only"/g) ?? []).length).toBe(1);
    /* 원본 img.bg src 는 body 안에 없음 — 변환기 placeholder 가 대체. */
    expect(html).not.toMatch(/src="arbitrary\.png"/);
    expect(html).not.toMatch(/src="arbitrary_mobile\.png"/);
  });

  it('데모 메타 (.section · .label) 와 wrap 자체 (.banner-wrap · .landscape-max-wrap) 는 cascade output 에서 제외', () => {
    const parsed = parseResponsiveHtml(arbitraryFixture);
    const { html } = buildProductionHtml(parsed);
    /* .section / .label / .banner-wrap 데모/wrap rule 은 cascade output 에 없음 (BANNER_WRAP_CSS 표준만). */
    expect(html).not.toMatch(/^\s*\.section\s*\{/m);
    expect(html).not.toMatch(/^\s*\.label\s*\{/m);
    /* .banner-wrap 의 border-radius 등 데모 잔존 rule 차단. */
    expect(html).not.toMatch(/\.banner-wrap\s*\{[^}]*border-radius:\s*12px/);
  });

  it('warnings 가 parsed.warnings 포함', () => {
    const partialFixture = `<html><body>
      <div class="banner-wrap landscape-max-wrap"><img class="bg" src="x.png"></div>
    </body></html>`;
    const parsed = parseResponsiveHtml(partialFixture);
    const { warnings } = buildProductionHtml(parsed);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.includes('landscape-min'))).toBe(true);
  });
});

/* ── 8. sanitizeProductionHtml ───────────────────────────────────────── */

describe('sanitizeProductionHtml', () => {
  it('<script> 태그를 제거한다', () => {
    const html = '<html><body><script>alert(1)</script><p>ok</p></body></html>';
    const out = sanitizeProductionHtml(html);
    expect(out).not.toMatch(/<script/i);
    expect(out).toMatch(/<p>ok<\/p>/);
  });

  it('<meta name="viewport"> 를 제거한다', () => {
    const html = `<html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta charset="UTF-8">
    </head><body></body></html>`;
    const out = sanitizeProductionHtml(html);
    expect(out).not.toMatch(/name="viewport"/);
    expect(out).toMatch(/charset/);
  });

  it('body 의 데모 layout inline style 만 제거한다', () => {
    const html = `<html><body style="background: #f5f0ea; padding: 40px 20px; gap: 48px; color: red;"></body></html>`;
    const out = sanitizeProductionHtml(html);
    /* background / padding / gap 제거. color 등 다른 속성 보존. */
    expect(out).not.toMatch(/background:\s*#f5f0ea/);
    expect(out).not.toMatch(/padding:\s*40px/);
    expect(out).not.toMatch(/gap:/);
    expect(out).toMatch(/color:\s*red/);
  });

  it('body 의 모든 style 이 데모 잔존이면 style attribute 자체 제거', () => {
    const html = `<html><body style="background: #f5f0ea; padding: 40px 20px;"></body></html>`;
    const out = sanitizeProductionHtml(html);
    expect(out).not.toMatch(/<body[^>]*style=/);
  });

  it('script 가 없는 input 은 그대로 통과한다', () => {
    const html = '<html><body><p>clean</p></body></html>';
    const out = sanitizeProductionHtml(html);
    expect(out).toMatch(/<p>clean<\/p>/);
  });
});
