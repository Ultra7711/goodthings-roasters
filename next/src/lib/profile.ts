'use server';

/* ══════════════════════════════════════════════════════════════════════════
   lib/profile.ts — 본인 프로필 server action (유저 리뷰 Phase 1 Step 0)

   책임:
   - getMyNickname(): 본인 닉네임 SSR prefetch (ProfileView 초기값 · flash 차단)
   - updateNickname(): 마이페이지 닉네임 편집 (Zod 검증 + profiles UPDATE)

   닉네임 정책 (084_profiles_nickname.sql):
   - 길이 2~20 + HTML 특수문자 차단 (DB CHECK 와 이중 방어)
   - 중복 허용 (유니크 제약 없음)
   - RLS profiles_update_own — authenticated + auth.uid() = id
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';
import { createRouteHandlerClient } from '@/lib/supabaseServer';

/* DB CHECK 와 동일 — 길이 2~20, XSS 위협 문자 차단 */
const nicknameSchema = z
  .string()
  .trim()
  .min(2, '닉네임은 2자 이상이어야 합니다.')
  .max(20, '닉네임은 20자 이하여야 합니다.')
  .regex(/^[^<>&"']+$/, '사용할 수 없는 문자가 포함되어 있습니다.');

export type UpdateNicknameResult =
  | { ok: true; nickname: string }
  | { ok: false; error: 'unauthenticated' | 'invalid'; message?: string }
  | { ok: false; error: 'db_error' };

/* 본인 닉네임 조회. ProfileView 초기 로드 시 사용 (SSR prefetch).
   RLS profiles_select_own 통과 — authenticated + auth.uid() = id. */
export async function getMyNickname(): Promise<string | null> {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[profile.getMyNickname] failed', error);
    return null;
  }
  return data?.nickname ?? null;
}

/* 닉네임 변경. Zod 검증 후 profiles UPDATE (RLS 본인만). */
export async function updateNickname(input: string): Promise<UpdateNicknameResult> {
  const parsed = nicknameSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'invalid', message: parsed.error.issues[0]?.message };
  }
  const nickname = parsed.data;

  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const { error } = await supabase
    .from('profiles')
    .update({ nickname })
    .eq('id', user.id);

  if (error) {
    console.error('[profile.updateNickname] failed', error);
    return { ok: false, error: 'db_error' };
  }
  return { ok: true, nickname };
}
