/* ══════════════════════════════════════════
   sections/HoursSubForm.tsx — Section 4: 매장 영업시간

   - 요일별 영업시간 (월~일) : 영업/휴무 토글 + 오픈/마감 time input
   - 비정기 휴무 : 날짜(date) + 사유 행 추가/삭제
   - Story 페이지 Location 위젯(실시간 상태 + 7일 아코디언)에 즉시 반영
   ══════════════════════════════════════════ */

import type { HoursSettings } from '@/lib/siteSettings';
import { WEEKDAY_KR } from '@/lib/shopHours';
import { Switch } from '@/components/admin/ui/switch';
import { Button } from '@/components/admin/ui/button';
import { Input } from '@/components/admin/ui/input';

/* 표시 순서: 월~일 (한국 관습). 키는 0=일 ~ 6=토. */
const DAY_ORDER = ['1', '2', '3', '4', '5', '6', '0'] as const;

type WeekKey = keyof HoursSettings['weekly'];

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

  return (
    <div className="bg-[var(--surface)] border border-border rounded-[var(--radius)]">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="m-0 text-sm font-medium">매장 영업시간</h3>
        <div className="text-xs text-muted-foreground mt-0.5">
          Story 페이지 Location 위젯(실시간 상태 + 7일 시간표)에 즉시 반영돼요.
        </div>
      </div>

      <div className="p-6 flex flex-col gap-5">
        {/* 요일별 기본 영업시간 */}
        <div className="flex flex-col gap-2.5">
          {DAY_ORDER.map((wd) => {
            const d = value.weekly[wd];
            const onDay = !!d;
            return (
              <div key={wd} className="flex items-center gap-3">
                <span className="w-7 text-sm font-medium">
                  {WEEKDAY_KR[Number(wd)]}
                </span>
                <Switch
                  checked={onDay}
                  onCheckedChange={() => toggleDay(wd)}
                  aria-label={`${WEEKDAY_KR[Number(wd)]}요일 ${onDay ? '휴무로 전환' : '영업으로 전환'}`}
                  className="data-[state=unchecked]:bg-[var(--switch-off-bg)]"
                />
                {onDay && d ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={d.open}
                      onChange={(e) => setTime(wd, 'open', e.target.value)}
                      className="w-[120px]"
                      aria-label={`${WEEKDAY_KR[Number(wd)]}요일 오픈 시각`}
                    />
                    <span className="text-muted-foreground">~</span>
                    <Input
                      type="time"
                      value={d.close}
                      onChange={(e) => setTime(wd, 'close', e.target.value)}
                      className="w-[120px]"
                      aria-label={`${WEEKDAY_KR[Number(wd)]}요일 마감 시각`}
                    />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">휴무</span>
                )}
              </div>
            );
          })}
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
    </div>
  );
}
