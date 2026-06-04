/* ══════════════════════════════════════════
   sections/HoursSubForm.tsx — Section 4: 매장 영업시간

   - 마스터 토글(enabled) : 위젯 표시 여부 (SettingsCard · notice/shipping 답습)
   - 휴무 요일 : 멀티칩 (선택 = 휴무 · Switch 7개 폐기)
   - 영업 시간 : 영업일만 시·분 드롭다운 (24시간제 · 오전/오후 표기 없음)
   - 비정기 휴무 : 날짜(date) + 사유 행 추가/삭제
   - Story 페이지 Location 위젯(실시간 상태 + 7일 아코디언)에 즉시 반영
   ══════════════════════════════════════════ */

import type { HoursSettings } from '@/lib/siteSettings';
import { WEEKDAY_KR } from '@/lib/shopHours';
import { SettingsCard } from '../_shared/SettingsCard';
import { Button } from '@/components/admin/ui/button';
import { Input } from '@/components/admin/ui/input';

/* 표시 순서: 월~일 (한국 관습). 키는 0=일 ~ 6=토. */
const DAY_ORDER = ['1', '2', '3', '4', '5', '6', '0'] as const;

type WeekKey = keyof HoursSettings['weekly'];

/* 시·분 드롭다운 옵션 — 24시간제 (오전/오후 없음) · 분 5분 단위 */
const HOUR_OPTS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MIN_OPTS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

interface TimeSelectProps {
  value: string; // 'HH:MM'
  onChange: (next: string) => void;
  label: string;
}

/** native select + admin 표준 chevron(appearance-none 오버레이). 기본 브라우저 화살표 제거. */
function SelectBox({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: readonly string[];
  onChange: (next: string) => void;
  label: string;
}) {
  return (
    <span className="relative inline-flex items-center">
      <select
        className="h-8 appearance-none rounded-md border border-border bg-[var(--surface)] pl-2.5 pr-7 text-sm tabular-nums cursor-pointer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-muted-foreground absolute right-2 pointer-events-none"
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  );
}

/** 시·분 드롭다운 페어 — 브라우저/OS locale 무관 24시간제 보장. */
function TimeSelect({ value, onChange, label }: TimeSelectProps) {
  const [h, m] = value.split(':');
  return (
    <span className="inline-flex items-center gap-1">
      <SelectBox
        value={h}
        options={HOUR_OPTS}
        onChange={(hh) => onChange(`${hh}:${m}`)}
        label={`${label} 시`}
      />
      <span className="text-muted-foreground">:</span>
      <SelectBox
        value={m}
        options={MIN_OPTS}
        onChange={(mm) => onChange(`${h}:${mm}`)}
        label={`${label} 분`}
      />
    </span>
  );
}

interface HoursSubFormProps {
  value: HoursSettings;
  onChange: (patch: Partial<HoursSettings>) => void;
}

