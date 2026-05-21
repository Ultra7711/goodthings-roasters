/* ══════════════════════════════════════════════════════════════════════════
   normalize-allergens.ts — cafe_menu_items.allergen 일괄 정규화 (S245)

   목적:
     기존 35종 seed 의 allergen 컬럼을 식약처 [별표 4] 19종 순서로 정렬 +
     별칭 정규화 (계란→알류 등). 신규 등록은 actions.ts toCafeMenuDbRow 가
     자동 처리하므로 본 스크립트는 1회성 백필 용도.

   처리 흐름:
     1) service_role 클라이언트 생성
     2) SELECT id, name, allergen FROM cafe_menu_items
     3) 각 row 의 normalizeAllergen() 결과와 현재 값 비교
     4) 변경된 row 만 UPDATE (idempotent — 재실행 안전)
     5) 결과 보고 (변경 N건 / skip N건 / 실패 N건)

   실행:
     npx tsx scripts/normalize-allergens.ts

   환경변수 필수:
     - NEXT_PUBLIC_SUPABASE_URL
     - SUPABASE_SERVICE_ROLE_KEY (.env.local)

   참조:
     - lib/allergenSort.ts (normalizeAllergen 본체 · 18 test)
     - app/admin/(authed)/menu/actions.ts (자동 적용)
   ══════════════════════════════════════════════════════════════════════════ */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';

import { normalizeAllergen } from '../src/lib/allergenSort';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NEXT_ROOT = path.join(__dirname, '..');

loadEnv({ path: path.join(NEXT_ROOT, '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    '[normalize-allergens] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필수 (.env.local)',
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log('[normalize-allergens] 시작 — cafe_menu_items 전체 fetch');

  const { data, error } = await admin
    .from('cafe_menu_items')
    .select('id, name, allergen')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[normalize-allergens] SELECT 실패', error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) {
    console.log('[normalize-allergens] cafe_menu_items 비어있음 — 종료');
    return;
  }

  console.log(`[normalize-allergens] ${data.length}건 검토 시작`);

  let changed = 0;
  let skipped = 0;
  let failed = 0;
  const diff: Array<{ id: string; name: string; before: string; after: string }> = [];

  for (const row of data) {
    const id = row.id as string;
    const name = row.name as string;
    const before = (row.allergen ?? '') as string;
    const after = normalizeAllergen(before);

    if (before === after) {
      skipped += 1;
      continue;
    }

    const { error: updErr } = await admin
      .from('cafe_menu_items')
      .update({ allergen: after })
      .eq('id', id);

    if (updErr) {
      console.error(
        `[normalize-allergens] UPDATE 실패 — ${id} (${name})`,
        updErr.message,
      );
      failed += 1;
      continue;
    }

    diff.push({ id, name, before, after });
    changed += 1;
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`[normalize-allergens] 결과`);
  console.log(`  변경: ${changed}건`);
  console.log(`  유지: ${skipped}건`);
  console.log(`  실패: ${failed}건`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (diff.length > 0) {
    console.log('');
    console.log('[변경 내역]');
    for (const d of diff) {
      console.log(`  · ${d.id} ${d.name}`);
      console.log(`      before: ${d.before || '(빈값)'}`);
      console.log(`      after : ${d.after || '(빈값)'}`);
    }
  }

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[normalize-allergens] 예외 발생', err);
  process.exit(1);
});
