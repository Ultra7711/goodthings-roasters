/* ══════════════════════════════════════════════════════════════════════════
   paymentLogger.test.ts — PCI-safe 결제 로거 단위 테스트 (Session 8 보안 #4)

   검증 대상:
   - maskPaymentKey: 앞 6 + **** + 뒤 4 + #<sha256 prefix 5> 포맷, empty/short 방어
   - logPaymentEvent: allowlist 컨텍스트만 직렬화, 개행/따옴표 이스케이프
   - safeErrorMessage: 프로덕션은 message only, dev 는 stack 포함
   ══════════════════════════════════════════════════════════════════════════ */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { maskPaymentKey, logPaymentEvent, safeErrorMessage } from './paymentLogger';

/* ─── maskPaymentKey ─────────────────────────────────────────────────── */

describe('maskPaymentKey', () => {
  it('[1] 앞 6 + **** + 뒤 4 + #hash 포맷', () => {
    const masked = maskPaymentKey('tviva_20260417abcd1234');
    /* `tviva_` 가 접두사이므로 앞 6 = 'tviva_', 뒤 4 = '1234' */
    expect(masked).toMatch(/^tviva_\*\*\*\*1234#[0-9a-f]{5}$/);
  });

  it('[2] 동일 key 는 동일 hash prefix (상관관계 추적)', () => {
    const a = maskPaymentKey('tviva_XYZ789012345');
    const b = maskPaymentKey('tviva_XYZ789012345');
    expect(a).toBe(b);
  });

  it('[3] 다른 key 는 다른 hash prefix', () => {
    const a = maskPaymentKey('tviva_AAA111111111');
    const b = maskPaymentKey('tviva_BBB222222222');
    expect(a).not.toBe(b);
  });

  it('[4] empty/undefined 는 ***EMPTY', () => {
    expect(maskPaymentKey('')).toBe('***EMPTY');
    expect(maskPaymentKey(null)).toBe('***EMPTY');
    expect(maskPaymentKey(undefined)).toBe('***EMPTY');
  });

  it('[5] 12자 미만 short 값은 ***SHORT#hash (부분 재식별 방어)', () => {
    const masked = maskPaymentKey('tviva_123');
    expect(masked).toMatch(/^\*\*\*SHORT#[0-9a-f]{5}$/);
  });

  it('[6] 원본 paymentKey 는 출력에 포함되지 않음', () => {
    const key = 'tviva_SUPERSECRETPAYLOAD_DEADBEEF';
    const masked = maskPaymentKey(key);
    expect(masked).not.toContain('SUPERSECRETPAYLOAD');
    expect(masked).not.toContain('DEADBEEF');
  });
});

/* ─── logPaymentEvent ────────────────────────────────────────────────── */

describe('logPaymentEvent', () => {
  const spies = {
    log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  };

  beforeEach(() => {
    spies.log.mockClear();
    spies.warn.mockClear();
    spies.error.mockClear();
  });

  afterEach(() => {
    spies.log.mockClear();
    spies.warn.mockClear();
    spies.error.mockClear();
  });

  it('[7] level=info → console.log 으로 라우팅', () => {
    logPaymentEvent('info', 'test_event', { orderId: 'uuid-1' });
    expect(spies.log).toHaveBeenCalledTimes(1);
    expect(spies.warn).not.toHaveBeenCalled();
    expect(spies.error).not.toHaveBeenCalled();
    expect(spies.log.mock.calls[0][0]).toContain('[payment:info]');
    expect(spies.log.mock.calls[0][0]).toContain('event="test_event"');
    expect(spies.log.mock.calls[0][0]).toContain('orderId="uuid-1"');
  });

  it('[8] level=warn → console.warn', () => {
    logPaymentEvent('warn', 'approved_at_fallback', { orderId: 'x' });
    expect(spies.warn).toHaveBeenCalledTimes(1);
  });

  it('[9] level=error → console.error', () => {
    logPaymentEvent('error', 'fail', { errorMessage: 'boom' });
    expect(spies.error).toHaveBeenCalledTimes(1);
  });

  it('[10] undefined 필드는 로그에서 생략', () => {
    logPaymentEvent('info', 'evt', {
      orderId: 'x',
      orderNumber: undefined,
      paymentKeyMasked: undefined,
    });
    const line = spies.log.mock.calls[0][0] as string;
    expect(line).toContain('orderId=');
    expect(line).not.toContain('orderNumber=');
    expect(line).not.toContain('paymentKeyMasked=');
  });

  it('[11] 값 내 개행/따옴표는 JSON.stringify 로 이스케이프', () => {
    logPaymentEvent('error', 'evt', {
      errorMessage: 'line1\nline2"injected"',
    });
    const line = spies.error.mock.calls[0][0] as string;
    /* 실제 개행이 로그 라인에 포함되면 안 됨 */
    expect(line.split('\n').length).toBe(1);
    expect(line).toContain('\\n');
  });

  it('[12] errorMessage 200자 이상은 truncate', () => {
    const long = 'a'.repeat(500);
    logPaymentEvent('error', 'evt', { errorMessage: long });
    const line = spies.error.mock.calls[0][0] as string;
    expect(line).toContain('…');
    expect(line.length).toBeLessThan(300);
  });

  it('[13] 숫자 필드도 안전하게 직렬화', () => {
    logPaymentEvent('info', 'evt', { amount: 15000, durationMs: 234 });
    const line = spies.log.mock.calls[0][0] as string;
    expect(line).toContain('amount=15000');
    expect(line).toContain('durationMs=234');
  });
});

/* ─── safeErrorMessage ───────────────────────────────────────────────── */

describe('safeErrorMessage', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
  });

  it('[14] production → message only (stack 제외)', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    const err = new Error('boom');
    const result = safeErrorMessage(err);
    expect(result).toBe('boom');
    expect(result).not.toContain('\n');
  });

  it('[15] development → stack 포함', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    const err = new Error('boom');
    const result = safeErrorMessage(err);
    expect(result).toContain('boom');
    /* stack 에는 보통 at 이나 파일명이 포함 */
    expect(result.length).toBeGreaterThan('boom'.length);
  });

  it('[16] 비-Error 값은 String() 변환', () => {
    expect(safeErrorMessage('plain string')).toBe('plain string');
    expect(safeErrorMessage(42)).toBe('42');
    expect(safeErrorMessage(null)).toBe('null');
  });

  it('[17] 빈 message 는 err.name fallback', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    class CustomError extends Error {
      constructor() {
        super('');
        this.name = 'CustomError';
      }
    }
    expect(safeErrorMessage(new CustomError())).toBe('CustomError');
  });
});
