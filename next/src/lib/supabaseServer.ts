/* ══════════════════════════════════════════
   supabaseServer — Route Handler / Server Component용 SSR 클라이언트 팩토리

   역할:
   - @supabase/ssr createServerClient + cookies() 연동
   - 세션 쿠키 읽기/쓰기가 가능한 서버 전용 anon 클라이언트 반환

   사용처:
   - /api/auth/naver/callback  (P0-3 verifyOtp)
   - /api/auth/kakao/callback  (P0-3 verifyOtp)
   - /auth/callback            (exchangeCodeForSession — 현재 인라인, 필요 시 이관)

   주의:
   - 서비스 롤 권한이 필요한 경우 supabaseAdmin (supabase-js createClient) 을 사용한다.
   - 이 클라이언트는 anon key 기반이며 RLS 적용 대상이다.
   ══════════════════════════════════════════ */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Route Handler 및 Server Component에서 모두 사용 가능한 Supabase SSR 클라이언트.
 *
 * 사용처:
 * - Route Handler: verifyOtp / exchangeCodeForSession 세션 쿠키 발급
 * - Server Component: auth.getUser() JWT 서명 검증 (보안 경계, getSession() 금지)
 */
export async function createRouteHandlerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );
}
