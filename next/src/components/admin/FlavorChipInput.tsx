'use client';

/* ══════════════════════════════════════════════════════════════════════════
   FlavorChipInput — 한·영 페어 노트 태그 칩 입력 (시그니처 + 상품 공유 · S231-6b/c)

   - value: { ko, en }[] (controlled)
   - 입력 1줄 "복숭아 Peach" → parseChipInput → 마지막 한글 위치 기준 ko/en 분리
   - Enter / 쉼표 추가 · Backspace (input 비어있을 때 마지막 칩 제거) · X 클릭 제거
   - max prop 도달 시 추가 차단 · 중복 ko 차단
   - extraAction = 입력 row 우측 슬롯 (예: 'Tasting Notes 가져오기' 버튼)

   사용처:
   - SettingsForm (시그니처 칩 max=4 · Tasting Notes 추출 버튼)
   - ProductEditForm (상품 detail 탭 max=20)
   ══════════════════════════════════════════════════════════════════════════ */

import { useState, type KeyboardEvent } from 'react';
import { Input } from '@/components/admin/ui/input';

export type FlavorChip = { ko: string; en: string };

type Props = {
  value: FlavorChip[];
  onChange: (chips: FlavorChip[]) => void;
  max?: number;
  placeholder?: string;
  extraAction?: React.ReactNode;
  showCount?: boolean;
  emptyMessage?: string;
  inputAriaLabel?: string;
};

/** "복숭아 Peach" 또는 "복숭아" → {ko, en} 파싱.
    마지막 한글 문자(U+AC00~D7A3) 위치 기준으로 ko/en 분리.
    한글 없으면 전체를 ko 로 처리 (영문만 입력 케이스 허용). */
export function parseChipInput(raw: string): FlavorChip | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let lastKoreanIdx = -1;
  for (let i = trimmed.length - 1; i >= 0; i--) {
    const code = trimmed.charCodeAt(i);
    if (code >= 0xac00 && code <= 0xd7a3) {
      lastKoreanIdx = i;
      break;
    }
  }
  if (lastKoreanIdx < 0) return { ko: trimmed, en: '' };
  const ko = trimmed.slice(0, lastKoreanIdx + 1).trim();
  const en = trimmed.slice(lastKoreanIdx + 1).trim();
  return ko ? { ko, en } : null;
}

/** DB 의 두 컬럼 (note_tags / note_tags_en · ' | ' join) → {ko, en}[] */
export function decodeChipsFromColumns(noteTags: string, noteTagsEn: string): FlavorChip[] {
  const kos = noteTags.split(' | ').map((s) => s.trim()).filter(Boolean);
  const ens = noteTagsEn.split(' | ').map((s) => s.trim());
  return kos.map((ko, i) => ({ ko, en: ens[i] ?? '' }));
}

/** {ko, en}[] → DB 두 컬럼 ' | ' join */
export function encodeChipsToColumns(chips: FlavorChip[]): { noteTags: string; noteTagsEn: string } {
  return {
    noteTags: chips.map((c) => c.ko).join(' | '),
    noteTagsEn: chips.map((c) => c.en).join(' | '),
  };
}

export function FlavorChipInput({
  value,
  onChange,
  max,
  placeholder = '예: 복숭아 Peach  (영문 생략 가능)',
  extraAction,
  showCount = false,
  emptyMessage = '(chip 없음 — Enter / 쉼표로 추가)',
  inputAriaLabel = '플레이버 칩 추가',
}: Props) {
  const [draft, setDraft] = useState('');

  function commit(next: FlavorChip[]) {
    onChange(next);
  }

  function addFromDraft() {
    const chip = parseChipInput(draft);
    if (!chip) return;
    if (max !== undefined && value.length >= max) return;
    if (value.some((c) => c.ko === chip.ko)) return;
    commit([...value, chip]);
    setDraft('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addFromDraft();
      return;
    }
    if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      commit(value.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* 칩 표시 */}
      <div className="flex gap-1.5 flex-wrap">
        {value.length === 0 ? (
          <span className="text-xs text-muted-foreground italic">{emptyMessage}</span>
        ) : (
          value.map((chip, i) => (
            <span
              key={`${chip.ko}-${i}`}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-[3px] text-xs bg-[var(--surface-muted)] border border-border rounded-full text-[var(--foreground)]"
            >
              {chip.ko}
              {chip.en && <span className="text-muted-foreground">{chip.en}</span>}
              <button
                type="button"
                onClick={() => commit(value.filter((_, idx) => idx !== i))}
                aria-label={`${chip.ko} 삭제`}
                className="size-[18px] rounded-full border-0 bg-transparent text-muted-foreground cursor-pointer text-sm p-0 inline-flex items-center justify-center leading-none"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      {/* 입력 row + 외부 액션 슬롯 */}
      <div className="flex items-center gap-1.5">
        <div className="flex-1 min-w-0">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            maxLength={50}
            aria-label={inputAriaLabel}
          />
        </div>
        {extraAction}
      </div>

      {/* Footer 안내 */}
      {showCount && (
        <div className="text-xs text-muted-foreground">
          Enter 또는 쉼표 로 추가
          {max !== undefined ? ` · 현재 ${value.length}/${max}` : ''}
        </div>
      )}
    </div>
  );
}
