/* ══════════════════════════════════════════════════════════════════════════
   orders.test.ts — 어드민 주문 목록 매핑·파싱 단위 테스트 (S128 Group B)

   커버리지:
   - describeStatus / describePayment — DB enum → 시안 라벨
   - summarizeItems — 다양한 케이스 (빈 / volume 없음 / 수량 1 vs N)
   - sanitizeSearchQuery — 와일드카드/메타문자 strip + cap
   - parseSearchParams — 정상 / 부분 누락 / 잘못된 값 fallback
   - periodToSinceIso — 7d/30d/90d/all
   - formatKstDateTime — UTC → KST 변환
   ══════════════════════════════════════════════════════════════════════════ */

import { describe, expect, it } from 'vitest';
import {
  describePayment,
  describeShippingMessage,
  describeStatus,
  formatJoinedAt,
  formatKstDateTime,
  formatKstDateTimeWithSeconds,
  formatKstFullDate,
  parseSearchParams,
  periodToSinceIso,
  sanitizeSearchQuery,
  summarizeItems,
  CANCELLED_GROUP,
} from './orders';

describe('describeStatus', () => {
  it('paid → 신규 / primary', () => {
    expect(describeStatus('paid')).toEqual({ label: '신규', tone: 'primary' });
  });
  it('shipping → 배송중 / info', () => {
    expect(describeStatus('shipping')).toEqual({ label: '배송중', tone: 'info' });
  });
  it('delivered → 완료 / success', () => {
    expect(describeStatus('delivered')).toEqual({ label: '완료', tone: 'success' });
  });
  it('cancelled → 취소 / neutral', () => {
    expect(describeStatus('cancelled')).toEqual({ label: '취소', tone: 'neutral' });
  });
  it('환불 3종 → neutral 묶음', () => {
    expect(describeStatus('refund_requested').tone).toBe('neutral');
    expect(describeStatus('refund_processing').tone).toBe('neutral');
    expect(describeStatus('refunded').tone).toBe('neutral');
  });
  it('CANCELLED_GROUP 에 환불 3종 + cancelled 포함', () => {
    expect(CANCELLED_GROUP).toEqual([
      'cancelled',
      'refund_requested',
      'refund_processing',
      'refunded',
    ]);
  });
});

describe('describePayment', () => {
  it('card → 카드', () => {
    expect(describePayment('card')).toBe('카드');
  });
  it('transfer → 계좌이체', () => {
    expect(describePayment('transfer')).toBe('계좌이체');
  });
});

describe('summarizeItems', () => {
  it('빈 배열 → 빈 문자열', () => {
    expect(summarizeItems([])).toBe('');
  });
  it('단일 아이템 + volume', () => {
    expect(
      summarizeItems([
        { product_name: '에티오피아 예가체프', product_volume: '200g', quantity: 1 },
      ]),
    ).toBe('에티오피아 예가체프 200g');
  });
  it('수량 > 1 일 때 × 표시', () => {
    expect(
      summarizeItems([
        { product_name: '콜롬비아', product_volume: '200g', quantity: 2 },
      ]),
    ).toBe('콜롬비아 200g × 2');
  });
  it('volume 없으면 상품명만', () => {
    expect(
      summarizeItems([{ product_name: '드립백 12개입', product_volume: null, quantity: 1 }]),
    ).toBe('드립백 12개입');
  });
  it('복수 아이템 ` · ` 로 join', () => {
    expect(
      summarizeItems([
        { product_name: '에티오피아', product_volume: '200g', quantity: 1 },
        { product_name: '콜롬비아', product_volume: '200g', quantity: 2 },
      ]),
    ).toBe('에티오피아 200g · 콜롬비아 200g × 2');
  });
});

describe('sanitizeSearchQuery', () => {
  it('와일드카드 strip — % _', () => {
    expect(sanitizeSearchQuery('GT%_2026')).toBe('GT2026');
  });
  it('메타문자 strip — , ( ) *', () => {
    expect(sanitizeSearchQuery('foo,(bar)*')).toBe('foobar');
  });
  it('따옴표·백슬래시 strip', () => {
    expect(sanitizeSearchQuery(`abc"\\def`)).toBe('abcdef');
  });
  it('양끝 trim', () => {
    expect(sanitizeSearchQuery('  hello  ')).toBe('hello');
  });
  it('60자 cap', () => {
    expect(sanitizeSearchQuery('a'.repeat(100)).length).toBe(60);
  });
  it('한글 허용', () => {
    expect(sanitizeSearchQuery('김민지')).toBe('김민지');
  });
  it('이메일 형식 허용', () => {
    expect(sanitizeSearchQuery('user@example.com')).toBe('user@example.com');
  });
});

