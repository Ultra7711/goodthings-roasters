/* ══════════════════════════════════════════════════════════════════════════
   types/product.ts — products 도메인 DB row 타입 + UI 매핑 (S211)

   목적:
   - 046_products_schema.sql 의 4 테이블 (products / product_volumes /
     product_images / product_recipes) row 타입 정의.
   - DB row → 기존 UI Product (lib/products.ts) 매핑 헬퍼.

   설계:
   - 기존 lib/products.ts 의 UI 타입 (Product · FlavorNote · RecipeItem ·
     ProductImage 등) 은 36개 파일이 이미 import 중이므로 변경하지 않음.
     S212 마이그 시점에 export 위치 정리.
   - 본 파일은 server-side 매핑 전용. 클라이언트 번들에 포함되어도 무해
     (순수 데이터 변환만, 비밀 없음).

   참조:
   - supabase/migrations/046_products_schema.sql
   - next/src/lib/products.ts
   - memory/project_release_blocker_sprint.md §S211
   ══════════════════════════════════════════════════════════════════════════ */

import type {
  FlavorNote,
  Product,
  ProductImage,
  ProductStatus,
  ProductVolume,
  RecipeItem,
  RoastStage,
} from '@/lib/products';

/** 046 products 테이블 row */
export type ProductRow = {
  id: string;
  slug: string;
  category: 'coffee_bean' | 'drip_bag';
  name: string;
  display_price: string;
  color: string;
  status: ProductStatus; // text + check constraint, nullable
  subscription: boolean;
  popup: boolean;
  description: string;
  specs: string;
  // numeric(2,1) — Supabase JS 는 안전하게 number 로 typing.
  // mapProductRow 에서 Number() 강제 변환으로 string 응답에도 대응.
  note_sweet: number;
  note_body: number;
  note_aftertaste: number;
  note_aroma: number;
  note_acidity: number;
  note_tags: string;
  note_tags_en: string;
  flavor_desc: string;
  note_color: string;
  roast_stage: RoastStage;
  /** 052 마이그 — 운영자 작성 ROASTING 설명 문구. 빈 값 fallback (S231-4). */
  roast_desc: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** 046 product_volumes 테이블 row */
export type ProductVolumeRow = {
  id: string;
  product_id: string;
  label: string;
  price: number;
  sold_out: boolean;
  sort_order: number;
};

/** 046 product_images 테이블 row (050 추가: is_active) */
export type ProductImageRow = {
  id: string;
  product_id: string;
  src: string;
  bg: string;
  bg_theme: 'light' | 'dark';
  blur_data_url: string | null;
  width: number | null;
  height: number | null;
  sort_order: number;
  /** 사이트 노출 여부. 050 마이그 신규. 기존 row default true · 신규 업로드 default false (안전장치). */
  is_active: boolean;
};

/** 046 product_recipes 테이블 row */
export type ProductRecipeRow = {
  id: string;
  product_id: string;
  method: string;
  dose: string;
  temp: string;
  time: string;
  water: string;
  sort_order: number;
};

/**
 * 1 쿼리 nested select 응답 형태:
 *   .from('products').select('*, product_volumes(*), product_images(*), product_recipes(*)')
 */
export type ProductWithRelationsRow = ProductRow & {
  product_volumes: ProductVolumeRow[];
  product_images: ProductImageRow[];
  product_recipes: ProductRecipeRow[];
};

/** DB enum → UI 표시 카테고리 매핑 */
const CATEGORY_DB_TO_UI: Record<ProductRow['category'], Product['category']> = {
  coffee_bean: 'Coffee Bean',
  drip_bag: 'Drip Bag',
};

/** UI category → DB enum 역매핑 (어드민 / seed 에서 사용) */
export const CATEGORY_UI_TO_DB: Record<Product['category'], ProductRow['category']> = {
  'Coffee Bean': 'coffee_bean',
  'Drip Bag': 'drip_bag',
};

/**
 * numeric 컬럼 안전 변환.
 * Supabase JS 가 큰 numeric 을 string 으로 반환하는 경우에도 number 로 정규화.
 */
function toNumber(v: number | string | null | undefined): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v);
  return 0;
}

/**
 * DB row (4 테이블 nested) → 기존 UI Product 타입.
 *
 * 정렬: 자식 배열은 sort_order asc 로 정렬 후 매핑.
 *   nested select 의 order 는 사용자 측에서 항상 보장되지 않으므로 매핑 시 정렬.
 */
