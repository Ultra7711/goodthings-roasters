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
import {
  useForm,
  useWatch,
  type FieldErrors,
  type SubmitHandler,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import { Button } from '@/components/admin/ui/button';
import {
  createProductAction,
  updateProductMetaAction,
} from '../../productActions';
import { reorderProductImagesAction } from '../../imageActions';
import { describeError } from '@/lib/admin/errorDescribe';
import { cn } from '@/lib/utils';
import { usePdpDirty } from './PdpDirtyContext';
import { TABS, type TabId } from './_shared/constants';
import { FormSchema, type FormValues, type Props } from './_shared/schema';
import {
  buildAutoDisplayPrice,
  buildCreateDefaults,
  buildEditDefaults,
  buildSlugFromName,
} from './_shared/defaults';
import { BasicTab } from './tabs/BasicTab';
import { DetailTab } from './tabs/DetailTab';
import { OptionTab } from './tabs/OptionTab';

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
          toast.error(describeError(result.error, result.detail));
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
          toast.error(describeError(result.error, result.detail));
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
          const msg = describeError(reorderResult.error, reorderResult.detail);
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

