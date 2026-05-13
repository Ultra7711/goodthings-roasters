'use client';

/* ══════════════════════════════════════════════════════════════════════════
   ProductEditForm — /admin/products/[slug]/edit 5탭 RHF 폼 (S218 Phase 1)

   범위 (이번 단계):
   - 5탭 UI 구조 (basic 활성 / detail · option · shipping · seo 준비 중)
   - basic 탭 필드: name / category / status / displayPrice / sortOrder /
                    color / noteColor / subscription / popup
   - slug 는 read-only (상품 상세 페이지 URL 변경 위험 — 신규 등록 시만 입력)
   - dirty 상태일 때만 저장 활성
   - onSubmit → updateProductMetaAction → sonner toast + revalidate

   carry-over:
   - detail (description / specs / note_tags / flavor_desc / roast_stage / flavor radar)
   - option (product_volumes 1:N)
   - recipe (product_recipes 1:N · Coffee Bean 만)
   - shipping / seo
   ══════════════════════════════════════════════════════════════════════════ */

import { useState, useTransition } from 'react';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import { Button } from '@/components/admin/ui/button';
import { Input } from '@/components/admin/ui/input';
import { Switch } from '@/components/admin/ui/switch';
import { updateProductMetaAction } from '../../actions';
import type { ProductWithRelationsRow } from '@/types/product';

const STATUS_OPTIONS = [
  { value: '', label: '없음' },
  { value: 'NEW', label: 'NEW' },
  { value: '인기 NO.1', label: '인기 NO.1' },
  { value: '인기 NO.2', label: '인기 NO.2' },
  { value: '인기 NO.3', label: '인기 NO.3' },
  { value: '수량 한정', label: '수량 한정' },
  { value: '품절', label: '품절' },
] as const;

const CATEGORY_OPTIONS = [
  { value: 'coffee_bean', label: 'Coffee Bean' },
  { value: 'drip_bag', label: 'Drip Bag' },
] as const;

const TABS = [
  { id: 'basic', label: '기본 정보' },
  { id: 'detail', label: '상세 설명' },
  { id: 'option', label: '옵션 / 재고' },
  { id: 'shipping', label: '배송' },
  { id: 'seo', label: 'SEO' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const ProductStatusEnum = z
  .enum(['NEW', '인기 NO.1', '인기 NO.2', '인기 NO.3', '수량 한정', '품절'])
  .nullable();

const HexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, '#RRGGBB 형식이어야 합니다');

const FormSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1, '상품명을 입력해주세요').max(60, '최대 60자'),
  category: z.enum(['coffee_bean', 'drip_bag']),
  status: ProductStatusEnum,
  displayPrice: z.string().min(1, '가격을 입력해주세요').max(30),
  sortOrder: z.number().int().min(0).max(9999),
  color: HexColor,
  subscription: z.boolean(),
  popup: z.boolean(),
});

type FormValues = z.infer<typeof FormSchema>;

type Props = {
  product: ProductWithRelationsRow;
};

export default function ProductEditForm({ product }: Props) {
  const [tab, setTab] = useState<TabId>('basic');
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      id: product.id,
      slug: product.slug,
      name: product.name,
      category: product.category,
      status: product.status,
      displayPrice: product.display_price,
      sortOrder: product.sort_order,
      color: product.color,
      subscription: product.subscription,
      popup: product.popup,
    },
  });

  const onSubmit: SubmitHandler<FormValues> = (values) => {
    startTransition(async () => {
      const result = await updateProductMetaAction(values);
      if (!result.ok) {
        const msg =
          result.error === 'unauthorized'
            ? '권한이 없습니다. 다시 로그인해주세요.'
            : result.error === 'validation_failed'
              ? `입력값을 확인해주세요. (${result.detail ?? ''})`
              : result.error === 'not_found'
                ? '상품을 찾을 수 없습니다.'
                : '처리 중 오류가 발생했습니다.';
        toast.error(msg);
        return;
      }
      toast.success('상품 정보를 저장했습니다');
      reset(values, { keepValues: true }); // dirty 해제
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* 상단 액션 바 — 취소 + 저장 (이미지 reorder 는 즉시 저장, 별개 흐름).
          settings · orders 페이지와 동일 ghost/primary 패턴. */}
      <AdminTopbarActions>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="!h-7"
          onClick={() => reset()}
          disabled={!isDirty || pending}
        >
          변경 취소
        </Button>
        <Button
          type="submit"
          size="sm"
          className="!h-7"
          disabled={!isDirty || pending}
        >
          {pending ? '저장 중…' : '변경사항 저장'}
        </Button>
      </AdminTopbarActions>

      {/* 탭 */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid var(--border)',
          marginBottom: 16,
        }}
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                padding: '8px 14px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                color: active ? 'var(--foreground)' : 'var(--foreground-muted)',
                position: 'relative',
              }}
            >
              {t.label}
              {active && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: -1,
                    height: 2,
                    background: 'var(--primary)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 탭 본문 */}
      {tab === 'basic' ? (
        <BasicTab register={register} control={control} errors={errors} />
      ) : (
        <ComingSoonPanel label={TABS.find((t) => t.id === tab)?.label ?? ''} />
      )}

      {/* dirty 안내 (액션 버튼은 상단으로 portal) */}
      {isDirty && !pending && (
        <div
          style={{
            marginTop: 14,
            padding: '8px 12px',
            background: 'var(--warning-soft)',
            color: 'var(--warning)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12,
          }}
        >
          저장되지 않은 변경이 있습니다 — 상단의 변경 저장 버튼을 눌러주세요.
        </div>
      )}
    </form>
  );
}

