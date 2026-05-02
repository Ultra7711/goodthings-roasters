/* ══════════════════════════════════════════
   OptionChipGroup — PDP 옵션 chip 그룹 (V2 §6.11)
   ──────────────────────────────────────────
   - 용량·분쇄도 등 PDP 옵션 dropdown 의 대체 UI
   - 가로 chip 나열 (가격 비교 즉시) · flex-wrap 으로 모바일 줄바꿈
   - 상태: 기본 / 선택 (1px ink border) / disabled (line-through · 품절)
   - sublabel 은 같은 chip 내부에 점(·) 구분으로 인라인 ("200g · 14,000원")
   ══════════════════════════════════════════ */

'use client';

export type OptionChipItem<V extends string> = {
  label: string;
  sublabel?: string;
  value: V;
  disabled?: boolean;
  badge?: string;
};

type Props<V extends string> = {
  label: string;
  options: ReadonlyArray<OptionChipItem<V>>;
  value: V;
  onChange: (value: V) => void;
  /** 라디오 그룹 ID — 외부 라벨 연결용 */
  groupId?: string;
};

export default function OptionChipGroup<V extends string>({
  label,
  options,
  value,
  onChange,
  groupId,
}: Props<V>) {
  return (
    <div className="option-chip-group">
      <div className="option-chip-label" id={groupId ? `${groupId}-label` : undefined}>
        {label}
      </div>
      <div
        className="option-chip-list"
        role="radiogroup"
        aria-labelledby={groupId ? `${groupId}-label` : undefined}
        aria-label={groupId ? undefined : label}
      >
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={opt.disabled}
              className={
                'option-chip' +
                (selected ? ' option-chip--selected' : '') +
                (opt.disabled ? ' option-chip--disabled' : '')
              }
              onClick={() => {
                if (opt.disabled) return;
                onChange(opt.value);
              }}
            >
              <span className="option-chip-main">
                {opt.label}
                {opt.sublabel && (
                  <span className="option-chip-sub"> · {opt.sublabel}</span>
                )}
              </span>
              {opt.badge && <span className="option-chip-badge">{opt.badge}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
