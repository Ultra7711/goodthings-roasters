import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isCronRequest } from './cronAuth';

/* x-cron-secret 또는 Authorization: Bearer 를 CRON_SECRET 과 timing-safe 비교. */

const SECRET = 'test-cron-secret-abc123';

function req(headers: Record<string, string>): Request {
  return new Request('https://x.test/api/billing/charge/run', { headers });
}

describe('isCronRequest', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it('x-cron-secret 일치 → 통과', () => {
    expect(isCronRequest(req({ 'x-cron-secret': SECRET }))).toBe(true);
  });

  it('Authorization: Bearer 일치 → 통과 (Vercel Cron)', () => {
    expect(isCronRequest(req({ authorization: `Bearer ${SECRET}` }))).toBe(true);
  });

  it('x-cron-secret 불일치 → 거부', () => {
    expect(isCronRequest(req({ 'x-cron-secret': 'wrong' }))).toBe(false);
  });

  it('Bearer 불일치 → 거부', () => {
    expect(isCronRequest(req({ authorization: 'Bearer wrong' }))).toBe(false);
  });

  it('헤더 없음 → 거부', () => {
    expect(isCronRequest(req({}))).toBe(false);
  });

  it('Bearer 접두사 없는 Authorization → 거부', () => {
    expect(isCronRequest(req({ authorization: SECRET }))).toBe(false);
  });

  it('CRON_SECRET 미설정 → fail-closed (항상 거부)', () => {
    delete process.env.CRON_SECRET;
    expect(isCronRequest(req({ 'x-cron-secret': SECRET }))).toBe(false);
    expect(isCronRequest(req({ authorization: `Bearer ${SECRET}` }))).toBe(false);
  });

  it('CRON_SECRET 빈 문자열 → fail-closed', () => {
    process.env.CRON_SECRET = '';
    expect(isCronRequest(req({ 'x-cron-secret': '' }))).toBe(false);
  });

  it('길이가 더 긴 제공값(접두사 일치) → 거부 (길이 후위 검증)', () => {
    expect(isCronRequest(req({ 'x-cron-secret': `${SECRET}extra` }))).toBe(false);
  });
});
