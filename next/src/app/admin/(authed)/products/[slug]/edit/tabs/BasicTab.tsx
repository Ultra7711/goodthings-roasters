/* ══════════════════════════════════════════
   tabs/BasicTab.tsx — 기본 정보 탭 (S260 분리)

   - 기본 정보 카드 (name/slug/category/status/sortOrder/displayPrice)
   - 본문 설명 카드 (description textarea)
   - 대표 컬러 카드 (ColorField — color picker + hex)
   - 노출 옵션 카드 (subscription / popup 토글)
   ══════════════════════════════════════════ */

import {
  Controller,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from 'react-hook-form';
import {
  ADMIN_READONLY_FIELD,
  ADMIN_SELECT_CLASS,
  NativeSelectWrap,
} from '@/components/admin/NativeSelectWrap';
import { Input } from '@/components/admin/ui/input';
import { Textarea } from '@/components/admin/ui/textarea';
import { cn } from '@/lib/utils';
import { CATEGORY_OPTIONS, STATUS_OPTIONS } from '../_shared/constants';
import type { FormValues } from '../_shared/schema';
import { Card, Field, FieldGrid } from '../_shared/primitives';
import { ToggleRow } from '../_shared/ToggleRow';

export function BasicTab({
  register,
  control,
  errors,
  autoDisplayPrice,
  isCreate,
}: {
  register: UseFormRegister<FormValues>;
  control: Control<FormValues>;
  errors: FieldErrors<FormValues>;
  autoDisplayPrice: string;
  isCreate: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* 기본 정보 카드 */}
      <Card title="기본 정보">
        <FieldGrid>
          <Field
            label="상품명"
            required
            hint="한글 + 영문 · 공백으로 구분 (최대 60자)"
            error={errors.name?.message}
          >
            <Input
              type="text"
              maxLength={60}
              placeholder="가을의 밤 Autumn Night"
              {...register('name')}
            />
          </Field>
          <Field
            label="슬러그"
            required={isCreate}
            hint={
              isCreate
                ? '상품명의 영문 부분에서 자동 생성됩니다. 직접 수정도 가능합니다 (소문자/숫자 + 하이픈).'
                : '상품 상세 페이지 URL · 등록 후 변경 불가'
            }
            error={errors.slug?.message}
          >
            {isCreate ? (
              <Input
                type="text"
                maxLength={80}
                placeholder="autumn-night"
                className="gtr-mono"
                {...register('slug')}
              />
            ) : (
              <Input
                type="text"
                {...register('slug')}
                readOnly
                aria-disabled
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onFocus={(e) => e.currentTarget.blur()}
                className={ADMIN_READONLY_FIELD}
              />
            )}
          </Field>
        </FieldGrid>

        <FieldGrid cols={3}>
          <Field
            label="카테고리"
            required
            hint={
              isCreate
                ? '드립백은 모든 상품에 공통 추출 가이드가 자동 적용됩니다.'
                : undefined
            }
            error={errors.category?.message}
          >
            <NativeSelectWrap>
              <select
                {...register('category')}
                className={ADMIN_SELECT_CLASS}
                style={{ fontFamily: 'inherit' }}
              >
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </NativeSelectWrap>
          </Field>
          <Field label="상태 배지">
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <NativeSelectWrap>
                  <select
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? null : e.target.value)
                    }
                    className={ADMIN_SELECT_CLASS}
                    style={{ fontFamily: 'inherit' }}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </NativeSelectWrap>
              )}
            />
          </Field>
          <Field
            label="정렬 순서"
            hint={
              isCreate
                ? '같은 카테고리 맨 뒤로 자동 배치됩니다. 순서 변경은 등록 후 상품 목록 페이지에서 ↑/↓ 버튼으로 가능합니다.'
                : '카테고리 내 표시 순서. 변경은 상품 목록 페이지에서 ↑/↓ 버튼으로 가능합니다.'
            }
            error={errors.sortOrder?.message}
          >
            <Controller
              name="sortOrder"
              control={control}
              render={({ field }) => (
                <div
                  role="status"
                  className={cn(
                    ADMIN_READONLY_FIELD,
                    'flex items-center h-9 px-3 border rounded-md text-sm gtr-mono',
                  )}
                >
                  {typeof field.value === 'number' ? field.value : 0}
                </div>
              )}
            />
          </Field>
        </FieldGrid>

        <FieldGrid cols={2}>
          <Field
            label="표시 가격"
            hint="카드/PDP 노출 형식. '용량 / 옵션' 탭의 첫 번째 옵션 가격 기반으로 자동 생성됩니다."
            error={errors.displayPrice?.message}
          >
            <div
              role="status"
              aria-live="polite"
              className={cn(
                ADMIN_READONLY_FIELD,
                'flex items-center h-9 px-3 border rounded-md text-sm gtr-mono',
              )}
            >
              {autoDisplayPrice || '옵션 추가 시 자동 표시'}
            </div>
          </Field>
        </FieldGrid>
      </Card>

      {/* 본문 설명 카드 */}
      <Card title="본문 설명">
        <Field
          label="설명"
          hint="PDP 본문에 노출됩니다. 멀티라인 가능."
          error={errors.description?.message}
        >
          <Textarea
            rows={5}
            maxLength={4000}
            placeholder="원두의 향미 · 산지 · 로스팅 의도 등 본문 설명"
            className="leading-tight"
            {...register('description')}
          />
        </Field>
      </Card>

      {/* 컬러 카드 */}
      <Card title="대표 컬러">
        <Field
          label="배경 컬러"
          hint="이미지가 1:1 비율을 벗어날 때 보이는 여백 컬러. 운영 표준은 #eaeaea 일괄 적용 — 예외가 필요한 상품만 변경하세요."
          error={errors.color?.message}
        >
          <ColorField name="color" register={register} control={control} />
        </Field>
      </Card>

      {/* 노출 옵션 카드 */}
      <Card title="노출 옵션">
        <div className="flex flex-col gap-2.5">
          <ToggleRow
            label="정기 배송 상품"
            hint="상품 상세 페이지에서 정기 옵션 노출됩니다"
            name="subscription"
            control={control}
          />
          <ToggleRow
            label="노출 후보 플래그 (예약)"
            hint="현재 사이트 어디서도 사용하지 않음 · 컬럼만 보존 (S237 시그니처 iframe 모델 전환)"
            name="popup"
            control={control}
          />
        </div>
      </Card>
    </div>
  );
}

/* ── 색상 필드 (color picker + hex) ──────────────────────────────────── */

function ColorField({
  name,

  register: _register,
  control,
}: {
  name: 'color';
  register: UseFormRegister<FormValues>;
  control: Control<FormValues>;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <div className="flex items-center gap-2 px-2.5 h-[34px] bg-[var(--surface)] border border-input rounded-md">
          <input
            type="color"
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            className="border-none p-0 bg-transparent cursor-pointer"
            style={{ width: 24, height: 24 }}
            aria-label="색상 선택"
          />
          <input
            type="text"
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            maxLength={7}
            className="gtr-mono flex-1 min-w-0 border-none outline-none bg-transparent text-sm text-[var(--foreground)] p-0"
            placeholder="#000000"
          />
        </div>
      )}
    />
  );
}
