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

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { sendNewsletterWelcomeEmail } from '@/lib/email/notifications';

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

  /* unsubscribe_token 을 client 측에서 미리 생성 — anon RLS 상 SELECT 권한 없어
     INSERT 후 RETURNING/SELECT 로 token 받을 수 없음. UUID v4 추측 불가능하므로
     server 측 default(gen_random_uuid()) 와 동등한 보안. */
  const unsubscribeToken = randomUUID();

  const { error } = await supabase.from('newsletter_subscribers').insert({
    email,
    user_id: user?.id ?? null,
    source: 'newsletter_form',
    unsubscribe_token: unsubscribeToken,
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

  /* Welcome 메일 발송 — fire-and-forget. 발송 실패는 구독 success 자체를 막지 않음. */
  void sendNewsletterWelcomeEmail(email, unsubscribeToken);

  return { ok: true };
}

/* ── 회원 마이페이지 토글 (Phase 2) ─────────────────────────────────────── */

export type NewsletterStatusResult =
  | { ok: true; status: 'active' | 'unsubscribed' | 'none' }
  | { ok: false; error: 'unauthenticated' | 'db_error' };

/* 현재 회원의 newsletter 구독 상태 조회. ProfileView 초기 로드 시 사용.
   RLS owner_select 정책 통과 — authenticated + auth.uid() = user_id. */
export async function getNewsletterStatus(): Promise<NewsletterStatusResult> {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const { data, error } = await supabase
    .from('newsletter_subscribers')
    .select('status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[newsletter] status fetch failed', error);
    return { ok: false, error: 'db_error' };
  }
  if (!data) return { ok: true, status: 'none' };
  return { ok: true, status: data.status as 'active' | 'unsubscribed' };
}

export type SetSubscriptionResult =
  | { ok: true }
  | { ok: false; error: 'unauthenticated' | 'db_error' };

/* 회원 마이페이지 토글 (active / unsubscribed).
   set_newsletter_subscription RPC (079 · SECURITY DEFINER) 에 위임 — caller 의 auth email
   기준 upsert + user_id 재연결. row 의 user_id 가 stale/NULL/missing 이어도 자가 치유하므로
   "email 은 있는데 user_id 불일치" 로 인한 email unique 충돌(기존 fallback INSERT 버그) 차단. */
export async function setNewsletterSubscription(
  enabled: boolean,
): Promise<SetSubscriptionResult> {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const { error } = await supabase.rpc('set_newsletter_subscription', {
    p_enabled: enabled,
  });
  if (error) {
    console.error('[newsletter] set subscription failed', error);
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
