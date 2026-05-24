/* ══════════════════════════════════════════════════════════════════════════
   cafe_menus.cat 단일 source of truth (S264-D LOW-B)

   047 마이그 cafe_menus.cat CHECK constraint 와 일치.
   기존 분산 정의 3곳 통합:
   - MenuEditForm.tsx CAT_OPTIONS (UI dropdown)
   - MenuEditForm.tsx CatEnum (client zod)
   - menu/actions.ts CatEnum (server zod)

   카테고리 추가 시:
   1. 마이그 047 CHECK constraint 수정
   2. 본 배열 추가
   3. ID prefix 매핑 (createCafeMenuAction fetchAdminNextCafeMenuId) 확인
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';

/* z.enum 은 [string, ...string[]] tuple 형식만 받음 — values 를 별도 tuple 로 박고
   CAFE_MENU_CATEGORIES 는 labels 와 함께 매핑. 추가 시 두 곳 동시 갱신. */
const CAFE_MENU_CATEGORY_VALUES = ['brewing', 'tea', 'non-coffee', 'dessert'] as const;

export const CafeMenuCategoryEnum = z.enum(CAFE_MENU_CATEGORY_VALUES);

export type CafeMenuCategory = (typeof CAFE_MENU_CATEGORY_VALUES)[number];

export const CAFE_MENU_CATEGORIES: ReadonlyArray<{
  value: CafeMenuCategory;
  label: string;
}> = [
  { value: 'brewing', label: 'Brewing (브루잉)' },
  { value: 'tea', label: 'Tea (티)' },
  { value: 'non-coffee', label: 'Non-Coffee (논커피)' },
  { value: 'dessert', label: 'Dessert (디저트)' },
];