export function mapProductRow(row: ProductWithRelationsRow): Product {
  const volumes: ProductVolume[] = [...row.product_volumes]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((v) => ({
      label: v.label,
      price: v.price,
      ...(v.sold_out ? { soldOut: true } : {}),
    }));

  /* B2C 노출 — is_active=false 이미지는 사이트에서 제외 (안전장치 · S231-3 / 050).
     admin 은 fetchAdminProductRawBySlug 로 raw row 사용 — 전체 노출 유지. */
  const images: ProductImage[] = [...row.product_images]
    .filter((i) => i.is_active !== false)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => ({
      bg: i.bg,
      bgTheme: i.bg_theme,
      src: i.src,
    }));

  const recipe: RecipeItem[] = [...row.product_recipes]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => ({
      method: r.method,
      dose: r.dose,
      temp: r.temp,
      time: r.time,
      water: r.water,
    }));

  const note: FlavorNote = {
    sweet: toNumber(row.note_sweet),
    body: toNumber(row.note_body),
    aftertaste: toNumber(row.note_aftertaste),
    aroma: toNumber(row.note_aroma),
    acidity: toNumber(row.note_acidity),
  };

  const product: Product = {
    category: CATEGORY_DB_TO_UI[row.category],
    name: row.name,
    price: row.display_price,
    volumes,
    color: row.color,
    status: row.status,
    slug: row.slug,
    subscription: row.subscription,
    images,
    desc: row.description,
    specs: row.specs,
    note,
    noteTags: row.note_tags,
    noteTagsEn: row.note_tags_en,
    flavorDesc: row.flavor_desc,
    noteColor: row.note_color,
    roastStage: row.roast_stage,
    roastDesc: row.roast_desc ?? '',
    recipe,
  };

  if (row.popup) product.popup = true;

  return product;
}

/**
 * 이미지 LQIP 메타 컬럼이 채워졌는지 확인.
 * seed / admin 등록 시점에 build-time blur 가 빠진 경우 경고용.
 */
export function hasImageBlur(image: ProductImageRow): boolean {
  return image.blur_data_url !== null && image.width !== null && image.height !== null;
}

/**
 * 어드민 목록 행 (S218) — DB raw 컬럼 + 썸네일 derived.
 * UI 매핑 (Product) 를 거치지 않고 admin 표시에 필요한 필드만 노출.
 * id / isActive / sortOrder / updatedAt 등 admin 전용 메타 포함.
 */
export type AdminProductListItem = {
  id: string;
  slug: string;
  name: string;
  category: ProductRow['category'];
  status: ProductStatus;
  displayPrice: string;
  sortOrder: number;
  isActive: boolean;
  updatedAt: string;
  thumbSrc: string | null;
  thumbBlurDataUrl: string | null;
};

/**
 * volumes[0].price 기반 admin 목록용 displayPrice 자동 계산.
 * ProductEditForm `buildAutoDisplayPrice` + B2C `formatStartPrice` 답습 (S231-4).
 *
 * volumes 가 비어있거나 첫 가격이 0 이하면 fallback (DB display_price 그대로).
 */
function buildAdminListDisplayPrice(
  volumes: ProductVolumeRow[],
  fallback: string,
): string {
  if (!volumes || volumes.length === 0) return fallback;
  const sorted = [...volumes].sort((a, b) => a.sort_order - b.sort_order);
  const first = sorted[0]?.price ?? 0;
  if (!Number.isFinite(first) || first <= 0) return fallback;
  return `${first.toLocaleString('ko-KR')}원~`;
}

/** ProductWithRelationsRow → AdminProductListItem (admin 목록 매핑) */
export function mapAdminProductListItem(
  row: ProductWithRelationsRow,
): AdminProductListItem {
  const sortedImages = [...row.product_images].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const thumb = sortedImages[0] ?? null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    status: row.status,
    displayPrice: buildAdminListDisplayPrice(
      row.product_volumes,
      row.display_price,
    ),
    sortOrder: row.sort_order,
    isActive: row.is_active,
    updatedAt: row.updated_at,
    thumbSrc: thumb?.src ?? null,
    thumbBlurDataUrl: thumb?.blur_data_url ?? null,
  };
}
