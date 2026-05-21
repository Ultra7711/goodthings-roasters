/* ══════════════════════════════════════════════════════════════════════════
   normalize-cup-volumes.ts — 음료 메뉴 컵 용량 통일 + 영양성분 비례 재계산 (S245-P15)

   배경:
   현재 음료 메뉴 vol 들쑥날쑥. 실제 컵 5종 운영 기준으로 통일 + 영양성분
   비례 재계산.

   컵 운영 (사용자 명시):
   - 컵 A 350ml: 유리컵 (입구 넓고 짧은) — s01, b03, b06
   - 컵 B 380ml: 유리컵 (중간 사이즈 · 메인) — 디저트 제외 나머지 음료 (디폴트)
   - 컵 C 400ml: 유리컵 (입구 좁고 길쭉한) — s07, s08, b05
   - 컵 D 350ml: 도기 세라믹 (따뜻한 음료 · 색상 2종 동일 용량) — s02, s03, t01, t02, t03

   처리 흐름:
     1) service_role 클라이언트
     2) SELECT 모든 음료 (cat != 'dessert')
     3) 각 row 의 컵 매핑 lookup → newVolMl
     4) parseVol(currentVol) → currentVolMl
     5) k = newVolMl / currentVolMl
     6) kcal/satfat/sugar/sodium/protein/caffeine 모두 × k (text 필드는 숫자 파싱 후
        스케일 + 단위 복원)
     7) vol = "{newVolMl}ml" 갱신
     8) dry-run (기본): diff 출력만 / --apply: UPDATE 실행

   실행:
     npx tsx scripts/normalize-cup-volumes.ts            # dry-run (기본)
     npx tsx scripts/normalize-cup-volumes.ts --apply    # 실 UPDATE

   환경변수 필수:
     - NEXT_PUBLIC_SUPABASE_URL
     - SUPABASE_SERVICE_ROLE_KEY (.env.local)

   주의:
     - 비례 계산은 "제조 공정 (원두 양/시럽 양) 가 컵 용량에 비례" 전제일 때만 정확.
       실제로 음료 농도가 컵 사이즈 무관일 수도 있음 → 결과 검토 후 운영자 추가
       조정 가능.
     - 재실행 시 currentVol 이 이미 newVol 이면 k=1 → 변경 없음 (idempotent).
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
    '[normalize-cup-volumes] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필수 (.env.local)',
  );
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** ID → 컵 용량 (ml) 명시 매핑. 명시 안 된 음료는 DEFAULT_VOLUME_ML (컵 B). */
const CUP_VOLUMES: Record<string, number> = {
  /* 컵 A 350ml — 유리컵 (입구 넓고 짧은) */
  s01: 350,
  b03: 350,
  b06: 350,
  /* 컵 C 400ml — 유리컵 (입구 좁고 길쭉한) */
  s07: 400,
  s08: 400,
  b05: 400,
  /* 컵 D 350ml — 도기 세라믹 (따뜻한 음료) */
  s02: 350,
  s03: 350,
  t01: 350,
  t02: 350,
  t03: 350,
};

const DEFAULT_VOLUME_ML = 380; // 컵 B (디저트 제외 나머지 음료)

