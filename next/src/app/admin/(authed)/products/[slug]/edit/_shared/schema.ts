/* ══════════════════════════════════════════
   _shared/schema.ts — ProductEditForm Zod 스키마 (S260 분리)

   - ProductStatusEnum / HexColor / RoastStageEnum / FlavorAxis — 원자 스키마
   - VolumeSchema / RecipeSchema — 동적 행 (volumes/recipes) 스키마
   - FormSchema — 통합 폼 스키마 + FormValues 타입
   - Props — ProductEditForm props (create vs edit discriminated)
   ══════════════════════════════════════════ */

import { z } from 'zod';
import type { ProductWithRelationsRow } from '@/types/product';

export const ProductStatusEnum = z
  .enum(['NEW', '인기 NO.1', '인기 NO.2', '인기 NO.3', '수량 한정', '품절'])
  .nullable();

export const HexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, '#RRGGBB 형식이어야 합니다');

export const RoastStageEnum = z.enum([
  'light',
  'medium-light',
  'medium',
  'medium-dark',
  'dark',
  'italian',
]);

export const FlavorAxis = z.number().min(0).max(5);

export const VolumeSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1, '라벨 필요').max(50),
  price: z.number().int().min(0).max(99_999_999),
  soldOut: z.boolean(),
});

export const RecipeSchema = z.object({
  id: z.string().uuid().optional(),
  method: z.string().min(1, '방식 필요').max(50),
  dose: z.string().min(1, '분량 필요').max(50),
  temp: z.string().min(1, '온도 필요').max(50),
  time: z.string().min(1, '시간 필요').max(50),
  water: z.string().min(1, '물 필요').max(50),
});

export const FormSchema = z.object({
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

export type FormValues = z.infer<typeof FormSchema>;

export type Props =
  | { mode: 'edit'; product: ProductWithRelationsRow }
  | { mode: 'create'; initialSortOrder: number };
