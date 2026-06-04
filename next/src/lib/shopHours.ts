/* ══════════════════════════════════════════
   shopHours — 매장 영업시간 및 현재 상태 계산
   - 타임존: Asia/Seoul 고정 (사용자 로컬 TZ 무관)
   - 영업 규칙(요일별 + 비정기 휴무)은 site_settings.hours(HoursSettings)에서 주입.
     호출자(useShopStatus)가 useSiteSettings().hours 를 넘긴다.
   - 24시간 포맷 (00:00 ~ 23:59)
   ══════════════════════════════════════════ */

import type { HoursSettings, DayHours } from '@/lib/siteSettings';

type DaySchedule = { open: [number, number]; close: [number, number] };

export const WEEKDAY_KR = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 'HH:MM' → [h, m] */
function parseHM(s: string): [number, number] {
  return [Number(s.slice(0, 2)), Number(s.slice(3, 5))];
}

function toDaySchedule(d: DayHours): DaySchedule | null {
  if (!d) return null;
  return { open: parseHM(d.open), close: parseHM(d.close) };
}

type KSTParts = {
  year: number;
  month: number;
  day: number;
  weekday: number; // 0=일, 6=토
  hour: number;
  minute: number;
};

/**
 * 주어진 Date를 Asia/Seoul 타임존 기준으로 분해한다.
 * weekday는 로케일 의존성을 피하기 위해 UTC 기준 재계산 방식을 사용.
 */
function getKSTParts(date: Date): KSTParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '';

  const year = parseInt(get('year'), 10);
  const month = parseInt(get('month'), 10);
  const day = parseInt(get('day'), 10);

  // UTC 자정 기준으로 Date를 만들면 getUTCDay()가 해당 달력일의 요일과 일치
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  return {
    year,
    month,
    day,
    weekday,
    hour: parseInt(get('hour'), 10),
    minute: parseInt(get('minute'), 10),
  };
}

function formatDateKey(p: { year: number; month: number; day: number }): string {
  const m = String(p.month).padStart(2, '0');
  const d = String(p.day).padStart(2, '0');
  return `${p.year}-${m}-${d}`;
}

