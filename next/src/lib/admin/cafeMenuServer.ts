import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   lib/admin/cafeMenuServer.ts — /admin/menu 서버 전용 fetcher (S244)

   분리 사유 (ADR-009 답습 · DEC-16):
   - lib/cafeMenuServer.ts = B2C SSR (`use cache` + cacheTag)
   - lib/admin/cafeMenuServer.ts = admin only (createRouteHandlerClient + RLS bypass)

   역할:
   - listAdminCafeMenuLite()        — /admin/menu 목록 (AdminCafeMenuListItem[])
   - fetchAdminCafeMenuById(id)     — /admin/menu/[id]/edit raw row
   - fetchAdminNextCafeMenuId(pf)   — /admin/menu/new 자동 ID 생성

   설계 (productsServer.ts 답습):
   - createRouteHandlerClient (admin RLS = is_active=false 도 fetch)
   - cache 미사용 (어드민 항상 최신)
   - 호출 실패 시 [] / null graceful fallback

   참조:
   - lib/admin/productsServer.ts
   - 047_cafe_menu_schema.sql
   - types/cafeMenu.ts (mapAdminCafeMenuListItem · CafeMenuItemRow)
   ══════════════════════════════════════════════════════════════════════════ */

import { createRouteHandlerClient } from '@/lib/supabaseServer';
import {
  mapAdminCafeMenuListItem,
  type AdminCafeMenuListItem,
  type CafeMenuItemRow,
} from '@/types/cafeMenu';

/** ID prefix — 카테고리/시그니처 매핑 (047 seed 답습) */
export type CafeMenuIdPrefix = 's' | 'b' | 't' | 'n' | 'd';

/**
 * 어드민 목록 (is_active 무관) — sort_order asc → updated_at desc.
 * products RLS 와 동일 — admin 세션 쿠키 필수.
 */
export async function listAdminCafeMenuLite(): Promise<AdminCafeMenuListItem[]> {
  const client = await createRouteHandlerClient();
  const { data, error } = await client
    .from('cafe_menu_items')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[listAdminCafeMenuLite] query failed', {
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return [];
  }
  if (!data) return [];

  return (data as CafeMenuItemRow[]).map(mapAdminCafeMenuListItem);
}

/**
 * /admin/menu/[id]/edit 상세 편집 페이지 전용.
 * raw row 반환 — is_active=false 도 fetch (admin RLS).
 */
export async function fetchAdminCafeMenuById(
  id: string,
): Promise<CafeMenuItemRow | null> {
  const client = await createRouteHandlerClient();
  const { data, error } = await client
    .from('cafe_menu_items')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[fetchAdminCafeMenuById] query failed', {
      id,
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return null;
  }
  if (!data) return null;

  return data as CafeMenuItemRow;
}

/**
 * /admin/menu/new 자동 ID 생성.
 *
 * 규칙 (047 check constraint `^[a-z][0-9]{2,}$` 정합):
 *  - prefix 1글자 + max(번호) + 1
 *  - 번호 2자리 padStart (예: 'b04' · 'b05')
 *  - 9 이하는 'b09' / 10 이상은 'b10', 'b99', 'b100' 그대로
 *
 * prefix 매핑:
 *  - 's' = signature (status='시그니처', cat 무관)
 *  - 'b' = brewing
 *  - 't' = tea
 *  - 'n' = non-coffee
 *  - 'd' = dessert
 *
 * 첫 번호는 'x01'. id 컬럼 충돌 시 caller (create action) 에서 재시도/에러 처리.
 */
export async function fetchAdminNextCafeMenuId(
  prefix: CafeMenuIdPrefix,
): Promise<string> {
  const client = await createRouteHandlerClient();
  const { data, error } = await client
    .from('cafe_menu_items')
    .select('id')
    .like('id', `${prefix}%`);

  if (error) {
    console.error('[fetchAdminNextCafeMenuId] query failed', {
      prefix,
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return `${prefix}01`;
  }

  const nums = (data ?? [])
    .map((r) => {
      const m = (r.id as string).match(/^[a-z](\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => Number.isFinite(n));

  const next = (nums.length > 0 ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(2, '0')}`;
}
