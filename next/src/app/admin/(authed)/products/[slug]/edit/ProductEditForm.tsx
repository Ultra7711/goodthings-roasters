'use client';

/* ══════════════════════════════════════════════════════════════════════════
   ProductEditForm — /admin/products/[slug]/edit + /admin/products/new 공유

   mode 분기:
   - mode='edit'   : 기존 row 업데이트 (updateProductMetaAction)
   - mode='create' : 신규 등록 (createProductAction) + 등록 후 /admin/products/{slug}/edit redirect

   탭 구성 (S231 β · shipping/seo 제거 — 도메인 부재):
   - basic   : name / category / status / displayPrice / sortOrder /
               color / subscription / popup
   - detail  : 5축 노트 + roast_stage + note_tags + flavor_desc
   - option  : product_volumes (1:N) · product_recipes (Coffee Bean 만)

   - slug 는 mode='edit' 에서 read-only (URL 변경 위험) · mode='create' 에서 editable
     (name 기반 자동 생성 + 운영자 수동 수정 가능 · 자동값과 불일치 시 lock)
   - dirty 상태일 때만 저장 활성
   ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type FieldErrors,
  type SubmitHandler,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import {
  FlavorChipInput,
  decodeChipsFromColumns,
} from '@/components/admin/FlavorChipInput';
import {
  ADMIN_READONLY_FIELD,
  ADMIN_SELECT_CLASS,
  NativeSelectWrap,
} from '@/components/admin/NativeSelectWrap';
import { PriceInput } from '@/components/admin/PriceInput';
import { Button } from '@/components/admin/ui/button';
import { Input } from '@/components/admin/ui/input';
import { Slider } from '@/components/admin/ui/slider';
import { Switch } from '@/components/admin/ui/switch';
import { Textarea } from '@/components/admin/ui/textarea';
import {
  createProductAction,
  updateProductMetaAction,
} from '../../productActions';
import { reorderProductImagesAction } from '../../imageActions';
import type { ProductWithRelationsRow } from '@/types/product';
import { cn } from '@/lib/utils';
import { usePdpDirty } from './PdpDirtyContext';

/* name 입력에서 ASCII 영문/숫자 부분만 추출해 kebab-case slug 생성.
   - "가을의 밤 Autumn Night" → "autumn-night"
   - "에티오피아 예가체프" → "" (영문 없으면 빈 문자열 — 운영자 수동 입력 강제) */
function buildSlugFromName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** PDP ProductRoastStage 의 한글 음차 라벨 답습 */
const ROAST_STAGE_OPTIONS = [
  { value: 'light', label: '라이트' },
  { value: 'medium-light', label: '미디엄 라이트' },
  { value: 'medium', label: '미디엄' },
  { value: 'medium-dark', label: '미디엄 다크' },
  { value: 'dark', label: '다크' },
  { value: 'italian', label: '이탈리안', disabled: true, hint: '국내 시장 희귀 — 사용 안 함' },
] as const;

/** ProductRoastStage.tsx 의 STAGE_DESCRIPTIONS 답습 — 운영자가 빈 값 유지 시 PDP 가 그대로 fallback. */
const ROAST_STAGE_PLACEHOLDERS: Record<(typeof ROAST_STAGE_OPTIONS)[number]['value'], string> = {
  light:
    '산뜻한 산미와 화사한 향, 산지 고유 특성이 가장 잘 드러나는 단계. 푸어오버와 에어로프레스에 적합합니다.',
  'medium-light':
    '산미와 단맛이 부드럽게 어우러지며 산지 특성이 살아있는 단계. 핸드드립에 잘 어울립니다.',
  medium:
    '캐러멜 단맛과 부드러운 바디가 균형을 이루는 단계. 다양한 추출 방식에 잘 어울립니다.',
  'medium-dark':
    '고소한 토스티드 너트와 깊은 단맛이 어우러지는 단계. 에스프레소 추출에 적합합니다.',
  dark: '묵직한 바디와 카카오의 진한 단맛이 살아나는 단계. 라떼와 카푸치노에 잘 어울립니다.',
  italian:
    '농밀한 풍미와 스모키함이 절정에 이르는 가장 깊은 단계. 진한 에스프레소에 적합합니다.',
};

