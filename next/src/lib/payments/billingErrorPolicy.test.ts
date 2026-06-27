import { describe, it, expect } from 'vitest';
import {
  classifyBillingError,
  computeRetryAt,
  RETRY_SCHEDULE_HOURS,
} from './billingErrorPolicy';

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse('2026-06-28T00:00:00.000Z');

describe('classifyBillingError', () => {
  it('일시(retryable) 코드', () => {
    expect(classifyBillingError('REJECT_CARD_PAYMENT')).toBe('retryable');
    expect(classifyBillingError('PROVIDER_ERROR')).toBe('retryable');
    expect(classifyBillingError('FAILED_CARD_COMPANY')).toBe('retryable');
    expect(classifyBillingError('NETWORK_ERROR')).toBe('retryable');
  });

  it('영구(permanent) 코드', () => {
    expect(classifyBillingError('INVALID_CARD_EXPIRATION')).toBe('permanent');
    expect(classifyBillingError('INVALID_STOPPED_CARD')).toBe('permanent');
    expect(classifyBillingError('NOT_MATCHES_CUSTOMER_KEY')).toBe('permanent');
    expect(classifyBillingError('REJECT_CARD_COMPANY')).toBe('permanent');
    // 내부 코드 — 데이터 수정 전 재시도 무의미
    expect(classifyBillingError('NO_DEFAULT_ADDRESS')).toBe('permanent');
    expect(classifyBillingError('PRODUCT_NOT_FOUND')).toBe('permanent');
  });

  it('미분류/누락 → unknown', () => {
    expect(classifyBillingError('SOMETHING_BRAND_NEW')).toBe('unknown');
    expect(classifyBillingError(null)).toBe('unknown');
    expect(classifyBillingError(undefined)).toBe('unknown');
    expect(classifyBillingError('')).toBe('unknown');
  });
});

describe('computeRetryAt', () => {
  it('permanent → 항상 null', () => {
    expect(computeRetryAt('INVALID_STOPPED_CARD', 0, NOW)).toBeNull();
    expect(computeRetryAt('NO_DEFAULT_ADDRESS', 0, NOW)).toBeNull();
  });

  it('retryable → 24h → 48h → 72h → 소진 시 null', () => {
    expect(computeRetryAt('PROVIDER_ERROR', 0, NOW)).toBe(
      new Date(NOW + RETRY_SCHEDULE_HOURS[0] * HOUR).toISOString(),
    );
    expect(computeRetryAt('PROVIDER_ERROR', 1, NOW)).toBe(
      new Date(NOW + RETRY_SCHEDULE_HOURS[1] * HOUR).toISOString(),
    );
    expect(computeRetryAt('PROVIDER_ERROR', 2, NOW)).toBe(
      new Date(NOW + RETRY_SCHEDULE_HOURS[2] * HOUR).toISOString(),
    );
    expect(computeRetryAt('PROVIDER_ERROR', 3, NOW)).toBeNull();
  });

  it('unknown → 1회만 재시도(24h) 후 null', () => {
    expect(computeRetryAt('WAT', 0, NOW)).toBe(
      new Date(NOW + 24 * HOUR).toISOString(),
    );
    expect(computeRetryAt('WAT', 1, NOW)).toBeNull();
  });
});
