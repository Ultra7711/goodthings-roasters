/* ══════════════════════════════════════════
   GET /api/auth/naver
   네이버 OAuth 시작 — 네이버 인증 URL로 리다이렉트.
   Supabase가 네이버를 기본 지원하지 않으므로 커스텀 구현.
   CSRF 방어: state를 HttpOnly 쿠키에 저장하고 콜백에서 검증.
   ══════════════════════════════════════════ */

import { NextResponse } from 'next/server';
import crypto from 'crypto';

/** CSRF state 쿠키 이름 */
const CSRF_COOKIE = 'naver_oauth_state';
/** 쿠키 유효 시간(초) — 인증 흐름 완료까지 충분한 10분 */
const CSRF_COOKIE_MAX_AGE = 600;

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.NAVER_CLIENT_ID!,
    redirect_uri: `${origin}/api/auth/naver/callback`,
    state,
  });

  const response = NextResponse.redirect(
    `https://nid.naver.com/oauth2.0/authorize?${params.toString()}`,
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
