// @ts-check
/**
 * generate-image-blur.mjs (S205)
 *
 * 목적: 정적 이미지 자산 디렉토리들을 일괄 sharp+plaiceholder 처리하여
 *       각각의 LQIP JSON (filename → blurDataURL/width/height) 생성.
 *       cafe-menu + products 동시 처리.
 *
 * 출력 사용처:
 *   - cafe-menu-blur.json   ← getCafeImageMeta (CafeNutritionSheet · CafeMenuCard)
 *   - products-blur.json    ← getProductImageMeta (ShopCard · 검색결과 · LineupSection)
 *   - story-blur.json       ← StoryPage 섹션 이미지
 *   - gallery-blur.json     ← GoodDays 메인 갤러리
 *   - cafe-events-blur.json ← 카페 이벤트 seed 이미지 (S-PND-4 · 075 migration UPDATE 에 사용)
 *
 * 사용법:
 *   cd next && npm run gen:image-blur
 *
 * 참고: GoodDays 어드민은 업로드 시점에 동일 처리 (admin/gooddays/actions.ts).
 *       cafe-menu / products 도 추후 admin 도입 시 동일 흐름으로 일관화 — carry-over.
 *
 * 제외 (S-PND-4 진단):
 *   - hero/hero-poster.jpg → <video poster> HTML attribute (next/image 아님 · 42KB)
 *   - sections/img_* → CSS background-image (placeholder 적용 불가) · 일부 dead asset 정리
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPlaiceholder } from 'plaiceholder';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

/** @type {{ label: string; srcDir: string; outFile: string; ext?: RegExp }[]} */
const BUILDS = [
  {
    label: 'cafe-menu',
    srcDir: join(ROOT, 'public', 'images', 'cafe-menu'),
    outFile: join(ROOT, 'src', 'lib', 'cafe-menu-blur.json'),
  },
  {
    label: 'products',
    srcDir: join(ROOT, 'public', 'images', 'products'),
    outFile: join(ROOT, 'src', 'lib', 'products-blur.json'),
  },
  {
    label: 'story',
    srcDir: join(ROOT, 'public', 'images', 'story'),
    outFile: join(ROOT, 'src', 'lib', 'story-blur.json'),
  },
  {
    label: 'gallery-home',
    srcDir: join(ROOT, 'public', 'images', 'gallery'),
    outFile: join(ROOT, 'src', 'lib', 'gallery-blur.json'),
  },
  {
    label: 'cafe-events',
    srcDir: join(ROOT, 'public', 'images', 'cafe-events'),
    outFile: join(ROOT, 'src', 'lib', 'cafe-events-blur.json'),
    /* family-month .png + .webp 동시 보유 기간 — webp 만 처리. */
  },
];

/**
 * @param {{ label: string; srcDir: string; outFile: string; ext?: RegExp }} build
 */
async function processBuild({ label, srcDir, outFile, ext }) {
  const pattern = ext ?? /\.webp$/i;
  const files = (await readdir(srcDir)).filter((f) => pattern.test(f));
  if (files.length === 0) {
    console.error(`[gen:image-blur][${label}] no .webp in ${srcDir}`);
    return;
  }

  console.log(`[gen:image-blur][${label}] processing ${files.length} files…`);

  /** @type {Record<string, { blurDataURL: string; width: number; height: number }>} */
  const out = {};
  for (const f of files) {
    const buf = await readFile(join(srcDir, f));
    try {
      const ph = await getPlaiceholder(buf, { size: 10 });
      out[f] = {
        blurDataURL: ph.base64,
        width: ph.metadata.width,
        height: ph.metadata.height,
      };
      console.log(`  ✓ ${f}  ${ph.metadata.width}x${ph.metadata.height}`);
    } catch (err) {
      console.error(`  ✗ ${f}  ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  }

  await mkdir(dirname(outFile), { recursive: true });
  // 키 정렬 — diff 안정성
  const sorted = Object.fromEntries(
    Object.entries(out).sort(([a], [b]) => a.localeCompare(b)),
  );
  await writeFile(outFile, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  console.log(`[gen:image-blur][${label}] wrote ${outFile}`);
}

async function main() {
  for (const build of BUILDS) {
    await processBuild(build);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