export function HoursSubForm({ value, onChange }: HoursSubFormProps) {
  function toggleDay(wd: WeekKey) {
    const cur = value.weekly[wd];
    onChange({
      weekly: {
        ...value.weekly,
        [wd]: cur ? null : { open: '12:00', close: '21:00' },
      },
    });
  }

  function setTime(wd: WeekKey, field: 'open' | 'close', time: string) {
    const cur = value.weekly[wd];
    if (!cur) return;
    onChange({
      weekly: { ...value.weekly, [wd]: { ...cur, [field]: time } },
    });
  }

  function addClosure() {
    onChange({ closures: [...value.closures, { date: '', reason: '' }] });
  }

  function setClosure(i: number, field: 'date' | 'reason', v: string) {
    onChange({
      closures: value.closures.map((c, j) => (j === i ? { ...c, [field]: v } : c)),
    });
  }

  function removeClosure(i: number) {
    onChange({ closures: value.closures.filter((_, j) => j !== i) });
  }

  const openDays = DAY_ORDER.filter((wd) => value.weekly[wd]);
  const closedDays = DAY_ORDER.filter((wd) => !value.weekly[wd]);
  const closedLabel =
    closedDays.length === 0
      ? '선택한 요일은 정기 휴무로 처리돼요.'
      : `${closedDays.map((wd) => WEEKDAY_KR[Number(wd)]).join('·')}요일은 정기 휴무로 처리됩니다.`;

  return (
    <SettingsCard
      title="매장 영업시간"
      subtitle="Story 페이지 Location 위젯(실시간 상태 + 7일 시간표)에 즉시 반영돼요."
      on={value.enabled}
      onToggle={() => onChange({ enabled: !value.enabled })}
    >
      <div className="flex flex-col gap-5">
        {/* 휴무 요일 (멀티칩) */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">휴무 요일</span>
          <p className="text-xs text-muted-foreground">{closedLabel}</p>
          <div className="flex flex-wrap gap-2 mt-0.5">
            {DAY_ORDER.map((wd) => {
              const isClosed = !value.weekly[wd];
              return (
                <button
                  key={wd}
                  type="button"
                  onClick={() => toggleDay(wd)}
                  aria-pressed={isClosed}
                  aria-label={`${WEEKDAY_KR[Number(wd)]}요일 ${isClosed ? '영업으로 전환' : '휴무로 전환'}`}
                  className={
                    'size-9 rounded-md border text-sm font-medium cursor-pointer transition-colors ' +
                    (isClosed
                      ? 'bg-[var(--danger-soft)] border-[var(--danger)] text-[var(--danger)]'
                      : 'border-border text-muted-foreground hover:border-foreground')
                  }
                >
                  {WEEKDAY_KR[Number(wd)]}
                </button>
              );
            })}
          </div>
        </div>

        {/* 영업 시간 (영업일만 · 시·분 드롭다운) */}
        <div className="border-t border-border pt-4 flex flex-col gap-2.5">
          <span className="text-sm font-medium">영업 시간</span>
          {openDays.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              모든 요일이 휴무예요. 위 칩에서 영업 요일을 선택해 주세요.
            </p>
          ) : (
            openDays.map((wd) => {
              const d = value.weekly[wd]!;
              const kr = WEEKDAY_KR[Number(wd)];
              return (
                <div key={wd} className="flex items-center gap-3">
                  <span className="w-7 text-sm font-medium">{kr}</span>
                  <TimeSelect
                    value={d.open}
                    onChange={(t) => setTime(wd, 'open', t)}
                    label={`${kr}요일 오픈`}
                  />
                  <span className="text-muted-foreground">~</span>
                  <TimeSelect
                    value={d.close}
                    onChange={(t) => setTime(wd, 'close', t)}
                    label={`${kr}요일 마감`}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* 비정기 휴무 */}
        <div className="border-t border-border pt-4 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">비정기 휴무</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                날짜 + 사유. 해당 날짜는 7일 시간표에 “휴무 · 사유”로 표시돼요.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="!h-7"
              onClick={addClosure}
            >
              + 추가
            </Button>
          </div>

          {value.closures.length === 0 ? (
            <p className="text-xs text-muted-foreground">등록된 비정기 휴무가 없어요.</p>
          ) : (
            value.closures.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  type="date"
                  value={c.date}
                  onChange={(e) => setClosure(i, 'date', e.target.value)}
                  className="w-[160px]"
                  aria-label="휴무 날짜"
                />
                <Input
                  type="text"
                  value={c.reason}
                  onChange={(e) => setClosure(i, 'reason', e.target.value)}
                  placeholder="사유 (예: 직원 연수)"
                  maxLength={60}
                  className="flex-1"
                  aria-label="휴무 사유"
                />
                <button
                  type="button"
                  onClick={() => removeClosure(i)}
                  aria-label="이 휴무 삭제"
                  className="shrink-0 size-8 rounded-md border border-border text-muted-foreground hover:text-[var(--danger)] flex items-center justify-center cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </SettingsCard>
  );
}
