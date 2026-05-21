/* ══════════════════════════════════════════════════════════════════════════
   round-nutrient-display.ts — 영양 표기 값 기반 분기 reformat (S245-P16)

   배경:
   normalize-cup-volumes.ts 첫 실행이 소수 1자리로 일괄 포맷 → 일부 필드
   (kcal 230.7 · sugar 27.1g · caffeine 197.2mg) 가 어색. 식품 라벨 관례는
   큰 값은 정수, 작은 값만 소수 1자리.

   처리:
     - v >= 1 → 정수 반올림 (예: 230.7 → 231)
     - 0 < v < 1 → 소수 1자리 유지 (예: 0.4 → '0.4')
     - v == 0 → '0'

   대상: 음료 메뉴 (cat != dessert)
     - kcal (numeric)
     - satfat / sugar / sodium / protein / caffeine (text · 단위 포함)

   실행:
     npx tsx scripts/round-nutrient-display.ts            # dry-run (기본)
     npx tsx scripts/round-nutrient-display.ts --apply    # 실 UPDATE

   idempotent — 재실행 시 이미 룰 적용된 값은 변경 없음.
   ══════════════════════════════════════════════════════════════════════════ */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NEXT_ROOT = path.join(__dirname, '..');

loadEnv({ path: path.join(NEXT_ROOT, '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    '[round-nutrient-display] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필수 (.env.local)',
  );
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** 값 기반 분기 — v>=1 정수 / 0<v<1 소수 1자리 / 0 = '0'. */
function formatValue(v: number): string {
  if (!Number.isFinite(v)) return '0';
  if (v === 0) return '0';
  if (Math.abs(v) >= 1) return String(Math.round(v));
  const rounded = Math.round(v * 10) / 10;
  if (rounded === 0) return '0';
  return rounded.toFixed(1);
}

/** text 필드 ('0.4g' / '27.1g' / '197.2mg') → 값 기반 reformat + 단위 복원.
    S245-P18: defaultUnit 인자 — 단위 누락 row 정리 (예: '38' → '38mg'). */
function reformatText(
  text: string | null | undefined,
  defaultUnit: string,
): string {
  if (!text) return '';
  const raw = String(text).trim();
  if (raw === '') return '';
  const m = raw.match(/^(-?\d+(?:\.\d+)?)(.*)$/);
  if (!m) return raw;
  const value = parseFloat(m[1]);
  const unit = m[2].trim() || defaultUnit;
  return `${formatValue(value)}${unit}`;
}

/** kcal numeric reformat — round to integer if >=1, else 1 decimal. */
function reformatKcal(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  if (n === 0) return 0;
  if (Math.abs(n) >= 1) return Math.round(n);
  return Math.round(n * 10) / 10;
}

type DrinkRow = {
  id: string;
  name: string;
  cat: 'brewing' | 'tea' | 'non-coffee';
  kcal: number | string | null;
  satfat: string | null;
  sugar: string | null;
  sodium: string | null;
  protein: string | null;
  caffeine: string | null;
};

async function main() {
  console.log(`[round-nutrient-display] mode = ${APPLY ? 'APPLY' : 'dry-run'}`);

  const { data, error } = await admin
    .from('cafe_menu_items')
    .select('id, name, cat, kcal, satfat, sugar, sodium, protein, caffeine')
    .neq('cat', 'dessert')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[round-nutrient-display] SELECT 실패', error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) {
    console.log('[round-nutrient-display] 음료 메뉴 없음 — 종료');
    return;
  }

  console.log(`[round-nutrient-display] ${data.length}건 검토 시작`);
  console.log('');

  let changed = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of data as DrinkRow[]) {
    const currentKcal =
      typeof row.kcal === 'number'
        ? row.kcal
        : row.kcal !== null && row.kcal !== undefined
          ? Number(row.kcal)
          : 0;

    const newKcal = reformatKcal(row.kcal);
    const newSatfat = reformatText(row.satfat, 'g');
    const newSugar = reformatText(row.sugar, 'g');
    const newSodium = reformatText(row.sodium, 'mg');
    const newProtein = reformatText(row.protein, 'g');
    const newCaffeine = reformatText(row.caffeine, 'mg');

    const fields: Array<{ name: string; before: string; after: string }> = [];
    if (currentKcal !== newKcal) {
      fields.push({ name: 'kcal', before: String(currentKcal), after: String(newKcal) });
    }
    if ((row.satfat ?? '') !== newSatfat) {
      fields.push({ name: 'satfat', before: row.satfat ?? '', after: newSatfat });
    }
    if ((row.sugar ?? '') !== newSugar) {
      fields.push({ name: 'sugar', before: row.sugar ?? '', after: newSugar });
    }
    if ((row.sodium ?? '') !== newSodium) {
      fields.push({ name: 'sodium', before: row.sodium ?? '', after: newSodium });
    }
    if ((row.protein ?? '') !== newProtein) {
      fields.push({ name: 'protein', before: row.protein ?? '', after: newProtein });
    }
    if ((row.caffeine ?? '') !== newCaffeine) {
      fields.push({ name: 'caffeine', before: row.caffeine ?? '', after: newCaffeine });
    }

    if (fields.length === 0) {
      skipped += 1;
      continue;
    }

    console.log(`  · ${row.id} ${row.name} (cat=${row.cat})`);
    for (const f of fields) {
      console.log(`      ${f.name.padEnd(8)}: ${f.before || '—'} → ${f.after || '—'}`);
    }

    changed += 1;

    if (APPLY) {
      const { error: updErr } = await admin
        .from('cafe_menu_items')
        .update({
          kcal: newKcal,
          satfat: newSatfat,
          sugar: newSugar,
          sodium: newSodium,
          protein: newProtein,
          caffeine: newCaffeine,
        })
        .eq('id', row.id);
      if (updErr) {
        console.error(`    ✗ UPDATE 실패 — ${updErr.message}`);
        failed += 1;
        changed -= 1;
      }
    }
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`[round-nutrient-display] mode=${APPLY ? 'APPLY' : 'dry-run'}`);
  console.log(`  변경 ${APPLY ? '적용' : '예상'}: ${changed}건`);
  console.log(`  유지 (이미 일치): ${skipped}건`);
  if (APPLY) console.log(`  UPDATE 실패: ${failed}건`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (!APPLY) {
    console.log('');
    console.log('dry-run 모드 — 실제 변경 없음.');
    console.log('적용하려면: npx tsx scripts/round-nutrient-display.ts --apply');
  } else {
    console.log('');
    console.log('⚠ 사이트 캐시 무효화 필요 — 어드민에서 메뉴 1건 토글 ON/OFF');
  }

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('[round-nutrient-display] 예외 발생', err);
  process.exit(1);
});
