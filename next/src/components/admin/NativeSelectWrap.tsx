'use client';

/* ══════════════════════════════════════════════════════════════════════════
   NativeSelectWrap — admin 표준 native <select> wrapper (S231-9)

   - DEC-5 (native select 유지) 정책 준수
   - chevron 위치 = DropdownFilter (OrdersTableClient) 답습
     · svg 12×12 · opacity 0.6 · 우측 8px (살짝 바깥) · pointer-events-none
   - 사용처는 select 자체에 ADMIN_SELECT_CLASS 적용 의무 (pr-8 확보 + appearance-none)

   사용 예:
     <NativeSelectWrap>
       <select className={ADMIN_SELECT_CLASS} {...register('field')}>
         ...
       </select>
     </NativeSelectWrap>
   ══════════════════════════════════════════════════════════════════════════ */

import type { ReactNode } from 'react';

/* h-9 (36px) — shadcn Input 표준 정합. */
export const ADMIN_SELECT_CLASS =
  'appearance-none w-full h-9 pl-3 pr-8 bg-[var(--surface)] border border-input rounded-md text-sm text-[var(--foreground)] outline-none shadow-xs transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

/* readonly / 자동 표시 필드 시각 표준 (S231 폴리싱 · 진짜 readonly 한정).
   사용처: 슬러그 input · 표시 가격 자동 표시 · OrderDetailClient 어드민 메모 textarea 등.
   ※ 액션 disabled hint (cursor-not-allowed opacity-60 only) 와 의미 분리. */
export const ADMIN_READONLY_FIELD =
  'bg-[var(--surface-muted)] text-muted-foreground border-input cursor-not-allowed select-none';

export function NativeSelectWrap({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <svg
        aria-hidden
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground pointer-events-none"
        style={{ opacity: 0.6 }}
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}
