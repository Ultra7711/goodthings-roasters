/* ══════════════════════════════════════════
   bizInquiries.test.ts — 검색/페이지네이션 파싱 (S304)
   ══════════════════════════════════════════ */

import { describe, expect, it } from 'vitest';
import { parseBizSearchParams, sanitizeBizQuery } from './bizInquiries';

describe('sanitizeBizQuery', () => {
  it('ilike 특수문자 제거 + trim + 60자 제한', () => {
    expect(sanitizeBizQuery('  good%_things,()  ')).toBe('goodthings');
    expect(sanitizeBizQuery('a'.repeat(100)).length).toBe(60);
  });
});

describe('parseBizSearchParams', () => {
  it('기본값 — status all · q 빈문자 · page 1', () => {
    expect(parseBizSearchParams({})).toEqual({ status: 'all', q: '', page: 1 });
  });

  it('유효 status/q/page 파싱', () => {
    expect(parseBizSearchParams({ status: 'pending', q: 'acme', page: '3' })).toEqual({
      status: 'pending',
      q: 'acme',
      page: 3,
    });
  });

  it('잘못된 status → 기본값으로 폴백', () => {
    const res = parseBizSearchParams({ status: 'bogus' });
    expect(res.status).toBe('all');
  });

  it('배열 searchParam → 첫 값 사용', () => {
    expect(parseBizSearchParams({ status: ['contacted', 'closed'] }).status).toBe('contacted');
  });

  it('page 범위 밖 → 기본값 폴백', () => {
    expect(parseBizSearchParams({ page: '0' }).page).toBe(1);
    expect(parseBizSearchParams({ page: 'abc' }).page).toBe(1);
  });
});
