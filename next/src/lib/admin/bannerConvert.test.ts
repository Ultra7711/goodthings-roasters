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
  computeClamp,
  parseCssRules,
  parseResponsiveHtml,
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

/* ── 4. sanitizeProductionHtml ───────────────────────────────────────── */

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
