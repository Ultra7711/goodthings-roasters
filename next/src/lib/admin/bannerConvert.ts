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

/* ── 6. cascade resolver (S275 Phase 2) ──────────────────────────────── */

/** BP key → declarations after cascade resolve. */
export type BpDeclarationsMap = Record<BpKey, CssDeclarations>;

/**
 * 특정 target selector 의 4 BP 별 effective declarations 계산.
 *
 * cascade convention (디자이너 responsive HTML 작성 규칙):
 *   - base rule `.X { ... }` = `landscape-max` BP 값 + 모든 BP base
 *   - `.landscape-min-wrap .X` override = `landscape-min` BP 값
 *   - `.portrait-max-wrap .X` override = `portrait-max` BP 값
 *   - `.portrait-min-wrap .X` override = `portrait-min` BP 값
 *
 * descendant selector 도 동일 규칙:
 *   - target `.mobile-text .headline` 의 base = `.mobile-text .headline` rule (있으면)
 *   - portrait-max override = `.portrait-max-wrap .mobile-text .headline`
 *
 * UBE 매몰 금지 — selector 는 임의 (`.foo` · `.parent .child` 등).
 */
export function resolveBpDeclarations(
  cssRules: CssRulesMap,
  targetSelector: string,
): BpDeclarationsMap {
  const result: BpDeclarationsMap = {
    'landscape-max': {},
    'landscape-min': {},
    'portrait-max': {},
    'portrait-min': {},
  };

  /* 1) base rule → 모든 BP 의 시작점. */
  const baseDecls = cssRules[targetSelector];
  if (baseDecls) {
    for (const bp of BP_WRAPS) {
      Object.assign(result[bp], baseDecls);
    }
  }

  /* 2) BP 별 wrap prefix override → 해당 BP 만 덮어쓰기. */
  for (const bp of BP_WRAPS) {
    const wrapKey = `.${bp}-wrap ${targetSelector}`;
    const overrideDecls = cssRules[wrapKey];
    if (overrideDecls) {
      Object.assign(result[bp], overrideDecls);
    }
  }

  return result;
}

/**
 * cssRules 에서 모든 unique target selector 추출.
 *
 * - base rule 자체 (`.X`) 가 selector 이면 target 으로 등재
 * - `.{bp}-wrap .X` wrap prefix rule 은 suffix (`.X`) 만 target 으로 등재
 * - wrap prefix selector 자체는 target 에서 제외
 */
export function collectTargetSelectors(cssRules: CssRulesMap): ReadonlyArray<string> {
  const set = new Set<string>();
  for (const selector of Object.keys(cssRules)) {
    let isWrapPrefix = false;
    for (const bp of BP_WRAPS) {
      const wrapPrefix = `.${bp}-wrap `;
      if (selector.startsWith(wrapPrefix)) {
        const suffix = selector.slice(wrapPrefix.length).trim();
        if (suffix) set.add(suffix);
        isWrapPrefix = true;
        break;
      }
    }
    if (!isWrapPrefix) set.add(selector);
  }
  return Array.from(set).sort();
}

/* ── 7. buildClampMap (BP 양 끝점 → clamp 식) ────────────────────────── */

/** target selector 의 base (가로형) + portrait (@container) declarations. */
export interface SelectorClampMap {
  /** base CSS (가로형 1440~768 구간) — `.X { ... }` 로 출력. */
  base: CssDeclarations;
  /** portrait override CSS (세로형 767~360 구간) — `@container (max-width: 767px) { .X { ... } }` 로 출력. */
  portrait: CssDeclarations;
}

/**
 * cascade resolved BP map → 가로형 base + 세로형 @container override 자동 생성.
 *
 * 규칙:
 *   - 4 BP 값 동일 → base 에 고정값 · portrait 생략
 *   - landscape pair differs → base 에 가로형 clamp (1440/768)
 *   - portrait pair differs and != landscape min → portrait override 에 세로형 clamp (767/360)
 *   - portrait pair === landscape min → portrait override 생략 (가로형 clamp 가 자연 흡수)
 *   - landscape undefined / portrait only → portrait 만 clamp
 *   - px / % 양 끝 → clamp 변환 · 그 외 unit 또는 keyword → 양 끝 동일이면 base, 다르면 portrait override
 */
