'use client';

/* ══════════════════════════════════════════════════════════════════════════
   ProductEditForm — /admin/products/[slug]/edit 3탭 RHF 폼

   탭 구성 (S231 β · shipping/seo 제거 — 도메인 부재):
   - basic   : name / category / status / displayPrice / sortOrder /
               color / subscription / popup
   - detail  : 5축 노트 + roast_stage + note_tags + flavor_desc
   - option  : product_volumes (1:N) · product_recipes (Coffee Bean 만)

   - slug 는 read-only (URL 변경 위험 — 신규 등록 시만 입력)
   - dirty 상태일 때만 저장 활성
   - onSubmit → updateProductMetaAction → sonner toast + revalidate
   ══════════════════════════════════════════════════════════════════════════ */

import { useState, useTransition } from 'react';
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type SubmitHandler,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import {
  FlavorChipInput,
  decodeChipsFromColumns,
  type FlavorChip,
} from '@/components/admin/FlavorChipInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/admin/ui/select';
import { Button } from '@/components/admin/ui/button';
import { Input } from '@/components/admin/ui/input';
import { Slider } from '@/components/admin/ui/slider';
import { Switch } from '@/components/admin/ui/switch';
import { Textarea } from '@/components/admin/ui/textarea';
import { updateProductMetaAction } from '../../actions';
import type { ProductWithRelationsRow } from '@/types/product';
import { cn } from '@/lib/utils';

/** PDP ProductRoastStage 의 한글 음차 라벨 답습 */
const ROAST_STAGE_OPTIONS = [
  { value: 'light', label: '라이트' },
  { value: 'medium-light', label: '미디엄 라이트' },
  { value: 'medium', label: '미디엄' },
  { value: 'medium-dark', label: '미디엄 다크' },
  { value: 'dark', label: '다크' },
  { value: 'italian', label: '이탈리안', disabled: true, hint: '국내 시장 희귀 — 사용 안 함' },
] as const;

const FLAVOR_AXES = [
  { key: 'noteSweet', label: 'Sweet (단맛)' },
  { key: 'noteBody', label: 'Body (바디)' },
  { key: 'noteAftertaste', label: 'Aftertaste (여운)' },
  { key: 'noteAroma', label: 'Aroma (향)' },
  { key: 'noteAcidity', label: 'Acidity (산미)' },
] as const;

/** 옵션 최소가 기반 display_price placeholder 동적 생성 */
function buildPricePlaceholder(volumes: ProductWithRelationsRow['product_volumes']): string {
  if (!volumes || volumes.length === 0) return '예: 14,000원';
  const prices = volumes.map((v) => v.price).filter((p) => Number.isFinite(p) && p > 0);
  if (prices.length === 0) return '예: 14,000원';
  const min = Math.min(...prices);
  const formatted = `${min.toLocaleString('ko-KR')}원`;
  return prices.length > 1 ? `${formatted}부터` : formatted;
}

/** Radix Select 는 SelectItem value="" 비허용 — null/empty 를 표현하는 sentinel. */
const STATUS_NONE_VALUE = '__none__';

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
  { id: 'option', label: '용량 / 옵션' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const ProductStatusEnum = z
  .enum(['NEW', '인기 NO.1', '인기 NO.2', '인기 NO.3', '수량 한정', '품절'])
  .nullable();

const HexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, '#RRGGBB 형식이어야 합니다');

const RoastStageEnum = z.enum([
  'light',
  'medium-light',
  'medium',
  'medium-dark',
  'dark',
  'italian',
]);

const FlavorAxis = z.number().min(0).max(5);

const VolumeSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1, '라벨 필요').max(50),
  price: z.number().int().min(0).max(99_999_999),
  soldOut: z.boolean(),
});

