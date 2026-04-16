/* ══════════════════════════════════════════
   auth/logger 유닛 테스트 (P3-1a)

   커버리지:
   - maskEmail: 일반·가상·엣지 케이스 전수
   - logAuthEvent: JSON 형태·필수 필드·undefined 제외 검증
   - extractIp: x-forwarded-for / x-real-ip / 없음
   - extractUserAgent: 120자 제한·없음
   ══════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  maskEmail,
  logAuthEvent,
  extractIp,
  extractUserAgent,
} from './logger';

/* ══════════════════════════════════════════
   maskEmail
   ══════════════════════════════════════════ */

describe('maskEmail', () => {
  it('빈 문자열 → ***', () => {
    expect(maskEmail('')).toBe('***');
  });

  it('@ 없는 문자열 → ***', () => {
    expect(maskEmail('notanemail')).toBe('***');
  });

  it('@ 가 첫 글자인 경우 → ***', () => {
    expect(maskEmail('@example.com')).toBe('***');
  });

  it('일반 이메일 — local part 첫 글자만 노출', () => {
    expect(maskEmail('user@example.com')).toBe('u***@example.com');
  });

  it('두 글자 local part 마스킹', () => {
    expect(maskEmail('ab@example.com')).toBe('a***@example.com');
  });

  it('한 글자 local part 마스킹', () => {
    expect(maskEmail('a@example.com')).toBe('a***@example.com');
  });

  it('플러스 alias 포함 이메일 — lastIndexOf(@) 기준 처리', () => {
    expect(maskEmail('user+alias@example.com')).toBe('u***@example.com');
  });

  it('서브도메인 포함 이메일', () => {
    expect(maskEmail('test@mail.example.co.kr')).toBe('t***@mail.example.co.kr');
  });

  it('카카오 가상 이메일 — 변환 없이 반환', () => {
    expect(maskEmail('kakao_123456@kakao-oauth.internal')).toBe(
      'kakao_123456@kakao-oauth.internal',
    );
  });

  it('네이버 가상 이메일 — 변환 없이 반환', () => {
    expect(maskEmail('naver_abc@naver-oauth.internal')).toBe(
      'naver_abc@naver-oauth.internal',
    );
  });
});

/* ══════════════════════════════════════════
   logAuthEvent
   ══════════════════════════════════════════ */

describe('logAuthEvent', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('구조화 JSON 출력 — 필수 필드 포함', () => {
    logAuthEvent({
      event: 'oauth.login.success',
      provider: 'google',
      emailMasked: 'u***@example.com',
      outcome: 'success',
      userId: 'user-abc',
    });

    expect(consoleSpy).toHaveBeenCalledOnce();
    const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string);

    expect(logged).toMatchObject({
      event: 'oauth.login.success',
      provider: 'google',
      emailMasked: 'u***@example.com',
      outcome: 'success',
      userId: 'user-abc',
    });
  });

  it('ts 필드가 ISO 8601 형식', () => {
    logAuthEvent({
      event: 'oauth.login.failed',
      provider: 'naver',
      emailMasked: '***',
      outcome: 'failed',
    });

    const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(typeof logged.ts).toBe('string');
    expect(new Date(logged.ts).toISOString()).toBe(logged.ts);
  });

  it('블록 이벤트 — errorCode 포함', () => {
    logAuthEvent({
      event: 'oauth.merge_blocked',
      provider: 'naver',
      emailMasked: 'u***@example.com',
      outcome: 'blocked',
      errorCode: 'account_conflict_google',
    });

    const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(logged.event).toBe('oauth.merge_blocked');
    expect(logged.outcome).toBe('blocked');
    expect(logged.errorCode).toBe('account_conflict_google');
  });

  it('undefined 선택 필드는 JSON 직렬화에서 제외', () => {
    logAuthEvent({
      event: 'oauth.login.failed',
      provider: 'kakao',
      emailMasked: '***',
      outcome: 'failed',
      /* userId, mergeAction, errorCode, ip, userAgent 모두 전달하지 않음 */
    });

    const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect('userId' in logged).toBe(false);
    expect('mergeAction' in logged).toBe(false);
    expect('errorCode' in logged).toBe(false);
    expect('ip' in logged).toBe(false);
    expect('userAgent' in logged).toBe(false);
  });

  it('ip·userAgent 전달 시 JSON에 포함', () => {
    logAuthEvent({
      event: 'oauth.login.success',
      provider: 'google',
      emailMasked: 'u***@example.com',
      outcome: 'success',
      ip: '1.2.3.4',
      userAgent: 'Mozilla/5.0',
    });

    const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(logged.ip).toBe('1.2.3.4');
    expect(logged.userAgent).toBe('Mozilla/5.0');
  });
});

/* ══════════════════════════════════════════
   extractIp
   ══════════════════════════════════════════ */

describe('extractIp', () => {
  function makeReq(headers: Record<string, string>): Request {
    return new Request('https://example.com', { headers });
  }

  /* Pass 1 H-3 반영: Vercel edge 는 수신된 x-forwarded-for 끝에 자신이 확인한
     client IP 를 append. "마지막 값" 이 조작 불가능한 신뢰 IP.
     이전의 "첫 번째 값" 로직은 클라이언트가 헤더를 조작해 rate limit 우회 가능. */

  it('x-real-ip 가 있으면 최우선 반환 (Vercel edge 덮어쓰기)', () => {
    expect(
      extractIp(makeReq({
        'x-real-ip': '10.0.0.1',
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
      })),
    ).toBe('10.0.0.1');
  });

  it('x-forwarded-for — 마지막 값 반환 (공백 trim)', () => {
    expect(extractIp(makeReq({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('5.6.7.8');
  });

  it('x-forwarded-for — 단일 IP', () => {
    expect(extractIp(makeReq({ 'x-forwarded-for': '9.9.9.9' }))).toBe('9.9.9.9');
  });

  it('x-real-ip fallback (x-forwarded-for 없을 때)', () => {
    expect(extractIp(makeReq({ 'x-real-ip': '10.0.0.1' }))).toBe('10.0.0.1');
  });

  it('헤더 없으면 undefined', () => {
    expect(extractIp(makeReq({}))).toBeUndefined();
  });

  it('x-forwarded-for 끝 공백/빈 값 방어', () => {
    expect(
      extractIp(makeReq({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8,  ' })),
    ).toBe('5.6.7.8');
  });
});

/* ══════════════════════════════════════════
   extractUserAgent
   ══════════════════════════════════════════ */

describe('extractUserAgent', () => {
  it('120자 이하 그대로 반환', () => {
    const ua = 'Mozilla/5.0 Chrome/120';
    const req = new Request('https://example.com', { headers: { 'user-agent': ua } });
    expect(extractUserAgent(req)).toBe(ua);
  });

  it('120자 초과 시 120자로 잘라냄', () => {
    const long = 'A'.repeat(200);
    const req = new Request('https://example.com', { headers: { 'user-agent': long } });
    expect(extractUserAgent(req)).toHaveLength(120);
    expect(extractUserAgent(req)).toBe('A'.repeat(120));
  });

  it('user-agent 헤더 없으면 undefined', () => {
    const req = new Request('https://example.com');
    expect(extractUserAgent(req)).toBeUndefined();
  });
});
