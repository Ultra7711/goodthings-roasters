'use server';

/* ══════════════════════════════════════════════════════════════════════════
   actions.ts — /admin/products Server Actions (re-export entry · S256-B)

   S256-B 분리:
   - productActions.ts — 상품 CRUD (5 actions · toggleActive / updateMeta /
     create / delete / reorder)
   - imageActions.ts — 이미지 갤러리 (4 actions · reorder / upload /
     updateActive / delete)
   - 본 파일 — re-export entry. caller 의 `import { ... } from './actions'`
     경로 보존.

   분리 배경 (S254 audit P4-a · P2):
   - 단일 파일 1095 lines (god module). 책임 혼재 (product CRUD + image domain).
   - imageActions 는 storage / plaiceholder / sort_order 등 도메인 고유 helper
     집중. productActions 는 RPC + zod schema + volumes/recipes sync 집중.
   - 신규 설계 원칙 (DEC-S254-1) 충족 — 파일당 800 lines 이내.
   ══════════════════════════════════════════════════════════════════════════ */

export {
  toggleProductActiveAction,
  updateProductMetaAction,
  createProductAction,
  deleteProductAction,
  reorderProductsAction,
  type ToggleActiveResult,
  type UpdateProductMetaInput,
  type UpdateProductMetaResult,
  type CreateProductInput,
  type CreateProductResult,
  type DeleteProductResult,
  type ReorderProductsResult,
} from './productActions';

export {
  reorderProductImagesAction,
  uploadProductImageAction,
  updateProductImageActiveAction,
  deleteProductImageAction,
  type ReorderImagesResult,
  type UploadProductImageResult,
  type UpdateProductImageActiveResult,
  type DeleteProductImageResult,
} from './imageActions';