export function buildClampMap(bpMap: BpDeclarationsMap): SelectorClampMap {
  const allProps = new Set<string>();
  for (const bp of BP_WRAPS) {
    for (const prop of Object.keys(bpMap[bp])) allProps.add(prop);
  }

  const base: CssDeclarations = {};
  const portrait: CssDeclarations = {};

  for (const prop of allProps) {
    const lMax = bpMap['landscape-max'][prop];
    const lMin = bpMap['landscape-min'][prop];
    const pMax = bpMap['portrait-max'][prop];
    const pMin = bpMap['portrait-min'][prop];

    /* 가로형 base 식. */
    const landscapeValue = buildLandscapeValue(lMax, lMin);
    if (landscapeValue !== undefined) {
      base[prop] = landscapeValue;
    }

    /* 세로형 portrait 식 (필요 시) — portrait pair == landscape min 이면 가로형 clamp 가 자연 흡수. */
    const portraitValue = buildPortraitValue(pMax, pMin, lMin ?? lMax);
    if (portraitValue !== undefined) {
      portrait[prop] = portraitValue;
    }
  }

  return { base, portrait };
}

function buildLandscapeValue(
  max: string | undefined,
  min: string | undefined,
): string | undefined {
  if (max === undefined && min === undefined) return undefined;
  if (max === undefined) return min;
  if (min === undefined) return max;
  if (max === min) return max;
  const clamp = tryComputeClampForValues(
    max,
    min,
    BP_WIDTHS['landscape-max'],
    BP_WIDTHS['landscape-min'],
  );
  return clamp ?? max;
}

function buildPortraitValue(
  pMax: string | undefined,
  pMin: string | undefined,
  /** 가로형 min 원본값 — portrait pair 가 이와 동일하면 가로형 clamp 가 자연 흡수. */
  landscapeMin: string | undefined,
): string | undefined {
  if (pMax === undefined && pMin === undefined) return undefined;

  /* portrait pair 양 끝 모두 가로형 min 과 동일 → 가로형 clamp 의 lower bound 와 정합 → override 불필요. */
  if (pMax !== undefined && pMin !== undefined && pMax === pMin && pMax === landscapeMin) {
    return undefined;
  }
  if (pMax === undefined) return pMin;
  if (pMin === undefined) return pMax;
  if (pMax === pMin) {
    /* 양 끝점 동일하지만 landscape min 과 다르면 portrait override 필요. */
    return pMax === landscapeMin ? undefined : pMax;
  }
  const clamp = tryComputeClampForValues(
    pMax,
    pMin,
    BP_WIDTHS['portrait-max'],
    BP_WIDTHS['portrait-min'],
  );
  return clamp ?? pMax;
}

function tryComputeClampForValues(
  max: string,
  min: string,
  wMax: number,
  wMin: number,
): string | undefined {
  /* 양쪽 모두 px. */
  const maxPx = parseNumberWithUnit(max, 'px');
  const minPx = parseNumberWithUnit(min, 'px');
  if (maxPx !== null && minPx !== null) {
    return computeClamp(maxPx, minPx, wMax, wMin);
  }
  /* 양쪽 모두 %. */
  const maxPct = parseNumberWithUnit(max, '%');
  const minPct = parseNumberWithUnit(min, '%');
  if (maxPct !== null && minPct !== null) {
    return computeClampPct(maxPct, minPct, wMax, wMin);
  }
  return undefined;
}

function parseNumberWithUnit(value: string, unit: string): number | null {
  const trimmed = value.trim();
  if (!trimmed.endsWith(unit)) return null;
  const numStr = trimmed.slice(0, -unit.length).trim();
  const n = Number(numStr);
  return Number.isFinite(n) ? n : null;
}

