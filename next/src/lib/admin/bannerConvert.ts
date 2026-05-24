/* ══════════════════════════════════════════════════════════════════════════
   bannerConvert.ts — responsive HTML → production HTML 결정론적 변환 (S274 Phase 1)

   배경:
   - 디자이너 데모 (4 BP stacked) → 어드민 운영자 facing production HTML.
   - 변환 spec = docs/banner-conversion-guide.md (503 줄 · SoT).
   - 결정론적 변환 (cheerio + 산수) — LLM 의존 0 / 외부 API 0.

   Phase 1 범위 (본 모듈):
   - parseResponsiveHtml(html) — 4 BP section 추출 + `<style>` block 의 CSS rules map
   - computeClamp(max, min, wMax, wMin) — slope + intercept 산수 → clamp 문자열
   - sanitizeProductionHtml(html) — script 태그 + viewport meta + 데모 body bg 제거

   Phase 2 carry (NEXT_SESSION):
   - buildProductionHtml — 단일 .banner-wrap + container query CSS + placeholder 조합
   - BannerEditForm UI 통합 ("Auto convert" 토글)

   참조:
   - docs/banner-conversion-guide.md §변환 규칙 (1~9 단계)
   - lib/banners.ts (BannerSchema · 변환 출력의 target)
   ══════════════════════════════════════════════════════════════════════════ */

import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';

/* ── 1. 4 BP wrap class 정의 ─────────────────────────────────────────── */

export const BP_WRAPS = [
  'landscape-max',
  'landscape-min',
  'portrait-max',
  'portrait-min',
] as const;

export type BpKey = (typeof BP_WRAPS)[number];

/** 각 BP wrap 의 기준 컨테이너 width (px). clamp 산수의 wMax / wMin 입력. */
export const BP_WIDTHS: Record<BpKey, number> = {
  'landscape-max': 1440,
  'landscape-min': 768,
  'portrait-max': 767,
  'portrait-min': 360,
};

/* ── 2. 타입 ─────────────────────────────────────────────────────────── */

/** 단일 CSS selector 의 declarations (property → value). */
export type CssDeclarations = Record<string, string>;

/** selector 문자열 → declarations map. */
export type CssRulesMap = Record<string, CssDeclarations>;

export interface BpSection {
  /** wrap element 의 inner HTML (콘텐츠 구조 보존). */
  innerHtml: string;
  /** wrap 안에서 사용된 element class names (중복 제거). */
  classes: ReadonlyArray<string>;
}

export interface ParsedResponsiveHtml {
  /** 4 BP section 각각. 없으면 null. */
  sections: Record<BpKey, BpSection | null>;
  /** 전체 `<style>` block 합본의 CSS rules. */
  cssRules: CssRulesMap;
  /** 데모 메타 — 디자이너가 사용한 `<title>`, `<meta>` 등. */
  title: string;
  /** 디자이너 데모 HTML 의 사전 검증 issue (변환 가능성 평가용). */
  warnings: ReadonlyArray<string>;
}

/* ── 3. parseResponsiveHtml ─────────────────────────────────────────── */

/**
 * 디자이너 responsive.html 을 4 BP section + CSS rules 로 분해.
 *
 * 추출 규칙:
 *   - `.landscape-max-wrap` / `.landscape-min-wrap` / `.portrait-max-wrap` / `.portrait-min-wrap`
 *     class 의 element 안 콘텐츠 = 각 BP section
 *   - `<style>` block 합본 → selector 별 declarations map
 *   - 누락 BP wrap 은 warning 으로 보고 (변환 불가 신호)
 */
export function parseResponsiveHtml(html: string): ParsedResponsiveHtml {
  const warnings: string[] = [];
  const $ = cheerio.load(html);

  /* 1) 4 BP section 추출. .{key}-wrap 패턴. */
  const sections = {} as Record<BpKey, BpSection | null>;
  for (const key of BP_WRAPS) {
    const wrap = $(`.${key}-wrap`).first();
    if (wrap.length === 0) {
      sections[key] = null;
      warnings.push(`BP wrap 누락: .${key}-wrap`);
      continue;
    }
    const classes = collectClassNames($, wrap);
    sections[key] = {
      innerHtml: wrap.html() ?? '',
      classes,
    };
  }

  /* 2) <style> block 합본 → CSS rules. */
  const styleBlocks: string[] = [];
  $('style').each((_, el) => {
    const text = $(el).text();
    if (text) styleBlocks.push(text);
  });
  const cssRules = parseCssRules(styleBlocks.join('\n'));

  /* 3) <title> 추출. */
  const title = $('title').first().text().trim();

  return {
    sections,
    cssRules,
    title,
    warnings,
  };
}

/** wrap descendant 의 모든 class names 수집 (중복 제거). */
function collectClassNames(
  $: cheerio.CheerioAPI,
  wrap: cheerio.Cheerio<AnyNode>,
): ReadonlyArray<string> {
  const set = new Set<string>();
  wrap.find('[class]').each((_, el) => {
    const cls = $(el).attr('class') ?? '';
    for (const c of cls.split(/\s+/)) {
      if (c) set.add(c);
    }
  });
  return Array.from(set).sort();
}

/* ── 4. CSS rules 파서 (정규식) ──────────────────────────────────────── */

