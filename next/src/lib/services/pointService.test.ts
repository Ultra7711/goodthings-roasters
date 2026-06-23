/* ══════════════════════════════════════════════════════════════════════════
   pointService.test.ts — 포인트 순수 로직 단위 테스트 (Phase 1)

   커버리지:
   - computeEarnAmount  — 적립률 계산·내림·OFF 게이트
   - computeTriggerEarn — 행동 트리거 적립·OFF 게이트
   - previewRedeem      — 한도(잔액·결제액·비율)·최소사용액·사유 코드

   순수 함수 — DB·mock 불필요. PointsSettingsSchema 로 정책 객체 구성.
   ══════════════════════════════════════════════════════════════════════════ */

import { describe, expect, it } from 'vitest';
import { PointsSettingsSchema, type PointsSettings } from '@/lib/siteSettings';
import {
  computeEarnAmount,
  computeEarnForItems,
  computeTriggerEarn,
  previewRedeem,
  resolveRedeem,
  type EarnLineItem,
} from './pointService';

/** 기본 정책 + 부분 override 헬퍼. enabled=true 로 켠 상태를 베이스로. */
function makePolicy(overrides: Record<string, unknown> = {}): PointsSettings {
  return PointsSettingsSchema.parse({ enabled: true, ...overrides });
}

describe('computeEarnAmount', () => {
  it('적립률을 적용해 원 단위 정수로 내림한다', () => {
    // Arrange
    const policy = makePolicy({ earn: { enabled: true, rate: 0.01 } });

    // Act
    const earned = computeEarnAmount(15_500, policy);

    // Assert — 15500 * 0.01 = 155
    expect(earned).toBe(155);
  });

  it('소수 발생 시 내림(floor) 한다', () => {
    const policy = makePolicy({ earn: { enabled: true, rate: 0.03 } });
    // 12345 * 0.03 = 370.35 → 370
    expect(computeEarnAmount(12_345, policy)).toBe(370);
  });

  it('마스터 OFF 면 0 을 반환한다', () => {
    const policy = makePolicy({ enabled: false, earn: { enabled: true, rate: 0.05 } });
    expect(computeEarnAmount(50_000, policy)).toBe(0);
  });

  it('적립(earn) OFF 면 0 을 반환한다', () => {
    const policy = makePolicy({ earn: { enabled: false, rate: 0.05 } });
    expect(computeEarnAmount(50_000, policy)).toBe(0);
  });

  it('소계가 0 이하면 0 을 반환한다', () => {
    const policy = makePolicy({ earn: { enabled: true, rate: 0.01 } });
    expect(computeEarnAmount(0, policy)).toBe(0);
    expect(computeEarnAmount(-100, policy)).toBe(0);
  });
});

describe('computeTriggerEarn', () => {
  it('해당 트리거가 켜져 있으면 설정 금액을 반환한다', () => {
    const policy = makePolicy({
      earn: {
        enabled: true,
        triggers: {
          signup: { enabled: true, amount: 2000 },
          review: { enabled: false, amount: 500 },
          birthday: { enabled: false, amount: 0 },
        },
      },
    });
    expect(computeTriggerEarn('signup', policy)).toBe(2000);
  });

  it('트리거가 꺼져 있으면 0 을 반환한다', () => {
    const policy = makePolicy({
      earn: {
        enabled: true,
        triggers: {
          signup: { enabled: false, amount: 2000 },
          review: { enabled: false, amount: 0 },
          birthday: { enabled: false, amount: 0 },
        },
      },
    });
    expect(computeTriggerEarn('signup', policy)).toBe(0);
  });

  it('마스터 OFF 면 트리거가 켜져 있어도 0', () => {
    const policy = makePolicy({
      enabled: false,
      earn: {
        enabled: true,
        triggers: {
          signup: { enabled: true, amount: 2000 },
          review: { enabled: false, amount: 0 },
          birthday: { enabled: false, amount: 0 },
        },
      },
    });
    expect(computeTriggerEarn('signup', policy)).toBe(0);
  });
});

