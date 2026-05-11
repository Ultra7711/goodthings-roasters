/* ══════════════════════════════════════════════════════════════════════════
   seed-products.ts — products / product_volumes / product_images /
                       product_recipes 테이블 seed (S211 Group E Phase 1)

   목적:
     lib/products.ts 의 hardcoded PRODUCTS (6 상품) + products-blur.json
     (LQIP) 을 046 마이그 4 테이블로 이관.

   처리 흐름:
     1. service_role 클라이언트 생성 (SUPABASE_SERVICE_ROLE_KEY 필수)
     2. products 테이블 row 존재 여부 체크 → 있으면 abort (idempotent 보호)
        재실행 전 사용자가 명시적으로 truncate 필요
     3. PRODUCTS 6종 순회:
        a. products INSERT (sort_order = idx) → id 회수
        b. product_volumes INSERT (옵션 N개 + sort_order)
        c. product_images INSERT (이미지 N개 + blur 매핑)
        d. product_recipes INSERT (Coffee Bean: 4 method, Drip Bag: skip)
     4. summary 출력 (6 / 18 / 10~12 / 8 row 기대)

   실행: npx tsx scripts/seed-products.ts

   환경변수 필수:
     - NEXT_PUBLIC_SUPABASE_URL
     - SUPABASE_SERVICE_ROLE_KEY (.env.local)

   참조:
     - scripts/seed-gooddays-gallery.ts (동일 패턴)
     - supabase/migrations/046_products_schema.sql
     - next/src/lib/products.ts (PRODUCTS source)
     - next/src/lib/products-blur.json (LQIP source)
   ══════════════════════════════════════════════════════════════════════════ */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';

import { PRODUCTS, type Product } from '../src/lib/products';
import { CATEGORY_UI_TO_DB } from '../src/types/product';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NEXT_ROOT = path.join(__dirname, '..');
const BLUR_JSON = path.join(NEXT_ROOT, 'src', 'lib', 'products-blur.json');

loadEnv({ path: path.join(NEXT_ROOT, '.env.local') });

type BlurEntry = { blurDataURL: string; width: number; height: number };
type BlurMap = Record<string, BlurEntry>;

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) {
    console.error(`[seed-products] ${key} 미설정 — .env.local 확인`);
    process.exit(1);
  }
  return v;
}

async function loadBlurMap(): Promise<BlurMap> {
  const raw = await fs.readFile(BLUR_JSON, 'utf8');
  return JSON.parse(raw) as BlurMap;
}

/**
 * lib/products.ts 의 ProductImage.src ('/images/products/xxx.webp') 에서
 * filename 추출 → blur map lookup. 없으면 null 반환 (DB 컬럼 nullable).
 */