function computeClampPct(
  max: number,
  min: number,
  wMax: number,
  wMin: number,
): string {
  if (max === min) return `${max}%`;
  if (wMax === wMin) throw new Error('computeClampPct: wMax 와 wMin 동일 — 분모 0');
  const slope = (max - min) / ((wMax - wMin) * 0.01);
  const intercept = min - slope * (wMin * 0.01);
  const slopeStr = formatNumber(slope);
  const interceptStr = formatNumber(intercept);
  const lower = Math.min(max, min);
  const upper = Math.max(max, min);
  return `clamp(${lower}%, ${interceptStr}% + ${slopeStr}cqw, ${upper}%)`;
}

/* ── 8. buildProductionHtml (S275 Phase 2) ───────────────────────────── */

export interface BuildProductionOptions {
  /** 출력 HTML 의 <title>. 기본 = parsed.title 또는 'Banner'. */
  title?: string;
  /** :root 추가 토큰 (디자이너 responsive 의 :root 와 머지). */
  extraRootTokens?: Record<string, string>;
}

export interface BuildProductionResult {
  /** production HTML 전체 문자열. */
  html: string;
  /** 변환 중 발생한 경고 (parse warnings + 변환 한계 안내). */
  warnings: ReadonlyArray<string>;
}

const FONT_LINKS = `\
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300..900&display=swap" rel="stylesheet">`;

const CSS_RESET = `\
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    body {
      font-family: var(--font-kr);
      background: transparent;
    }`;

const BANNER_WRAP_CSS = `\
    .banner-wrap {
      container-type: inline-size;
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    .banner-wrap img.bg {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
    }
    .banner-wrap img.bg-desktop { display: block; }
    .banner-wrap img.bg-tablet,
    .banner-wrap img.bg-mobile  { display: none; }

    @container (max-width: 1023px) and (min-width: 768px) {
      .banner-wrap img.bg-desktop,
      .banner-wrap img.bg-mobile  { display: none; }
      .banner-wrap img.bg-tablet  { display: block; }
    }
    @container (max-width: 767px) {
      .banner-wrap img.bg-desktop,
      .banner-wrap img.bg-tablet  { display: none; }
      .banner-wrap img.bg-mobile  { display: block; }
    }`;

const IMG_PLACEHOLDERS = `\
  <img class="bg bg-desktop" src="{{IMAGE_DESKTOP}}" alt="{{IMAGE_ALT}}"
       style="background-image:url('{{IMAGE_BLUR_DESKTOP}}');background-size:cover;background-position:center;">
  <img class="bg bg-tablet"  src="{{IMAGE_TABLET}}"  alt="{{IMAGE_ALT}}"
       style="background-image:url('{{IMAGE_BLUR_TABLET}}');background-size:cover;background-position:center;">
  <img class="bg bg-mobile"  src="{{IMAGE_MOBILE}}"  alt="{{IMAGE_ALT}}"
       style="background-image:url('{{IMAGE_BLUR_MOBILE}}');background-size:cover;background-position:center;">`;

/**
 * 디자이너 responsive HTML → production HTML 변환.
 *
 * 변환 규칙 (docs/banner-conversion-guide.md §변환 규칙 답습):
 *   1. `<head>` reset (viewport meta 제거 · body transparent + 100% size)
 *   2. 단일 `.banner-wrap` + `container-type: inline-size`
 *   3. `<img>` × 3 (bg-desktop/tablet/mobile) + placeholder + LQIP inline
 *   4. cascade resolver → BP 별 clamp 식 자동 생성
 *   5. @container (max-width: 767px) 분기
 *   6. 콘텐츠 합본 (가로형 wrap + 세로형 wrap children · class dedupe)
 *   7. 폰트 시스템 정합 (Pretendard + Inter · --font-en / --font-kr)
 *   8. 데모 메타 라벨 / section wrapper 제거
 *   9. body bg transparent · width/height 100%
 *
 * UBE 매몰 금지 — 임의 selector / class / 콘텐츠 구조 일반화.
 */
