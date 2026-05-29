/* ══════════════════════════════════════════
   useEmailRegisterForm.test.ts — Supabase AuthError → 한국어 매핑 (S302)
   mapEmailError 순수 함수 단위 테스트.
   ══════════════════════════════════════════ */

import { describe, expect, it } from 'vitest';
import { mapEmailError } from './useEmailRegisterForm';

describe('mapEmailError', () => {
  it('중복 이메일(code=email_exists) → 안내', () => {
    expect(mapEmailError({ code: 'email_exists' })).toContain('이미 가입된 이메일');
  });

  it('중복 이메일(message) → 안내', () => {
    expect(
      mapEmailError({ message: 'A user with this email address has already been registered' }),
    ).toContain('이미 가입된 이메일');
  });

  it('rate limit(status 429) → 안내', () => {
    expect(mapEmailError({ status: 429 })).toContain('잠시 후');
  });

  it('rate limit(message) → 안내', () => {
    expect(mapEmailError({ message: 'Email rate limit exceeded' })).toContain('잠시 후');
  });

  it('동일 이메일(message=same) → 안내', () => {
    expect(mapEmailError({ message: 'New email should be different' })).toContain('동일');
  });

  it('알 수 없는 에러 → 일반 실패 메시지', () => {
    expect(mapEmailError({ message: 'unexpected boom' })).toContain('실패');
  });
});
