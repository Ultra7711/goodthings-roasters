'use client';

/* ══════════════════════════════════════════════════════════════════════════
   MenuEditForm — /admin/menu/[id]/edit + /admin/menu/new 공유 (S244)

   답습:
   - ProductEditForm 패턴 (mode discriminated union + RHF + zod + 탭 + Topbar 액션)
   - 이미지 섹션은 폼 밖 별 섹션 (edit 페이지 자체) — DEC-S244-5

   mode 분기:
   - mode='edit'   : updateCafeMenuAction
   - mode='create' : createCafeMenuAction → 등록 후 /admin/menu/{id}/edit redirect

   탭 (2탭):
   - basic     : id(자동/표시) / name / cat / status(시그니처 포함) / temp /
                 price / badge2 / bg / description / sortOrder
   - nutrition : vol / kcal / satfat / sugar / sodium / protein /
                 caffeine / allergen + menuDesc

   ID 자동 생성 규칙 (DEC-S244-2):
   - status='시그니처' → prefix 's'
   - 그 외 → cat prefix (brewing='b' / tea='t' / non-coffee='n' / dessert='d')
   - 신규 등록은 createCafeMenuAction 이 fetchAdminNextCafeMenuId(prefix) 호출
   ══════════════════════════════════════════════════════════════════════════ */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Controller,
  useForm,
  type FieldErrors,
  type SubmitHandler,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import {
  ADMIN_SELECT_CLASS,
  NativeSelectWrap,
} from '@/components/admin/NativeSelectWrap';
import { PriceInput } from '@/components/admin/PriceInput';
import { Button } from '@/components/admin/ui/button';
import { Input } from '@/components/admin/ui/input';
import { Textarea } from '@/components/admin/ui/textarea';
import { cn } from '@/lib/utils';
import type { CafeMenuItemRow } from '@/types/cafeMenu';
import { createCafeMenuAction, updateCafeMenuAction } from '../../actions';

/* ── 상수 ─────────────────────────────────────────────────────────────── */

const CAT_OPTIONS = [
  { value: 'brewing', label: 'Brewing (브루잉)' },
  { value: 'tea', label: 'Tea (티)' },
  { value: 'non-coffee', label: 'Non-Coffee (논커피)' },
  { value: 'dessert', label: 'Dessert (디저트)' },
] as const;

/** 047 check constraint 와 일치 — '' 포함 (미표시) */
const STATUS_OPTIONS = [
  { value: '', label: '없음' },
  { value: '시그니처', label: '시그니처' },
  { value: 'NEW', label: 'NEW' },
  { value: '인기', label: '인기' },
  { value: '시즌', label: '시즌' },
  { value: '시즌 한정', label: '시즌 한정' },
  { value: '품절', label: '품절' },
] as const;

const TEMP_OPTIONS = [
  { value: '', label: '없음' },
  { value: 'ice-only', label: 'ICE only (차가운 전용)' },
  { value: 'hot-only', label: 'HOT only (뜨거운 전용)' },
  { value: 'warm', label: 'WARM (실온)' },
  { value: 'both', label: 'ICE / HOT 둘 다' },
] as const;

