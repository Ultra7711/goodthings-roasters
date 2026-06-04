/* ══════════════════════════════════════════════════════════════════════════
   user-auth.ts — E2E 일반회원(비-admin) 세션 생성/정리 (S260 carry)

   목적:
   admin-auth-guard 가 "비-admin 회원도 /admin 접근 거부" 를 실제로 검증하도록,
   admin_level 없는 일반 회원 세션 쿠키를 동적 생성한다.

   흐름 (admin-auth.ts createAdminStorageState 답습):
   1. service_role 로 고정 email 의 기존 user 삭제(격리) → 임시 일반회원 createUser
   2. magic link 생성 → hashed_token → anon verifyOtp 로 session 획득
   3. @supabase/ssr createServerClient + 가짜 cookies 저장소로 setSession
      → sb-* cookies 수집 → Playwright 형식 변환
   4. cleanup: auth.admin.deleteUser

   admin-auth.ts 와 달리 파일 저장 없이 cookies 배열을 반환(spec 에서 직접 주입).
   일반회원이라 008 handle_new_user 트리거가 profiles row 생성(admin_level 없음).
   ══════════════════════════════════════════════════════════════════════════ */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';

/* 격리 식별자 — 이 email user 는 매 실행 선삭제 후 재생성. */
export const E2E_NONADMIN_EMAIL = 'e2e-nonadmin@example.com';

type PlaywrightCookies = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
}[];

export interface NonAdminSession {
  userId: string;
  cookies: PlaywrightCookies;
}

interface CookieSpec {
  name: string;
  value: string;
  options: CookieOptions;
}

function requireEnv(): { url: string; serviceRoleKey: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceRoleKey || !anonKey) {
    throw new Error(
      'user-auth: Supabase 환경변수 누락 (URL / SERVICE_ROLE_KEY / ANON_KEY)',
    );
  }
  return { url, serviceRoleKey, anonKey };
}

/** 고정 email 의 기존 user 삭제 (격리 — 이전 실행 cleanup 실패 보호). */
async function purgePriorUser(admin: SupabaseClient): Promise<void> {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const prior = data?.users.find((u) => u.email === E2E_NONADMIN_EMAIL);
  if (prior) {
    await admin.auth.admin.deleteUser(prior.id);
  }
}

/**
 * 임시 일반회원 1명 생성 후 세션 쿠키 수집.
 * 반환 cookies 를 spec 의 context.addCookies 로 주입 → 비-admin 세션 재현.
 */
export async function createNonAdminSession(): Promise<NonAdminSession> {
  const { url, serviceRoleKey, anonKey } = requireEnv();

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  /* 1. 격리 + 임시 일반회원 생성 (email 확인된 상태) */
  await purgePriorUser(admin);
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: E2E_NONADMIN_EMAIL,
    email_confirm: true,
  });
  if (createErr || !created?.user?.id) {
    throw new Error(`createNonAdminSession createUser 실패: ${createErr?.message}`);
  }
  const userId = created.user.id;

  /* 2. magic link → hashed_token → verifyOtp 로 session */
  const { data: linkRes, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: E2E_NONADMIN_EMAIL,
  });
  if (linkErr || !linkRes?.properties?.hashed_token) {
    await admin.auth.admin.deleteUser(userId);
    throw new Error(`generateLink 실패: ${linkErr?.message ?? 'no hashed_token'}`);
  }

  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: otpRes, error: otpErr } = await anon.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkRes.properties.hashed_token,
  });
  if (otpErr || !otpRes?.session) {
    await admin.auth.admin.deleteUser(userId);
    throw new Error(`verifyOtp 실패: ${otpErr?.message ?? 'no session'}`);
  }

  /* 3. createServerClient 로 setSession → cookies 수집 */
  const collected: CookieSpec[] = [];
  const ssr = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return collected.map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          const existing = collected.findIndex((c) => c.name === name);
          if (existing >= 0) {
            collected[existing] = { name, value, options };
          } else {
            collected.push({ name, value, options });
          }
        }
      },
    },
  });

  const { error: setErr } = await ssr.auth.setSession({
    access_token: otpRes.session.access_token,
    refresh_token: otpRes.session.refresh_token,
  });
  if (setErr) {
    await admin.auth.admin.deleteUser(userId);
    throw new Error(`setSession 실패: ${setErr.message}`);
  }

  const cookies: PlaywrightCookies = collected
    .filter((c) => c.value !== '')
    .map((c) => {
      const opts = c.options;
      const maxAge = opts.maxAge;
      const expires =
        typeof maxAge === 'number' && maxAge > 0
          ? Math.floor(Date.now() / 1000) + maxAge
          : -1;
      return {
        name: c.name,
        value: c.value,
        domain: 'localhost',
        path: opts.path ?? '/',
        expires,
        httpOnly: opts.httpOnly ?? true,
        secure: opts.secure ?? false,
        sameSite: normalizeSameSite(opts.sameSite),
      };
    });

  return { userId, cookies };
}

/** 임시 일반회원 삭제. teardown — 실패해도 throw 안 함. */
export async function deleteNonAdminUser(userId: string): Promise<void> {
  const { url, serviceRoleKey } = requireEnv();
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.warn(`[user-auth] deleteUser 실패 (id=${userId}): ${error.message}`);
  }
}

function normalizeSameSite(value: unknown): 'Strict' | 'Lax' | 'None' {
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'strict') return 'Strict';
    if (lower === 'none') return 'None';
  }
  return 'Lax';
}
