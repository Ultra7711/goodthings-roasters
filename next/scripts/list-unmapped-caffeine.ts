/* 매핑 누락 음료 list — S245-P17 2차 명세 받기용 */

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

const MAPPED_IDS = new Set([
  's01', 's02', 's03', 's04',
  'b01', 'b02', 'b03', 'b04', 'b05', 'b06',
  't01', 't02', 't03',
]);

async function main() {
  const { data, error } = await admin
    .from('cafe_menu_items')
    .select('id, name, cat, caffeine')
    .neq('cat', 'dessert')
    .order('cat', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error || !data) {
    console.error('SELECT fail', error?.message);
    process.exit(1);
  }

  const unmapped = data.filter((r) => !MAPPED_IDS.has(r.id as string));
  console.log(`총 음료: ${data.length}건 / 매핑됨: ${data.length - unmapped.length}건 / 매핑 누락: ${unmapped.length}건`);
  console.log('');
  console.log('━━━ 매핑 누락 (추가 명세 필요) ━━━');
  for (const r of unmapped) {
    console.log(`  ${r.id.padEnd(4)} ${(r.cat as string).padEnd(12)} caffeine=${r.caffeine ?? '—'}  · ${r.name}`);
  }
}

main();
