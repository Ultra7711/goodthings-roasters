'use client';

/* ══════════════════════════════════════════
   ShopHoursAccordion — Location 섹션 영업시간 위젯
   - 한 줄 요약: 실시간 상태 (영업 중 · 21:00 마감 / 영업 마감 · 내일 12:00 오픈)
   - 펼침(아코디언): 오늘부터 7일 시간표 (오늘 강조 · 비정기 휴무 사유 표시)
   - 로직 SoT: lib/shopHours (Asia/Seoul 고정) · 훅: useShopStatus (60초 갱신)
   - SSR/초기(view=null): 정적 fallback(STORY_LOCATION.hours) 표시 → hydration 안전
   ══════════════════════════════════════════ */

import { useState } from 'react';
import { useShopStatus } from '@/hooks/useShopStatus';
import { emphasizeHours } from '@/lib/emphasizeHours';

type Props = {
  /** view 미준비(SSR/초기) 시 펼침 영역에 보여줄 정적 영업시간 텍스트 (개행 구분) */
  fallbackHours: string;
};

export default function ShopHoursAccordion({ fallbackHours }: Props) {
  const [open, setOpen] = useState(false);
  const view = useShopStatus();
  const isOpenNow = view?.status.kind === 'open';
  const line = view?.status.label ?? '영업시간 안내';

  return (
    <div className="st-hours">
      <button
        type="button"
        className="st-hours-summary"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={`st-hours-dot${isOpenNow ? ' is-open' : ''}`}
          aria-hidden
        />
        <span className="st-hours-line">{emphasizeHours(line)}</span>
        <svg
          className={`st-hours-chev${open ? ' is-open' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="st-hours-panel" role="region" aria-label="주간 영업시간">
          {view ? (
            <ul className="st-hours-week">
              {view.week.map((d) => (
                <li
                  key={d.dateKey}
                  className={`st-hours-row${d.isToday ? ' is-today' : ''}${d.closed ? ' is-closed' : ''}`}
                >
                  <span className="st-hours-date">
                    {d.weekdayLabel}({d.month}/{d.day})
                  </span>
                  <span className="st-hours-time">
                    {d.closed ? (
                      <span className="emph-closed">
                        {d.reason ? `휴무 · ${d.reason}` : '휴무일'}
                      </span>
                    ) : (
                      emphasizeHours(d.timeLabel)
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="st-hours-fallback">
              {fallbackHours.split('\n').map((l, i, arr) => (
                <span key={i}>
                  {emphasizeHours(l)}
                  {i < arr.length - 1 && <br />}
                </span>
              ))}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
