/* ══════════════════════════════════════════════════════════════════════════
   pointRepo.ts — 적립금(포인트) 조회 Repository (Phase 2)

   역할:
   - 포인트 잔액 조회만 담당(읽기). 잔액 변동은 094 RPC(service_role)만.
   - orderService(서버 재계산·T1)가 사용 가능액 캡 계산용으로 실잔액을 조회한다.

   주의:
   - service_role 클라이언트 사용(profiles.point_balance 조회). RLS 우회.
     실제 차감은 create_order(096) 내부 use_points 의 FOR UPDATE 가 권위 —
     본 조회는 캡 계산용이며, 차감 시점 잔액 부족은 RPC 가 재검증/거부한다(T2).

   참조:
   - supabase/migrations/090_points_schema.sql (profiles.point_balance)
   - supabase/migrations/094_point_rpcs.sql (use_points · 권위 차감)
   ══════════════════════════════════════════════════════════════════════════ */

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * 회원 포인트 잔액 조회 (service_role).
 * 프로필 미존재 시 0 반환(방어적 — 정상 회원은 handle_new_user 로 항상 존재).
 *
 * @throws DB 오류 — 호출자가 catch.
 */
export async function getPointBalance(userId: string): Promise<number> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('profiles')
    .select('point_balance')
    .eq('id', userId)
    .maybeSingle<{ point_balance: number }>();

  if (error) throw error;
  return data?.point_balance ?? 0;
}
