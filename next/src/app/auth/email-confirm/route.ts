/* ══════════════════════════════════════════
   /auth/email-confirm — 이메일 등록(변경) 확인 링크 복귀 라우트 (S302)

   흐름 (ADR-001 §3.2 · DEC-E1):
   1. 가상 이메일 유저가 마이페이지/주문 승격에서 실제 이메일 입력 →
      supabase.auth.updateUser({ email }) → Supabase 가 신규 이메일로 확인 메일 발송.
   2. 메일의 링크 = `{SiteURL}/auth/email-confirm?token_hash=...&type=email_change`
      (Supabase "Change Email Address" 템플릿 token_hash 포맷 — 선행 액션).
   3. 본 라우트가 verifyOtp 로 확정 → auth.users.email 갱신.
      → 001 on_auth_user_email_updated 트리거가 profiles.email 동기화
      → 081 트리거가 가상 이메일 newsletter 쓰레기 row 삭제.
   4. 성공 → /mypage?emailRegistered=1 · 실패 → /mypage?error=email_confirm_failed

   참조: app/auth/callback/route.ts (verifyOtp/리다이렉트 패턴).
   ══════════════════════════════════════════ */

import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@/lib/supabaseServer';

export async function GET(request: Request): Promise<Response> {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  if (!tokenHash || type !== 'email_change') {
    return NextResponse.redirect(`${origin}/mypage?error=email_confirm_failed`);
  }

  const supabase = await createRouteHandlerClient();
  const { error } = await supabase.auth.verifyOtp({
    type: 'email_change',
    token_hash: tokenHash,
  });

  if (error) {
    console.error('[auth.email-confirm] verifyOtp failed', { code: error.code });
    return NextResponse.redirect(`${origin}/mypage?error=email_confirm_failed`);
  }

  return NextResponse.redirect(`${origin}/mypage?emailRegistered=1`);
}
