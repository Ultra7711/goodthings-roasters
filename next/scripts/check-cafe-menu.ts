/* DB 의 cafe_menu_items 현재 값 확인 — 캐시 진단용 (S245-P19) */
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

const targetIds = process.argv.slice(2);
if (targetIds.length === 0) targetIds.push('n09'); // default

async function main() {
  const { data, error } = await admin
    .from('cafe_menu_items')
    .select('id, name, vol, kcal, satfat, sugar, sodium, protein, caffeine')
    .in('id', targetIds);

  if (error || !data) {
    console.error('SELECT fail', error?.message);
    process.exit(1);
  }

  for (const r of data) {
    console.log(`━━━ ${r.id} ${r.name} ━━━`);
    console.log(`  vol      : ${r.vol}`);
    console.log(`  kcal     : ${r.kcal}`);
    console.log(`  satfat   : ${r.satfat}`);
    console.log(`  sugar    : ${r.sugar}`);
    console.log(`  sodium   : ${r.sodium}`);
    console.log(`  protein  : ${r.protein}`);
    console.log(`  caffeine : ${r.caffeine}`);
  }
}

main();
