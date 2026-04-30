/* ══════════════════════════════════════════
   middleware — User Sessions B안
   역할: 로그인 유저의 마지막 활동 시간을 httpOnly 쿠키로 추적.
         7일(604800초) 이상 비활성이면 세션 만료 처리.

   흐름:
   1. supabase.auth.getUser() → 미인증이면 통과
   2. gtr_last_active 쿠키 없음 → 현재 시간 설정 후 통과
   3. gtr_last_active 7일 초과 → signOut + /login?error=session_expired redirect
   4. 정상 → gtr_last_active sliding window 갱신 후 통과

   참고: Supabase access token 만료(30분)와는 별개.
         이 미들웨어는 마지막 활동 기준 7일 비활성 세션을 강제 종료한다.
   ══════════════════════════════════════════ */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const LAST_ACTIVE_COOKIE = 'gtr_last_active';
const SESSION_TIMEOUT_SECONDS = 7 * 24 * 60 * 60; // 604800

const LAST_ACTIVE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_TIMEOUT_SECONDS,
} as const;

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Supabase 세션 토큰 갱신 시 request + response 양쪽에 반영
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // JWT 서명 검증 포함 — getSession() 금지
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return supabaseResponse;
  }

  const now = Math.floor(Date.now() / 1000);
  const lastActiveRaw = request.cookies.get(LAST_ACTIVE_COOKIE)?.value;
  const lastActive = lastActiveRaw ? parseInt(lastActiveRaw, 10) : NaN;

  // 쿠키 없거나 값 손상 → 현재 시간으로 초기화
  if (!lastActiveRaw || isNaN(lastActive)) {
    supabaseResponse.cookies.set(
      LAST_ACTIVE_COOKIE,
      String(now),
      LAST_ACTIVE_COOKIE_OPTIONS,
    );
    return supabaseResponse;
  }

  // 7일 초과 비활성 → 세션 만료
  if (now - lastActive > SESSION_TIMEOUT_SECONDS) {
    await supabase.auth.signOut();

    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('error', 'session_expired');
    const redirectResponse = NextResponse.redirect(redirectUrl);

    redirectResponse.cookies.delete(LAST_ACTIVE_COOKIE);
    // Supabase signOut이 쿠키 삭제를 처리하지만, redirect response에서 명시적으로 삭제
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.startsWith('sb-')) {
        redirectResponse.cookies.delete(cookie.name);
      }
    }
    return redirectResponse;
  }

  // 정상 활동 — sliding window 갱신
  supabaseResponse.cookies.set(
    LAST_ACTIVE_COOKIE,
    String(now),
    LAST_ACTIVE_COOKIE_OPTIONS,
  );

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * _next/static, _next/image, favicon.ico, 정적 파일 확장자 제외
     * API 라우트는 자체 인증 체크가 있으므로 제외
     */
    '/((?!api/|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