const FLAVOR_AXES = [
  { key: 'noteSweet', label: 'Sweet (단맛)' },
  { key: 'noteBody', label: 'Body (바디)' },
  { key: 'noteAftertaste', label: 'Aftertaste (여운)' },
  { key: 'noteAroma', label: 'Aroma (향)' },
  { key: 'noteAcidity', label: 'Acidity (산미)' },
] as const;


/** formatStartPrice (lib/products.ts) 답습 — 옵션 첫 번째 가격 기반 "원~" 자동.
    사이트 카드/PDP 가격 노출과 동일 형식으로 admin display_price 자동 동기화. */
function buildAutoDisplayPrice(
  volumes: Array<{ price: number; sort_order?: number }>,
): string {
  if (!volumes || volumes.length === 0) return '';
  const sorted = [...volumes].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  const first = sorted[0]?.price ?? 0;
  if (!Number.isFinite(first) || first <= 0) return '';
  return `${first.toLocaleString('ko-KR')}원~`;
}

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

/* 동적 행 (volumes / recipes) grid 간격 토큰 (S231-5).
   admin-design §3 Spacing whitelist 답습. 매직 값 직접 입력 금지 — 본 상수 답습. */
const DYNAMIC_ROW_LIST_GAP = 'gap-3'; // 행 사이 (카드 안 row ↔ row)
const DYNAMIC_ROW_CELL_GAP = 'gap-2'; // 행 안 셀 ↔ 셀
const DYNAMIC_ROW_UNIT_GAP = 'gap-1'; // 인풋 + 화살표 한 몸 (시각 결합)
const DYNAMIC_ROW_SECTION_BREAK = 'ml-3'; // 그룹 사이 추가 spacing (예: 화살표 → 토글)

/* 신규 등록 시 추출 레시피 기본 4행 — 기존 Coffee Bean 상품 답습 (lib/products.ts).
   운영자가 상품별로 dose/temp/time/water 만 약간 수정해서 등록. */
const DEFAULT_COFFEE_BEAN_RECIPES = [
  { method: '에어로프레스', dose: '15g', temp: '85~90°C', time: '1분~1분 30초', water: '120g' },
  { method: '에스프레소', dose: '18~20g', temp: '90~93°C', time: '25~30초', water: '34~40g' },
  { method: '모카포트', dose: '12g', temp: '100°C 이상', time: '4분 내외', water: '110g' },
  { method: '드립', dose: '18~20g', temp: '88~92°C', time: '2분 이내 (뜸 30초)', water: '270~360g' },
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
  /* mode='edit' 시 product.id · mode='create' 시 undefined (createProductAction 에서 자동) */
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .min(1, '슬러그를 입력해 주세요')
    .max(80, '최대 80자')
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      '소문자/숫자 + 하이픈만 가능합니다 (예: autumn-night)',
    ),
  name: z.string().min(1, '상품명을 입력해 주세요').max(60, '최대 60자'),
  category: z.enum(['coffee_bean', 'drip_bag']),
  status: ProductStatusEnum,
  displayPrice: z.string().min(1, '가격을 입력해 주세요').max(30),
  sortOrder: z.number().int().min(0).max(9999),
  color: HexColor,
  subscription: z.boolean(),
  popup: z.boolean(),
  description: z.string().max(4000),
  flavorDesc: z.string().max(200),
  roastStage: RoastStageEnum,
  /** 052 마이그 — 운영자 작성 ROASTING 단계 설명. 빈 값 PDP fallback. */
  roastDesc: z.string().max(500),
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

type Props =
  | { mode: 'edit'; product: ProductWithRelationsRow }
  | { mode: 'create'; initialSortOrder: number };

/* mode='create' 의 빈 폼 기본값.
   - category 'coffee_bean' / color '#eaeaea' (049 일괄) / roastStage 'medium' / subscription true
   - volumes 1행 빈값 (zod min(1) 충족 — 운영자가 라벨/가격 입력)
   - sortOrder = 같은 카테고리 max + 1 (page.tsx 가 prefetch · readonly 노출) */