describe('previewRedeem', () => {
  it('요청·잔액·결제액 내에서 사용 가능액을 산출한다', () => {
    const policy = makePolicy({ redeem: { enabled: true, min: 0, max_ratio: 1.0 } });
    // 요청 3000, 잔액 5000, 결제액 20000 → 3000 사용, 17000 결제
    const r = previewRedeem(3000, 5000, 20_000, policy);
    expect(r).toEqual({ usable: 3000, payable: 17_000, reason: null });
  });

  it('잔액을 초과 요청하면 잔액으로 캡한다', () => {
    const policy = makePolicy({ redeem: { enabled: true, min: 0, max_ratio: 1.0 } });
    const r = previewRedeem(9999, 5000, 20_000, policy);
    expect(r.usable).toBe(5000);
    expect(r.payable).toBe(15_000);
  });

  it('결제액을 초과 요청하면 결제액으로 캡한다', () => {
    const policy = makePolicy({ redeem: { enabled: true, min: 0, max_ratio: 1.0 } });
    // 잔액 50000 충분하나 결제액 8000 이 상한
    const r = previewRedeem(50_000, 50_000, 8000, policy);
    expect(r.usable).toBe(8000);
    expect(r.payable).toBe(0);
  });

  it('결제액 대비 최대 비율(max_ratio)로 한도를 제한한다', () => {
    const policy = makePolicy({ redeem: { enabled: true, min: 0, max_ratio: 0.5 } });
    // 결제액 20000 의 50% = 10000 상한
    const r = previewRedeem(50_000, 50_000, 20_000, policy);
    expect(r.usable).toBe(10_000);
    expect(r.payable).toBe(10_000);
  });

  it('사용 가능액이 최소 사용액 미만이면 below_min 사유로 0', () => {
    const policy = makePolicy({ redeem: { enabled: true, min: 1000, max_ratio: 1.0 } });
    const r = previewRedeem(500, 5000, 20_000, policy);
    expect(r).toEqual({ usable: 0, payable: 20_000, reason: 'below_min' });
  });

  it('잔액이 최소 사용액보다 작으면 below_min', () => {
    const policy = makePolicy({ redeem: { enabled: true, min: 1000, max_ratio: 1.0 } });
    // 요청은 충분하나 잔액 500 → cap 500 < min 1000
    const r = previewRedeem(5000, 500, 20_000, policy);
    expect(r.reason).toBe('below_min');
    expect(r.usable).toBe(0);
  });

  it('잔액이 0 이면 no_balance 사유', () => {
    const policy = makePolicy({ redeem: { enabled: true, min: 0 } });
    const r = previewRedeem(1000, 0, 20_000, policy);
    expect(r).toEqual({ usable: 0, payable: 20_000, reason: 'no_balance' });
  });

  it('마스터 OFF 면 disabled 사유', () => {
    const policy = makePolicy({ enabled: false });
    const r = previewRedeem(1000, 5000, 20_000, policy);
    expect(r).toEqual({ usable: 0, payable: 20_000, reason: 'disabled' });
  });

  it('사용(redeem) OFF 면 disabled 사유', () => {
    const policy = makePolicy({ redeem: { enabled: false } });
    const r = previewRedeem(1000, 5000, 20_000, policy);
    expect(r.reason).toBe('disabled');
  });

  it('음수·소수 요청은 floor·0 하한으로 정규화한다', () => {
    const policy = makePolicy({ redeem: { enabled: true, min: 0, max_ratio: 1.0 } });
    expect(previewRedeem(-500, 5000, 20_000, policy).usable).toBe(0);
    expect(previewRedeem(1500.9, 5000, 20_000, policy).usable).toBe(1500);
  });
});

/* ── resolveRedeem — 서버 재계산 경계(T1) ──────────────────────────────── */

