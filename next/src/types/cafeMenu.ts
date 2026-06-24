/* ══════════════════════════════════════════════════════════════════════════
   types/cafeMenu.ts — cafe_menu_items DB row 타입 + UI 매핑 (S213)

   목적:
   - 047_cafe_menu_schema.sql 의 cafe_menu_items row 타입 정의.
   - DB row → 기존 UI CafeMenuItem (lib/cafeMenu.ts) 매핑 헬퍼.

   설계:
   - 기존 lib/cafeMenu.ts 의 CafeMenuItem 타입은 8개 컴포넌트가 이미
     import 중이므로 변경하지 않음. S214 마이그 시점에 교체.
   - 본 파일은 server-side 매핑 전용. 클라이언트 번들에 포함되어도 무해
     (순수 데이터 변환만, 비밀 없음).
   - 컬럼명 변환: description→desc, img_src→img, menu_desc→menuDesc.

   참조:
   - supabase/migrations/047_cafe_menu_schema.sql
   - next/src/lib/cafeMenu.ts
   - memory/project_release_blocker_sprint.md §S213
   ══════════════════════════════════════════════════════════════════════════ */

import type { CafeMenuItem, CafeMenuStatus, CafeMenuTemp } from '@/lib/cafeMenu';

/** 047 cafe_menu_items 테이블 row */
export type CafeMenuItemRow = {
  id: string;
  name: string;
  cat: 'brewing' | 'tea' | 'non-coffee' | 'dessert';
  /** DB check constraint 와 일치. Supabase JS 는 string 반환. */
  status: string;
  /** null = 디저트 등 온도 무관 */
  temp: string | null;
  badge2: string;
  price: number;
  description: string;
  img_src: string;
  bg: string;
  menu_desc: string;
  vol: string;
  /** numeric(6,1) — Supabase JS 가 string 으로 반환하는 경우 있음. mapCafeMenuRow 에서 강제 변환. */
  kcal: number | string;
  satfat: string;
  sugar: string;
  sodium: string;
  protein: string;
  caffeine: string;
  allergen: string;
  /** LQIP blur (DEC-6 build-time). seed 시점에 채움. */
  blur_data_url: string | null;
  width: number | null;
  height: number | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * numeric 컬럼 안전 변환.
 * Supabase JS 가 numeric(6,1) 을 string 으로 반환하는 경우에도 number 로 정규화.
 */
function toNumber(v: number | string | null | undefined): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v);
  return 0;
}

/**
 * DB row → 기존 UI CafeMenuItem 타입.
 *
 * 컬럼명 변환:
 *   description → desc
 *   img_src     → img
 *   menu_desc   → menuDesc
 */
export function mapCafeMenuRow(row: CafeMenuItemRow): CafeMenuItem {
  return {
    id: row.id,
    name: row.name,
    cat: row.cat,
    status: row.status as CafeMenuStatus,
    temp: row.temp as CafeMenuTemp,
    badge2: row.badge2,
    price: row.price,
    desc: row.description,
    img: row.img_src,
    bg: row.bg,
    menuDesc: row.menu_desc,
    vol: row.vol,
    kcal: toNumber(row.kcal),
    satfat: row.satfat,
    sugar: row.sugar,
    sodium: row.sodium,
    protein: row.protein,
    caffeine: row.caffeine,
    allergen: row.allergen,
    /* S245-P21: DB LQIP 메타 매핑 — 어드민 업로드 이미지 blur 표시. */
    blurDataUrl: row.blur_data_url,
    imgWidth: row.width,
    imgHeight: row.height,
  };
}

/* ── Admin 목록용 매핑 (S244) ────────────────────────────────────────────── */

/**
 * /admin/menu 목록 행 — types/product.ts 의 AdminProductListItem 답습.
 * is_active=false 도 포함 (admin RLS).
 */
export type AdminCafeMenuListItem = {
  id: string;
  name: string;
  cat: CafeMenuItemRow['cat'];
  status: string;
  /** NEW 배지 여부 (S330 · badge2='NEW') */
  isNew: boolean;
  temp: string | null;
  price: number;
  displayPrice: string;
  sortOrder: number;
  isActive: boolean;
  updatedAt: string;
  thumbSrc: string | null;
  thumbBlurDataUrl: string | null;
};

/** CafeMenuItemRow → AdminCafeMenuListItem (admin 목록 매핑) */
export function mapAdminCafeMenuListItem(
  row: CafeMenuItemRow,
): AdminCafeMenuListItem {
  return {
    id: row.id,
    name: row.name,
    cat: row.cat,
    status: row.status,
    isNew: row.badge2 === 'NEW',
    temp: row.temp,
    price: row.price,
    displayPrice: `${row.price.toLocaleString('ko-KR')}원`,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    updatedAt: row.updated_at,
    thumbSrc: row.img_src || null,
    thumbBlurDataUrl: row.blur_data_url,
  };
}
