/* ══════════════════════════════════════════════════════════════════════════
   adminAuth.test.ts — 어드민 API 키 검증 (Session 8-B B-2)

   커버리지:
   - ADMIN_API_SECRET 미설정 시 거부
   - ADMIN_API_SECRET 빈 문자열 거부
   - x-admin-secret 헤더 부재 거부
   - 길이 불일치 거부
   - 정상 일치 시 통과
   - 유사 값(1자 차이) 거부
   ══════════════════════════════════════════════════════════════════════════ */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isAdminRequest } from './adminAuth';

function makeRequest(headerValue?: string): Request {
  const headers: Record<string, string> = {};
  if (headerValue !== undefined) headers['x-admin-secret'] = headerValue;
  return new Request('https://goodthings-roasters.com/api/admin/foo', {
    method: 'POST',
    headers,
  });
}

describe('isAdminRequest', () => {
  const originalSecret = process.env.ADMIN_API_SECRET;

  beforeEach(() => {
    delete process.env.ADMIN_API_SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.ADMIN_API_SECRET;
    else process.env.ADMIN_API_SECRET = originalSecret;
  });

  it('ADMIN_API_SECRET 미설정 시 거부', () => {
    expect(isAdminRequest(makeRequest('anything'))).toBe(false);
  });

  it('ADMIN_API_SECRET 빈 문자열 시 거부', () => {
    process.env.ADMIN_API_SECRET = '';
    expect(isAdminRequest(makeRequest('anything'))).toBe(false);
  });

  it('x-admin-secret 헤더 부재 시 거부', () => {
    process.env.ADMIN_API_SECRET = 'topsecret-1234';
    expect(isAdminRequest(makeRequest())).toBe(false);
  });

  it('길이 불일치 거부', () => {
    process.env.ADMIN_API_SECRET = 'topsecret-1234';
    expect(isAdminRequest(makeRequest('topsecret'))).toBe(false);
  });

  it('정확히 일치하면 통과', () => {
    process.env.ADMIN_API_SECRET = 'topsecret-1234';
    expect(isAdminRequest(makeRequest('topsecret-1234'))).toBe(true);
  });

  it('1자 차이 거부', () => {
    process.env.ADMIN_API_SECRET = 'topsecret-1234';
    expect(isAdminRequest(makeRequest('topsecret-1235'))).toBe(false);
  });
});
