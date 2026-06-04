/* ══════════════════════════════════════════════════════════════════════════
   cafe-menu-seed.ts — E2E 임시 cafe_menu_items 생성/정리 helper (S250-5)

   - service_role 로 직접 INSERT (admin Server Action 우회)
   - is_active=false 로 박음 → /menu 노출 X, admin 페이지만 노출
     (cafe_menu_items 의 is_active default 는 true 이지만, 토글 테스트를 위해
      명시적으로 false 로 시작)
   - id 는 047 check `^[a-z][0-9]{2,}$` 통과하는 'b990' (brewing prefix)
   - cleanup: row hard delete (menu_likes FK 는 ON DELETE 정책 따름)

   product-seed.ts 패턴 답습.
   ══════════════════════════════════════════════════════════════════════════ */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

export const E2E_CAFE_MENU_ID = 'b990';
export const E2E_CAFE_MENU_NAME = '[E2E] 테스트 카페 메뉴';

export interface SeedCafeMenu {
  id: string;
}

function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      'cafe-menu-seed: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 누락',
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * E2E 전용 임시 cafe 메뉴 1개 생성 (이미 존재하면 is_active=false 재보장 후 재사용).
 * 047 cafe_menu_items 스키마의 NOT NULL(default 없는) 컬럼 = id·name·cat·price·img_src·bg.
 * 나머지는 default 보유하나 toCafeMenuDbRow 정합 위해 명시.
 */
export async function seedTestCafeMenu(): Promise<SeedCafeMenu> {
  const admin = adminClient();

  const { data: existing, error: selErr } = await admin
    .from('cafe_menu_items')
    .select('id')
    .eq('id', E2E_CAFE_MENU_ID)
    .maybeSingle();
  if (selErr) throw new Error(`seedTestCafeMenu select 실패: ${selErr.message}`);

  if (existing) {
    /* 이전 실행이 활성 토글 후 cleanup 실패 시 격리 보호 */
    await admin
      .from('cafe_menu_items')
      .update({ is_active: false })
      .eq('id', E2E_CAFE_MENU_ID);
    return { id: E2E_CAFE_MENU_ID };
  }

  const { error: insErr } = await admin.from('cafe_menu_items').insert({
    id: E2E_CAFE_MENU_ID,
    name: E2E_CAFE_MENU_NAME,
    cat: 'brewing',
    status: '',
    temp: null,
    badge2: '',
    price: 5_000,
    bg: '#cccccc',
    description: '',
    menu_desc: '',
    vol: '',
    kcal: 0,
    satfat: '',
    sugar: '',
    sodium: '',
    protein: '',
    caffeine: '',
    allergen: '',
    img_src: '',
    sort_order: 9_990,
    is_active: false,
  });
  if (insErr) {
    throw new Error(`seedTestCafeMenu insert 실패: ${insErr.message}`);
  }

  return { id: E2E_CAFE_MENU_ID };
}

/** seed 한 cafe 메뉴 hard delete. teardown 단계 — 실패해도 throw 안 함. */
export async function cleanupTestCafeMenu(seed: SeedCafeMenu): Promise<void> {
  const admin = adminClient();
  const { error } = await admin
    .from('cafe_menu_items')
    .delete()
    .eq('id', seed.id);
  if (error) {
    console.warn(
      `[cafe-menu-seed] delete 실패 (id=${seed.id}): ${error.message}`,
    );
  }
}
