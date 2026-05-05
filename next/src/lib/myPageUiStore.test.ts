/* ══════════════════════════════════════════════════════════════════════════
   myPageUiStore.test.ts — 11 state setter + toggleOrder + resetMyPageUi

   대상: action 함수 동작, no-op 최적화, toggleOrder, reset
   비대상: React hook (useSyncExternalStore) — DOM 환경 불필요
   ══════════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSnapshot,
  setAddrOpen,
  setPwOpen,
  setSubEditId,
  setSubCycleEdit,
  setCycleDropdownOpen,
  toggleCycleDropdownOpen,
  setWithdrawOpen,
  setSkipConfirmSubId,
  setCancelConfirmSubId,
  setPauseConfirmSubId,
  toggleOrder,
  resetMyPageUi,
} from '@/lib/myPageUiStore';

beforeEach(() => {
  resetMyPageUi();
});

/* ── 초기 상태 ──────────────────────────────────────────────────────────── */

describe('초기 상태', () => {
  it('모든 boolean flag 는 false', () => {
    const s = getSnapshot();
    expect(s.isAddrOpen).toBe(false);
    expect(s.isPwOpen).toBe(false);
    expect(s.isCycleDropdownOpen).toBe(false);
    expect(s.isWithdrawOpen).toBe(false);
  });

  it('모든 nullable ID 는 null', () => {
    const s = getSnapshot();
    expect(s.subEditId).toBeNull();
    expect(s.subCycleEdit).toBeNull();
    expect(s.skipConfirmSubId).toBeNull();
    expect(s.cancelConfirmSubId).toBeNull();
    expect(s.pauseConfirmSubId).toBeNull();
  });

  it('openOrders 는 빈 Set', () => {
    expect(getSnapshot().openOrders.size).toBe(0);
  });
});

/* ── boolean flag setters ───────────────────────────────────────────────── */

describe('setAddrOpen', () => {
  it('true 설정', () => {
    setAddrOpen(true);
    expect(getSnapshot().isAddrOpen).toBe(true);
  });

  it('false 복귀', () => {
    setAddrOpen(true);
    setAddrOpen(false);
    expect(getSnapshot().isAddrOpen).toBe(false);
  });

  it('같은 값 재설정 시 state 참조 불변 (no-op 최적화)', () => {
    const before = getSnapshot();
    setAddrOpen(false);
    expect(getSnapshot()).toBe(before);
  });
});

describe('setPwOpen', () => {
  it('true 설정', () => {
    setPwOpen(true);
    expect(getSnapshot().isPwOpen).toBe(true);
  });

  it('같은 값 재설정 — no-op', () => {
    const before = getSnapshot();
    setPwOpen(false);
    expect(getSnapshot()).toBe(before);
  });
});

describe('setCycleDropdownOpen', () => {
  it('true 설정', () => {
    setCycleDropdownOpen(true);
    expect(getSnapshot().isCycleDropdownOpen).toBe(true);
  });

  it('같은 값 재설정 — no-op', () => {
    const before = getSnapshot();
    setCycleDropdownOpen(false);
    expect(getSnapshot()).toBe(before);
  });
});

describe('setWithdrawOpen', () => {
  it('true 설정', () => {
    setWithdrawOpen(true);
    expect(getSnapshot().isWithdrawOpen).toBe(true);
  });
});

/* ── nullable ID setters ─────────────────────────────────────────────────── */

describe('setSubEditId', () => {
  it('ID 설정', () => {
    setSubEditId('sub-abc');
    expect(getSnapshot().subEditId).toBe('sub-abc');
  });

  it('null 복귀', () => {
    setSubEditId('sub-abc');
    setSubEditId(null);
    expect(getSnapshot().subEditId).toBeNull();
  });

  it('같은 ID 재설정 — no-op', () => {
    setSubEditId(null);
    const before = getSnapshot();
    setSubEditId(null);
    expect(getSnapshot()).toBe(before);
  });
});

describe('setSubCycleEdit', () => {
  it('cycle 설정', () => {
    setSubCycleEdit('4주');
    expect(getSnapshot().subCycleEdit).toBe('4주');
  });

  it('null 복귀', () => {
    setSubCycleEdit('4주');
    setSubCycleEdit(null);
    expect(getSnapshot().subCycleEdit).toBeNull();
  });
});

