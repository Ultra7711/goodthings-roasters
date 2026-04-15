/* ══════════════════════════════════════════
   GET /api/auth/kakao
   카카오 OAuth 시작 — 카카오 인증 URL로 리다이렉트.
   Supabase GoTrue가 account_email 스코프를 강제 추가하므로
   Naver와 동일하게 커스텀 구현.
   CSRF 방어: state를 HttpOnly 쿠키에 저장하고 콜백에서 검증.
   ══════════════════════════════════════════ */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { checkRateLimit } from '@/lib/auth/rateLimit';

/** CSRF state 쿠키 이름 */
const CSRF_COOKIE = 'kakao_oauth_state';
/** 쿠키 유효 시간(초) — 인증 흐름 완료까지 충분한 10분 */
const CSRF_COOKIE_MAX_AGE = 600;

export async function GET(request: Request) {
  const limited = await checkRateLimit(request, 'auth_initiate');
  if (limited) return limited;

  const { origin } = new URL(request.url);
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.KAKAO_REST_API_KEY!,
    redirect_uri: `${origin}/api/auth/kakao/callback`,
    state,
    scope: 'profile_nickname profile_image',
  });

  const response = NextResponse.redirect(
    `https://kauth.kakao.com/oauth/authorize?${params.toString()}`,
  );

  // CSRF 방어: state를 HttpOnly 쿠키에 저장. 콜백에서 URL state와 대조 후 소비.
  response.cookies.set(CSRF_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: CSRF_COOKIE_MAX_AGE,
    path: '/',
  });

  return response;
}