describe('resolveRedeem (T1 서버 재계산 경계)', () => {
  const policy = (o: Record<string, unknown> = {}) =>
    PointsSettingsSchema.parse({ enabled: true, redeem: { enabled: true, min: 0, max_ratio: 1.0 }, ...o });

  it('게스트(비회원)는 요청·잔액과 무관하게 항상 0 (DEC-P6)', () => {
    // 잔액 9999·요청 9999 여도 게스트면 0
    const used = resolveRedeem({
      requested: 9999,
      balance: 9999,
      payableTotal: 50_000,
      policy: policy(),
      isMember: false,
    });
    expect(used).toBe(0);
  });

  it('클라가 잔액 초과 위조 요청해도 서버 잔액으로 캡한다 (T1 핵심)', () => {
    // 클라 requested=999_999 (위조) · 서버 실잔액 3000 → 3000 으로 캡
    const used = resolveRedeem({
      requested: 999_999,
      balance: 3000,
      payableTotal: 50_000,
      policy: policy(),
      isMember: true,
    });
    expect(used).toBe(3000);
  });

  it('결제액·max_ratio 한도로도 캡한다', () => {
    // 잔액 50000·요청 50000 이나 결제액 8000·ratio 0.5 → 4000 상한
    const used = resolveRedeem({
      requested: 50_000,
      balance: 50_000,
      payableTotal: 8000,
      policy: policy({ redeem: { enabled: true, min: 0, max_ratio: 0.5 } }),
      isMember: true,
    });
    expect(used).toBe(4000);
  });

  it('정책 마스터 OFF 면 회원이어도 0 (포인트 경로 완전 우회)', () => {
    const used = resolveRedeem({
      requested: 5000,
      balance: 5000,
      payableTotal: 50_000,
      policy: PointsSettingsSchema.parse({ enabled: false }),
      isMember: true,
    });
    expect(used).toBe(0);
  });

  it('최소 사용액 미만이면 0 (below_min)', () => {
    const used = resolveRedeem({
      requested: 500,
      balance: 5000,
      payableTotal: 50_000,
      policy: policy({ redeem: { enabled: true, min: 1000, max_ratio: 1.0 } }),
      isMember: true,
    });
    expect(used).toBe(0);
  });

  it('요청 0 이면 0', () => {
    const used = resolveRedeem({
      requested: 0,
      balance: 5000,
      payableTotal: 50_000,
      policy: policy(),
      isMember: true,
    });
    expect(used).toBe(0);
  });

  it('정상 회원 요청은 그대로 사용 확정', () => {
    const used = resolveRedeem({
      requested: 2500,
      balance: 5000,
      payableTotal: 50_000,
      policy: policy(),
      isMember: true,
    });
    expect(used).toBe(2500);
  });
});

/* ── computeEarnForItems — 정기배송 차등 적립률(DEC-S328) ──────────────── */

describe('computeEarnForItems', () => {
  const normal = (lineTotal: number): EarnLineItem => ({
    lineTotal,
    itemType: 'normal',
    subscriptionPeriod: null,
  });
  const sub = (lineTotal: number, period: string): EarnLineItem => ({
    lineTotal,
    itemType: 'subscription',
    subscriptionPeriod: period,
  });

  it('일반 품목은 earn.rate 를 품목별로 적용해 합산한다', () => {
    const policy = makePolicy({ earn: { enabled: true, rate: 0.01 } });
    // floor(10000*0.01)=100 + floor(15500*0.01)=155 = 255
    expect(computeEarnForItems([normal(10_000), normal(15_500)], policy)).toBe(255);
  });

  it('정기배송 품목은 cycle별 차등 적립률을 적용한다', () => {
    const policy = makePolicy({
      earn: {
        enabled: true,
        rate: 0.01,
        subscription_rates: { '2주': 0.05, '4주': 0.03, '6주': 0.02, '8주': 0.02 },
      },
    });
    // 2주: floor(20000*0.05)=1000 · 4주: floor(20000*0.03)=600
    expect(computeEarnForItems([sub(20_000, '2주'), sub(20_000, '4주')], policy)).toBe(1600);
  });

  it('혼합 주문 — 일반은 일반율, 정기는 차등율', () => {
    const policy = makePolicy({
      earn: {
        enabled: true,
        rate: 0.01,
        subscription_rates: { '2주': 0.05, '4주': 0.03, '6주': 0.02, '8주': 0.02 },
      },
    });
    // 일반 floor(10000*0.01)=100 + 정기2주 floor(20000*0.05)=1000 = 1100
    expect(computeEarnForItems([normal(10_000), sub(20_000, '2주')], policy)).toBe(1100);
  });

  it('알 수 없는 cycle 의 정기 품목은 일반율로 폴백한다', () => {
    const policy = makePolicy({ earn: { enabled: true, rate: 0.01 } });
    // period '12주'(미지원) → earn.rate(0.01) 적용: floor(20000*0.01)=200
    expect(computeEarnForItems([sub(20_000, '12주')], policy)).toBe(200);
  });

  it('마스터/적립 OFF 면 0', () => {
    const off = makePolicy({ enabled: false });
    expect(computeEarnForItems([normal(50_000), sub(50_000, '2주')], off)).toBe(0);
    const earnOff = makePolicy({ earn: { enabled: false, rate: 0.05 } });
    expect(computeEarnForItems([normal(50_000)], earnOff)).toBe(0);
  });

  it('line_total 이 0 이하인 품목은 건너뛴다', () => {
    const policy = makePolicy({ earn: { enabled: true, rate: 0.01 } });
    expect(computeEarnForItems([normal(0), normal(-100), normal(10_000)], policy)).toBe(100);
  });

  it('빈 품목 배열은 0', () => {
    const policy = makePolicy({ earn: { enabled: true, rate: 0.01 } });
    expect(computeEarnForItems([], policy)).toBe(0);
  });
});
