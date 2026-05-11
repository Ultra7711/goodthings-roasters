/* ══════════════════════════════════════════════════════════════════════════
   seed-cafe-menu.ts — cafe_menu_items 테이블 seed (S213 Group F Phase 1)

   목적:
     lib/cafeMenu.ts 의 hardcoded CAFE_MENU (30종) + cafe-menu-blur.json
     (LQIP) 을 047 마이그 cafe_menu_items 테이블로 이관.

   처리 흐름:
     1. service_role 클라이언트 생성 (SUPABASE_SERVICE_ROLE_KEY 필수)
     2. cafe_menu_items row 존재 여부 체크 → 있으면 abort (idempotent 보호)
        재실행 전 사용자가 명시적으로 truncate 필요
     3. CAFE_MENU 30종 순회 → INSERT (sort_order = idx)
     4. blur_data_url / width / height → cafe-menu-blur.json lookup
     5. summary 출력

   실행: npx tsx scripts/seed-cafe-menu.ts

   환경변수 필수:
     - NEXT_PUBLIC_SUPABASE_URL
     - SUPABASE_SERVICE_ROLE_KEY (.env.local)

   참조:
     - scripts/seed-products.ts (동일 패턴)
     - supabase/migrations/047_cafe_menu_schema.sql
     - next/src/lib/cafeMenu.ts (CAFE_MENU source)
     - next/src/lib/cafe-menu-blur.json (LQIP source)
   ══════════════════════════════════════════════════════════════════════════ */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';

import { CAFE_MENU } from '../src/lib/cafeMenu';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NEXT_ROOT = path.join(__dirname, '..');
const BLUR_JSON = path.join(NEXT_ROOT, 'src', 'lib', 'cafe-menu-blur.json');

loadEnv({ path: path.join(NEXT_ROOT, '.env.local') });

type BlurEntry = { blurDataURL: string; width: number; height: number };
type BlurMap = Record<string, BlurEntry>;

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) {
    console.error(`[seed-cafe-menu] ${key} 미설정 — .env.local 확인`);
    process.exit(1);
  }
  return v;
}

async function loadBlurMap(): Promise<BlurMap> {
  const raw = await fs.readFile(BLUR_JSON, 'utf8');
  return JSON.parse(raw) as BlurMap;
}

/** img path 에서 filename 추출 → blur map lookup. 없으면 null. */
function lookupBlur(imgPath: string, blur: BlurMap): BlurEntry | null {
  const filename = imgPath.split('/').pop();
  if (!filename) return null;
  return blur[filename] ?? null;
}

async function main(): Promise<void> {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  /* 1. 기존 row 체크 — 있으면 abort */
  const { count, error: countErr } = await admin
    .from('cafe_menu_items')
    .select('id', { count: 'exact', head: true });
  if (countErr) {
    console.error('[seed-cafe-menu] count 실패:', countErr.message);
    process.exit(1);
  }
  if ((count ?? 0) > 0) {
    console.error(
      `[seed-cafe-menu] cafe_menu_items 에 이미 ${count} rows 존재.\n` +
        '재실행 전 다음 SQL 로 truncate 필요:\n' +
        '  truncate public.cafe_menu_items restart identity cascade;\n' +
        'abort.',
    );
    process.exit(1);
  }

  const blur = await loadBlurMap();
  console.log(`[seed-cafe-menu] processing ${CAFE_MENU.length} items...`);
  console.log(`[seed-cafe-menu] blur map: ${Object.keys(blur).length} entries`);

  let withBlur = 0;
  let withoutBlur = 0;

  for (let idx = 0; idx < CAFE_MENU.length; idx++) {
    const m = CAFE_MENU[idx];
    const b = lookupBlur(m.img, blur);
    if (b) withBlur++;
    else withoutBlur++;

    const { error } = await admin.from('cafe_menu_items').insert({
      id: m.id,
      name: m.name,
      cat: m.cat,
      status: m.status,
      temp: m.temp,
      badge2: m.badge2,
      price: m.price,
      description: m.desc,
      img_src: m.img,
      bg: m.bg,
      menu_desc: m.menuDesc,
      vol: m.vol,
      kcal: m.kcal,
      satfat: m.satfat,
      sugar: m.sugar,
      sodium: m.sodium,
      protein: m.protein,
      caffeine: m.caffeine,
      allergen: m.allergen,
      blur_data_url: b?.blurDataURL ?? null,
      width: b?.width ?? null,
      height: b?.height ?? null,
      sort_order: idx,
      is_active: true,
    });

    if (error) {
      console.error(`[seed-cafe-menu] INSERT 실패 (${m.id} ${m.name}):`, error.message);
      process.exit(1);
    }

    process.stdout.write(`  ✓ ${m.id} ${m.name}\n`);
  }

  console.log('');
  console.log('[seed-cafe-menu] ✅ 완료');
  console.log(`[seed-cafe-menu]    - cafe_menu_items: ${CAFE_MENU.length}`);
  console.log(`[seed-cafe-menu]    - blur: ${withBlur}, none: ${withoutBlur}`);
  if (withoutBlur > 0) {
    console.warn(
      `[seed-cafe-menu] ⚠ ${withoutBlur} 이미지 LQIP 누락 — ` +
        'npm run gen:image-blur 재실행 후 재시드 권장',
    );
  }
}

main().catch((err) => {
  console.error('[seed-cafe-menu] FAILED:', err);
  process.exit(1);
});
