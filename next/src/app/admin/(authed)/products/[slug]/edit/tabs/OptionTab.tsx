/* ══════════════════════════════════════════
   tabs/OptionTab.tsx — 용량 / 옵션 탭 (S260 분리)

   - 용량 / 옵션 카드 (label · price · soldOut + ↑↓ reorder · 삭제)
   - 추출 레시피 카드 — category='coffee_bean' 만 (5축 input · ↑↓ · 삭제)
   - drip_bag 은 공통 가이드 안내 placeholder
   - ReorderButtons — volumes/recipes 공유 (S231-5)
   ══════════════════════════════════════════ */

import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import {
  Controller,
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from 'react-hook-form';
import { PriceInput } from '@/components/admin/PriceInput';
import { Button } from '@/components/admin/ui/button';
import { Input } from '@/components/admin/ui/input';
import { Switch } from '@/components/admin/ui/switch';
import { cn } from '@/lib/utils';
import {
  DYNAMIC_ROW_CELL_GAP,
  DYNAMIC_ROW_LIST_GAP,
  DYNAMIC_ROW_SECTION_BREAK,
  DYNAMIC_ROW_UNIT_GAP,
} from '../_shared/constants';
import type { FormValues } from '../_shared/schema';
import { Card } from '../_shared/primitives';

export function OptionTab({
  register,
  control,
  errors,
}: {
  register: UseFormRegister<FormValues>;
  control: Control<FormValues>;
  errors: FieldErrors<FormValues>;
}) {
  const category = useWatch({ control, name: 'category' });
  const volumes = useFieldArray({ control, name: 'volumes' });
  const recipes = useFieldArray({ control, name: 'recipes' });

  return (
    <div className="flex flex-col gap-3">
      {/* 용량 / 옵션 카드 — ↑↓ reorder (S231-5) · 간격 토큰: DYNAMIC_ROW_* */}
      <Card title="용량 / 옵션">
        <div className={cn('flex flex-col', DYNAMIC_ROW_LIST_GAP)}>
          {volumes.fields.length === 0 && (
            <div className="text-xs text-muted-foreground italic">
              아직 옵션이 없습니다. 아래 버튼으로 추가해 주세요.
            </div>
          )}
          {volumes.fields.map((field, idx) => (
            <div
              key={field.id}
              className={cn(
                'grid grid-cols-[1fr_auto_auto_auto] items-center',
                DYNAMIC_ROW_CELL_GAP,
              )}
            >
              <Input
                type="text"
                placeholder="예: 200g · 500g · 1개"
                maxLength={50}
                aria-label={`${idx + 1}번 옵션 라벨`}
                {...register(`volumes.${idx}.label` as const)}
              />
              {/* 가격 + ↑↓ 한 몸 — DYNAMIC_ROW_UNIT_GAP 시각 결합 */}
              <div className={cn('flex items-center', DYNAMIC_ROW_UNIT_GAP)}>
                <Controller
                  control={control}
                  name={`volumes.${idx}.price` as const}
                  render={({ field: priceField }) => (
                    <div className="w-[140px]">
                      <PriceInput
                        value={
                          typeof priceField.value === 'number' &&
                          Number.isFinite(priceField.value)
                            ? priceField.value
                            : 0
                        }
                        onChange={priceField.onChange}
                        placeholder="가격"
                        ariaLabel={`${idx + 1}번 옵션 가격`}
                      />
                    </div>
                  )}
                />
                <ReorderButtons
                  idx={idx}
                  total={volumes.fields.length}
                  onMoveUp={() => volumes.swap(idx, idx - 1)}
                  onMoveDown={() => volumes.swap(idx, idx + 1)}
                  rowLabel={`${idx + 1}번 옵션`}
                />
              </div>
              <Controller
                control={control}
                name={`volumes.${idx}.soldOut` as const}
                render={({ field: soField }) => {
                  const onSale = !soField.value;
                  return (
                    <label
                      className={cn(
                        'inline-flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap',
                        DYNAMIC_ROW_SECTION_BREAK,
                      )}
                    >
                      <Switch
                        checked={onSale}
                        onCheckedChange={(v) => soField.onChange(!v)}
                        aria-label={onSale ? '판매중' : '품절'}
                        className="data-[state=unchecked]:bg-[var(--switch-off-bg)]"
                      />
                      {onSale ? '판매중' : '품절'}
                    </label>
                  );
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="!h-7 !text-[var(--danger)] hover:!bg-[var(--danger-soft)]"
                onClick={() => volumes.remove(idx)}
                aria-label={`${idx + 1}번 옵션 삭제`}
              >
                <Trash2 size={14} />
                삭제
              </Button>
            </div>
          ))}
          {errors.volumes?.message && (
            <div className="text-xs text-[var(--danger)]">{errors.volumes.message}</div>
          )}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="!h-8"
              onClick={() =>
                volumes.append({ label: '', price: 0, soldOut: false })
              }
            >
              <Plus size={14} />
              옵션 추가
            </Button>
          </div>
        </div>
      </Card>

      {/* 추출 레시피 카드 (category 분기) */}
      {category === 'coffee_bean' ? (
        <Card title="추출 레시피">
          <div className={cn('flex flex-col', DYNAMIC_ROW_LIST_GAP)}>
            {recipes.fields.length === 0 && (
              <div className="text-xs text-muted-foreground italic">
                아직 추출 레시피가 없습니다. 아래 버튼으로 추가해 주세요.
              </div>
            )}
            {recipes.fields.map((field, idx) => (
              <div
                key={field.id}
                className={cn(
                  'grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr_auto] items-center',
                  DYNAMIC_ROW_CELL_GAP,
                )}
              >
                <Input
                  type="text"
                  placeholder="에어로프레스"
                  aria-label={`${idx + 1}번 레시피 방식`}
                  {...register(`recipes.${idx}.method` as const)}
                />
                <Input
                  type="text"
                  placeholder="15g"
                  aria-label={`${idx + 1}번 레시피 분량`}
                  {...register(`recipes.${idx}.dose` as const)}
                />
                <Input
                  type="text"
                  placeholder="85~90°C"
                  aria-label={`${idx + 1}번 레시피 온도`}
                  {...register(`recipes.${idx}.temp` as const)}
                />
                <Input
                  type="text"
                  placeholder="1분 30초"
                  aria-label={`${idx + 1}번 레시피 시간`}
                  {...register(`recipes.${idx}.time` as const)}
                />
                {/* 마지막 input (물) + ↑↓ 한 몸 — DYNAMIC_ROW_UNIT_GAP */}
                <div className={cn('flex items-center', DYNAMIC_ROW_UNIT_GAP)}>
                  <Input
                    type="text"
                    placeholder="120g"
                    aria-label={`${idx + 1}번 레시피 물`}
                    {...register(`recipes.${idx}.water` as const)}
                  />
                  <ReorderButtons
                    idx={idx}
                    total={recipes.fields.length}
                    onMoveUp={() => recipes.swap(idx, idx - 1)}
                    onMoveDown={() => recipes.swap(idx, idx + 1)}
                    rowLabel={`${idx + 1}번 레시피`}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="!h-7 !text-[var(--danger)] hover:!bg-[var(--danger-soft)]"
                  onClick={() => recipes.remove(idx)}
                  aria-label={`${idx + 1}번 레시피 삭제`}
                >
                  <Trash2 size={14} />
                  삭제
                </Button>
              </div>
            ))}
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="!h-8"
                onClick={() =>
                  recipes.append({
                    method: '',
                    dose: '',
                    temp: '',
                    time: '',
                    water: '',
                  })
                }
              >
                <Plus size={14} />
                레시피 추가
              </Button>
            </div>
            {/* hint 들여쓰기 pl-2.5 (admin-design §5-9 답습) */}
            <div className="pl-2.5 text-xs text-muted-foreground pt-1">
              방식 · 분량 · 온도 · 시간 · 물 (예: &apos;15g&apos;, &apos;85~90°C&apos;) — 단위까지 자유롭게 적어주세요.
            </div>
          </div>
        </Card>
      ) : (
        <Card title="드립백 추출 가이드">
          <div className="px-3 py-2 bg-[var(--surface-muted)] rounded-[var(--radius-sm)] text-xs text-muted-foreground leading-[1.6]">
            드립백은 모든 상품에 동일한 <strong className="text-foreground">공통 추출 가이드</strong>가
            자동으로 적용됩니다. 본 옵션 탭에서는 편집하지 않습니다.
            <br />
            <span className="block mt-1">
              상품별 가이드 / 어드민 편집은 추후 단계에서 제공될 예정입니다.
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ── 동적 행 reorder 버튼 (↑/↓) — volumes/recipes 공유 (S231-5) ─────── */

function ReorderButtons({
  idx,
  total,
  onMoveUp,
  onMoveDown,
  rowLabel,
}: {
  idx: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  rowLabel: string;
}) {
  const canMoveUp = idx > 0;
  const canMoveDown = idx < total - 1;
  return (
    <div className="inline-flex gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="!size-7"
        onClick={onMoveUp}
        disabled={!canMoveUp}
        aria-label={`${rowLabel} 위로 이동`}
        title="위로 이동"
      >
        <ChevronUp size={14} />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="!size-7"
        onClick={onMoveDown}
        disabled={!canMoveDown}
        aria-label={`${rowLabel} 아래로 이동`}
        title="아래로 이동"
      >
        <ChevronDown size={14} />
      </Button>
    </div>
  );
}
