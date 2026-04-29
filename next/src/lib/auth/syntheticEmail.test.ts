/* ══════════════════════════════════════════════════════════════════════════
   syntheticEmail.test.ts — 가상 이메일 생성 · 판별 (L-3)

   커버리지:
   - isSyntheticEmail: null/undefined/일반/가상 이메일 판별
   - buildSyntheticEmail: 정상 생성 · 특수문자 포함 시 throw (L-3)
   ══════════════════════════════════════════════════════════════════════════ */

import { describe, expect, it } from 'vitest';
import { buildSyntheticEmail, isSyntheticEmail } from './syntheticEmail';

describe('isSyntheticEmail', () => {
  it('null/undefined → false', () => {
    expect(isSyntheticEmail(null)).toBe(false);
    expect(isSyntheticEmail(undefined)).toBe(false);
  });

  it('일반 이메일 → false', () => {
    expect(isSyntheticEmail('user@example.com')).toBe(false);
  });

  it('kakao 가상 이메일 → true', () => {
    expect(isSyntheticEmail('kakao_12345@kakao-oauth.internal')).toBe(true);
  });

  it('naver 가상 이메일 → true', () => {
    expect(isSyntheticEmail('naver_abc@naver-oauth.internal')).toBe(true);
  });
});

describe('buildSyntheticEmail', () => {
  it('kakao 정상 ID → 가상 이메일 생성', () => {
    expect(buildSyntheticEmail('kakao', '1234567890')).toBe(
      'kakao_1234567890@kakao-oauth.internal',
    );
  });

  it('naver 정상 ID (영문+숫자+_-) → 가상 이메일 생성', () => {
    expect(buildSyntheticEmail('naver', 'user_id-123')).toBe(
      'naver_user_id-123@naver-oauth.internal',
    );
  });

  it('providerUserId 에 @ 포함 → throw (L-3)', () => {
    expect(() => buildSyntheticEmail('naver', 'user@domain')).toThrow(
      /invalid providerUserId/,
    );
  });

  it('providerUserId 에 공백 포함 → throw', () => {
    expect(() => buildSyntheticEmail('kakao', 'user id')).toThrow(
      /invalid providerUserId/,
    );
  });

  it('빈 문자열 → throw', () => {
    expect(() => buildSyntheticEmail('kakao', '')).toThrow(
      /invalid providerUserId/,
    );
  });
});