function formatTime(h: number, m: number): string {
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** 해당 날짜의 영업 스케줄 — 비정기 휴무면 null, 정기 휴무면 null. */
function getScheduleForDate(
  weekday: number,
  dateKey: string,
  hours: HoursSettings,
): DaySchedule | null {
  if (hours.closures.some((c) => c.date === dateKey)) return null;
  const key = String(weekday) as keyof HoursSettings['weekly'];
  return toDaySchedule(hours.weekly[key]);
}

type NextOpen = {
  dayDiff: number; // 1=내일, 2=모레, ...
  weekday: number;
  schedule: DaySchedule;
};

/**
 * 오늘 이후로 첫 번째 영업일을 찾아 반환한다.
 * 최대 14일까지 탐색 (장기 휴무 방어).
 */
function findNextOpen(fromKst: KSTParts, hours: HoursSettings): NextOpen | null {
  // KST 달력 기준 자정의 UTC 타임스탬프
  const baseUtcMs =
    Date.UTC(fromKst.year, fromKst.month - 1, fromKst.day) - 9 * 3600 * 1000;
  for (let i = 1; i <= 14; i++) {
    const t = getKSTParts(new Date(baseUtcMs + i * 24 * 3600 * 1000));
    const schedule = getScheduleForDate(t.weekday, formatDateKey(t), hours);
    if (schedule) {
      return { dayDiff: i, weekday: t.weekday, schedule };
    }
  }
  return null;
}

/** 다음 영업일 짧은 표기 — "내일 12:00" / "토요일 11:00" (dayDiff 1=내일, 그 외 요일명). */
function formatNextOpenShort(next: NextOpen): string {
  const time = formatTime(next.schedule.open[0], next.schedule.open[1]);
  const dayLabel = next.dayDiff === 1 ? '내일' : `${WEEKDAY_KR[next.weekday]}요일`;
  return `${dayLabel} ${time}`;
}

export type ShopStatus =
  | { kind: 'before-open'; label: string }
  | { kind: 'open'; label: string }
  | { kind: 'after-close'; label: string }
  | { kind: 'closed'; label: string };

/**
 * 매장의 현재 상태를 계산한다 (카카오/네이버 지도 영업상태 톤).
 *
 * 상태 분기:
 * - 영업 전:                      `영업 전 · 오늘 12:00 오픈`
 * - 영업 중:                      `영업 중 · 21:00 마감`
 * - 영업 종료 후 (내일 영업일):     `영업 마감 · 내일 12:00 오픈`
 * - 영업 종료 후 (내일 휴무):       `영업 마감 · 화요일 12:00 오픈`
 * - 휴무일 (내일 영업):             `휴무 · 내일 12:00 오픈`
 * - 휴무일 (내일도 휴무):           `휴무 · 수요일 12:00 오픈`
 */
export function getShopStatus(now: Date, hours: HoursSettings): ShopStatus {
  const kst = getKSTParts(now);
  const todayKey = formatDateKey(kst);
  const todaySchedule = getScheduleForDate(kst.weekday, todayKey, hours);
  const next = findNextOpen(kst, hours);
  const nextShort = next ? formatNextOpenShort(next) : '';

  // 오늘이 휴무일 (정기/비정기)
  if (!todaySchedule) {
    return {
      kind: 'closed',
      label: nextShort ? `휴무 · ${nextShort} 오픈` : '휴무',
    };
  }

  const nowMin = kst.hour * 60 + kst.minute;
  const openMin = todaySchedule.open[0] * 60 + todaySchedule.open[1];
  const closeMin = todaySchedule.close[0] * 60 + todaySchedule.close[1];

  // 영업 전 (오늘 오픈 예정)
  if (nowMin < openMin) {
    return {
      kind: 'before-open',
      label: `영업 전 · 오늘 ${formatTime(todaySchedule.open[0], todaySchedule.open[1])} 오픈`,
    };
  }

  // 영업 종료 후
  if (nowMin >= closeMin) {
    return {
      kind: 'after-close',
      label: nextShort ? `영업 마감 · ${nextShort} 오픈` : '영업 종료',
    };
  }

  // 영업 중
  return {
    kind: 'open',
    label: `영업 중 · ${formatTime(todaySchedule.close[0], todaySchedule.close[1])} 마감`,
  };
}

/* ── 주간 시간표 (오늘부터 7일) ─────────────────────────────────────────── */

export type DayScheduleView = {
  dateKey: string;       // 'YYYY-MM-DD'
  month: number;
  day: number;
  weekdayLabel: string;  // '월'
  isToday: boolean;
  closed: boolean;
  /** 영업일: '12:00 ~ 21:00' · 휴무일: '휴무' */
  timeLabel: string;
  /** 비정기 휴무 사유 (정기 휴무·영업일은 undefined) */
  reason?: string;
};

/**
 * 오늘(KST)부터 7일간의 영업/휴무 시간표.
 * Location 아코디언 펼침 영역에서 사용. 비정기 휴무는 사유 포함.
 */
export function getWeekSchedule(now: Date, hours: HoursSettings): DayScheduleView[] {
  const kst = getKSTParts(now);
  const baseUtcMs =
    Date.UTC(kst.year, kst.month - 1, kst.day) - 9 * 3600 * 1000;

  const out: DayScheduleView[] = [];
  for (let i = 0; i < 7; i++) {
    const t = getKSTParts(new Date(baseUtcMs + i * 24 * 3600 * 1000));
    const dateKey = formatDateKey(t);
    const closure = hours.closures.find((c) => c.date === dateKey);
    const schedule = getScheduleForDate(t.weekday, dateKey, hours);
    out.push({
      dateKey,
      month: t.month,
      day: t.day,
      weekdayLabel: WEEKDAY_KR[t.weekday],
      isToday: i === 0,
      closed: !schedule,
      timeLabel: schedule
        ? `${formatTime(schedule.open[0], schedule.open[1])} ~ ${formatTime(schedule.close[0], schedule.close[1])}`
        : '휴무',
      reason: closure?.reason || undefined,
    });
  }
  return out;
}
