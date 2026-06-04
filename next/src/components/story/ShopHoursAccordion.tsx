'use client';

/* ══════════════════════════════════════════
   ShopHoursAccordion — Location 섹션 영업시간 위젯
   - 한 줄 요약: 실시간 상태 (영업 중 · 21:00 마감 / 영업 마감 · 내일 12:00 오픈)
   - 펼침(아코디언): 오늘부터 7일 시간표 (오늘 강조 · 비정기 휴무 사유 표시)
   - 영업 규칙: site_settings.hours (useSiteSettings) → useShopStatus(hours) 계산
   - SSR/초기(view=null): 한 줄 안내만 → hydration 안전 (클라 시각 의존)
   ══════════════════════════════════════════ */

import { useState } from 'react';
import { useSiteSettings } from '@/components/providers/SiteSettingsProvider';
import { useShopStatus } from '@/hooks/useShopStatus';
import { emphasizeHours } from '@/lib/emphasizeHours';
import type { ShopStatus } from '@/lib/shopHours';

/* 상태별 색 (카카오/네이버 톤) — dot + 상태어에 동일 적용 */
const STATUS_TONE: Record<ShopStatus['kind'], string> = {
  open: 'var(--color-success)', // 영업 중
  'before-open': 'var(--color-info)', // 영업 전
  'after-close': 'var(--color-text-tertiary)', // 영업 마감
  closed: 'var(--color-error)', // 휴무
};

export default function ShopHoursAccordion() {
  const [open, setOpen] = useState(false);
  const { hours } = useSiteSettings();
  const view = useShopStatus(hours);
  const tone = view ? STATUS_TONE[view.status.kind] : 'var(--color-text-tertiary)';

  /* label "영업 마감 · 내일 12:00 오픈" → 상태어(색 적용) + 나머지(시간 강조) 분리 */
  const label = view?.status.label ?? '영업시간 안내';
  const sepIdx = label.indexOf(' · ');
  const statusWord = sepIdx >= 0 ? label.slice(0, sepIdx) : label;
  const rest = sepIdx >= 0 ? label.slice(sepIdx + 3) : '';

  return (
    <div className="st-hours">
      <button
        type="button"
        className="st-hours-summary"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="st-hours-line">
          <strong className="st-hours-status" style={{ color: tone }}>
            {statusWord}
          </strong>
          {rest && (
            <>
              {' · '}
              {emphasizeHours(rest)}
            </>
          )}
        </span>
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

      {open && view && (
        <div className="st-hours-panel" role="region" aria-label="주간 영업시간">
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
        </div>
      )}
    </div>
  );
}
