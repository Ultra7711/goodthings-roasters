/* ══════════════════════════════════════════════════════════════════════════
   admin-auth.ts — E2E admin storageState 생성 (S264-D LOW-C)

   흐름:
   1. service_role 로 E2E_ADMIN_USER_ID 의 email 조회
   2. service_role 로 magic link 생성 → hashed_token 추출
   3. anon client 로 verifyOtp → access_token / refresh_token 획득
   4. @supabase/ssr createServerClient + 가짜 cookies 저장소로 setSession 호출
      → Supabase 가 sb-* cookies 를 setAll 콜백으로 push
   5. 모인 cookies 를 Playwright storageState 형식으로 변환 → JSON 저장

   설계 결정:
   - Browser 띄우지 않음 — magic link redirect_to allow list 의존 회피
   - cookie 형식은 @supabase/ssr 가 내부적으로 생성한 그대로 사용
     → @supabase/ssr 버전 업그레이드 시 자동 호환
   - chunked cookie (sb-*.0, sb-*.1) 자동 처리
   ══════════════════════════════════════════════════════════════════════════ */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';

export interface AdminAuthSetupResult {
  /** Playwright storageState 파일 경로 */
  storageStatePath: string;
  /** admin user 의 email (디버그용) */
  email: string;
}

interface CookieSpec {
  name: string;
  value: string;
  options: CookieOptions;
}

/**
 * E2E admin storageState 생성. 사전 조건:
 * - process.env.E2E_ADMIN_USER_ID
 * - process.env.NEXT_PUBLIC_SUPABASE_URL
 * - process.env.SUPABASE_SERVICE_ROLE_KEY
 * - process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * 환경변수 누락 시 throw — 호출자 (globalSetup) 가 catch 해서 spec skip 처리.
 */
export async function createAdminStorageState(
  storageStatePath: string,
): Promise<AdminAuthSetupResult> {
  const adminUserId = process.env.E2E_ADMIN_USER_ID;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!adminUserId) {
    throw new Error('E2E_ADMIN_USER_ID 미설정');
  }
  if (!url || !serviceRoleKey || !anonKey) {
    throw new Error(
      'Supabase 환경변수 누락 (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY)',
    );
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  /* 1. admin user 의 email 조회 */
  const { data: userRes, error: userErr } =
    await admin.auth.admin.getUserById(adminUserId);
  if (userErr || !userRes?.user?.email) {
    throw new Error(
      `admin user 조회 실패 (id=${adminUserId}): ${userErr?.message ?? 'no email'}`,
    );
  }
  const email = userRes.user.email;

  /* 2. magic link 로 hashed_token 추출 */
  const { data: linkRes, error: linkErr } =
    await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
  if (linkErr || !linkRes?.properties?.hashed_token) {
    throw new Error(`generateLink 실패: ${linkErr?.message ?? 'no hashed_token'}`);
  }

  /* 3. anon client 로 verifyOtp → session 획득 */
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: otpRes, error: otpErr } = await anon.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkRes.properties.hashed_token,
  });
  if (otpErr || !otpRes?.session) {
    throw new Error(`verifyOtp 실패: ${otpErr?.message ?? 'no session'}`);
  }

  /* 4. @supabase/ssr createServerClient 로 setSession → cookies 수집
     verifyOtp 이미 호출됐으니 setSession 만으로 cookies 가 채워진다. */
  const collected: CookieSpec[] = [];
  const ssr = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return collected.map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          /* 동일 이름 cookie 가 setAll 여러 번 호출되면 마지막만 유지 */
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
    throw new Error(`setSession 실패: ${setErr.message}`);
  }

  /* 5. Playwright storageState 형식 변환 */
  const cookies = collected
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

  mkdirSync(dirname(storageStatePath), { recursive: true });
  writeFileSync(
    storageStatePath,
    JSON.stringify({ cookies, origins: [] }, null, 2),
  );

  return { storageStatePath, email };
}

type PlaywrightSameSite = 'Strict' | 'Lax' | 'None';

function normalizeSameSite(value: unknown): PlaywrightSameSite {
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'strict') return 'Strict';
    if (lower === 'none') return 'None';
  }
  return 'Lax';
}