const RecipeSchema = z.object({
  id: z.string().uuid().optional(),
  method: z.string().min(1, '방식 필요').max(50),
  dose: z.string().min(1, '분량 필요').max(50),
  temp: z.string().min(1, '온도 필요').max(50),
  time: z.string().min(1, '시간 필요').max(50),
  water: z.string().min(1, '물 필요').max(50),
});

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
  description: z.string().max(4000),
  flavorDesc: z.string().max(200),
  roastStage: RoastStageEnum,
  noteChips: z
    .array(z.object({ ko: z.string().min(1), en: z.string() }))
    .max(20),
  noteColor: HexColor,
  noteSweet: FlavorAxis,
  noteBody: FlavorAxis,
  noteAftertaste: FlavorAxis,
  noteAroma: FlavorAxis,
  noteAcidity: FlavorAxis,
  volumes: z.array(VolumeSchema).min(1, '최소 1개 옵션이 필요합니다'),
  recipes: z.array(RecipeSchema),
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
      description: product.description ?? '',
      flavorDesc: product.flavor_desc ?? '',
      roastStage: product.roast_stage,
      noteChips: decodeChipsFromColumns(
        product.note_tags ?? '',
        product.note_tags_en ?? '',
      ),
      noteColor: product.note_color ?? '#A47146',
      noteSweet: Number(product.note_sweet) || 0,
      noteBody: Number(product.note_body) || 0,
      noteAftertaste: Number(product.note_aftertaste) || 0,
      noteAroma: Number(product.note_aroma) || 0,
      noteAcidity: Number(product.note_acidity) || 0,
      volumes: [...product.product_volumes]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((v) => ({
          id: v.id,
          label: v.label,
          price: v.price,
          soldOut: v.sold_out,
        })),
      recipes: [...product.product_recipes]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((r) => ({
          id: r.id,
          method: r.method,
          dose: r.dose,
          temp: r.temp,
          time: r.time,
          water: r.water,
        })),
    },
  });

  const pricePlaceholder = buildPricePlaceholder(product.product_volumes);

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
      <div className="flex gap-1 border-b border-border mb-4">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'px-3 py-2 bg-transparent border-none cursor-pointer text-sm relative',
                active
                  ? 'font-medium text-foreground'
                  : 'font-normal text-muted-foreground',
              )}
            >
              {t.label}
              {active && (
                <span
                  aria-hidden
                  className="absolute left-0 right-0 h-0.5 bg-[var(--primary)]"
                  style={{ bottom: -1 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 탭 본문 */}
      {tab === 'basic' && (
        <BasicTab
          register={register}
          control={control}
          errors={errors}
          pricePlaceholder={pricePlaceholder}
        />
      )}
      {tab === 'detail' && (
        <DetailTab register={register} control={control} errors={errors} />
      )}
      {tab === 'option' && (
        <OptionTab register={register} control={control} errors={errors} />
      )}

      {/* dirty 안내 (액션 버튼은 상단으로 portal) */}
      {isDirty && !pending && (
        <div className="mt-3 px-3 py-2 bg-[var(--warning-soft)] text-[var(--warning)] rounded-[var(--radius-sm)] text-xs">
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
  pricePlaceholder,
}: {
  register: ReturnType<typeof useForm<FormValues>>['register'];
  control: ReturnType<typeof useForm<FormValues>>['control'];
  errors: ReturnType<typeof useForm<FormValues>>['formState']['errors'];
  pricePlaceholder: string;
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
          <Field label="슬러그" hint="상품 상세 페이지 URL · 변경 불가 (신규 등록에서만 입력)">
            <Input
              type="text"
              {...register('slug')}
              readOnly
              aria-disabled
              tabIndex={-1}
              className="cursor-not-allowed opacity-60 bg-[var(--surface-muted)] text-muted-foreground"
            />
          </Field>
        </FieldGrid>

        <FieldGrid cols={3}>
          <Field label="카테고리" required error={errors.category?.message}>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="상태 배지">
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? STATUS_NONE_VALUE}
                  onValueChange={(v) =>
                    field.onChange(v === STATUS_NONE_VALUE ? null : v)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="없음" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem
                        key={o.value === '' ? STATUS_NONE_VALUE : o.value}
                        value={o.value === '' ? STATUS_NONE_VALUE : o.value}
                      >
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            hint="카드/카탈로그 노출용 문구. 옵션별 실 가격은 '용량 / 옵션' 탭에서 관리합니다."
          >
            <Input type="text" placeholder={pricePlaceholder} {...register('displayPrice')} />
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
            placeholder="원두의 향미·산지·로스팅 의도 등 본문 설명"
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
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">{label}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
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

/* ── detail 탭 ───────────────────────────────────────────────────────── */

function DetailTab({
  register,
  control,
  errors,
}: {
  register: ReturnType<typeof useForm<FormValues>>['register'];
  control: ReturnType<typeof useForm<FormValues>>['control'];
  errors: ReturnType<typeof useForm<FormValues>>['formState']['errors'];
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
      </Card>

      {/* 노트 태그 카드 — 시그니처 설정과 동일한 한·영 페어 chip UI 답습 */}
      <Card title="노트 태그">
        <Field
          label="한·영 페어 chip"
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

/* ── option 탭 ───────────────────────────────────────────────────────── */

function OptionTab({
  register,
  control,
  errors,
}: {
  register: ReturnType<typeof useForm<FormValues>>['register'];
  control: ReturnType<typeof useForm<FormValues>>['control'];
  errors: ReturnType<typeof useForm<FormValues>>['formState']['errors'];
}) {
  const category = useWatch({ control, name: 'category' });
  const volumes = useFieldArray({ control, name: 'volumes' });
  const recipes = useFieldArray({ control, name: 'recipes' });

  return (
    <div className="flex flex-col gap-3">
      {/* 용량 / 옵션 카드 */}
      <Card title="용량 / 옵션">
        <div className="flex flex-col gap-2">
          {volumes.fields.length === 0 && (
            <div className="text-xs text-muted-foreground italic">
              옵션이 없습니다. 아래 버튼으로 추가하세요.
            </div>
          )}
          {volumes.fields.map((field, idx) => (
            <div
              key={field.id}
              className="grid grid-cols-[1fr_140px_auto_auto] gap-2 items-center"
            >
              <Input
                type="text"
                placeholder="예: 200g · 500g · 1개"
                maxLength={50}
                aria-label={`옵션 ${idx + 1} 라벨`}
                {...register(`volumes.${idx}.label` as const)}
              />
              <Input
                type="number"
                min={0}
                placeholder="가격(KRW)"
                aria-label={`옵션 ${idx + 1} 가격`}
                {...register(`volumes.${idx}.price` as const, { valueAsNumber: true })}
              />
              <Controller
                control={control}
                name={`volumes.${idx}.soldOut` as const}
                render={({ field: soField }) => (
                  <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                    <Switch
                      size="sm"
                      checked={!!soField.value}
                      onCheckedChange={soField.onChange}
                      aria-label="품절 토글"
                    />
                    품절
                  </label>
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="!h-7"
                onClick={() => volumes.remove(idx)}
                aria-label={`옵션 ${idx + 1} 삭제`}
              >
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
              className="!h-7"
              onClick={() =>
                volumes.append({ label: '', price: 0, soldOut: false })
              }
            >
              + 옵션 추가
            </Button>
          </div>
        </div>
      </Card>

      {/* 추출 레시피 카드 (category 분기) */}
      {category === 'coffee_bean' ? (
        <Card title="추출 레시피">
          <div className="flex flex-col gap-2">
            {recipes.fields.length === 0 && (
              <div className="text-xs text-muted-foreground italic">
                레시피가 없습니다. 추출 방식별로 추가하세요.
              </div>
            )}
            {recipes.fields.map((field, idx) => (
              <div
                key={field.id}
                className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center"
              >
                <Input
                  type="text"
                  placeholder="에어로프레스"
                  aria-label={`레시피 ${idx + 1} 방식`}
                  {...register(`recipes.${idx}.method` as const)}
                />
                <Input
                  type="text"
                  placeholder="15g"
                  aria-label={`레시피 ${idx + 1} 분량`}
                  {...register(`recipes.${idx}.dose` as const)}
                />
                <Input
                  type="text"
                  placeholder="85~90°C"
                  aria-label={`레시피 ${idx + 1} 온도`}
                  {...register(`recipes.${idx}.temp` as const)}
                />
                <Input
                  type="text"
                  placeholder="1분 30초"
                  aria-label={`레시피 ${idx + 1} 시간`}
                  {...register(`recipes.${idx}.time` as const)}
                />
                <Input
                  type="text"
                  placeholder="120g"
                  aria-label={`레시피 ${idx + 1} 물`}
                  {...register(`recipes.${idx}.water` as const)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="!h-7"
                  onClick={() => recipes.remove(idx)}
                  aria-label={`레시피 ${idx + 1} 삭제`}
                >
                  삭제
                </Button>
              </div>
            ))}
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="!h-7"
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
                + 레시피 추가
              </Button>
            </div>
            <div className="text-xs text-muted-foreground pt-1">
              컬럼 순서: 추출 방식 / 분량 / 온도 / 시간 / 물 — 모두 텍스트 (단위 포함 자유 입력)
            </div>
          </div>
        </Card>
      ) : (
        <Card title="드립백 추출 가이드">
          <div className="px-3 py-2 bg-[var(--surface-muted)] rounded-[var(--radius-sm)] text-xs text-muted-foreground leading-[1.6]">
            드립백 상품은 <strong className="text-foreground">DRIP_BAG_RECIPE 전역 상수</strong>
            (모든 drip_bag 공통 3단계 + 팁) 가 적용됩니다. 본 옵션 탭에서는 편집하지 않습니다.
            <br />
            <span className="block mt-1">
              상품별 / 어드민 편집 흐름은 후속 sprint (Phase 3-D · site_settings 통합) 에서
              제공 예정입니다. carry-over: <code>memory/project_drip_bag_recipe_admin.md</code>
            </span>
          </div>
        </Card>
      )}
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
  control: ReturnType<typeof useForm<FormValues>>['control'];
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

/* ── 로스팅 단계 칩 (§5-23 표준) ──────────────────────────────────────── */

function RoastStageChips({
  control,
}: {
  control: ReturnType<typeof useForm<FormValues>>['control'];
}) {
  return (
    <Controller
      name="roastStage"
      control={control}
      render={({ field }) => (
        <div className="flex flex-wrap gap-2">
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
                  'px-3 py-1.5 rounded-md text-xs border font-medium cursor-pointer transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent border-input text-foreground hover:bg-accent',
                  disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent',
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

/* ── 준비 중 패널 ─────────────────────────────────────────────────────── */

function ComingSoonPanel({ label }: { label: string }) {
  return (
    <div
      className="px-4 py-12 text-center bg-[var(--surface-muted)] rounded-[var(--radius-sm)] text-muted-foreground text-sm"
      style={{ border: '1px dashed var(--border-strong)' }}
    >
      <div className="font-medium text-foreground">{label} 탭 준비 중</div>
      <div className="mt-1.5 text-xs">다음 단계에서 추가됩니다.</div>
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
    <div className="bg-[var(--surface)] border border-border rounded-[var(--radius)] p-5">
      <h3 className="m-0 mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
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
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
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
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[var(--foreground)] tracking-[-0.005em] flex items-center gap-1">
        {label}
        {required && <span className="text-[var(--primary)]">*</span>}
      </label>
      {children}
      {error ? (
        <div className="pl-2.5 text-xs text-[var(--danger)]">{error}</div>
      ) : (
        hint && <div className="pl-2.5 text-xs text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

/* DEC-5 갱신 (S231-11): native select → shadcn Radix Select 전환.
   DropdownFilter 와 동일 옵션 목록 스타일 단일화 · OS dropdown 의존 폐기.
   S222 PR-5c: SM_BASE/GHOST/PRIMARY 상수 폐기 — shadcn Button 으로 대체. */
