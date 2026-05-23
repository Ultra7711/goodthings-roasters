/* ══════════════════════════════════════════
   sections/HomeFeaturedSubForm.tsx — Section 4: 메인 노출 카페 메뉴 (S256-A 분리)

   매트릭스 슬롯 모델 (S248 · 069):
   - dropdown source = cafe_menus 전체 (is_active=true · status 무관 · DEC-S248-4)
   - 검색 + 카테고리/status 배지 + 중복 disabled
   - ↑↓ 슬롯 reorder (S245 sort_order 동적 행 reorder 답습)
   - 빈 배열·미설정 시 메인 페이지에서 status='시그니처' .slice(0,3) 자동 fallback
     (DEC-S248-8 안전망).

   Section 4 는 SettingsCard (toggle 헤더) 를 쓰지 않고 자체 헤더 (count/max 표시) 보유.
   ══════════════════════════════════════════ */

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { Button } from '@/components/admin/ui/button';
import { cn } from '@/lib/utils';
import {
  CAFE_CATEGORY_LABEL,
  type CafeMenuItem,
} from '@/lib/cafeMenu';
import type { HomeFeaturedSettings } from '@/lib/siteSettings';

interface HomeFeaturedSubFormProps {
  value: HomeFeaturedSettings;
  onChange: (patch: Partial<HomeFeaturedSettings>) => void;
  cafeMenus: CafeMenuItem[];
}

export function HomeFeaturedSubForm({ value, onChange, cafeMenus }: HomeFeaturedSubFormProps) {
  const count = value.menu_ids.length;
  const max = 3;

  /** id → CafeMenuItem map (옵션 row · 슬롯 라벨 lookup). */
  const menuById = useMemo(() => {
    const m = new Map<string, CafeMenuItem>();
    for (const item of cafeMenus) m.set(item.id, item);
    return m;
  }, [cafeMenus]);

  function setSlot(index: number, menuId: string | null) {
    const next = [...value.menu_ids];
    if (menuId === null) {
      next.splice(index, 1);
    } else {
      next[index] = menuId;
    }
    onChange({ menu_ids: next });
  }

  function appendSlot(menuId: string) {
    if (count >= max) return;
    onChange({ menu_ids: [...value.menu_ids, menuId] });
  }

  function moveSlot(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= count) return;
    const next = [...value.menu_ids];
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ menu_ids: next });
  }

  function removeSlot(index: number) {
    const next = [...value.menu_ids];
    next.splice(index, 1);
    onChange({ menu_ids: next });
  }

  return (
    <div className="bg-[var(--surface)] border border-border rounded-[var(--radius)]">
      <div className="px-6 py-4 border-b border-border flex items-center gap-3">
        <div className="flex-1">
          <h3 className="m-0 text-sm font-medium">메인 노출 카페 메뉴</h3>
          <div className="text-xs text-muted-foreground mt-0.5">
            메인 페이지 §2.5 cafe-menu chapter 의 3종 슬롯 · 시그니처 마커가 아니어도 노출 가능 · 0~3 개 가변
          </div>
        </div>
        <span className="text-xs text-muted-foreground gtr-tnum">
          {count} / {max}
        </span>
      </div>
      <div className="p-6 flex flex-col gap-3">
        {count === 0 && (
          <div className="px-4 py-3 rounded-md bg-[var(--surface-muted)] text-xs text-muted-foreground leading-relaxed">
            아직 선택된 메뉴가 없어요 · 비워두면 시그니처 마커가 붙은 메뉴 3종이 자동 노출돼요 (안전망)
          </div>
        )}

        {value.menu_ids.map((id, index) => {
          const item = menuById.get(id);
          return (
            <HomeFeaturedSlotRow
              key={`slot-${index}-${id}`}
              index={index}
              total={count}
              item={item}
              cafeMenus={cafeMenus}
              selectedIds={value.menu_ids}
              onPick={(menuId) => setSlot(index, menuId)}
              onMoveUp={() => moveSlot(index, -1)}
              onMoveDown={() => moveSlot(index, 1)}
              onRemove={() => removeSlot(index)}
            />
          );
        })}

        {count < max && (
          <HomeFeaturedAddRow
            cafeMenus={cafeMenus}
            selectedIds={value.menu_ids}
            onPick={(menuId) => appendSlot(menuId)}
          />
        )}
      </div>
    </div>
  );
}