describe('setSkipConfirmSubId', () => {
  it('ID 설정', () => {
    setSkipConfirmSubId('sub-1');
    expect(getSnapshot().skipConfirmSubId).toBe('sub-1');
  });

  it('null 복귀', () => {
    setSkipConfirmSubId('sub-1');
    setSkipConfirmSubId(null);
    expect(getSnapshot().skipConfirmSubId).toBeNull();
  });
});

describe('setCancelConfirmSubId', () => {
  it('ID 설정', () => {
    setCancelConfirmSubId('sub-2');
    expect(getSnapshot().cancelConfirmSubId).toBe('sub-2');
  });
});

describe('setPauseConfirmSubId', () => {
  it('ID 설정', () => {
    setPauseConfirmSubId('sub-3');
    expect(getSnapshot().pauseConfirmSubId).toBe('sub-3');
  });
});

/* ── toggleCycleDropdownOpen ─────────────────────────────────────────────── */

describe('toggleCycleDropdownOpen', () => {
  it('false → true', () => {
    toggleCycleDropdownOpen();
    expect(getSnapshot().isCycleDropdownOpen).toBe(true);
  });

  it('true → false', () => {
    setCycleDropdownOpen(true);
    toggleCycleDropdownOpen();
    expect(getSnapshot().isCycleDropdownOpen).toBe(false);
  });

  it('2회 토글 → 원복', () => {
    toggleCycleDropdownOpen();
    toggleCycleDropdownOpen();
    expect(getSnapshot().isCycleDropdownOpen).toBe(false);
  });
});

/* ── toggleOrder ─────────────────────────────────────────────────────────── */

describe('toggleOrder', () => {
  it('새 주문번호 추가', () => {
    toggleOrder('ORD-001');
    expect(getSnapshot().openOrders.has('ORD-001')).toBe(true);
  });

  it('기존 번호 토글 → 제거', () => {
    toggleOrder('ORD-001');
    toggleOrder('ORD-001');
    expect(getSnapshot().openOrders.has('ORD-001')).toBe(false);
  });

  it('여러 주문 독립 관리', () => {
    toggleOrder('ORD-A');
    toggleOrder('ORD-B');
    const s = getSnapshot();
    expect(s.openOrders.has('ORD-A')).toBe(true);
    expect(s.openOrders.has('ORD-B')).toBe(true);
  });

  it('일부만 닫아도 나머지 유지', () => {
    toggleOrder('ORD-A');
    toggleOrder('ORD-B');
    toggleOrder('ORD-A');
    const s = getSnapshot();
    expect(s.openOrders.has('ORD-A')).toBe(false);
    expect(s.openOrders.has('ORD-B')).toBe(true);
  });
});

/* ── resetMyPageUi ───────────────────────────────────────────────────────── */

describe('resetMyPageUi', () => {
  it('모든 state 를 초기값으로 복원', () => {
    setAddrOpen(true);
    setPwOpen(true);
    setSubEditId('sub-1');
    setSubCycleEdit('2주');
    setCycleDropdownOpen(true);
    setWithdrawOpen(true);
    setSkipConfirmSubId('sub-2');
    setCancelConfirmSubId('sub-3');
    setPauseConfirmSubId('sub-4');
    toggleOrder('ORD-001');
    toggleOrder('ORD-002');

    resetMyPageUi();

    const s = getSnapshot();
    expect(s.isAddrOpen).toBe(false);
    expect(s.isPwOpen).toBe(false);
    expect(s.subEditId).toBeNull();
    expect(s.subCycleEdit).toBeNull();
    expect(s.isCycleDropdownOpen).toBe(false);
    expect(s.isWithdrawOpen).toBe(false);
    expect(s.skipConfirmSubId).toBeNull();
    expect(s.cancelConfirmSubId).toBeNull();
    expect(s.pauseConfirmSubId).toBeNull();
    expect(s.openOrders.size).toBe(0);
  });

  it('reset 후 setter 재사용 가능', () => {
    setAddrOpen(true);
    resetMyPageUi();
    setAddrOpen(true);
    expect(getSnapshot().isAddrOpen).toBe(true);
  });
});

/* ── 독립성: 여러 state 동시 변경 ──────────────────────────────────────── */

describe('state 독립성', () => {
  it('setAddrOpen 은 isPwOpen 에 영향 없음', () => {
    setPwOpen(true);
    setAddrOpen(true);
    expect(getSnapshot().isPwOpen).toBe(true);
  });

  it('setSubEditId 는 subCycleEdit 에 영향 없음', () => {
    setSubCycleEdit('4주');
    setSubEditId('sub-x');
    expect(getSnapshot().subCycleEdit).toBe('4주');
  });
});
