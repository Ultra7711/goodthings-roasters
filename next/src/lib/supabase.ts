/* ══════════════════════════════════════════
   supabase — 브라우저 클라이언트 싱글톤
   'use client' 컴포넌트·훅에서 import해서 사용.
   createBrowserClient(@supabase/ssr) 사용으로 PKCE flow 적용.
   서버 전용 로직(API Routes)은 supabaseAdmin.ts 사용.
   ══════════════════════════════════════════ */

import { createBrowserClient } from '@supabase/ssr';

/** 브라우저 클라이언트 싱글톤 (PKCE flow, 쿠키 기반) */
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
