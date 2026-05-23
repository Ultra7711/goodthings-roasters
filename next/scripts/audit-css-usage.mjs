// @ts-check
/**
 * CSS Class Usage Auditor — S262 Phase 0
 *
 * 목적:
 *  globals.css + 모든 *.css 에 정의된 unique class 를 추출하고
 *  src/**\/*.{tsx,jsx,ts,js,mjs} 에서 사용 여부를 매트릭스로 출력.
 *
 * 분류:
 *  - A: 정확 매칭 hit >= 1 (명확 사용)
 *  - B: 정확 매칭 0 + prefix dynamic 0 (명확 dead)
 *  - C: 정확 매칭 0 + prefix dynamic 1 이상 (의심 — 동적 prefix 매칭)
 *
 * 사용법:
 *   node scripts/audit-css-usage.mjs
 *
 * 산출물:
 *   docs/audit/css-usage-matrix.csv
 *   docs/audit/css-usage-summary.md
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, dirname, join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(PROJECT_ROOT, '..');
const SRC_DIR = resolve(PROJECT_ROOT, 'src');
const OUT_DIR = resolve(REPO_ROOT, 'docs', 'audit');

const CSS_EXT = new Set(['.css']);
const CODE_EXT = new Set(['.tsx', '.jsx', '.ts', '.js', '.mjs']);
const SKIP_DIRS = new Set(['node_modules', '.next', '.turbo', 'dist', 'build', 'coverage']);

// prefix 최소 길이 (너무 짧으면 false positive · `is-` `bi-` 는 의도적 도메인 prefix 로 허용)
const MIN_PREFIX_LEN = 2;

// 외부 라이브러리 override CSS — 라이브러리가 자동 적용 (grep 무용 · audit 제외)
const EXTERNAL_LIB_PREFIXES = ['yarl__', 'swiper-', 'react-', 'rdg-', 'recharts-', 'rt-'];

/** @param {string} cls */
function isExternalLibClass(cls) {
  return EXTERNAL_LIB_PREFIXES.some((p) => cls.startsWith(p));
}

/**
 * 디렉토리 재귀 탐색
 * @param {string} dir
 * @returns {AsyncGenerator<string>}
 */
async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      yield* walk(join(dir, e.name));
    } else if (e.isFile()) {
      yield join(dir, e.name);
    }
  }
}

/**
 * CSS 클래스 추출 — `.classname` 패턴 (escape \. 제외, pseudo 미포함)
 * @param {string} css
 */
function extractClasses(css) {
  // 주석 제거
  const noComment = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /(?<![\w\\-])\.([a-zA-Z_][\w-]*)/g;
  const set = new Set();
  let m;
  while ((m = re.exec(noComment))) {
    set.add(m[1]);
  }
  return set;
}

/**
 * class prefix 추출 — 첫 segment 까지 (`bi-consent-icon` → `bi-`)
 * 다중 prefix 도 후보 (`bi-consent-` 도 dynamic 패턴 가능)
 * @param {string} cls
 * @returns {string[]}
 */
function prefixCandidates(cls) {
  const parts = cls.split('-');
  if (parts.length < 2) return [];
  const candidates = [];
  let acc = '';
  for (let i = 0; i < parts.length - 1; i++) {
    acc += (i === 0 ? '' : '-') + parts[i];
    if (acc.length >= MIN_PREFIX_LEN) candidates.push(acc + '-');
  }
  return candidates;
}

