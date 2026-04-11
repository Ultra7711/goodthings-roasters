/* ══════════════════════════════════════════
   shopHours — 매장 영업시간 및 현재 상태 계산
   - 타임존: Asia/Seoul 고정 (사용자 로컬 TZ 무관)
   - 주간 스케줄 + 비정기 휴무 조합으로 상태 도출
   - 24시간 포맷 (00:00 ~ 23:59)
   ══════════════════════════════════════════ */

type DaySchedule = { open: [number, number]; close: [number, number] };

// key: 0=일, 1=월, ..., 6=토
// null = 해당 요일 정기 휴무
export const WEEKLY_SCHEDULE: Record<number, DaySchedule | null> = {
  0: { open: [11, 0], close: [21, 0] }, // 일
  1: null, // 월 휴무
  2: { open: [12, 0], close: [21, 0] }, // 화
  3: { open: [12, 0], close: [21, 0] }, // 수
  4: { open: [12, 0], close: [21, 0] }, // 목
  5: { open: [12, 0], close: [21, 0] }, // 금
  6: { open: [11, 0], close: [21, 0] }, // 토
};

// 비정기 휴무 (KST 기준 YYYY-MM-DD)
// TODO: Next.js + Supabase 이관 시 DB 테이블로 이관
export type IrregularClosure = {
  date: string; // 'YYYY-MM-DD'
  reason?: string; // 메인 표기에는 미사용. Location 페이지에서 활용 예정
};

export const IRREGULAR_CLOSURES: IrregularClosure[] = [
  // 예시: { date: '2026-04-20', reason: '직원 연수' },
];

const WEEKDAY_KR = ['일', '월', '화', '수', '목', '금', '토'] as const;

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

function getScheduleForDate(
  weekday: number,
  dateKey: string
): DaySchedule | null {
  if (IRREGULAR_CLOSURES.some((c) => c.date === dateKey)) return null;
  return WEEKLY_SCHEDULE[weekday];
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
function findNextOpen(fromKst: KSTParts): NextOpen | null {
  // KST 달력 기준 자정의 UTC 타임스탬프
  const baseUtcMs =
    Date.UTC(fromKst.year, fromKst.month - 1, fromKst.day) - 9 * 3600 * 1000;
  for (let i = 1; i <= 14; i++) {
    const target = new Date(baseUtcMs + i * 24 * 3600 * 1000);
    const t = getKSTParts(target);
    const dateKey = formatDateKey(t);
    const schedule = getScheduleForDate(t.weekday, dateKey);
    if (schedule) {
      return { dayDiff: i, weekday: t.weekday, schedule };
    }
  }
  return null;
}

function formatNextOpenLabel(next: NextOpen): string {
  const time = formatTime(next.schedule.open[0], next.schedule.open[1]);
  let dayPrefix: string;
  if (next.dayDiff === 1) dayPrefix = '내일';
  else if (next.dayDiff === 2) dayPrefix = '모레';
  else dayPrefix = `${WEEKDAY_KR[next.weekday]}요일`;
  return `${dayPrefix} ${time} 오픈합니다`;
}

export type ShopStatus =
  | { kind: 'before-open'; label: string }
  | { kind: 'open'; label: string }
  | { kind: 'after-close'; label: string }
  | { kind: 'closed'; label: string };

/**
 * 매장의 현재 상태를 계산한다.
 *
 * 상태 분기 (문장형 `-합니다` 완결형, 타이틀 "직접 만나보세요."와 톤 일치):
 * - 영업 전:                      `11:00 오픈합니다`
 * - 영업 중:                      `21:00까지 영업합니다`
 * - 영업 종료 후 (내일 영업일):     `내일 12:00 오픈합니다`
 * - 영업 종료 후 (내일 휴무):       `내일은 휴무 · 화요일 12:00 오픈합니다`
 * - 휴무일 (내일 영업):             `금일 휴무 · 내일 12:00 오픈합니다`
 * - 휴무일 (내일도 휴무):           `금일 휴무 · 수요일 12:00 오픈합니다`
 */
export function getShopStatus(now: Date): ShopStatus {
  const kst = getKSTParts(now);
  const todayKey = formatDateKey(kst);
  const todaySchedule = getScheduleForDate(kst.weekday, todayKey);
  const next = findNextOpen(kst);
  const nextOpenLabel = next ? formatNextOpenLabel(next) : '';

  // 오늘이 휴무일 (정기/비정기)
  if (!todaySchedule) {
    return {
      kind: 'closed',
      label: nextOpenLabel ? `금일 휴무 · ${nextOpenLabel}` : '금일 휴무',
    };
  }

  const nowMin = kst.hour * 60 + kst.minute;
  const openMin = todaySchedule.open[0] * 60 + todaySchedule.open[1];
  const closeMin = todaySchedule.close[0] * 60 + todaySchedule.close[1];

  // 영업 전 (오늘 오픈 예정)
  if (nowMin < openMin) {
    return {
      kind: 'before-open',
      label: `${formatTime(todaySchedule.open[0], todaySchedule.open[1])} 오픈합니다`,
    };
  }

  // 영업 종료 후
  if (nowMin >= closeMin) {
    if (next && next.dayDiff === 1) {
      // 내일이 바로 영업일 → 단순 라벨
      return { kind: 'after-close', label: nextOpenLabel };
    }
    // 내일이 휴무 (또는 그 이후) → 사용자 의문 차단용 prefix
    return {
      kind: 'after-close',
      label: nextOpenLabel ? `내일은 휴무 · ${nextOpenLabel}` : '영업 종료',
    };
  }

  // 영업 중
  return {
    kind: 'open',
    label: `${formatTime(todaySchedule.close[0], todaySchedule.close[1])}까지 영업합니다`,
  };
}
