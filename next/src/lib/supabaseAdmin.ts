/* ══════════════════════════════════════════════════════════════════════════
   supabaseAdmin.ts — service_role 전용 Supabase 클라이언트 (P2-A)

   역할:
   - RLS 를 우회해야 하는 특권 작업(주문 원자 INSERT, 게스트 주문조회 등) 에서 사용.
   - 세션 저장 없음(persistSession=false) + 토큰 자동 갱신 없음.

   사용 제한:
   - Route Handler 전용. 클라이언트 번들에 절대 포함되면 안 된다.
     (Next 가 `SUPABASE_SERVICE_ROLE_KEY` 를 NEXT_PUBLIC_ 접두 없이 사용하므로
      번들러가 자동 tree-shake 하지만, 모듈 경로는 서버 측에서만 import.)
   - 사용자 입력 검증은 이 클라이언트를 호출하기 *전에* 완료해야 한다.

   참조:
   - docs/backend-architecture-plan.md §5.4 비밀 관리
   - supabase/migrations/007_rls_policies.sql (service_role 우회 원칙)
   ══════════════════════════════════════════════════════════════════════════ */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/* 런타임 가드 — 클라이언트 번들에서 실행되면 즉시 에러.
   (본 파일은 Route Handler · Server Action 에서만 import 해야 한다.) */
if (typeof window !== 'undefined') {
  throw new Error('supabaseAdmin 은 서버 전용 모듈입니다.');
}

let _admin: SupabaseClient | null = null;

/**
 * service_role Supabase 클라이언트(singleton).
 *
 * 환경변수:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY (서버 전용)
 *
 * @throws 환경변수 누락 시 Error
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'supabaseAdmin: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 미설정',
    );
  }

  _admin = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return _admin;
}