/** vol text ("350ml" / "230 ml" 등) → ml 정수. 파싱 실패 시 0. */
function parseVolMl(text: string | null | undefined): number {
  if (!text) return 0;
  const m = String(text).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

/** 영양 text 필드 ("0.1g" / "10mg" / "0g" 등) 비례 스케일.
    숫자 부분 × k → 1자리 반올림 (정수면 '.0' 제거) + 단위 복원. */
function scaleNutrientText(text: string | null | undefined, k: number): string {
  if (!text) return '';
  const raw = String(text).trim();
  if (raw === '') return '';
  /* 앞쪽 숫자 + 나머지 (단위 + 공백 포함) */
  const m = raw.match(/^(-?\d+(?:\.\d+)?)(.*)$/);
  if (!m) return raw; // 숫자 없음 — 그대로
  const value = parseFloat(m[1]);
  const unit = m[2];
  const scaled = value * k;
  return `${formatScaled(scaled)}${unit}`;
}

/** 값 기반 분기 (S245-P16):
 *   - v >= 1 → 정수 반올림 (kcal/sodium/caffeine/sugar 등 큰 값 라벨 관례)
 *   - 0 < v < 1 → 소수 1자리 (satfat/protein 같은 작은 값 정보 보존)
 *   - v == 0 → '0'
 */
function formatScaled(v: number): string {
  if (!Number.isFinite(v)) return '0';
  if (v === 0) return '0';
  if (Math.abs(v) >= 1) return String(Math.round(v));
  const rounded = Math.round(v * 10) / 10;
  if (rounded === 0) return '0';
  return rounded.toFixed(1);
}

type DrinkRow = {
  id: string;
  name: string;
  cat: 'brewing' | 'tea' | 'non-coffee';
  vol: string | null;
  kcal: number | string | null;
  satfat: string | null;
  sugar: string | null;
  sodium: string | null;
  protein: string | null;
  caffeine: string | null;
};

async function main() {
  console.log(`[normalize-cup-volumes] mode = ${APPLY ? 'APPLY' : 'dry-run'}`);
  console.log('[normalize-cup-volumes] fetch 음료 메뉴 (cat != dessert)');

  const { data, error } = await admin
    .from('cafe_menu_items')
    .select('id, name, cat, vol, kcal, satfat, sugar, sodium, protein, caffeine')
    .neq('cat', 'dessert')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[normalize-cup-volumes] SELECT 실패', error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) {
    console.log('[normalize-cup-volumes] 음료 메뉴 없음 — 종료');
    return;
  }

  console.log(`[normalize-cup-volumes] ${data.length}건 검토 시작`);
  console.log('');

  let changed = 0;
  let volOnly = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of data as DrinkRow[]) {
    const id = row.id;
    const name = row.name;
    const currentVolText = row.vol ?? '';
    const currentVolMl = parseVolMl(currentVolText);
    const newVolMl = CUP_VOLUMES[id] ?? DEFAULT_VOLUME_ML;
    const cupLabel = CUP_VOLUMES[id]
      ? ['s01', 'b03', 'b06'].includes(id)
        ? 'A'
        : ['s07', 's08', 'b05'].includes(id)
          ? 'C'
          : 'D'
      : 'B';

    if (currentVolMl === 0) {
      /* currentVol 빈 값/파싱 실패 — 비례 계산 불가. vol-only set + 영양 보존
         (운영자가 별도로 어드민에서 영양정보 입력 예정). */
      const newVol = `${newVolMl}ml`;
      console.log(
        `  · ${id} ${name} (cat=${row.cat}, 컵 ${cupLabel}) — vol-only`,
      );
      console.log(
        `      vol: '${currentVolText}' → ${newVol}  (영양 보존 — 운영자 별도 입력)`,
      );
      volOnly += 1;
      if (APPLY) {
        const { error: updErr } = await admin
          .from('cafe_menu_items')
          .update({ vol: newVol })
          .eq('id', id);
        if (updErr) {
          console.error(`    ✗ UPDATE 실패 — ${updErr.message}`);
          failed += 1;
          volOnly -= 1;
        }
      }
      continue;
    }

    if (currentVolMl === newVolMl) {
      skipped += 1;
      continue;
    }

    const k = newVolMl / currentVolMl;
    const newVol = `${newVolMl}ml`;
    const newKcal =
      typeof row.kcal === 'number'
        ? Math.round(row.kcal * k * 10) / 10
        : row.kcal !== null && row.kcal !== undefined
          ? Math.round(Number(row.kcal) * k * 10) / 10
          : 0;
    const newSatfat = scaleNutrientText(row.satfat, k);
    const newSugar = scaleNutrientText(row.sugar, k);
    const newSodium = scaleNutrientText(row.sodium, k);
    const newProtein = scaleNutrientText(row.protein, k);
    const newCaffeine = scaleNutrientText(row.caffeine, k);

    console.log(`  · ${id} ${name} (cat=${row.cat}, 컵 ${cupLabel})`);
    console.log(`      vol     : ${currentVolText} → ${newVol}   k=${k.toFixed(3)}`);
    console.log(`      kcal    : ${row.kcal ?? '—'} → ${newKcal}`);
    console.log(`      satfat  : ${row.satfat ?? '—'} → ${newSatfat || '—'}`);
    console.log(`      sugar   : ${row.sugar ?? '—'} → ${newSugar || '—'}`);
    console.log(`      sodium  : ${row.sodium ?? '—'} → ${newSodium || '—'}`);
    console.log(`      protein : ${row.protein ?? '—'} → ${newProtein || '—'}`);
    console.log(`      caffeine: ${row.caffeine ?? '—'} → ${newCaffeine || '—'}`);

    changed += 1;

    if (APPLY) {
      const { error: updErr } = await admin
        .from('cafe_menu_items')
        .update({
          vol: newVol,
          kcal: newKcal,
          satfat: newSatfat,
          sugar: newSugar,
          sodium: newSodium,
          protein: newProtein,
          caffeine: newCaffeine,
        })
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
  console.log(`[normalize-cup-volumes] mode=${APPLY ? 'APPLY' : 'dry-run'}`);
  console.log(`  변경 ${APPLY ? '적용' : '예상'} (vol + 영양 비례): ${changed}건`);
  console.log(`  vol-only ${APPLY ? '적용' : '예상'} (영양 보존): ${volOnly}건`);
  console.log(`  유지 (이미 일치): ${skipped}건`);
  if (APPLY) console.log(`  UPDATE 실패: ${failed}건`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (!APPLY) {
    console.log('');
    console.log('dry-run 모드 — 실제 변경 없음.');
    console.log('적용하려면: npx tsx scripts/normalize-cup-volumes.ts --apply');
  } else {
    console.log('');
    console.log('⚠ 사이트 캐시 무효화 필요 — 어드민에서 메뉴 1건 토글 ON/OFF');
    console.log('   또는 dev 서버 .next 재시작 → /menu 페이지에서 확인');
  }

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('[normalize-cup-volumes] 예외 발생', err);
  process.exit(1);
});