export function buildProductionHtml(
  parsed: ParsedResponsiveHtml,
  options: BuildProductionOptions = {},
): BuildProductionResult {
  const warnings: string[] = [...parsed.warnings];

  /* 1) :root 토큰 추출 + 폰트 토큰 보장. */
  const rootTokens: Record<string, string> = {
    ...extractRootTokens(parsed.cssRules),
    ...(options.extraRootTokens ?? {}),
  };
  if (!rootTokens['--font-en']) rootTokens['--font-en'] = "'Inter', sans-serif";
  if (!rootTokens['--font-kr']) {
    rootTokens['--font-kr'] = "'Pretendard Variable', 'Pretendard', sans-serif";
  }

  /* 2) target selectors → cascade → clamp map → CSS. */
  const targets = collectTargetSelectors(parsed.cssRules).filter(
    (sel) => sel !== ':root' && !isDemoOrWrapSelector(sel),
  );
  const cascadeCss = buildCascadeCss(targets, parsed.cssRules);

  /* 3) 콘텐츠 합본 (가로형 + 세로형 wrap children · class dedupe · img.bg 제거). */
  const bodyContent = mergeBpInnerHtml(parsed.sections);

  /* 4) HTML 조합. */
  const title = options.title || parsed.title || 'Banner';
  const html = renderProductionTemplate({
    title,
    rootTokens,
    cascadeCss,
    bodyContent,
  });

  return { html, warnings };
}

/** :root selector 의 custom property 들만 추출. */
function extractRootTokens(rules: CssRulesMap): Record<string, string> {
  const root = rules[':root'];
  if (!root) return {};
  const out: Record<string, string> = {};
  for (const [prop, value] of Object.entries(root)) {
    if (prop.startsWith('--')) out[prop] = value;
  }
  return out;
}

/**
 * 변환 시 무시할 selector — 데모 전용 또는 wrap 자체.
 * - `.section`, `.label`, `body`, `html` 등 데모 stacked layout selector
 * - `.banner-wrap`, `.banner-wrap img.bg`, `.{bp}-wrap` 등 wrap 자체 (production 에서 표준 박힘)
 */
function isDemoOrWrapSelector(selector: string): boolean {
  const trimmed = selector.trim();
  const demoSelectors = new Set([
    'body',
    'html',
    'html, body',
    '*',
    '*, *::before, *::after',
    '.section',
    '.label',
    '.banner-wrap',
    '.banner-wrap img.bg',
    '.banner-wrap img.bg:first-of-type',
  ]);
  if (demoSelectors.has(trimmed)) return true;
  for (const bp of BP_WRAPS) {
    if (trimmed === `.${bp}-wrap`) return true;
    if (trimmed.startsWith(`.${bp}-wrap `)) return true; /* wrap prefix 자체는 cascade resolver 가 처리 — output 에 직접 박지 않음. */
  }
  /* `.banner-wrap` 변형 (`.banner-wrap.X-wrap`) */
  if (/^\.banner-wrap(\.|\s)/.test(trimmed)) return true;
  return false;
}

/**
 * target selectors → 가로형 base CSS + 세로형 @container override CSS 문자열.
 */
function buildCascadeCss(
  targets: ReadonlyArray<string>,
  rules: CssRulesMap,
): string {
  const baseBlocks: string[] = [];
  const portraitBlocks: string[] = [];

  for (const target of targets) {
    const bpDecls = resolveBpDeclarations(rules, target);
    const clamps = buildClampMap(bpDecls);

    const baseEntries = Object.entries(clamps.base);
    if (baseEntries.length > 0) {
      const body = baseEntries.map(([p, v]) => `      ${p}: ${v};`).join('\n');
      baseBlocks.push(`    ${target} {\n${body}\n    }`);
    }
    const portraitEntries = Object.entries(clamps.portrait);
    if (portraitEntries.length > 0) {
      const body = portraitEntries.map(([p, v]) => `        ${p}: ${v};`).join('\n');
      portraitBlocks.push(`      ${target} {\n${body}\n      }`);
    }
  }

  let css = baseBlocks.join('\n\n');
  if (portraitBlocks.length > 0) {
    css += `\n\n    @container (max-width: 767px) {\n${portraitBlocks.join('\n\n')}\n    }`;
  }
  return css;
}

