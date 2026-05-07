/* ══════════════════════════════════════════════════════════════════════════
   cycles.test.ts — recalculateNextDeliveryOnCycleChange 단위 테스트

   대상: recalculateNextDeliveryOnCycleChange (서버 PATCH + 클라이언트 미리보기 SoT)
   ══════════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import { recalculateNextDeliveryOnCycleChange, CYCLE_DAYS } from './cycles';

describe('recalculateNextDeliveryOnCycleChange', () => {
  it('기준 시나리오 — 8주 → 2주 (사용자 보고 케이스)', () => {
    /* 2026.11.28(8주) → 2주: lastDelivery=2026.10.03 + 14일 = 2026.10.17 */
    const result = recalculateNextDeliveryOnCycleChange(
      new Date(2026, 10, 28),
      '8주',
      '2주',
    );
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(9); // 10월 (0-indexed)
    expect(result.getDate()).toBe(17);
  });

  it('주기 단축 — 4주 → 2주 (월 경계 역행)', () => {
    /* 2026.05.14(4주) → 2주: lastDelivery=2026.04.16 + 14일 = 2026.04.30 */
    const result = recalculateNextDeliveryOnCycleChange(
      new Date(2026, 4, 14),
      '4주',
      '2주',
    );
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(3); // 4월
    expect(result.getDate()).toBe(30);
  });

  it('주기 연장 — 2주 → 4주 (월 경계 진행)', () => {
    /* 2026.05.14(2주) → 4주: lastDelivery=2026.04.30 + 28일 = 2026.05.28 */
    const result = recalculateNextDeliveryOnCycleChange(
      new Date(2026, 4, 14),
      '2주',
      '4주',
    );
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(4); // 5월
    expect(result.getDate()).toBe(28);
  });

  it('동일 주기 — 변경 없음', () => {
    const original = new Date(2026, 4, 14);
    const result = recalculateNextDeliveryOnCycleChange(original, '4주', '4주');
    expect(result.getTime()).toBe(original.getTime());
    /* 새 Date 객체 반환 (mutation 방지) */
    expect(result).not.toBe(original);
  });

  it('연 경계 — 2026.01.10(8주) → 2주', () => {
    /* lastDelivery=2025.11.15 + 14일 = 2025.11.29 */
    const result = recalculateNextDeliveryOnCycleChange(
      new Date(2026, 0, 10),
      '8주',
      '2주',
    );
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(10); // 11월
    expect(result.getDate()).toBe(29);
  });

  it('CYCLE_DAYS 매핑 일관성 — diff = newDays - oldDays 확인', () => {
    const base = new Date(2026, 4, 14);
    const result = recalculateNextDeliveryOnCycleChange(base, '6주', '8주');
    const diff = (result.getTime() - base.getTime()) / (24 * 60 * 60 * 1000);
    expect(diff).toBe(CYCLE_DAYS['8주'] - CYCLE_DAYS['6주']);
  });
});