/* ── basic 탭 ────────────────────────────────────────────────────────── */

function BasicTab({
  register,
  control,
  errors,
}: {
  register: ReturnType<typeof useForm<FormValues>>['register'];
  control: ReturnType<typeof useForm<FormValues>>['control'];
  errors: ReturnType<typeof useForm<FormValues>>['formState']['errors'];
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
          <Field label="슬러그" hint="상품 상세 페이지 URL · 변경 불가 (신규 등록에서만 입력)">
            <Input type="text" {...register('slug')} readOnly />
          </Field>
        </FieldGrid>

        <FieldGrid cols={3}>
          <Field label="카테고리" required error={errors.category?.message}>
            <select {...register('category')} style={inputStyle}>
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="상태 배지">
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <select
                  value={field.value ?? ''}
                  onChange={(e) =>
                    field.onChange(e.target.value === '' ? null : e.target.value)
                  }
                  style={inputStyle}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
            />
          </Field>
          <Field label="정렬 순서" required error={errors.sortOrder?.message}>
            <Input
              type="number"
              min={0}
              {...register('sortOrder', { valueAsNumber: true })}
            />
          </Field>
        </FieldGrid>

        <FieldGrid cols={2}>
          <Field
            label="표시 가격"
            required
            error={errors.displayPrice?.message}
            hint="예: 18,000 또는 18,000원"
          >
            <Input type="text" {...register('displayPrice')} />
          </Field>
        </FieldGrid>
      </Card>

      {/* 컬러 카드 */}
      <Card title="대표 컬러">
        <Field
          label="배경 컬러"
          hint="상품 상세 페이지 구매 영역 · 카트 · 결제 요약 썸네일 배경에 사용됩니다 (포장의 메인 톤과 어울리는 베이지/크림 권장)"
          error={errors.color?.message}
        >
          <ColorField name="color" register={register} control={control} />
        </Field>
      </Card>

      {/* 노출 옵션 카드 */}
      <Card title="노출 옵션">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ToggleRow
            label="정기 배송 상품"
            hint="상품 상세 페이지에서 정기 옵션 노출됩니다"
            name="subscription"
            control={control}
          />
          <ToggleRow
            label="홈 시그니처 챕터 노출 후보"
            hint="홈 메인 SignatureChapter 선택 가능 리스트에 등록됩니다"
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
  register,
  control,
}: {
  name: 'color';
  register: ReturnType<typeof useForm<FormValues>>['register'];
  control: ReturnType<typeof useForm<FormValues>>['control'];
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 10px',
            height: 34,
            background: 'var(--surface)',
            border: '1px solid var(--input)',
            borderRadius: 6,
          }}
        >
          <input
            type="color"
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            style={{
              width: 24,
              height: 24,
              border: 'none',
              padding: 0,
              background: 'transparent',
              cursor: 'pointer',
            }}
            aria-label="색상 선택"
          />
          <input
            type="text"
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            maxLength={7}
            className="gtr-mono"
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 13,
              color: 'var(--foreground)',
              padding: 0,
            }}
            placeholder="#000000"
          />
        </div>
      )}
    />
  );
}

/* ── 토글 행 (subscription / popup) ───────────────────────────────────── */

function ToggleRow({
  label,
  hint,
  name,
  control,
}: {
  label: string;
  hint: string;
  name: 'subscription' | 'popup';
  control: ReturnType<typeof useForm<FormValues>>['control'];
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--foreground-muted)',
                marginTop: 2,
              }}
            >
              {hint}
            </div>
          </div>
          <Switch
            checked={!!field.value}
            onCheckedChange={field.onChange}
            aria-label={field.value ? `${label} 켜짐` : `${label} 꺼짐`}
            className="data-[state=unchecked]:bg-[var(--switch-off-bg)]"
          />
        </div>
      )}
    />
  );
}

/* ── 준비 중 패널 ─────────────────────────────────────────────────────── */

function ComingSoonPanel({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: '48px 18px',
        textAlign: 'center',
        background: 'var(--surface-muted)',
        border: '1px dashed var(--border-strong)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--foreground-muted)',
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 500, color: 'var(--foreground)' }}>
        {label} 탭 준비 중
      </div>
      <div style={{ marginTop: 6, fontSize: 12 }}>
        다음 단계에서 추가됩니다.
      </div>
    </div>
  );
}

/* ── primitives ──────────────────────────────────────────────────────── */

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 20,
      }}
    >
      <h3
        style={{
          margin: '0 0 14px',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--foreground-muted)',
        }}
      >
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {children}
      </div>
    </div>
  );
}

function FieldGrid({
  cols = 2,
  children,
}: {
  cols?: 1 | 2 | 3;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  error,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        style={{
          fontSize: 12.5,
          fontWeight: 500,
          color: 'var(--foreground)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {label}
        {required && <span style={{ color: 'var(--primary)' }}>*</span>}
      </label>
      {children}
      {error ? (
        <div style={{ fontSize: 11.5, color: 'var(--danger)' }}>{error}</div>
      ) : (
        hint && (
          <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)' }}>
            {hint}
          </div>
        )
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 34,
  padding: '0 10px',
  background: 'var(--surface)',
  border: '1px solid var(--input)',
  borderRadius: 6,
  fontSize: 13,
  color: 'var(--foreground)',
  outline: 'none',
  fontFamily: 'inherit',
};

/* S222 PR-5c: SM_BASE/GHOST/PRIMARY 상수 폐기 (shadcn Button 으로 대체).
   inputStyle = native select 의 fallback 유지 (DEC-5 native select 정책). */