const TABS = [
  { id: 'basic', label: '기본 정보' },
  { id: 'nutrition', label: '영양 정보' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/* ── Zod Schema ───────────────────────────────────────────────────────── */

const CatEnum = z.enum(['brewing', 'tea', 'non-coffee', 'dessert']);

const StatusEnum = z.enum([
  '',
  '시그니처',
  'NEW',
  '인기',
  '시즌',
  '시즌 한정',
  '품절',
]);

const TempEnum = z.enum(['', 'ice-only', 'hot-only', 'warm', 'both']);

const HexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, '#RRGGBB 형식이어야 합니다');

const FormSchema = z.object({
  /* mode='edit' 시 row.id · mode='create' 시 빈 문자열 (action 에서 자동 생성) */
  id: z.string(),
  name: z.string().min(1, '메뉴명을 입력해 주세요').max(60, '최대 60자'),
  cat: CatEnum,
  status: StatusEnum,
  temp: TempEnum,
  badge2: z.string().max(20),
  price: z.number().int().min(0).max(99_999_999),
  bg: HexColor,
  description: z.string().max(2000),
  sortOrder: z.number().int().min(0).max(9999),
  /* 영양 — 모두 text (단위 포함) */
  menuDesc: z.string().max(2000),
  vol: z.string().max(50),
  kcal: z.number().min(0).max(9999),
  satfat: z.string().max(50),
  sugar: z.string().max(50),
  sodium: z.string().max(50),
  protein: z.string().max(50),
  caffeine: z.string().max(50),
  allergen: z.string().max(100),
});

export type MenuFormValues = z.infer<typeof FormSchema>;

/* ── Props (Discriminated Union) ──────────────────────────────────────── */

type Props =
  | { mode: 'edit'; row: CafeMenuItemRow }
  | { mode: 'create'; initialSortOrder: number };

/* ── Defaults ─────────────────────────────────────────────────────────── */

function buildCreateDefaults(initialSortOrder: number): MenuFormValues {
  return {
    id: '',
    name: '',
    cat: 'brewing',
    status: '',
    temp: '',
    badge2: '',
    price: 0,
    bg: '#EEEEEE',
    description: '',
    /* S245-P9 정정: cafe-menu seed = 전체 단일 시퀀스 (idx 기반).
       카테고리 무관 전체 max+1 prefill — cat 변경해도 sortOrder 변동 없음. */
    sortOrder: initialSortOrder,
    menuDesc: '',
    vol: '',
    kcal: 0,
    satfat: '',
    sugar: '',
    sodium: '',
    protein: '',
    caffeine: '',
    allergen: '',
  };
}

function buildEditDefaults(row: CafeMenuItemRow): MenuFormValues {
  return {
    id: row.id,
    name: row.name,
    cat: row.cat,
    status: (row.status || '') as MenuFormValues['status'],
    temp: (row.temp || '') as MenuFormValues['temp'],
    badge2: row.badge2 ?? '',
    price: row.price ?? 0,
    bg: row.bg && /^#[0-9A-Fa-f]{6}$/.test(row.bg) ? row.bg : '#EEEEEE',
    description: row.description ?? '',
    sortOrder: row.sort_order ?? 0,
    menuDesc: row.menu_desc ?? '',
    vol: row.vol ?? '',
    kcal:
      typeof row.kcal === 'number'
        ? row.kcal
        : Number(row.kcal) || 0,
    satfat: row.satfat ?? '',
    sugar: row.sugar ?? '',
    sodium: row.sodium ?? '',
    protein: row.protein ?? '',
    caffeine: row.caffeine ?? '',
    allergen: row.allergen ?? '',
  };
}

/* ── Component ────────────────────────────────────────────────────────── */

export default function MenuEditForm(props: Props) {
  const router = useRouter();
  const isCreate = props.mode === 'create';
  const [tab, setTab] = useState<TabId>('basic');
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
    reset,
  } = useForm<MenuFormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: isCreate
      ? buildCreateDefaults(
          (props as { mode: 'create'; initialSortOrder: number }).initialSortOrder,
        )
      : buildEditDefaults(props.row),
  });

  /* S245-P9 정정: cat 변경 시 sortOrder 갱신 로직 제거.
     cafe-menu seed = 전체 단일 시퀀스이므로 cat 무관 단일 max+1 값 사용. */

  const TAB_FIELDS: Record<TabId, ReadonlyArray<keyof MenuFormValues>> = {
    basic: [
      'name',
      'cat',
      'status',
      'temp',
      'badge2',
      'price',
      'bg',
      'description',
      'sortOrder',
    ],
    nutrition: [
      'menuDesc',
      'vol',
      'kcal',
      'satfat',
      'sugar',
      'sodium',
      'protein',
      'caffeine',
      'allergen',
    ],
  };

  const TAB_LABEL: Record<TabId, string> = {
    basic: '기본 정보',
    nutrition: '영양 정보',
  };

  const onError = (errs: FieldErrors<MenuFormValues>) => {
    const errorKeys = Object.keys(errs) as Array<keyof MenuFormValues>;
    if (errorKeys.length === 0) return;
    const errorTab =
      (Object.entries(TAB_FIELDS) as Array<
        [TabId, ReadonlyArray<keyof MenuFormValues>]
      >).find(([, fields]) => fields.some((f) => errorKeys.includes(f)))?.[0] ??
      'basic';
    if (errorTab !== tab) setTab(errorTab);
    toast.error(`[${TAB_LABEL[errorTab]}] 탭의 입력값을 확인해 주세요`);
  };

  const onSubmit: SubmitHandler<MenuFormValues> = (values) => {
    if (isCreate) {
      startTransition(async () => {
        const { id: _id, ...createInput } = values;
        const result = await createCafeMenuAction(createInput);
        if (!result.ok) {
          const msg =
            result.error === 'unauthorized'
              ? '권한이 없습니다. 다시 로그인해 주세요.'
              : result.error === 'validation_failed'
                ? `입력값을 확인해 주세요. (${result.detail ?? ''})`
                : result.error === 'id_conflict'
                  ? '같은 ID 의 메뉴가 이미 있습니다. 다시 시도해 주세요.'
                  : '처리 중 오류가 발생했습니다.';
          toast.error(msg);
          return;
        }
        toast.success('메뉴를 등록했습니다');
        router.push(`/admin/menu/${result.id}/edit`);
      });
      return;
    }

    /* mode='edit' */
    if (!values.id) {
      toast.error('메뉴 ID 가 없습니다. 페이지를 새로고침해 주세요.');
      return;
    }
    const editInput = { ...values, id: values.id };
    startTransition(async () => {
      const result = await updateCafeMenuAction(editInput);
      if (!result.ok) {
        const msg =
          result.error === 'unauthorized'
            ? '권한이 없습니다. 다시 로그인해 주세요.'
            : result.error === 'validation_failed'
              ? `입력값을 확인해 주세요. (${result.detail ?? ''})`
              : result.error === 'not_found'
                ? '메뉴를 찾을 수 없습니다.'
                : '처리 중 오류가 발생했습니다.';
        toast.error(msg);
        return;
      }
      toast.success('메뉴 정보를 저장했습니다');
      reset(values, { keepValues: true });
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, onError)}>
      <AdminTopbarActions>
        {isCreate ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="!h-7"
              onClick={() => router.push('/admin/menu')}
              disabled={pending}
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              className="!h-7"
              onClick={handleSubmit(onSubmit, onError)}
              disabled={pending}
            >
              {pending ? '등록 중…' : '메뉴 등록'}
            </Button>
          </>
        ) : (
          <>
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
              type="button"
              size="sm"
              className="!h-7"
              onClick={handleSubmit(onSubmit, onError)}
              disabled={!isDirty || pending}
            >
              {pending ? '저장 중…' : '변경사항 저장'}
            </Button>
          </>
        )}
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

      {/* 기본 정보 탭 */}
      <div hidden={tab !== 'basic'}>
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          {/* name */}
          <Field label="메뉴명" required error={errors.name?.message}>
            <Input
              {...register('name')}
              placeholder="아메리카노"
              maxLength={60}
            />
          </Field>

          {/* cat + status grid */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="카테고리" required error={errors.cat?.message}>
              <NativeSelectWrap>
                <select
                  {...register('cat')}
                  className={ADMIN_SELECT_CLASS}
                >
                  {CAT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </NativeSelectWrap>
            </Field>

            <Field
              label="상태 배지"
              error={errors.status?.message}
              hint="시그니처는 ID prefix 가 's' 로 자동 결정됩니다"
            >
              <NativeSelectWrap>
                <select
                  {...register('status')}
                  className={ADMIN_SELECT_CLASS}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </NativeSelectWrap>
            </Field>
          </div>

          {/* temp + badge2 */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="온도" error={errors.temp?.message}>
              <NativeSelectWrap>
                <select
                  {...register('temp')}
                  className={ADMIN_SELECT_CLASS}
                >
                  {TEMP_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </NativeSelectWrap>
            </Field>

            <Field label="추가 배지 (badge2)" error={errors.badge2?.message}>
              <Input
                {...register('badge2')}
                placeholder="(선택) NEW · 디카페인 등"
                maxLength={20}
              />
            </Field>
          </div>

          {/* price */}
          <Field label="가격 (KRW)" required error={errors.price?.message}>
            <Controller
              control={control}
              name="price"
              render={({ field }) => (
                <PriceInput
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="6,500"
                />
              )}
            />
          </Field>

          {/* bg color */}
          <Field
            label="카드 배경 색상 (HEX)"
            required
            error={errors.bg?.message}
            hint="메뉴 카드 배경. 이미지 업로드 후 자동 색상으로 갱신됩니다"
          >
            <div className="flex items-center gap-3">
              <Controller
                control={control}
                name="bg"
                render={({ field }) => (
                  <>
                    <input
                      type="color"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      className="w-12 h-9 border border-border rounded cursor-pointer p-0"
                      aria-label="색상 선택"
                    />
                    <Input
                      value={field.value}
                      onChange={(e) =>
                        field.onChange(e.target.value.toUpperCase())
                      }
                      className="gtr-mono max-w-[140px]"
                      maxLength={7}
                      placeholder="#EEEEEE"
                    />
                  </>
                )}
              />
            </div>
          </Field>

          {/* description */}
          <Field label="짧은 설명" error={errors.description?.message}>
            <Textarea
              {...register('description')}
              placeholder="(선택) 카드 보조 텍스트"
              rows={2}
              maxLength={2000}
            />
          </Field>

          {/* sortOrder + id readonly */}
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="정렬 순서"
              error={errors.sortOrder?.message}
              hint={
                isCreate
                  ? '등록 시 전체 메뉴 시퀀스 맨 뒤로 자동 채번됩니다 (입력값 무시 · 등록 후 편집 가능)'
                  : '낮을수록 앞쪽 표시 (같은 카테고리 내)'
              }
            >
              <Input
                type="number"
                min={0}
                max={9999}
                {...register('sortOrder', { valueAsNumber: true })}
                /* S245-P10: mode='create' 시 server action 이 자동 채번. UI 는 prefill
                   참고용. 운영자가 수정해도 등록 시 덮어씌워짐. */
                readOnly={isCreate}
                tabIndex={isCreate ? -1 : undefined}
                className={isCreate ? 'bg-muted' : undefined}
              />
            </Field>

            <Field
              label="ID"
              hint={
                isCreate
                  ? '카테고리/시그니처 선택에 따라 자동 생성됩니다'
                  : '변경 불가 (PK)'
              }
            >
              <Input
                value={isCreate ? '— 자동 생성 —' : (props as { mode: 'edit'; row: CafeMenuItemRow }).row.id}
                readOnly
                className="gtr-mono bg-muted"
                tabIndex={-1}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* 영양 정보 탭 */}
      <div hidden={tab !== 'nutrition'}>
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <Field
            label="메뉴 상세 설명 (menuDesc)"
            error={errors.menuDesc?.message}
            hint="영양 시트 본문. 멀티라인 가능"
          >
            <Textarea
              {...register('menuDesc')}
              placeholder="원두 · 추출 · 풍미 노트 등"
              rows={4}
              maxLength={2000}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="용량 (vol)" error={errors.vol?.message}>
              <Input
                {...register('vol')}
                placeholder="350ml"
                maxLength={50}
              />
            </Field>

            <Field label="kcal" error={errors.kcal?.message}>
              <Input
                type="number"
                step="0.1"
                min={0}
                max={9999}
                {...register('kcal', { valueAsNumber: true })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="포화지방 (satfat)" error={errors.satfat?.message}>
              <Input
                {...register('satfat')}
                placeholder="0.1g"
                maxLength={50}
              />
            </Field>
            <Field label="당류 (sugar)" error={errors.sugar?.message}>
              <Input
                {...register('sugar')}
                placeholder="0g"
                maxLength={50}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="나트륨 (sodium)" error={errors.sodium?.message}>
              <Input
                {...register('sodium')}
                placeholder="10mg"
                maxLength={50}
              />
            </Field>
            <Field label="단백질 (protein)" error={errors.protein?.message}>
              <Input
                {...register('protein')}
                placeholder="0.5g"
                maxLength={50}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="카페인 (caffeine)" error={errors.caffeine?.message}>
              <Input
                {...register('caffeine')}
                placeholder="150mg"
                maxLength={50}
              />
            </Field>
            <Field label="알레르기 (allergen)" error={errors.allergen?.message}>
              <Input
                {...register('allergen')}
                placeholder="우유, 대두"
                maxLength={100}
              />
            </Field>
          </div>
        </div>
      </div>
    </form>
  );
}

/* ── Field wrapper ────────────────────────────────────────────────────── */

type FieldProps = {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
};

function Field({ label, required, error, hint, children }: FieldProps) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-muted-foreground mb-1.5">
        {label}
        {required && <span className="text-[var(--danger)] ml-0.5">*</span>}
      </div>
      {children}
      {hint && !error && (
        <div className="text-xs text-[var(--foreground-subtle)] mt-1">{hint}</div>
      )}
      {error && (
        <div className="text-xs text-[var(--danger)] mt-1">{error}</div>
      )}
    </label>
  );
}