function lookupBlur(src: string, blur: BlurMap): BlurEntry | null {
  const filename = src.split('/').pop();
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
    .from('products')
    .select('id', { count: 'exact', head: true });
  if (countErr) {
    console.error('[seed-products] count 실패:', countErr.message);
    process.exit(1);
  }
  if ((count ?? 0) > 0) {
    console.error(
      `[seed-products] products 에 이미 ${count} rows 존재. ` +
        '재실행 전 다음 SQL 로 truncate 필요 (자식 cascade):\n' +
        '  truncate public.products restart identity cascade;\n' +
        'abort.',
    );
    process.exit(1);
  }

  const blur = await loadBlurMap();
  console.log(`[seed-products] processing ${PRODUCTS.length} products...`);
  console.log(`[seed-products] blur map: ${Object.keys(blur).length} entries`);

  let totalVolumes = 0;
  let totalImages = 0;
  let totalRecipes = 0;
  let imagesWithBlur = 0;
  let imagesWithoutBlur = 0;

  for (let idx = 0; idx < PRODUCTS.length; idx++) {
    const p: Product = PRODUCTS[idx];

    /* 2-a. products INSERT */
    const { data: inserted, error: pErr } = await admin
      .from('products')
      .insert({
        slug: p.slug,
        category: CATEGORY_UI_TO_DB[p.category],
        name: p.name,
        display_price: p.price,
        color: p.color,
        status: p.status,
        subscription: p.subscription,
        popup: p.popup ?? false,
        description: p.desc,
        specs: p.specs,
        note_sweet: p.note.sweet,
        note_body: p.note.body,
        note_aftertaste: p.note.aftertaste,
        note_aroma: p.note.aroma,
        note_acidity: p.note.acidity,
        note_tags: p.noteTags,
        note_tags_en: p.noteTagsEn,
        flavor_desc: p.flavorDesc,
        note_color: p.noteColor,
        roast_stage: p.roastStage,
        sort_order: idx,
        is_active: true,
      })
      .select('id, slug')
      .single();
    if (pErr || !inserted) {
      console.error(`[seed-products] products INSERT 실패 (${p.slug}):`, pErr?.message);
      process.exit(1);
    }
    const productId = inserted.id;

    /* 2-b. product_volumes INSERT */
    if (p.volumes.length > 0) {
      const { error: vErr } = await admin.from('product_volumes').insert(
        p.volumes.map((v, vi) => ({
          product_id: productId,
          label: v.label,
          price: v.price,
          sold_out: v.soldOut ?? false,
          sort_order: vi,
        })),
      );
      if (vErr) {
        console.error(`[seed-products] volumes INSERT 실패 (${p.slug}):`, vErr.message);
        process.exit(1);
      }
      totalVolumes += p.volumes.length;
    }

    /* 2-c. product_images INSERT (blur 매핑) */
    if (p.images.length > 0) {
      const imageRows = p.images.map((img, ii) => {
        const b = lookupBlur(img.src, blur);
        if (b) imagesWithBlur++;
        else imagesWithoutBlur++;
        return {
          product_id: productId,
          src: img.src,
          bg: img.bg,
          bg_theme: img.bgTheme,
          blur_data_url: b?.blurDataURL ?? null,
          width: b?.width ?? null,
          height: b?.height ?? null,
          sort_order: ii,
        };
      });
      const { error: iErr } = await admin.from('product_images').insert(imageRows);
      if (iErr) {
        console.error(`[seed-products] images INSERT 실패 (${p.slug}):`, iErr.message);
        process.exit(1);
      }
      totalImages += p.images.length;
    }

    /* 2-d. product_recipes INSERT (Drip Bag 은 빈 배열 — skip) */
    if (p.recipe.length > 0) {
      const { error: rErr } = await admin.from('product_recipes').insert(
        p.recipe.map((r, ri) => ({
          product_id: productId,
          method: r.method,
          dose: r.dose,
          temp: r.temp,
          time: r.time,
          water: r.water,
          sort_order: ri,
        })),
      );
      if (rErr) {
        console.error(`[seed-products] recipes INSERT 실패 (${p.slug}):`, rErr.message);
        process.exit(1);
      }
      totalRecipes += p.recipe.length;
    }

    process.stdout.write(`  ✓ ${p.slug} (${p.volumes.length}v / ${p.images.length}i / ${p.recipe.length}r)\n`);
  }

  console.log('');
  console.log(`[seed-products] ✅ 완료`);
  console.log(`[seed-products]    - products:        ${PRODUCTS.length}`);
  console.log(`[seed-products]    - product_volumes: ${totalVolumes}`);
  console.log(`[seed-products]    - product_images:  ${totalImages} (blur: ${imagesWithBlur}, none: ${imagesWithoutBlur})`);
  console.log(`[seed-products]    - product_recipes: ${totalRecipes}`);
  if (imagesWithoutBlur > 0) {
    console.warn(
      `[seed-products] ⚠ ${imagesWithoutBlur} 이미지 LQIP 누락 — ` +
        'npm run gen:image-blur 재실행 후 재시드 권장',
    );
  }
}

main().catch((err) => {
  console.error('[seed-products] FAILED:', err);
  process.exit(1);
});
