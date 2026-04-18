/* ══════════════════════════════════════════
   /auth/callback — Google OAuth 코드 교환 라우트 (PKCE flow)

   ADR-001 §6.4 Implementation Notes — Google PKCE 제약:
   - exchangeCodeForSession 이후에만 이메일·검증 상태 획득 가능
   - 정책 검사는 세션 수립 **후** 수행
   - block 시 signOut + 세션 쿠키 수동 삭제 fallback 필수

   흐름:
   1. code → exchangeCodeForSession (세션 수립)
   2. user.email + user_metadata.email_verified 확보
   3. resolveAccountMerge 호출 (ADR §3.2)
      - block: signOut + sb-* 쿠키 수동 삭제 + /login?error
      - allow_*: user_metadata 정규화 (providers, email_verified) 후 /mypage
   ══════════════════════════════════════════ */

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
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

/* ── Supabase 어드민 클라이언트 (서버 전용, 세션 비유지) ── */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  /** 로그인 후 이동할 경로 (기본: /mypage) */
  const next = searchParams.get('next') ?? '/mypage';

  const limited = await checkRateLimit(request, 'auth_callback');
  if (limited) return limited;

  const ip = extractIp(request);
  const userAgent = extractUserAgent(request);

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_no_code`);
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
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

  /* ── 1. code → session 교환 ── */
  const { data: sessionData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !sessionData?.user?.email) {
    logAuthEvent({
      event: 'oauth.login.failed',
      provider: 'google',
      emailMasked: '***',
      outcome: 'failed',
      errorCode: 'auth_exchange_failed',
      ip,
      userAgent,
    });
    return NextResponse.redirect(`${origin}/login?error=auth_exchange_failed`);
  }

  const user = sessionData.user;
  const userEmail = user.email;
  if (!userEmail) {
    // 위에서 이미 체크됐지만 TypeScript 내로잉이 const 대입 이후 사라져 명시적 가드.
    return NextResponse.redirect(`${origin}/login?error=auth_exchange_failed`);
  }

  /* ── 2. accountMerge 정책 판단 (ADR-001 §3.2, §6.4) ──
     Google id_token.email_verified 는 Supabase가 내부 검증 후 세션에 반영.
     user_metadata.email_verified === true 또는 email_confirmed_at 세팅으로 판별. */
  const emailVerified =
    user.user_metadata?.email_verified === true ||
    user.email_confirmed_at != null;

  const decision = await resolveAccountMerge(
    {
      email: userEmail,
      emailVerified,
      provider: 'google',
      isSynthetic: false,
    },
    supabaseAdmin,
  );

  /* ── 3. block: signOut + sb-* 쿠키 수동 삭제 + 에러 리다이렉트 ── */
  if (decision.action === 'block') {
    logAuthEvent({
      event: 'oauth.merge_blocked',
      provider: 'google',
      emailMasked: maskEmail(userEmail),
      outcome: 'blocked',
      errorCode: decision.code,
      ip,
      userAgent,
    });
    // signOut은 정상 경로에서 쿠키를 자동 삭제. 실패 대비 응답에서 수동 삭제.
    try {
      await supabase.auth.signOut();
    } catch {
      // no-op — 아래 수동 삭제로 커버 (ADR §6.4 리뷰어 체크포인트 1)
    }
    const res = NextResponse.redirect(
      `${origin}/login?error=${decision.code}`,
    );
    for (const cookie of cookieStore.getAll()) {
      if (cookie.name.startsWith('sb-')) {
        res.cookies.delete(cookie.name);
      }
    }
    return res;
  }

  /* ── 4. allow_*: user_metadata 정규화 ──
     Supabase는 Google OAuth 시 user_metadata에 Google raw profile만 채운다.
     우리 규약(providers 배열, email_verified, synthetic_email)을 명시 기록. */
  if (decision.action === 'allow_new') {
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(user.user_metadata ?? {}),
        provider: 'google',
        providers: ['google'],
        email_verified: true,
        synthetic_email: false,
      },
    });
  } else if (decision.action === 'allow_merge') {
    // 기존 non-google 계정 쪽의 providers 배열에 'google' 추가 기록.
    // ⚠️ Supabase manual linking=ON 가정: 실제 identity linking(두 계정 통합)은 이 단계에서 수행하지 않음.
    //    Supabase Admin API에 identity linking 미지원 — 설정 페이지에서 수동 linking 예정(Phase 3-9).
    //    현재는 두 계정이 공존하며 세션은 신규 Google 계정으로 수립된다.
    //
    // 자기참조 가드 — Supabase email UNIQUE 제약으로 Google 재로그인 시 기존 유저가 곧 신규 유저.
    // decision.userId === user.id 인 경우 allow_same 과 동등하게 처리(정규화만 수행)해야
    // pending_link_with 자기참조 오염과 이중 업데이트 race를 피할 수 있다.
    if (decision.userId === user.id) {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...(user.user_metadata ?? {}),
          provider: 'google',
          providers: ['google'],
          email_verified: true,
          synthetic_email: false,
        },
      });
    } else {
      const { data: existing } = await supabaseAdmin.auth.admin.getUserById(
        decision.userId,
      );
      await supabaseAdmin.auth.admin.updateUserById(decision.userId, {
        user_metadata: buildMergeMetadata(
          existing?.user?.user_metadata ?? undefined,
          decision,
        ),
      });
      // 새 Google 계정에도 우리 규약 정규화
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...(user.user_metadata ?? {}),
          provider: 'google',
          providers: ['google'],
          email_verified: true,
          synthetic_email: false,
          pending_link_with: decision.userId, // 추후 수동 linking 대상 마커
        },
      });
    }
  }
  // allow_same: 기존 Google 재로그인 — 정규화 불필요

  logAuthEvent({
    event: 'oauth.login.success',
    provider: 'google',
    emailMasked: maskEmail(userEmail),
    outcome: 'success',
    userId: user.id,
    mergeAction: decision.action,
    ip,
    userAgent,
  });
  return NextResponse.redirect(`${origin}${next}`);
}
