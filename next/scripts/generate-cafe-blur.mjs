// @ts-check
/**
 * generate-cafe-blur.mjs (S205)
 *
 * 목적: public/images/cafe-menu/*.webp 일괄 LQIP 추출 → src/lib/cafe-menu-blur.json 생성.
 *       CafeNutritionSheet (+ 카드) 의 next/image placeholder=blur 데이터 소스.
 *
 * 흐름:
 *   1) public/images/cafe-menu/ 디렉토리 스캔
 *   2) 각 .webp 파일에 plaiceholder (size=10) 적용 → base64 + width + height
 *   3) src/lib/cafe-menu-blur.json 작성 (key = filename)
 *
 * 사용법:
 *   cd next && npm run gen:cafe-blur
 *
 * 출력 형태:
 *   {
 *     "cm_img_gold_orange_coffee.webp": {
 *       "blurDataURL": "data:image/webp;base64,...",
 *       "width": 1200,
 *       "height": 800
 *     },
 *     ...
 *   }
 *
 * 참고: GoodDays 어드민은 업로드 시점에 동일 처리 (admin/gooddays/actions.ts).
 *       cafe-menu 도 추후 admin 도입 시 동일 흐름으로 일관화 — carry-over.
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPlaiceholder } from 'plaiceholder';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const SRC_DIR = join(ROOT, 'public', 'images', 'cafe-menu');
const OUT_FILE = join(ROOT, 'src', 'lib', 'cafe-menu-blur.json');

async function main() {
  const files = (await readdir(SRC_DIR)).filter((f) => /\.webp$/i.test(f));
  if (files.length === 0) {
    console.error(`[gen:cafe-blur] no .webp in ${SRC_DIR}`);
    process.exit(1);
  }

  console.log(`[gen:cafe-blur] processing ${files.length} files…`);

  /** @type {Record<string, { blurDataURL: string; width: number; height: number }>} */
  const out = {};
  for (const f of files) {
    const buf = await readFile(join(SRC_DIR, f));
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

  await mkdir(dirname(OUT_FILE), { recursive: true });
  // 키 정렬 — diff 안정성
  const sorted = Object.fromEntries(
    Object.entries(out).sort(([a], [b]) => a.localeCompare(b)),
  );
  await writeFile(OUT_FILE, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  console.log(`[gen:cafe-blur] wrote ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