/**
 * raw CSS 텍스트 → selector 별 declarations map.
 *
 * 한계 (Phase 1):
 *   - @media / @container nested rule 미지원 — 본 가이드는 양 끝점 stacked 모델이라
 *     `@media` 가 거의 없음. 있어도 무시.
 *   - 주석 (/ * ... * /) 제거.
 *   - 동일 selector 가 여러 번 나오면 마지막 win (cascade 단순화).
 *
 * Phase 2 에서 css-tree 또는 postcss 로 정확도 강화 가능.
 */
export function parseCssRules(css: string): CssRulesMap {
  /* 주석 제거 — /\* ... \* / 패턴, 비욕심 (non-greedy). */
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');

  /* selector { declarations } 매칭 — 비욕심 매칭으로 중첩 회피.
     selector 안에 { } 가 없다고 가정 (CSS 표준). */
  const ruleRegex = /([^{}]+)\{([^{}]*)\}/g;
  const out: CssRulesMap = {};

  for (const m of stripped.matchAll(ruleRegex)) {
    const selectorRaw = m[1]!.trim();
    const declarationsRaw = m[2]!.trim();
    if (!selectorRaw || selectorRaw.startsWith('@')) continue;

    /* 다중 selector (.a, .b) — 각각 동일 declarations 적용. */
    const selectors = selectorRaw.split(',').map((s) => s.trim()).filter(Boolean);
    const declarations = parseDeclarations(declarationsRaw);

    for (const sel of selectors) {
      out[sel] = { ...(out[sel] ?? {}), ...declarations };
    }
  }
  return out;
}

function parseDeclarations(text: string): CssDeclarations {
  const decls: CssDeclarations = {};
  for (const stmt of text.split(';')) {
    const idx = stmt.indexOf(':');
    if (idx < 0) continue;
    const prop = stmt.slice(0, idx).trim();
    const value = stmt.slice(idx + 1).trim();
    if (prop && value) decls[prop] = value;
  }
  return decls;
}

/* ── 5. computeClamp 산수 ─────────────────────────────────────────────── */

/**
 * 양 끝점 (max, min) + 컨테이너 width 범위 (wMax, wMin) → clamp 문자열.
 *
 * 공식 (docs §4):
 *   slope     = (max - min) / ((wMax - wMin) × 0.01)
 *   intercept = min - slope × (wMin × 0.01)
 *
 * 출력 예: "clamp(48px, 29.72px + 2.38cqw, 64px)"
 *
 * 가로형 구간: wMax=1440, wMin=768
 * 세로형 구간: wMax=767,  wMin=360
 */
export function computeClamp(
  max: number,
  min: number,
  wMax: number,
  wMin: number,
): string {
  if (max === min) {
    /* 양 끝점 동일 → fluid 불필요. 고정값 반환. */
    return `${max}px`;
  }
  if (wMax === wMin) {
    throw new Error('computeClamp: wMax 와 wMin 동일 — 분모 0');
  }
  const slope = (max - min) / ((wMax - wMin) * 0.01);
  const intercept = min - slope * (wMin * 0.01);
  const slopeStr = formatNumber(slope);
  const interceptStr = formatNumber(intercept);
  const lower = Math.min(max, min);
  const upper = Math.max(max, min);
  return `clamp(${lower}px, ${interceptStr}px + ${slopeStr}cqw, ${upper}px)`;
}

/** 소수 2자리 + trailing zero 제거. -0 → 0. */
function formatNumber(n: number): string {
  if (Object.is(n, -0)) return '0';
  const rounded = Math.round(n * 100) / 100;
  return String(rounded);
}

/* ── 6. sanitizeProductionHtml ────────────────────────────────────────── */

/**
 * 변환 출력 HTML 의 최종 sanitize.
 * - `<script>` 태그 제거 (sandbox 차단되지만 사전 제거 = 명시적 의도)
 * - `<meta name="viewport">` 제거 (production 불필요)
 * - body 의 데모 background / padding / gap inline style 제거
 */
export function sanitizeProductionHtml(html: string): string {
  const $ = cheerio.load(html);

  /* script 제거. */
  $('script').remove();

  /* viewport meta 제거. */
  $('meta[name="viewport"]').remove();

  /* body inline style 의 데모 잔존 속성 제거.
     디자이너 데모는 body 에 `padding: 40px 20px; gap: 48px; background: #f5f0ea`
     같은 stacked layout 잔존. production 은 body transparent + full size. */
  const body = $('body').first();
  if (body.length > 0) {
    const styleAttr = body.attr('style');
    if (styleAttr) {
      const cleaned = styleAttr
        .split(';')
        .map((s) => s.trim())
        .filter((s) => {
          if (!s) return false;
          const prop = s.split(':')[0]?.trim().toLowerCase() ?? '';
          /* 데모 layout 잔존 속성만 제거. 다른 inline style 은 보존. */
          return ![
            'background',
            'background-color',
            'padding',
            'padding-top',
            'padding-right',
            'padding-bottom',
            'padding-left',
            'gap',
            'display',
            'flex-direction',
            'align-items',
            'justify-content',
          ].includes(prop);
        })
        .join('; ');
      if (cleaned) {
        body.attr('style', cleaned);
      } else {
        body.removeAttr('style');
      }
    }
  }

  return $.html();
}
