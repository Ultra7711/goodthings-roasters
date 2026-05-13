'use client';

/* ══════════════════════════════════════════
   AdminSearchInput — admin 공통 검색 input (S223 Phase 2-c)

   shadcn Input + 돋보기 prefix + clear button.
   native search input 의 cancel button 은 CSS 로 숨김 (이중 X 방지).
   사용처: Orders / Subscriptions / Products / Users 등 admin table 검색.
   ══════════════════════════════════════════ */

import { Input } from '@/components/admin/ui/input';

export type AdminSearchInputProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
};

export function AdminSearchInput({ value, onChange, placeholder }: AdminSearchInputProps) {
  return (
    <div className="relative flex flex-1 max-w-[360px] items-center">
      <span
        aria-hidden
        className="pointer-events-none absolute left-2.5 flex text-[var(--foreground-subtle)]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </span>
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-8 pr-7 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="검색어 지우기"
          title="지우기"
          className="absolute right-2 flex cursor-pointer rounded text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"
          style={{ padding: 2 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