/**
 * landscape-max wrap 의 children = production 본문 base.
 * portrait wrap 의 top-level child 중 가로형 base 에 없는 class signature 만 append.
 * img.bg 는 무조건 제거 (변환기 placeholder 가 대체).
 *
 * 디자이너 convention (자동 변환 정확도):
 *   - 가능한 모든 element 를 landscape-max wrap 안에 두고 CSS `display:none` + `@container` 로 토글
 *   - portrait wrap 의 element 가 가로형 wrap 의 같은 class wrapper 안에 nested 면 자동 merge 안 됨 → manual trim
 *
 * UBE 매몰 회피 — 트리 깊이 merge 안 함. 디자이너 convention + manual trim 안전망.
 */
function mergeBpInnerHtml(
  sections: Record<BpKey, BpSection | null>,
): string {
  const baseSection = sections['landscape-max'] ?? sections['landscape-min'];
  if (!baseSection || !baseSection.innerHtml.trim()) return '';

  const baseElements = extractTopLevelElements(baseSection.innerHtml).filter(
    (el) => !isImgBgElement(el),
  );
  const seen = new Set<string>();
  for (const el of baseElements) {
    const sig = elementSignature(el);
    if (sig) seen.add(sig);
  }

  /* portrait wrap 의 unique class element 추가 (가로형 base 에 없는 것만). */
  const portraitSection = sections['portrait-max'] ?? sections['portrait-min'];
  const extras: string[] = [];
  if (portraitSection?.innerHtml.trim()) {
    for (const el of extractTopLevelElements(portraitSection.innerHtml)) {
      if (isImgBgElement(el)) continue;
      const sig = elementSignature(el);
      if (!sig || seen.has(sig)) continue;
      seen.add(sig);
      extras.push(el);
    }
  }
  return [...baseElements, ...extras].map((s) => `  ${s.trim()}`).join('\n');
}

function extractTopLevelElements(html: string): ReadonlyArray<string> {
  const $ = cheerio.load(html, null, false);
  const out: string[] = [];
  $.root().children().each((_, el) => {
    out.push($.html(el));
  });
  return out;
}

function isImgBgElement(html: string): boolean {
  return /^\s*<img[^>]*\bclass=["'][^"']*\bbg\b/i.test(html);
}

/**
 * element 의 dedup signature — tag + class set + (id 없으면) text snippet.
 * 동일 class 조합의 element 는 중복 간주.
 */
function elementSignature(html: string): string {
  const tagMatch = /^\s*<(\w+)/i.exec(html);
  const tag = tagMatch ? tagMatch[1]!.toLowerCase() : '';
  const classMatch = /class=["']([^"']+)["']/i.exec(html);
  const classes = classMatch
    ? classMatch[1]!.trim().split(/\s+/).sort().join(' ')
    : '';
  if (!tag) return '';
  if (!classes) {
    /* class 없는 element 는 tag + 첫 30자 hash 로 식별 (중복 의도적 회피). */
    return `${tag}::${html.replace(/\s+/g, ' ').slice(0, 30)}`;
  }
  return `${tag}.${classes}`;
}

interface RenderArgs {
  title: string;
  rootTokens: Record<string, string>;
  cascadeCss: string;
  bodyContent: string;
}

function renderProductionTemplate(args: RenderArgs): string {
  const tokenLines = Object.entries(args.rootTokens)
    .map(([k, v]) => `      ${k}: ${v};`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(args.title)}</title>
${FONT_LINKS}
  <style>
${CSS_RESET}

    :root {
${tokenLines}
    }

${BANNER_WRAP_CSS}

${args.cascadeCss}
  </style>
</head>
<body>
<div class="banner-wrap">
${IMG_PLACEHOLDERS}
${args.bodyContent}
</div>
</body>
</html>
`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── 9. sanitizeProductionHtml ────────────────────────────────────────── */

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
