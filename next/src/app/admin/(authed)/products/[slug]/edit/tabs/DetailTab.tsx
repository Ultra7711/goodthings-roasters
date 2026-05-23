/* ══════════════════════════════════════════
   tabs/DetailTab.tsx — 상세 설명 탭 (S260 분리)

   - 플레이버 한 줄 카드 (flavorDesc)
   - 5축 노트 카드 (FlavorAxisSlider × 5)
   - 로스팅 단계 카드 (RoastStageChips + RoastDescField · 단계별 default prefill + lock)
   - 노트 태그 카드 (FlavorChipInput — 한·영 페어 chip)
   ══════════════════════════════════════════ */

import { useEffect, useRef } from 'react';
import {
  Controller,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormGetValues,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';
import { FlavorChipInput } from '@/components/admin/FlavorChipInput';
import { Input } from '@/components/admin/ui/input';
import { Slider } from '@/components/admin/ui/slider';
import { Textarea } from '@/components/admin/ui/textarea';
import { cn } from '@/lib/utils';
import {
  FLAVOR_AXES,
  ROAST_STAGE_OPTIONS,
  ROAST_STAGE_PLACEHOLDERS,
} from '../_shared/constants';
import type { FormValues } from '../_shared/schema';
import { Card, Field } from '../_shared/primitives';

export function DetailTab({
  register,
  control,
  setValue,
  getValues,
  errors,
}: {
  register: UseFormRegister<FormValues>;
  control: Control<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  getValues: UseFormGetValues<FormValues>;
  errors: FieldErrors<FormValues>;
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* 플레이버 한 줄 카드 */}
      <Card title="플레이버">
        <Field
          label="한 줄 설명"
          required
          hint="PDP 헤더에 노출되는 짧은 플레이버 묘사 (최대 200자)"
          error={errors.flavorDesc?.message}
        >
          <Input
            type="text"
            maxLength={200}
            placeholder="예: 자몽의 산뜻한 산미와 설탕의 단맛"
            {...register('flavorDesc')}
          />
        </Field>
      </Card>

      {/* 5축 노트 카드 */}
      <Card title="플레이버 노트 (5축)">
        <div className="flex flex-col gap-3">
          {FLAVOR_AXES.map((axis) => (
            <FlavorAxisSlider
              key={axis.key}
              name={axis.key}
              label={axis.label}
              control={control}
            />
          ))}
        </div>
      </Card>

      {/* 로스팅 단계 카드 */}
      <Card title="로스팅 단계">
        <Field
          label="단계 선택"
          required
          hint="PDP 로스팅 게이지에 반영됩니다. 이탈리안은 국내 시장 희귀로 사용 안 함."
          error={errors.roastStage?.message}
        >
          <RoastStageChips control={control} />
        </Field>
        <RoastDescField
          register={register}
          control={control}
          setValue={setValue}
          getValues={getValues}
          errors={errors}
        />
      </Card>

      {/* 노트 태그 카드 — 시그니처 설정과 동일한 한 · 영 페어 chip UI 답습 */}
      <Card title="노트 태그">
        <Field
          label="한 · 영 페어 chip"
          hint="입력 예: '복숭아 Peach' · Enter 또는 쉼표로 추가 · 영문 생략 가능. PDP 본문 + 시그니처 자동 추출에 사용됩니다."
          error={
            (errors.noteChips as { message?: string } | undefined)?.message ??
            undefined
          }
        >
          <Controller
            name="noteChips"
            control={control}
            render={({ field }) => (
              <FlavorChipInput
                value={field.value}
                onChange={field.onChange}
                showCount
                emptyMessage="(chip 없음 — Enter / 쉼표로 추가)"
              />
            )}
          />
        </Field>
      </Card>
    </div>
  );
}

/* ── 5축 슬라이더 (0~5 step 0.1) ──────────────────────────────────────── */

function FlavorAxisSlider({
  name,
  label,
  control,
}: {
  name: 'noteSweet' | 'noteBody' | 'noteAftertaste' | 'noteAroma' | 'noteAcidity';
  label: string;
  control: Control<FormValues>;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const value = typeof field.value === 'number' ? field.value : 0;
        return (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-medium text-[var(--foreground)] tracking-[-0.005em]">
                {label}
              </label>
              <span className="gtr-mono text-xs text-muted-foreground tabular-nums">
                {value.toFixed(1)} / 5
              </span>
            </div>
            <Slider
              value={[value]}
              min={0}
              max={5}
              step={0.1}
              onValueChange={(next) => field.onChange(next[0] ?? 0)}
              aria-label={`${label} 점수`}
            />
          </div>
        );
      }}
    />
  );
}

/* ── 로스팅 설명 textarea (S231-4) ───────────────────────────────────
   동작 (slug 자동 옵션 B 답습):
   - 단계 변경 시 입력값이 직전 단계의 default 와 일치하면 새 단계 default 로 자동 갱신
   - 운영자가 직접 수정해 default 와 달라지면 lock — 단계 변경해도 텍스트 보존
   - 빈 값으로 저장 시 PDP 가 fallback 으로 STAGE_DESCRIPTIONS 답습 */

function RoastDescField({
  register,
  control,
  setValue,
  getValues,
  errors,
}: {
  register: UseFormRegister<FormValues>;
  control: Control<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  getValues: UseFormGetValues<FormValues>;
  errors: FieldErrors<FormValues>;
}) {
  const stage = useWatch({ control, name: 'roastStage' });
  const prevAutoRef = useRef<string>(
    ROAST_STAGE_PLACEHOLDERS[stage] ?? '',
  );

  useEffect(() => {
    const next = ROAST_STAGE_PLACEHOLDERS[stage] ?? '';
    if (next === prevAutoRef.current) return;
    const current = (getValues('roastDesc') ?? '').trim();
    /* 현재값 == 직전 자동값 → 운영자가 수정 안 한 상태 → 자동 갱신 */
    if (current === prevAutoRef.current.trim()) {
      setValue('roastDesc', next, { shouldDirty: true, shouldValidate: false });
    }
    prevAutoRef.current = next;
  }, [stage, getValues, setValue]);

  return (
    <Field
      label="단계 설명"
      hint="단계를 바꾸면 기본 설명이 자동으로 채워집니다. 직접 수정하면 그 내용이 유지됩니다."
      error={errors.roastDesc?.message}
    >
      <Textarea
        rows={3}
        maxLength={500}
        className="leading-tight"
        {...register('roastDesc')}
      />
    </Field>
  );
}

/* ── 로스팅 단계 칩 (§5-23 표준) ──────────────────────────────────────── */

function RoastStageChips({
  control,
}: {
  control: Control<FormValues>;
}) {
  return (
    <Controller
      name="roastStage"
      control={control}
      render={({ field }) => (
        <div className="flex flex-wrap gap-1.5">
          {ROAST_STAGE_OPTIONS.map((opt) => {
            const active = field.value === opt.value;
            const disabled = 'disabled' in opt && opt.disabled === true;
            return (
              <button
                key={opt.value}
                type="button"
                data-slot="chip-radio"
                disabled={disabled}
                onClick={() => !disabled && field.onChange(opt.value)}
                title={'hint' in opt ? opt.hint : undefined}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs border font-medium cursor-pointer',
                  active
                    ? 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary)]'
                    : 'bg-[var(--surface)] text-foreground border-border',
                  disabled && 'opacity-50 cursor-not-allowed',
                )}
                aria-pressed={active}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    />
  );
}
