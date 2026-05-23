/* ══════════════════════════════════════════
   _shared/defaults.ts — ProductEditForm defaults + 보조 (S260 분리)

   - buildSlugFromName — name 입력에서 ASCII 영문/숫자 부분만 kebab-case
   - buildAutoDisplayPrice — formatStartPrice 답습 ("13,500원~")
   - buildCreateDefaults — mode='create' 의 빈 폼 기본값
   - buildEditDefaults — mode='edit' 의 product → FormValues
   ══════════════════════════════════════════ */

import { decodeChipsFromColumns } from '@/components/admin/FlavorChipInput';
import type { ProductWithRelationsRow } from '@/types/product';
import { DEFAULT_COFFEE_BEAN_RECIPES, ROAST_STAGE_PLACEHOLDERS } from './constants';
import type { FormValues } from './schema';

/* name 입력에서 ASCII 영문/숫자 부분만 추출해 kebab-case slug 생성.
   - "가을의 밤 Autumn Night" → "autumn-night"
   - "에티오피아 예가체프" → "" (영문 없으면 빈 문자열 — 운영자 수동 입력 강제) */
export function buildSlugFromName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** formatStartPrice (lib/products.ts) 답습 — 옵션 첫 번째 가격 기반 "원~" 자동.
    사이트 카드/PDP 가격 노출과 동일 형식으로 admin display_price 자동 동기화. */
export function buildAutoDisplayPrice(
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

/* mode='create' 의 빈 폼 기본값.
   - category 'coffee_bean' / color '#eaeaea' (049 일괄) / roastStage 'medium' / subscription true
   - volumes 1행 빈값 (zod min(1) 충족 — 운영자가 라벨/가격 입력)
   - sortOrder = 같은 카테고리 max + 1 (page.tsx 가 prefetch · readonly 노출) */
export function buildCreateDefaults(initialSortOrder: number): FormValues {
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

export function buildEditDefaults(product: ProductWithRelationsRow): FormValues {
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
