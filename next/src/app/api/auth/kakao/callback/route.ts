/* ══════════════════════════════════════════
   GET /api/auth/kakao/callback
   카카오 OAuth 콜백.
   0. CSRF state 쿠키 검증 (P0-1)
   1. code → 카카오 access_token 교환
   2. 카카오 프로필 조회 (id, nickname, email, is_email_verified)
   3. accountMerge 정책 판단 (P1-1, ADR-001 §3.2)
      - 비즈앱 미인증·이메일 미동의 시 가상 이메일 경로 (ADR §3.3)
      - 비즈앱 인증 시 검증된 이메일 기반 정책 적용
   4. hashed_token 발급 → 서버사이드 verifyOtp → 세션 쿠키 주입 → /mypage 리다이렉트 (P0-3)
   ══════════════════════════════════════════ */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import {
  resolveAccountMerge,
  buildMergeMetadata,
} from '@/lib/auth/accountMerge';
import {
  logAuthEvent,
  maskEmail,
  extractIp,
  extractUserAgent,
} from '@/lib/auth/logger';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import { sendWelcomeEmail } from '@/lib/email/notifications';

/* ── 카카오 API 응답 타입 ── */
type KakaoTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type KakaoProfileResponse = {
  id?: number;
  kakao_account?: {
    profile?: {
      nickname?: string;
    };
    email?: string;
    is_email_verified?: boolean;
  };
};

/** CSRF state 쿠키 이름 — 시작 라우트와 반드시 동일 */
const CSRF_COOKIE = 'kakao_oauth_state';

/* ── Supabase 어드민 클라이언트 (서버 전용, 세션 비유지) ── */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/**
 * 오류 리다이렉트 + state 쿠키 즉시 소비(삭제).
 * 검증 실패·처리 오류 모두 이 함수로 반환해 쿠키 누출을 방지한다.
 */
