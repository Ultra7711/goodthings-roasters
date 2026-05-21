/* 고카페인 함유 표기 일관성 진단 — 식약처 기준 1회 분량 카페인 >= 150mg (S245-P19) */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NEXT_ROOT = path.join(__dirname, '..');
loadEnv({ path: path.join(NEXT_ROOT, '.env.local') });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const HIGH_THRESHOLD = 150; // 식약처 기준 1회 분량 mg

function parseMg(text: string | null | undefined): number {
  if (!text) return 0;
  const m = String(text).match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

function hasHighMarker(allergen: string | null | undefined): boolean {
  if (!allergen) return false;
  return /고카페인\s*함유/.test(allergen);
}

async function main() {
  const { data, error } = await admin
    .from('cafe_menu_items')
    .select('id, name, cat, caffeine, allergen')
    .neq('cat', 'dessert')
    .order('cat')
    .order('sort_order');

  if (error || !data) {
    console.error('SELECT fail', error?.message);
    process.exit(1);
  }

  console.log(`총 음료: ${data.length}건 / 임계값: 카페인 >= ${HIGH_THRESHOLD}mg`);
  console.log('');
  console.log('━━━ 일관성 진단 ━━━');

  const mismatch: Array<{ id: string; name: string; caffeine: string; allergen: string; expected: boolean; actual: boolean }> = [];

  for (const r of data) {
    const id = r.id as string;
    const name = r.name as string;
    const caffeine = (r.caffeine ?? '') as string;
    const allergen = (r.allergen ?? '') as string;
    const mg = parseMg(caffeine);
    const expected = mg >= HIGH_THRESHOLD;
    const actual = hasHighMarker(allergen);

    if (expected !== actual) {
      mismatch.push({ id, name, caffeine, allergen, expected, actual });
    }
  }

  console.log(`불일치: ${mismatch.length}건 / 일치: ${data.length - mismatch.length}건`);
  console.log('');

  if (mismatch.length > 0) {
    console.log('━━━ 불일치 상세 ━━━');
    for (const m of mismatch) {
      const action = m.expected ? '추가 필요' : '제거 필요';
      console.log(`  ${m.id.padEnd(4)} ${m.name.padEnd(18)} caffeine=${m.caffeine.padEnd(6)} expected=${m.expected ? 'Y' : 'N'} actual=${m.actual ? 'Y' : 'N'}  → ${action}`);
      console.log(`         allergen: ${m.allergen || '—'}`);
    }
  }
}

main();
