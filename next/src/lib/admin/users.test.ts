/* ══════════════════════════════════════════════════════════════════════════
   users.test.ts — 어드민 사용자 목록 매핑·파싱 단위 테스트 (S169 PR-1)

   커버리지:
   - describeRole — DB enum → 라벨 + tone
   - sanitizeSearchQuery — 와일드카드/메타문자 strip + cap
   - parseSearchParams — 정상 / 부분 누락 / 잘못된 값 fallback
   - formatJoinedDate — UTC → KST 변환
   - resolveUserName — display_name → full_name → email local 우선순위
   ══════════════════════════════════════════════════════════════════════════ */

import { describe, expect, it } from 'vitest';
import {
  describeProvider,
  describeRole,
  formatJoinedDate,
  parseSearchParams,
  resolveUserName,
  sanitizeSearchQuery,
} from './users';

describe('describeRole', () => {
  it('admin → 운영자 / primary', () => {
    expect(describeRole('admin')).toEqual({ label: '운영자', tone: 'primary' });
  });
  it('customer → 고객 / neutral', () => {
    expect(describeRole('customer')).toEqual({ label: '고객', tone: 'neutral' });
  });
});

describe('sanitizeSearchQuery', () => {
  it('와일드카드 % _ strip', () => {
    expect(sanitizeSearchQuery('te%st_a')).toBe('testa');
  });
  it('메타문자 , ( ) * 제거', () => {
    expect(sanitizeSearchQuery('a,b(c)d*')).toBe('abcd');
  });
  it('따옴표·백슬래시 제거', () => {
    expect(sanitizeSearchQuery('"a"\\b')).toBe('ab');
  });
  it('양끝 공백 trim', () => {
    expect(sanitizeSearchQuery('  hello  ')).toBe('hello');
  });
  it('60자 cap', () => {
    const long = 'a'.repeat(80);
    expect(sanitizeSearchQuery(long).length).toBe(60);
  });
  it('한글 통과', () => {
    expect(sanitizeSearchQuery('홍길동')).toBe('홍길동');
  });
});

describe('parseSearchParams', () => {
  /* S232: provider 필드 추가 — 모든 fallback case 에서 'all' 기본값. */
  const DEFAULTS = { role: 'all', provider: 'all', q: '', page: 1 } as const;

  it('빈 객체 → 기본값', () => {
    expect(parseSearchParams({})).toEqual(DEFAULTS);
  });

  it('정상 값 통과', () => {
    expect(parseSearchParams({ role: 'admin', q: '홍길', page: '2' })).toEqual({
      ...DEFAULTS,
      role: 'admin',
      q: '홍길',
      page: 2,
    });
  });

  it('잘못된 role → 전체 기본값으로 fallback', () => {
    expect(parseSearchParams({ role: 'superuser' })).toEqual(DEFAULTS);
  });

  it('page 음수 → 기본값으로 fallback', () => {
    expect(parseSearchParams({ page: '-3' })).toEqual(DEFAULTS);
  });

  it('page 비정수 → 기본값으로 fallback', () => {
    expect(parseSearchParams({ page: 'abc' })).toEqual(DEFAULTS);
  });

  it('page 상한 초과 → 기본값으로 fallback', () => {
    expect(parseSearchParams({ page: '99999' })).toEqual(DEFAULTS);
  });

  it('배열 값 → 첫 요소만 사용', () => {
    expect(parseSearchParams({ role: ['customer', 'admin'] })).toMatchObject({
      role: 'customer',
    });
  });

  it('provider 정상 값 통과', () => {
    expect(parseSearchParams({ provider: 'kakao' })).toEqual({
      ...DEFAULTS,
      provider: 'kakao',
    });
  });

  it('잘못된 provider → 전체 기본값으로 fallback', () => {
    expect(parseSearchParams({ provider: 'apple' })).toEqual(DEFAULTS);
  });
});

describe('describeProvider', () => {
  it('email → 이메일', () => {
    expect(describeProvider('email')).toBe('이메일');
  });
  it('google → 구글', () => {
    expect(describeProvider('google')).toBe('구글');
  });
  it('kakao → 카카오', () => {
    expect(describeProvider('kakao')).toBe('카카오');
  });
  it('naver → 네이버', () => {
    expect(describeProvider('naver')).toBe('네이버');
  });
});

describe('formatJoinedDate', () => {
  it('UTC ISO → KST YYYY.MM.DD', () => {
    /* UTC 2026-05-06T15:00:00Z = KST 2026-05-07 00:00 */
    expect(formatJoinedDate('2026-05-06T15:00:00.000Z')).toBe('2026.05.07');
  });
  it('자정 직전 UTC → 다음날 KST', () => {
    /* UTC 2026-01-01T15:30:00Z = KST 2026-01-02 00:30 */
    expect(formatJoinedDate('2026-01-01T15:30:00.000Z')).toBe('2026.01.02');
  });
});

describe('resolveUserName', () => {
  it('display_name 우선', () => {
    expect(
      resolveUserName({
        email: 'a@b.com',
        fullName: '홍길동',
        displayName: '운영자',
      }),
    ).toBe('운영자');
  });

  it('display_name 비어있으면 full_name', () => {
    expect(
      resolveUserName({
        email: 'a@b.com',
        fullName: '홍길동',
        displayName: '   ',
      }),
    ).toBe('홍길동');
  });

  it('display_name·full_name 모두 비어있으면 email local-part', () => {
    expect(
      resolveUserName({
        email: 'alice@example.com',
        fullName: null,
        displayName: null,
      }),
    ).toBe('alice');
  });
});
