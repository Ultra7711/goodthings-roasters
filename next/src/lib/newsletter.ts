'use server';

/* ══════════════════════════════════════════════════════════════════════════
   lib/newsletter.ts — newsletter 구독 server action (S241 Phase 1)

   책임:
   - 메인 NewsletterSection 의 submit 처리 (비회원 + 회원 공통)
   - Zod email 검증 + 정규화 (trim + lowercase)
   - newsletter_subscribers INSERT
     · 회원이면 user_id 자동 연결 (cookies 인증)
     · 비회원이면 user_id null
     · email unique 충돌 시 "이미 구독" 응답 (RLS 상 비회원은 UPDATE 불가 →
       재구독은 회원 마이페이지 토글에서 처리 · Phase 2)

   참조:
   - 065_newsletter_subscribers.sql (RLS · 정책)
   - NewsletterSection.tsx (UI)
   - Phase 2: AccountInfoRow 토글 + setNewsletterSubscription
   - Phase 3: admin 발송 (Resend · /admin/newsletter)
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';
import { createRouteHandlerClient } from '@/lib/supabaseServer';

const emailSchema = z.string().trim().toLowerCase().email();

export type SubscribeNewsletterResult =
  | { ok: true }
  | { ok: false; error: 'invalid_email' | 'already_subscribed' | 'db_error' };

export async function subscribeNewsletter(
  emailInput: string,
): Promise<SubscribeNewsletterResult> {
  const parsed = emailSchema.safeParse(emailInput);
  if (!parsed.success) return { ok: false, error: 'invalid_email' };
  const email = parsed.data;

  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from('newsletter_subscribers').insert({
    email,
    user_id: user?.id ?? null,
    source: 'newsletter_form',
  });

  if (error) {
    /* email unique 충돌 (이미 구독 또는 unsubscribed 상태).
       비회원 RLS 상 UPDATE 권한 없음 → 재활성화는 회원 마이페이지에서 처리. */
    if (error.code === '23505') {
      return { ok: false, error: 'already_subscribed' };
    }
    console.error('[newsletter] subscribe failed', error);
    return { ok: false, error: 'db_error' };
  }

  return { ok: true };
}

export type UnsubscribeResult =
  | { ok: true; updated: boolean }
  | { ok: false; error: 'invalid_token' | 'db_error' };

/* 발송 메일의 /unsubscribe?token=<uuid> 처리.
   RPC unsubscribe_by_token (SECURITY DEFINER) 호출 → 토큰 매치 + active 일 때만 UPDATE.
   updated=true 면 방금 처리 / false 면 이미 unsubscribed 또는 토큰 불일치 (graceful). */
export async function unsubscribeByToken(
  token: string,
): Promise<UnsubscribeResult> {
  /* UUID v4 형식 검증 — 잘못된 token 은 RPC 전에 차단. */
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(token)) {
    return { ok: false, error: 'invalid_token' };
  }

  const supabase = await createRouteHandlerClient();
  const { data, error } = await supabase.rpc('unsubscribe_by_token', {
    p_token: token,
  });

  if (error) {
    console.error('[newsletter] unsubscribe failed', error);
    return { ok: false, error: 'db_error' };
  }

  return { ok: true, updated: data === true };
}
