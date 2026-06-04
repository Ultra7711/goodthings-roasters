/* ══════════════════════════════════════════
   shopHours.test.ts — 영업 상태 문구 + 7일 시간표 (KST 고정)

   기준일: 2026-06-09 = 화요일 (WEEKLY_SCHEDULE 화 = 12:00~21:00, 월 = 휴무)
   KST = UTC+9 → UTC 06:00 = KST 15:00
   ══════════════════════════════════════════ */

import { describe, expect, it } from 'vitest';
import { getShopStatus, getWeekSchedule } from './shopHours';
import { HOURS_DEFAULTS } from './siteSettings';

/** KST 시각으로 Date 생성 (UTC = KST - 9h) */
function kst(y: number, mo: number, d: number, h: number, mi = 0): Date {
  return new Date(Date.UTC(y, mo - 1, d, h - 9, mi));
}

const H = HOURS_DEFAULTS;

describe('getShopStatus', () => {
  it('영업 중 — 화 15:00 → "영업 중 · 21:00 마감"', () => {
    const s = getShopStatus(kst(2026, 6, 9, 15), H);
    expect(s.kind).toBe('open');
    expect(s.label).toBe('영업 중 · 21:00 마감');
  });

  it('영업 전 — 화 10:00 → "영업 전 · 오늘 12:00 오픈"', () => {
    const s = getShopStatus(kst(2026, 6, 9, 10), H);
    expect(s.kind).toBe('before-open');
    expect(s.label).toBe('영업 전 · 오늘 12:00 오픈');
  });

  it('영업 마감, 내일 영업 — 화 22:00 → "영업 마감 · 내일 12:00 오픈"', () => {
    const s = getShopStatus(kst(2026, 6, 9, 22), H);
    expect(s.kind).toBe('after-close');
    expect(s.label).toBe('영업 마감 · 내일 12:00 오픈');
  });

  it('영업 마감, 내일 휴무 — 일 22:00 → "영업 마감 · 화요일 12:00 오픈"', () => {
    // 2026-06-07 = 일요일 (다음날 월=휴무 → 다음 영업일 화)
    const s = getShopStatus(kst(2026, 6, 7, 22), H);
    expect(s.kind).toBe('after-close');
    expect(s.label).toBe('영업 마감 · 화요일 12:00 오픈');
  });

  it('오늘 휴무, 내일 영업 — 월 14:00 → "휴무 · 내일 12:00 오픈"', () => {
    // 2026-06-08 = 월요일 (정기 휴무)
    const s = getShopStatus(kst(2026, 6, 8, 14), H);
    expect(s.kind).toBe('closed');
    expect(s.label).toBe('휴무 · 내일 12:00 오픈');
  });
});

describe('getWeekSchedule', () => {
  it('오늘부터 7일 — 화 기준 [0]=오늘 영업, 월(6/15)=휴무', () => {
    const week = getWeekSchedule(kst(2026, 6, 9, 15), H);
    expect(week).toHaveLength(7);

    // [0] = 오늘(화 6/9)
    expect(week[0].isToday).toBe(true);
    expect(week[0].closed).toBe(false);
    expect(week[0].weekdayLabel).toBe('화');
    expect(week[0].timeLabel).toBe('12:00 ~ 21:00');

    // [6] = 6/15 월요일 = 휴무
    expect(week[6].dateKey).toBe('2026-06-15');
    expect(week[6].weekdayLabel).toBe('월');
    expect(week[6].closed).toBe(true);
    expect(week[6].timeLabel).toBe('휴무');

    // 나머지는 isToday=false
    expect(week.slice(1).every((d) => !d.isToday)).toBe(true);
  });
});
