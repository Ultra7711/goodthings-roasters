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
  computeTriggerEarn,
  previewRedeem,
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