function errRedirect(origin: string, errorCode: string): NextResponse {
  const res = NextResponse.redirect(`${origin}/login?error=${errorCode}`);
  res.cookies.delete(CSRF_COOKIE);
  return res;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const urlState = searchParams.get('state');

  const limited = await checkRateLimit(request, 'auth_callback');
  if (limited) return limited;

  const ip = extractIp(request);
  const userAgent = extractUserAgent(request);

  /* ── 0. CSRF state 검증 ── */
  const cookieStore = await cookies();
  const storedState = cookieStore.get(CSRF_COOKIE)?.value;

  if (!storedState || storedState !== urlState) {
    return errRedirect(origin, 'kakao_csrf_invalid');
  }

  if (!code) {
    return errRedirect(origin, 'kakao_no_code');
  }

  /* ── 1. code → 카카오 access_token ── */
  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.KAKAO_REST_API_KEY!,
    redirect_uri: `${origin}/api/auth/kakao/callback`,
    code,
  });

  // Client Secret이 설정된 경우 포함
  if (process.env.KAKAO_CLIENT_SECRET) {
    tokenParams.set('client_secret', process.env.KAKAO_CLIENT_SECRET);
  }

  const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: tokenParams.toString(),
  });

  if (!tokenRes.ok) {
    return errRedirect(origin, 'kakao_token_request_failed');
  }

  const tokenData = (await tokenRes.json()) as KakaoTokenResponse;

  if (!tokenData.access_token) {
    return errRedirect(origin, 'kakao_token_missing');
  }

  /* ── 2. 카카오 프로필 조회 ── */
  const profileRes = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!profileRes.ok) {
    return errRedirect(origin, 'kakao_profile_failed');
  }

  const profileData = (await profileRes.json()) as KakaoProfileResponse;

  if (!profileData.id) {
    return errRedirect(origin, 'kakao_profile_missing');
  }

  /* ── 3. accountMerge 정책 판단 + Supabase 유저 확보 ── */
  // 비즈앱 인증 시 이메일 + is_email_verified 제공.
  // 미인증 또는 이메일 미동의 시 가상 이메일 (ADR-001 §3.3)
  const kakaoEmail = profileData.kakao_account?.email;
  const isEmailVerified = profileData.kakao_account?.is_email_verified === true;
  const email = kakaoEmail && isEmailVerified
    ? kakaoEmail
    : `kakao_${profileData.id}@kakao-oauth.internal`;
  const isSyntheticEmail = email.endsWith('@kakao-oauth.internal');

  const decision = await resolveAccountMerge(
    {
      email,
      emailVerified: isEmailVerified && !isSyntheticEmail,
      provider: 'kakao',
      isSynthetic: isSyntheticEmail,
    },
    supabaseAdmin,
  );

  // block — 세션 미수립 상태라 signOut 없이 단순 리다이렉트 (ADR §6.4 대칭성)
  if (decision.action === 'block') {
    logAuthEvent({
      event: 'oauth.merge_blocked',
      provider: 'kakao',
      emailMasked: maskEmail(email),
      outcome: 'blocked',
      errorCode: decision.code,
      ip,
      userAgent,
    });
    return errRedirect(origin, decision.code);
  }

  const baseMetadata = {
    full_name: profileData.kakao_account?.profile?.nickname ?? '',
    provider: 'kakao' as const,
    kakao_id: String(profileData.id),
    email_verified: isEmailVerified,
    synthetic_email: isSyntheticEmail,
  };

  if (decision.action === 'allow_new') {
    await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { ...baseMetadata, providers: ['kakao'] },
    });
    /* 신규 가입 환영 메일 (fire-and-forget — 발송 실패해도 로그인 중단 없음) */
    if (!isSyntheticEmail) {
      void sendWelcomeEmail(email, baseMetadata.full_name || undefined);
    }
  } else if (decision.action === 'allow_merge') {
    // 기존 계정의 providers 배열에 kakao 추가 + (필요 시) email_verified 승격
    const { data: existing } = await supabaseAdmin.auth.admin.getUserById(
      decision.userId,
    );
    await supabaseAdmin.auth.admin.updateUserById(decision.userId, {
      user_metadata: buildMergeMetadata(
        existing?.user?.user_metadata ?? undefined,
        decision,
      ),
    });
  }
  // allow_same — 재로그인: createUser 불필요, generateLink가 기존 계정으로 매직링크 발급

  /* ── 4. hashed_token 발급 → 서버사이드 세션 수립 (P0-3) ── */
  // action_link(implicit flow) 대신 hashed_token을 추출해 서버에서 직접 소비.
  // verifyOtp가 세션 쿠키를 응답에 주입하므로 race condition이 발생하지 않는다.
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    logAuthEvent({
      event: 'oauth.login.failed',
      provider: 'kakao',
      emailMasked: maskEmail(email),
      outcome: 'failed',
      errorCode: 'kakao_signin_failed',
      ip,
      userAgent,
    });
    return errRedirect(origin, 'kakao_signin_failed');
  }

  const supabase = await createRouteHandlerClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });

  if (verifyError) {
    logAuthEvent({
      event: 'oauth.login.failed',
      provider: 'kakao',
      emailMasked: maskEmail(email),
      outcome: 'failed',
      errorCode: 'kakao_signin_failed',
      ip,
      userAgent,
    });
    return errRedirect(origin, 'kakao_signin_failed');
  }

  logAuthEvent({
    event: 'oauth.login.success',
    provider: 'kakao',
    emailMasked: maskEmail(email),
    outcome: 'success',
    mergeAction: decision.action,
    ip,
    userAgent,
  });
  // 세션 쿠키는 verifyOtp에서 이미 발급됨 — state 쿠키 소비 후 /mypage로 직접 리다이렉트
  const res = NextResponse.redirect(`${origin}/mypage`);
  res.cookies.delete(CSRF_COOKIE);
  return res;
}
