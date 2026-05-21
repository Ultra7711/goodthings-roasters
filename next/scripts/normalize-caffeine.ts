/* ══════════════════════════════════════════════════════════════════════════
   normalize-caffeine.ts — 카페인 샷/티 기준 일괄 통일 (S245-P17)

   배경:
   P15 비례 계산은 카페인에 부적절 (카페인은 컵 용량 무관 · 샷/재료 기준).
   사용자 명시 매핑으로 표준값 일괄 적용.

   매핑 (사용자 명시):
   - 1샷 75mg : s04, b01, b02, b04, b05, b06
   - 2샷 150mg: s01, s02, s03, b03
   - 표준 티 40mg: t01, t02, t03

   매핑 누락 음료 (s05~s08 시그니처 + n01~n10 논커피) 는 다음 단계
   (운영자 추가 명세 시) 본 script 의 CAFFEINE_MAP 확장 후 재실행.

   처리:
     - cafe_menu_items.caffeine = "{값}mg" 형식으로 update
     - 매핑 명시된 ID 만 처리 · 나머지는 skip (유지)
     - dry-run + --apply

   실행:
     npx tsx scripts/normalize-caffeine.ts            # dry-run
     npx tsx scripts/normalize-caffeine.ts --apply    # 실 적용
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
    '[normalize-caffeine] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필수 (.env.local)',
  );
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** ID → 카페인 mg 명시 매핑. 운영자 추가 명세 시 본 객체 확장. */
const CAFFEINE_MAP: Record<string, number> = {
  /* 1샷 75mg */
  s04: 75,
  b01: 75,
  b02: 75,
  b04: 75,
  b05: 75,
  b06: 75,
  /* 2샷 150mg */
  s01: 150,
  s02: 150,
  s03: 150,
  b03: 150,
  /* 표준 티 40mg (홍/녹/얼그레이) */
  t01: 40,
  t02: 40,
  t03: 40,
  s05: 40, // 자몽허니블랙티 — 티 베이스
  n05: 40, // 리얼아이스티 복숭아
  n08: 40, // 리얼아이스티 자두
  /* 말차 30mg */
  s06: 30, // 말차유자
  n02: 30, // 말차우유
  n03: 30, // 말차딸기우유
  /* 초콜릿/카카오 10mg */
  n04: 10, // 딥블랙(초코)우유
  /* 카페인 없음 0mg */
  s07: 0, // 스파클링 유자
  s08: 0, // 스파클링 자.망.추
  n01: 0, // 사.딸.라
  n06: 0, // 망고먹은오렌지
  n07: 0, // 밀크쉐이크
  n09: 0, // 우베밀크
  n10: 0, // 우베코코넛
};

/** ID 분류 라벨 (출력용) */
function getLabel(id: string): string {
  const v = CAFFEINE_MAP[id];
  if (v === 75) return '1샷';
  if (v === 150) return '2샷';
  if (v === 40) return '티';
  if (v === 30) return '말차';
  if (v === 10) return '초콜릿';
  if (v === 0) return '논카페인';
  return '?';
}

async function main() {
  console.log(`[normalize-caffeine] mode = ${APPLY ? 'APPLY' : 'dry-run'}`);

  const ids = Object.keys(CAFFEINE_MAP);
  console.log(`[normalize-caffeine] 매핑 ${ids.length}건 fetch`);

  const { data, error } = await admin
    .from('cafe_menu_items')
    .select('id, name, cat, caffeine')
    .in('id', ids)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[normalize-caffeine] SELECT 실패', error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) {
    console.log('[normalize-caffeine] 매핑 ID 일치 row 없음 — 종료');
    return;
  }

  console.log(`[normalize-caffeine] ${data.length}건 검토 시작`);
  console.log('');

  let changed = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of data) {
    const id = row.id as string;
    const name = row.name as string;
    const cat = row.cat as string;
    const newMg = CAFFEINE_MAP[id];
    const newCaffeine = `${newMg}mg`;
    const currentCaffeine = (row.caffeine ?? '') as string;

    if (currentCaffeine === newCaffeine) {
      skipped += 1;
      continue;
    }

    const label = getLabel(id);
    console.log(`  · ${id} ${name} (cat=${cat}, ${label})`);
    console.log(`      caffeine: ${currentCaffeine || '—'} → ${newCaffeine}`);

    changed += 1;

    if (APPLY) {
      const { error: updErr } = await admin
        .from('cafe_menu_items')
        .update({ caffeine: newCaffeine })
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
  console.log(`[normalize-caffeine] mode=${APPLY ? 'APPLY' : 'dry-run'}`);
  console.log(`  변경 ${APPLY ? '적용' : '예상'}: ${changed}건`);
  console.log(`  유지 (이미 일치): ${skipped}건`);
  if (APPLY) console.log(`  UPDATE 실패: ${failed}건`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (!APPLY) {
    console.log('');
    console.log('dry-run 모드 — 실제 변경 없음.');
    console.log('적용하려면: npx tsx scripts/normalize-caffeine.ts --apply');
  } else {
    console.log('');
    console.log('⚠ 사이트 캐시 무효화 필요 — 어드민에서 메뉴 1건 토글 ON/OFF');
  }

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('[normalize-caffeine] 예외 발생', err);
  process.exit(1);
});