function buildCreateDefaults(initialSortOrder: number): FormValues {
  return {
    id: undefined,
    slug: '',
    name: '',
    category: 'coffee_bean',
    status: null,
    displayPrice: '',
    sortOrder: initialSortOrder,
    color: '#eaeaea',
    subscription: true,
    popup: false,
    description: '',
    flavorDesc: '',
    roastStage: 'medium',
    /* 단계별 default 텍스트 prefill — 운영자가 수정 안 하면 그대로 저장 (S231-4) */
    roastDesc: ROAST_STAGE_PLACEHOLDERS.medium,
    noteChips: [],
    noteColor: '#A47146',
    noteSweet: 0,
    noteBody: 0,
    noteAftertaste: 0,
    noteAroma: 0,
    noteAcidity: 0,
    volumes: [{ label: '', price: 0, soldOut: false }],
    recipes: DEFAULT_COFFEE_BEAN_RECIPES.map((r) => ({ ...r })),
  };
}

function buildEditDefaults(product: ProductWithRelationsRow): FormValues {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    category: product.category,
    status: product.status,
    displayPrice:
      buildAutoDisplayPrice(product.product_volumes) || product.display_price,
    sortOrder: product.sort_order,
    color: product.color,
    subscription: product.subscription,
    popup: product.popup,
    description: product.description ?? '',
    flavorDesc: product.flavor_desc ?? '',
    roastStage: product.roast_stage,
    /* DB 의 roast_desc 가 빈 값이면 단계별 default 로 prefill — STAGE_DESCRIPTIONS 답습 */
    roastDesc:
      product.roast_desc?.trim() ||
      ROAST_STAGE_PLACEHOLDERS[product.roast_stage] ||
      '',
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
  };
}

