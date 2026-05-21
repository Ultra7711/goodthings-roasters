/* ══════════════════════════════════════════════════════════════════════════
   normalize-high-caffeine.ts — 고카페인 함유 표기 일괄 동기화 (S245-P19)

   기준: 식약처 「식품등의 표시기준」 — 1회 분량 카페인 >=150mg 표시 의무

   처리:
     - SELECT 모든 음료 (cat != dessert)
     - allergen 의 '고카페인 함유' 마커 vs caffeine 값 비교
       · caffeine >= 150mg → 마커 보장
       · caffeine <  150mg → 마커 제거
     - normalizeAllergen 으로 재정렬 후 UPDATE
     - dry-run + --apply

   실행:
     npx tsx scripts/normalize-high-caffeine.ts            # dry-run
     npx tsx scripts/normalize-high-caffeine.ts --apply
   ══════════════════════════════════════════════════════════════════════════ */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';

import { syncHighCaffeineMarker } from '../src/lib/allergenSort';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NEXT_ROOT = path.join(__dirname, '..');
loadEnv({ path: path.join(NEXT_ROOT, '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[normalize-high-caffeine] env 미설정');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log(`[normalize-high-caffeine] mode = ${APPLY ? 'APPLY' : 'dry-run'}`);

  const { data, error } = await admin
    .from('cafe_menu_items')
    .select('id, name, cat, caffeine, allergen')
    .neq('cat', 'dessert')
    .order('sort_order');

  if (error || !data) {
    console.error('SELECT fail', error?.message);
    process.exit(1);
  }

  let changed = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of data) {
    const id = row.id as string;
    const name = row.name as string;
    const current = (row.allergen ?? '') as string;
    const next = syncHighCaffeineMarker(current, row.caffeine as string);

    if (current === next) {
      skipped += 1;
      continue;
    }

    console.log(`  · ${id} ${name} (caffeine=${row.caffeine})`);
    console.log(`      before: ${current || '—'}`);
    console.log(`      after : ${next || '—'}`);

    changed += 1;
    if (APPLY) {
      const { error: updErr } = await admin
        .from('cafe_menu_items')
        .update({ allergen: next })
        .eq('id', id);
      if (updErr) {
        console.error(`    ✗ UPDATE 실패 — ${updErr.message}`);
        failed += 1;
        changed -= 1;
      }
    }
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`[normalize-high-caffeine] mode=${APPLY ? 'APPLY' : 'dry-run'}`);
  console.log(`  변경 ${APPLY ? '적용' : '예상'}: ${changed}건`);
  console.log(`  유지: ${skipped}건`);
  if (APPLY) console.log(`  실패: ${failed}건`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (!APPLY) {
    console.log('');
    console.log('적용: npx tsx scripts/normalize-high-caffeine.ts --apply');
  } else {
    console.log('');
    console.log('⚠ 캐시 무효화 — 어드민 메뉴 1건 토글 ON/OFF');
  }

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('[normalize-high-caffeine] 예외', err);
  process.exit(1);
});