/**
 * 정규식 메타 escape
 * @param {string} s
 */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  console.log('[CSS Audit] Scanning CSS files...');
  /** @type {Map<string, Set<string>>} */
  const classToFiles = new Map(); // class → defined-in CSS files

  for await (const file of walk(SRC_DIR)) {
    if (!CSS_EXT.has(extname(file))) continue;
    const css = await readFile(file, 'utf8');
    const classes = extractClasses(css);
    const rel = relative(PROJECT_ROOT, file).replaceAll('\\', '/');
    for (const c of classes) {
      let s = classToFiles.get(c);
      if (!s) {
        s = new Set();
        classToFiles.set(c, s);
      }
      s.add(rel);
    }
  }

  console.log(`[CSS Audit] Unique classes: ${classToFiles.size}`);

  console.log('[CSS Audit] Reading code files...');
  /** @type {Array<{ path: string; text: string }>} */
  const codeFiles = [];
  for await (const file of walk(SRC_DIR)) {
    if (!CODE_EXT.has(extname(file))) continue;
    const text = await readFile(file, 'utf8');
    codeFiles.push({
      path: relative(PROJECT_ROOT, file).replaceAll('\\', '/'),
      text,
    });
  }
  console.log(`[CSS Audit] Code files: ${codeFiles.length}`);

  console.log('[CSS Audit] Building matrix...');
  /** @type {Array<{ cls: string; cssFiles: string; exactHits: number; dynamicPrefixHits: number; category: string }>} */
  const rows = [];

  let processed = 0;
  for (const [cls, cssSet] of classToFiles) {
    processed++;
    if (processed % 100 === 0) {
      process.stdout.write(`  ${processed}/${classToFiles.size}\r`);
    }

    // 정확 매칭 — `\b<class>\b` 단어 경계
    const exactRe = new RegExp(`\\b${escapeRegex(cls)}\\b`, 'g');
    let exactHits = 0;
    for (const f of codeFiles) {
      const matches = f.text.match(exactRe);
      if (matches) exactHits += matches.length;
    }

    // 동적 prefix — template literal / concat 패턴
    // prefix 가 template literal 안 어디든 위치 가능 (시작 / 공백 후 / 다른 클래스 후)
    // 패턴: <prefix>${ 또는 <prefix>" + 또는 <prefix>' +
    const prefixes = prefixCandidates(cls);
    let dynHits = 0;
    for (const p of prefixes) {
      const dynRe = new RegExp(
        `${escapeRegex(p)}\\$\\{` // template literal: prefix${
          + `|${escapeRegex(p)}['"]\\s*[+,]` // string concat: 'prefix' + 또는 'prefix' ,
          + `|${escapeRegex(p)}["']\\s*\\)`, // function call: cn('prefix')
        'g',
      );
      for (const f of codeFiles) {
        const matches = f.text.match(dynRe);
        if (matches) dynHits += matches.length;
      }
    }

    let category;
    if (isExternalLibClass(cls)) category = 'L'; // 외부 라이브러리
    else if (exactHits > 0) category = 'A';
    else if (dynHits > 0) category = 'C';
    else category = 'B';

    rows.push({
      cls,
      cssFiles: [...cssSet].join('|'),
      exactHits,
      dynamicPrefixHits: dynHits,
      category,
    });
  }

  process.stdout.write('\n');

  // 분류 카운트
  const countA = rows.filter((r) => r.category === 'A').length;
  const countB = rows.filter((r) => r.category === 'B').length;
  const countC = rows.filter((r) => r.category === 'C').length;
  const countL = rows.filter((r) => r.category === 'L').length;
  console.log(`[CSS Audit] A=${countA} B=${countB} C=${countC} L=${countL}`);

  await mkdir(OUT_DIR, { recursive: true });

  // CSV 작성
  rows.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.cls.localeCompare(b.cls);
  });
  const csvLines = ['category,class,exact_hits,dynamic_prefix_hits,css_files'];
  for (const r of rows) {
    const safeCss = `"${r.cssFiles.replaceAll('"', '""')}"`;
    csvLines.push(`${r.category},${r.cls},${r.exactHits},${r.dynamicPrefixHits},${safeCss}`);
  }
  const csvPath = resolve(OUT_DIR, 'css-usage-matrix.csv');
  await writeFile(csvPath, csvLines.join('\n'), 'utf8');

  // Summary
  const bRows = rows.filter((r) => r.category === 'B').slice(0, 200);
  const cRows = rows.filter((r) => r.category === 'C');
  const summary = [
    '# CSS Usage Audit — S262 Phase 0',
    '',
    `- Total unique classes: **${classToFiles.size}**`,
    `- A (used): ${countA}`,
    `- B (likely dead): ${countB}`,
    `- C (suspect — dynamic prefix): ${countC}`,
    `- L (external library — audit 제외): ${countL}`,
    '',
    '## B (likely dead · first 200)',
    '',
    '| class | css_files |',
    '|---|---|',
    ...bRows.map((r) => `| \`${r.cls}\` | ${r.cssFiles.split('|').join('<br>')} |`),
    '',
    `## C (suspect · ${cRows.length})`,
    '',
    '| class | dynamic_prefix_hits | css_files |',
    '|---|---|---|',
    ...cRows.map((r) => `| \`${r.cls}\` | ${r.dynamicPrefixHits} | ${r.cssFiles.split('|').join('<br>')} |`),
  ].join('\n');
  const sumPath = resolve(OUT_DIR, 'css-usage-summary.md');
  await writeFile(sumPath, summary, 'utf8');

  console.log(`[CSS Audit] Output:`);
  console.log(`  ${relative(REPO_ROOT, csvPath)}`);
  console.log(`  ${relative(REPO_ROOT, sumPath)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
