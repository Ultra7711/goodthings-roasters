/* ══════════════════════════════════════════
   GET /api/auth/naver/callback
   네이버 OAuth 콜백.
   0. CSRF state 쿠키 검증 (P0-1)
   1. code → 네이버 access_token 교환
   2. 네이버 프로필 조회 (id, email, name)
   3. accountMerge 정책 판단 (P1-1, ADR-001 §3.2)
      - block: 즉시 errRedirect (세션 미수립 — signOut 불필요, ADR §6.4)
      - allow_new: createUser
      - allow_same: skip
      - allow_merge: updateUserById로 metadata 병합
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

/* ── 네이버 API 응답 타입 ── */
type NaverTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type NaverProfileResponse = {
  resultcode: string;
  message: string;
  response?: {
    id: string;
    email?: string;
    name?: string;
  };
};

/** CSRF state 쿠키 이름 — 시작 라우트와 반드시 동일 */
const CSRF_COOKIE = 'naver_oauth_state';

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
    return errRedirect(origin, 'naver_csrf_invalid');
  }

  if (!code) {
    return errRedirect(origin, 'naver_no_code');
  }

  /* ── 1. code → 네이버 access_token ── */
  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.NAVER_CLIENT_ID!,
    client_secret: process.env.NAVER_CLIENT_SECRET!,
    redirect_uri: `${origin}/api/auth/naver/callback`,
    code,
    state: urlState,
  });

  const tokenRes = await fetch(
    `https://nid.naver.com/oauth2.0/token?${tokenParams.toString()}`,
    { method: 'GET' },
  );

  if (!tokenRes.ok) {
    return errRedirect(origin, 'naver_token_request_failed');
  }

  const tokenData = (await tokenRes.json()) as NaverTokenResponse;

  if (!tokenData.access_token) {
    return errRedirect(origin, 'naver_token_missing');
  }

  /* ── 2. 네이버 프로필 조회 ── */
  const profileRes = await fetch('https://openapi.naver.com/v1/nid/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!profileRes.ok) {
    return errRedirect(origin, 'naver_profile_failed');
  }

  const profileData = (await profileRes.json()) as NaverProfileResponse;
  const profile = profileData.response;

  if (!profile) {
    return errRedirect(origin, 'naver_profile_missing');
  }

  /* ── 3. accountMerge 정책 판단 + Supabase 유저 확보 ── */
  // Naver는 이메일 검증 필드를 제공하지 않으므로 emailVerified: false 고정 (ADR-001 §3.1)
  // 이메일 미제공 시 가상 이메일(naver_{id}@naver-oauth.internal)로 fallback.
  const email = profile.email ?? `naver_${profile.id}@naver-oauth.internal`;
  const isSyntheticEmail = !profile.email;

  const decision = await resolveAccountMerge(
    {
      email,
      emailVerified: false,
      provider: 'naver',
      isSynthetic: isSyntheticEmail,
    },
    supabaseAdmin,
  );

  // block — 정책 위반 (예: 기존 Google·email 계정에 Naver 미검증 병합 시도, 시나리오 A)
  // 세션 미수립 상태라 signOut 없이 단순 리다이렉트 (ADR-001 §6.4 대칭성 참조)
  if (decision.action === 'block') {
    logAuthEvent({
      event: 'oauth.merge_blocked',
      provider: 'naver',
      emailMasked: maskEmail(email),
      outcome: 'blocked',
      errorCode: decision.code,
      ip,
      userAgent,
    });
    return errRedirect(origin, decision.code);
  }

  const baseMetadata = {
    full_name: profile.name ?? '',
    provider: 'naver' as const,
    naver_id: profile.id,
    email_verified: false,
    synthetic_email: isSyntheticEmail,
  };

  if (decision.action === 'allow_new') {
    // 신규 계정 생성. race/duplicate 에러는 무시 — 후속 generateLink가 이메일로 동작.
    const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { ...baseMetadata, providers: ['naver'] },
    });
    /* 신규 가입 환영 메일 — createUser 성공 + 실주소 확인 후만 발송 (fire-and-forget) */
    if (!createErr && !isSyntheticEmail) {
      void sendWelcomeEmail(email, baseMetadata.full_name || undefined);
    }
  } else if (decision.action === 'allow_merge') {
    // 기존 계정의 providers 배열에 naver 추가 (ADR §3.2 — 병합 허용 시 metadata 확장)
    // Naver 콜백에서는 실무상 도달하기 어려움(Naver는 항상 미검증이라 기존이 검증이면 block됨).
    // 방어적으로 남겨두어 향후 정책 변경에도 일관성 유지.
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
      provider: 'naver',
      emailMasked: maskEmail(email),
      outcome: 'failed',
      errorCode: 'naver_signin_failed',
      ip,
      userAgent,
    });
    return errRedirect(origin, 'naver_signin_failed');
  }

  const supabase = await createRouteHandlerClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });

  if (verifyError) {
    logAuthEvent({
      event: 'oauth.login.failed',
      provider: 'naver',
      emailMasked: maskEmail(email),
      outcome: 'failed',
      errorCode: 'naver_signin_failed',
      ip,
      userAgent,
    });
    return errRedirect(origin, 'naver_signin_failed');
  }

  logAuthEvent({
    event: 'oauth.login.success',
    provider: 'naver',
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