function HomeFeaturedSlotRow({
  index,
  total,
  item,
  cafeMenus,
  selectedIds,
  onPick,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  index: number;
  total: number;
  item: CafeMenuItem | undefined;
  cafeMenus: CafeMenuItem[];
  selectedIds: ReadonlyArray<string>;
  onPick: (menuId: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const slotLabel = `${index + 1}번째 노출`;
  const slotHint = index === 0 ? '메인 첫 표시' : index === 1 ? '두 번째' : '세 번째';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex flex-col text-xs min-w-[80px]">
        <span className="font-medium">{slotLabel}</span>
        <span className="text-muted-foreground">{slotHint}</span>
      </div>

      <div className="flex-1 min-w-[260px]">
        {item ? (
          <MenuPickerInline
            current={item}
            cafeMenus={cafeMenus}
            selectedIds={selectedIds}
            onPick={onPick}
          />
        ) : (
          <div className="px-3 py-2 rounded-md border border-[var(--danger)] bg-[var(--danger-soft)] text-xs text-[var(--danger)]">
            잘못된 메뉴 (삭제된 메뉴이거나 비활성 상태) — 다시 선택해 주세요
            <MenuPickerInline
              current={null}
              cafeMenus={cafeMenus}
              selectedIds={selectedIds}
              onPick={onPick}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="!h-8 !w-8 !p-0"
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label="위로 이동"
          title="위로 이동"
        >
          <ChevronUp size={14} />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="!h-8 !w-8 !p-0"
          onClick={onMoveDown}
          disabled={index === total - 1}
          aria-label="아래로 이동"
          title="아래로 이동"
        >
          <ChevronDown size={14} />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="!h-8 !w-8 !p-0 !text-[var(--danger)] !border-[var(--danger)]"
          onClick={onRemove}
          aria-label="슬롯 제거"
          title="슬롯 제거"
        >
          <X size={14} />
        </Button>
      </div>
    </div>
  );
}

function HomeFeaturedAddRow({
  cafeMenus,
  selectedIds,
  onPick,
}: {
  cafeMenus: CafeMenuItem[];
  selectedIds: ReadonlyArray<string>;
  onPick: (menuId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="!h-9 self-start"
        onClick={() => setOpen(true)}
      >
        <Plus size={14} />
        메뉴 추가
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="text-xs text-muted-foreground min-w-[80px]">신규 슬롯</div>
      <div className="flex-1 min-w-[260px]">
        <MenuPickerInline
          current={null}
          cafeMenus={cafeMenus}
          selectedIds={selectedIds}
          onPick={(id) => {
            onPick(id);
            setOpen(false);
          }}
          autoOpen
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="!h-8"
        onClick={() => setOpen(false)}
      >
        취소
      </Button>
    </div>
  );
}

/* MenuPickerInline — 검색 dropdown.
   - native <details>/<summary> 기반 (라이브러리 0 · 키보드 esc 자연 처리)
   - 검색 입력 (메뉴명 ilike) · status 배지 + 카테고리 표시
   - 다른 슬롯에 선택된 메뉴 disabled + "선택됨" 라벨. */
function MenuPickerInline({
  current,
  cafeMenus,
  selectedIds,
  onPick,
  autoOpen,
}: {
  current: CafeMenuItem | null;
  cafeMenus: CafeMenuItem[];
  selectedIds: ReadonlyArray<string>;
  onPick: (menuId: string) => void;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!autoOpen);
  const [query, setQuery] = useState('');
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cafeMenus;
    return cafeMenus.filter((m) => m.name.toLowerCase().includes(q));
  }, [cafeMenus, query]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="w-full flex items-center justify-between gap-2 px-3 h-[34px] rounded-[6px] border border-[var(--input)] bg-[var(--surface)] text-sm text-left cursor-pointer hover:bg-[var(--surface-muted)] transition-colors"
      >
        {current ? (
          <span className="flex items-center gap-2 min-w-0">
            <span className="font-medium truncate">{current.name}</span>
            <MenuMetaBadges item={current} />
          </span>
        ) : (
          <span className="text-muted-foreground">메뉴 선택…</span>
        )}
        <ChevronDown
          size={14}
          className="shrink-0 text-muted-foreground transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {open && (
        <div
          className="absolute z-10 top-[calc(100%+4px)] left-0 right-0 max-h-[320px] overflow-y-auto bg-[var(--surface)] border border-border rounded-md shadow-lg"
          role="listbox"
        >
          <div className="sticky top-0 bg-[var(--surface)] border-b border-border p-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="메뉴명 검색…"
              autoFocus
              className="w-full px-2.5 h-8 text-sm border border-[var(--input)] rounded-md bg-[var(--surface)] outline-none focus:border-ring"
            />
          </div>
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              검색 결과가 없어요
            </div>
          ) : (
            <ul className="py-1">
              {filtered.map((m) => {
                const isSelected = selectedSet.has(m.id);
                const isCurrent = current?.id === m.id;
                const disabled = isSelected && !isCurrent;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (disabled) return;
                        onPick(m.id);
                        setOpen(false);
                        setQuery('');
                      }}
                      disabled={disabled}
                      aria-selected={isCurrent}
                      className={cn(
                        'w-full px-3 py-2 text-sm text-left flex items-center gap-2 transition-colors',
                        isCurrent
                          ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                          : disabled
                            ? 'text-muted-foreground cursor-not-allowed opacity-60'
                            : 'hover:bg-[var(--surface-muted)] cursor-pointer',
                      )}
                    >
                      <span className="flex-1 min-w-0 truncate">{m.name}</span>
                      <MenuMetaBadges item={m} />
                      {disabled && (
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
                          다른 슬롯에 선택됨
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function MenuMetaBadges({ item }: { item: CafeMenuItem }) {
  const catLabel = CAFE_CATEGORY_LABEL[item.cat] ?? item.cat;
  return (
    <span className="inline-flex items-center gap-1 shrink-0 text-[10px] font-medium">
      <span className="px-1.5 py-0.5 rounded bg-[var(--surface-muted)] text-muted-foreground">
        {catLabel}
      </span>
      {item.status && (
        <span className="px-1.5 py-0.5 rounded bg-[var(--primary-soft)] text-[var(--primary)]">
          {item.status}
        </span>
      )}
    </span>
  );
}
