/* ══════════════════════════════════════════
   Auth Types
   Supabase Auth 연동 전 기초 타입
   ══════════════════════════════════════════ */

import type { UserAddress } from './address';

export type User = {
  id: string;
  email: string;
  name: string;
  phone?: string;
  /** 기본 배송지 (마이페이지에서 편집) */
  address?: UserAddress | null;
};

export type AuthState = {
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
};

/** 로그인/회원가입 결과 */
export type AuthResult =
  | { ok: true }
  | { ok: false; error: string };