describe('parseSearchParams', () => {
  it('빈 입력 → 모두 기본값', () => {
    expect(parseSearchParams({})).toEqual({
      status: 'all',
      period: 'all',
      payment: 'all',
      q: '',
      page: 1,
    });
  });
  it('정상 입력', () => {
    expect(
      parseSearchParams({
        status: 'shipping',
        period: '30d',
        payment: 'card',
        q: 'GT-',
        page: '3',
      }),
    ).toEqual({
      status: 'shipping',
      period: '30d',
      payment: 'card',
      q: 'GT-',
      page: 3,
    });
  });
  it('잘못된 status → 전체 기본값 fallback (UX 우선)', () => {
    /* z.enum 가 거부 → SafeParse 실패 → 전체 기본값 */
    expect(parseSearchParams({ status: 'unknown' }).status).toBe('all');
  });
  it('page 음수 → 1 fallback', () => {
    expect(parseSearchParams({ page: '-5' }).page).toBe(1);
  });
  it('page 비숫자 → 1 fallback', () => {
    expect(parseSearchParams({ page: 'abc' }).page).toBe(1);
  });
  it('배열 입력 — 첫 값만 사용', () => {
    expect(parseSearchParams({ status: ['shipping', 'delivered'] }).status).toBe('shipping');
  });
});

describe('periodToSinceIso', () => {
  const NOW = new Date('2026-05-02T00:00:00.000Z');

  it("'all' → null", () => {
    expect(periodToSinceIso('all', NOW)).toBeNull();
  });
  it("'7d' → 7일 전 ISO", () => {
    expect(periodToSinceIso('7d', NOW)).toBe('2026-04-25T00:00:00.000Z');
  });
  it("'30d' → 30일 전 ISO", () => {
    expect(periodToSinceIso('30d', NOW)).toBe('2026-04-02T00:00:00.000Z');
  });
  it("'90d' → 90일 전 ISO", () => {
    expect(periodToSinceIso('90d', NOW)).toBe('2026-02-01T00:00:00.000Z');
  });
});

describe('formatKstDateTime', () => {
  it('UTC ISO → KST YYYY.MM.DD HH:mm', () => {
    /* 2026-05-02T05:23:00Z → KST 14:23 (UTC+9) */
    expect(formatKstDateTime('2026-05-02T05:23:00.000Z')).toBe('2026.05.02 14:23');
  });
  it('자정 경계 — UTC 15:00 → KST 다음날 00:00', () => {
    expect(formatKstDateTime('2026-05-01T15:00:00.000Z')).toBe('2026.05.02 00:00');
  });
});

describe('formatKstDateTimeWithSeconds', () => {
  it('UTC ISO → KST YYYY.MM.DD HH:mm:ss', () => {
    expect(formatKstDateTimeWithSeconds('2026-05-02T05:23:48.000Z')).toBe(
      '2026.05.02 14:23:48',
    );
  });
});

describe('formatKstFullDate', () => {
  it('UTC ISO → "YYYY년 M월 D일 (요일) HH:mm"', () => {
    /* 2026-05-02 = 토요일 */
    expect(formatKstFullDate('2026-05-02T05:23:00.000Z')).toBe(
      '2026년 5월 2일 (토) 14:23',
    );
  });
});

describe('formatJoinedAt', () => {
  it('UTC ISO → "YYYY년 M월" (zero-pad 없음)', () => {
    expect(formatJoinedAt('2024-03-12T00:00:00.000Z')).toBe('2024년 3월');
  });
  it('자정 경계 — UTC 15:00 → KST 다음달 가능성', () => {
    /* 2024-02-29T15:00:00Z = KST 2024-03-01 → '2024년 3월' */
    expect(formatJoinedAt('2024-02-29T15:00:00.000Z')).toBe('2024년 3월');
  });
});

describe('describeShippingMessage', () => {
  it('custom 우선', () => {
    expect(describeShippingMessage(null, '집 앞에 두세요')).toEqual({
      text: '집 앞에 두세요',
      presetCode: null,
    });
  });
  it('code → 라벨 lookup + presetCode 보존', () => {
    expect(describeShippingMessage('경비실', null)).toEqual({
      text: '부재 시 경비실에 맡겨 주세요.',
      presetCode: '경비실',
    });
  });
  it('알 수 없는 code → 코드 자체 표시', () => {
    expect(describeShippingMessage('UNKNOWN', null)).toEqual({
      text: 'UNKNOWN',
      presetCode: 'UNKNOWN',
    });
  });
  it('둘 다 null → null', () => {
    expect(describeShippingMessage(null, null)).toBeNull();
  });
  it('둘 다 빈 문자열 → null', () => {
    expect(describeShippingMessage('', '')).toBeNull();
  });
});