export default function ProductEditForm(props: Props) {
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
    setValue,
    getValues,
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues:
      props.mode === 'create'
        ? buildCreateDefaults(props.initialSortOrder)
        : buildEditDefaults(props.product),
  });

  /* S251 Phase 3b — PDP 이미지 reorder dirty 통합.
     mode='create' 에서는 provider 가 빈 array 로 init → imageOrderDirty 항상 false. */
  const {
    imageDraftOrder,
    imageOrderDirty,
    commitImageOrder,
    resetImageOrder,
  } = usePdpDirty();
  const combinedDirty = isDirty || imageOrderDirty;

  const handleCancel = () => {
    reset();
    resetImageOrder();
  };

  /* 옵션 첫 번째 가격 변경 시 표시 가격 자동 동기화 (사이트 카드/PDP 형식 정합).
     shouldDirty: false — 운영자가 옵션만 수정해도 displayPrice 단독 dirty 트리거 회피. */
  const watchedVolumes = useWatch({ control, name: 'volumes' });
  const autoDisplayPrice = buildAutoDisplayPrice(watchedVolumes ?? []);
  useEffect(() => {
    if (!autoDisplayPrice) return;
    if (getValues('displayPrice') === autoDisplayPrice) return;
    setValue('displayPrice', autoDisplayPrice, { shouldDirty: false });
  }, [autoDisplayPrice, getValues, setValue]);

  /* mode='create' slug 자동 생성 (옵션 B):
     name 변경 시 직전 자동값과 현재 slug 가 일치하면 새 자동값으로 갱신.
     운영자가 slug 를 직접 수정해 자동값과 불일치해지면 자동 갱신 중지 (lock).
     초기 slug = '' / prevAutoSlugRef.current = '' 로 시작 — 첫 자동 갱신 정상 트리거. */
  const watchedName = useWatch({ control, name: 'name' });
  const prevAutoSlugRef = useRef('');
  useEffect(() => {
    if (!isCreate) return;
    const auto = buildSlugFromName(watchedName ?? '');
    if (auto === prevAutoSlugRef.current) return;
    const currentSlug = getValues('slug');
    if (currentSlug === prevAutoSlugRef.current) {
      setValue('slug', auto, { shouldDirty: true, shouldValidate: false });
    }
    prevAutoSlugRef.current = auto;
  }, [isCreate, watchedName, getValues, setValue]);

  /* 검증 실패 시 — 에러 발생 탭 자동 이동 + toast 안내.
     RHF + zodResolver 가 errors state 만 채우고 onSubmit 호출 안 함 → 운영자가
     다른 탭에 있으면 inline 에러도 못 봄. toast + 탭 이동 콤보로 안내. */
  const TAB_FIELDS: Record<TabId, ReadonlyArray<keyof FormValues>> = {
    basic: [
      'slug',
      'name',
      'category',
      'status',
      'displayPrice',
      'sortOrder',
      'color',
      'subscription',
      'popup',
      'description',
    ],
    detail: [
      'flavorDesc',
      'roastStage',
      'noteChips',
      'noteColor',
      'noteSweet',
      'noteBody',
      'noteAftertaste',
      'noteAroma',
      'noteAcidity',
    ],
    option: ['volumes', 'recipes'],
  };
  const TAB_LABEL: Record<TabId, string> = {
    basic: '기본 정보',
    detail: '상세 설명',
    option: '용량 / 옵션',
  };

  const onError = (errs: FieldErrors<FormValues>) => {
    const errorKeys = Object.keys(errs) as Array<keyof FormValues>;
    if (errorKeys.length === 0) return;

    const errorTab =
      (Object.entries(TAB_FIELDS) as Array<
        [TabId, ReadonlyArray<keyof FormValues>]
      >).find(([, fields]) => fields.some((f) => errorKeys.includes(f)))?.[0] ??
      'basic';

    if (errorTab !== tab) setTab(errorTab);
    toast.error(
      `[${TAB_LABEL[errorTab]}] 탭의 입력값을 확인해 주세요`,
    );
  };

  const onSubmit: SubmitHandler<FormValues> = (values) => {
    if (isCreate) {
      startTransition(async () => {
        const { id: _id, ...createInput } = values;
        const result = await createProductAction(createInput);
        if (!result.ok) {
          const msg =
            result.error === 'unauthorized'
              ? '권한이 없습니다. 다시 로그인해 주세요.'
              : result.error === 'validation_failed'
                ? `입력값을 확인해 주세요. (${result.detail ?? ''})`
                : result.error === 'slug_conflict'
                  ? '같은 슬러그의 상품이 이미 있습니다. 슬러그를 변경해 주세요.'
                  : '처리 중 오류가 발생했습니다.';
          toast.error(msg);
          return;
        }
        toast.success('상품을 등록했습니다');
        router.push(`/admin/products/${result.slug}/edit`);
      });
      return;
    }

    /* mode='edit' — id 보장 (defaults 가 product.id 채움) */
    if (!values.id) {
      toast.error('상품 ID 가 없습니다. 페이지를 새로고침해 주세요.');
      return;
    }
    const productIdSafe = values.id;
    const editInput = { ...values, id: productIdSafe };
    const needFormSave = isDirty;
    const needImageSave = imageOrderDirty;

    startTransition(async () => {
      /* (1) form mutation — form dirty 일 때만 */
      if (needFormSave) {
        const result = await updateProductMetaAction(editInput);
        if (!result.ok) {
          const msg =
            result.error === 'unauthorized'
              ? '권한이 없습니다. 다시 로그인해 주세요.'
              : result.error === 'validation_failed'
                ? `입력값을 확인해 주세요. (${result.detail ?? ''})`
                : result.error === 'not_found'
                  ? '상품을 찾을 수 없습니다.'
                  : '처리 중 오류가 발생했습니다.';
          toast.error(msg);
          return;
        }
      }

      /* (2) image reorder mutation — imageOrderDirty 일 때만 */
      if (needImageSave) {
        const reorderResult = await reorderProductImagesAction({
          productId: productIdSafe,
          orderedImageIds: imageDraftOrder,
        });
        if (!reorderResult.ok) {
          const msg =
            reorderResult.error === 'unauthorized'
              ? '권한이 없습니다. 다시 로그인해 주세요.'
              : reorderResult.error === 'mismatch'
                ? '이미지 목록이 일치하지 않습니다. 페이지를 새로고침해 주세요.'
                : reorderResult.error === 'validation_failed'
                  ? '입력값이 올바르지 않습니다.'
                  : '처리 중 오류가 발생했습니다.';
          toast.error(
            needFormSave
              ? `상품 정보는 저장됐지만 이미지 순서 저장 실패: ${msg}`
              : msg,
          );
          return;
        }
        commitImageOrder(imageDraftOrder);
      }

      /* (3) 성공 — form dirty 해제 + 통합 toast */
      if (needFormSave) reset(values, { keepValues: true });
      toast.success(
        needFormSave && needImageSave
          ? '상품 정보와 이미지 순서를 저장했습니다'
          : needFormSave
            ? '상품 정보를 저장했습니다'
            : '이미지 순서를 저장했습니다',
      );
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, onError)}>
      {/* 상단 액션 바 — settings · orders 페이지와 동일 ghost/primary 패턴.
          mode='edit': 변경 취소 + 변경사항 저장 (dirty 일 때만 활성)
          mode='create': 취소 + 상품 등록 (dirty 무관 — 빈 폼에서도 등록 시도 가능 · zod 가 차단)

          ⚠️ AdminTopbarActions 가 React Portal — submit 버튼이 DOM 상 form 밖.
          native form submit 이벤트 발화 안 됨. button type="button" + onClick 으로
          handleSubmit 직접 호출 답습 (SettingsForm 패턴). */}
      <AdminTopbarActions>
        {isCreate ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="!h-7"
              onClick={() => router.push('/admin/products')}
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
              {pending ? '등록 중…' : '상품 등록'}
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="!h-7"
              onClick={handleCancel}
              disabled={!combinedDirty || pending}
            >
              변경 취소
            </Button>
            <Button
              type="button"
              size="sm"
              className="!h-7"
              onClick={handleSubmit(onSubmit, onError)}
              disabled={!combinedDirty || pending}
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

      {/* 탭 본문 */}
      {tab === 'basic' && (
        <BasicTab
          register={register}
          control={control}
          errors={errors}
          autoDisplayPrice={autoDisplayPrice}
          isCreate={isCreate}
        />
      )}
      {tab === 'detail' && (
        <DetailTab
          register={register}
          control={control}
          setValue={setValue}
          getValues={getValues}
          errors={errors}
        />
      )}
      {tab === 'option' && (
        <OptionTab register={register} control={control} errors={errors} />
      )}

      {/* dirty 안내 — mode='edit' 에서만 의미 있음 (create 는 전부 dirty 라 안내 무의미) */}
      {!isCreate && combinedDirty && !pending && (
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
  autoDisplayPrice,
  isCreate,
}: {
  register: ReturnType<typeof useForm<FormValues>>['register'];
  control: ReturnType<typeof useForm<FormValues>>['control'];
  errors: ReturnType<typeof useForm<FormValues>>['formState']['errors'];
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
  setValue,
  getValues,
  errors,
}: {
  register: ReturnType<typeof useForm<FormValues>>['register'];
  control: ReturnType<typeof useForm<FormValues>>['control'];
  setValue: ReturnType<typeof useForm<FormValues>>['setValue'];
  getValues: ReturnType<typeof useForm<FormValues>>['getValues'];
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
  register: ReturnType<typeof useForm<FormValues>>['register'];
  control: ReturnType<typeof useForm<FormValues>>['control'];
  setValue: ReturnType<typeof useForm<FormValues>>['setValue'];
  getValues: ReturnType<typeof useForm<FormValues>>['getValues'];
  errors: ReturnType<typeof useForm<FormValues>>['formState']['errors'];
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
  control: ReturnType<typeof useForm<FormValues>>['control'];
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

/* DEC-5 (native select 유지) · chevron 표준 = NativeSelectWrap (S231-9).
   S222 PR-5c: SM_BASE/GHOST/PRIMARY 상수 폐기 — shadcn Button 으로 대체. */
