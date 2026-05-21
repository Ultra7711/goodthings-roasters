'use server';

/* ══════════════════════════════════════════════════════════════════════════
   actions.ts — /admin/menu Server Actions (S244)

   책임:
   1) admin 가드 (getAdminClaims / getAdminOwnerClaims)
   2) zod 검증
   3) supabase service_role 로 cafe_menu_items UPDATE/DELETE
   4) revalidateTag('cafe-menu') + revalidatePath('/admin/menu')

   현재 포함:
   - toggleCafeMenuActiveAction — is_active on/off (목록 인라인 토글)
   - createCafeMenuAction       — 신규 메뉴 등록 (자동 ID + INSERT)
   - updateCafeMenuAction       — 메뉴 메타 UPDATE (편집 폼)
   - uploadCafeMenuImageAction  — Storage upload + processAdminImage + UPDATE
   - deleteCafeMenuAction       — cafe_menu_items hard delete + Storage 폴더 cleanup

   답습:
   - products/actions.ts (toggleProductActiveAction · createProductAction ·
     updateProductMetaAction · uploadProductImageAction · deleteProductAction)

   주의 — menu_likes 정합:
   - 047 마이그 주석: "seed 적용 후 FK 추가 권장" (현재 FK 미박힘).
   - cafe_menu_items DELETE 시 menu_likes 의 menu_id 는 orphan 잔존.
   - P4-3 DangerZone 에서 menu_likes 카운트 표시 + 경고 (실제 데이터 손실 없음).
   ══════════════════════════════════════════════════════════════════════════ */

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { getAdminClaims, getAdminOwnerClaims } from '@/lib/auth/getClaims';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  buildAdminImageFilename,
  processAdminImage,
} from '@/lib/admin/imageProcessing';
import {
  fetchAdminNextCafeMenuId,
  fetchAdminNextCafeMenuSortOrder,
  type CafeMenuIdPrefix,
} from '@/lib/admin/cafeMenuServer';
import { normalizeAllergen } from '@/lib/allergenSort';
import { CAFE_MENU_CACHE_TAG } from '@/lib/cafeMenuServer';

const MENU_IMAGES_BUCKET = 'menu-images';

/** 047 check constraint `^[a-z][0-9]{2,}$` 와 일치 */
const CafeMenuIdSchema = z.string().regex(/^[a-z][0-9]{2,}$/);

const ToggleActiveSchema = z.object({
  id: CafeMenuIdSchema,
  isActive: z.boolean(),
});

export type ToggleCafeMenuActiveResult =
  | { ok: true; id: string; isActive: boolean }
  | {
      ok: false;
      error: 'unauthorized' | 'not_found' | 'validation_failed' | 'server_error';
      detail?: string;
    };

/**
 * 카페 메뉴 활성/비활성 토글.
 * products toggleProductActiveAction 답습.
 */
export async function toggleCafeMenuActiveAction(input: {
  id: string;
  isActive: boolean;
}): Promise<ToggleCafeMenuActiveResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = ToggleActiveSchema.safeParse(input);
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      error: 'validation_failed',
      detail: Object.entries(fields)
        .map(([k, v]) => `${k}:${(v as string[])[0]}`)
        .join('; ')
        .slice(0, 200),
    };
  }

  const { id, isActive } = parsed.data;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('cafe_menu_items')
    .update({ is_active: isActive })
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[toggleCafeMenuActiveAction] update failed', {
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }
  if (!data) return { ok: false, error: 'not_found' };

  revalidateTag(CAFE_MENU_CACHE_TAG, 'max');
  revalidatePath('/admin/menu');
  revalidatePath('/menu');

  return { ok: true, id, isActive };
}

/* ══════════════════════════════════════════════════════════════════════════
   deleteCafeMenuAction — 메뉴 영구 삭제

   - owner 만 가능 (staff 는 비공개 토글로만 처리)
   - cafe_menu_items DELETE
   - Storage menu-images/{id}/* 일괄 삭제 (실패해도 DB DELETE 진행)
   - menu_likes orphan 은 사용자 인지 (DangerZone 경고)
   - revalidate
   ══════════════════════════════════════════════════════════════════════════ */

export type DeleteCafeMenuResult =
  | { ok: true }
  | {
      ok: false;
      error: 'unauthorized' | 'validation_failed' | 'not_found' | 'server_error';
      detail?: string;
    };

export async function deleteCafeMenuAction(input: {
  id: string;
}): Promise<DeleteCafeMenuResult> {
  /* owner 만 영구 삭제. staff 는 일시 비공개만 가능 (products 답습 S232). */
  const claims = await getAdminOwnerClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  if (!CafeMenuIdSchema.safeParse(input.id).success) {
    return { ok: false, error: 'validation_failed', detail: 'id' };
  }

  const admin = getSupabaseAdmin();

  /* 존재 확인 */
  const { data: row, error: selErr } = await admin
    .from('cafe_menu_items')
    .select('id')
    .eq('id', input.id)
    .maybeSingle();
  if (selErr) {
    console.error('[deleteCafeMenuAction] select failed', selErr.message);
    return { ok: false, error: 'server_error' };
  }
  if (!row) return { ok: false, error: 'not_found' };

  /* Storage 폴더 cleanup — menu-images/{id}/* 전체 list → remove.
     실패해도 DB DELETE 진행 (orphan storage 는 carry). */
  const { data: files, error: listErr } = await admin.storage
    .from(MENU_IMAGES_BUCKET)
    .list(input.id);
  if (listErr) {
    console.error('[deleteCafeMenuAction] storage list failed', {
      id: input.id,
      message: listErr.message?.slice(0, 200),
    });
  } else if (files && files.length > 0) {
    const paths = files.map((f) => `${input.id}/${f.name}`);
    const { error: rmErr } = await admin.storage
      .from(MENU_IMAGES_BUCKET)
      .remove(paths);
    if (rmErr) {
      console.error('[deleteCafeMenuAction] storage remove failed', {
        id: input.id,
        count: paths.length,
        message: rmErr.message?.slice(0, 200),
      });
    }
  }

  /* DB DELETE — menu_likes 는 FK 없으므로 orphan 잔존 (사용자 인지) */
  const { error: delErr } = await admin
    .from('cafe_menu_items')
    .delete()
    .eq('id', input.id);
  if (delErr) {
    console.error('[deleteCafeMenuAction] delete failed', delErr.message);
    return { ok: false, error: 'server_error' };
  }

  revalidateTag(CAFE_MENU_CACHE_TAG, 'max');
  revalidatePath('/admin/menu');
  revalidatePath('/menu');

  return { ok: true };
}

/* ══════════════════════════════════════════════════════════════════════════
   공통 Schema — Create / Update 양쪽에서 사용
   ══════════════════════════════════════════════════════════════════════════ */

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

const HexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

const MenuMetaSchema = z.object({
  name: z.string().min(1).max(60),
  cat: CatEnum,
  status: StatusEnum,
  temp: TempEnum,
  badge2: z.string().max(20),
  price: z.number().int().min(0).max(99_999_999),
  bg: HexColor,
  description: z.string().max(2000),
  sortOrder: z.number().int().min(0).max(9999),
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

type MenuMetaInput = z.infer<typeof MenuMetaSchema>;

/** 폼 input → DB row (snake_case · null 처리 · allergen 정렬·정규화) */
function toCafeMenuDbRow(v: MenuMetaInput) {
  return {
    name: v.name,
    cat: v.cat,
    status: v.status, // '' = 미표시 (047 check 통과)
    temp: v.temp === '' ? null : v.temp, // null = 온도 무관
    badge2: v.badge2,
    price: v.price,
    bg: v.bg,
    description: v.description,
    menu_desc: v.menuDesc,
    vol: v.vol,
    kcal: v.kcal,
    satfat: v.satfat,
    sugar: v.sugar,
    sodium: v.sodium,
    protein: v.protein,
    caffeine: v.caffeine,
    /* S245: 식약처 19종 순 + 가나다 fallback + 별칭 정규화 (계란→알류 등).
       DB 저장 시점 정규화 → 어드민 재진입 시 정돈된 값 prefill + 사이트 표시 일관. */
    allergen: normalizeAllergen(v.allergen),
    sort_order: v.sortOrder,
  };
}

/** status / cat 으로 ID prefix 결정 (DEC-S244-2) */
function pickIdPrefix(cat: MenuMetaInput['cat'], status: MenuMetaInput['status']): CafeMenuIdPrefix {
  if (status === '시그니처') return 's';
  if (cat === 'brewing') return 'b';
  if (cat === 'tea') return 't';
  if (cat === 'non-coffee') return 'n';
  return 'd'; // dessert
}

function formatZodFieldErrors(errs: Record<string, string[] | undefined>): string {
  return Object.entries(errs)
    .map(([k, v]) => `${k}:${(v as string[])[0]}`)
    .join('; ')
    .slice(0, 200);
}

/* ══════════════════════════════════════════════════════════════════════════
   createCafeMenuAction — 신규 메뉴 등록 (S244)

   - admin 가드
   - Zod 검증
   - prefix 결정 → fetchAdminNextCafeMenuId 로 자동 ID
   - INSERT cafe_menu_items (이미지 없이 등록 — 등록 후 edit 페이지에서 업로드)
   - revalidate
   ══════════════════════════════════════════════════════════════════════════ */

export type CreateCafeMenuResult =
  | { ok: true; id: string }
  | {
      ok: false;
      error:
        | 'unauthorized'
        | 'validation_failed'
        | 'id_conflict'
        | 'server_error';
      detail?: string;
    };

export async function createCafeMenuAction(
  input: MenuMetaInput,
): Promise<CreateCafeMenuResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = MenuMetaSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validation_failed',
      detail: formatZodFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }
  const v = parsed.data;

  const prefix = pickIdPrefix(v.cat, v.status);
  const id = await fetchAdminNextCafeMenuId(prefix);

  /* S245-P10: sort_order 항상 server-side 자동 채번 (폼 입력값 무시).
     hidden Activity 로 RHF state 잔존 시 폼 sortOrder 가 stale 값일 수 있어
     server 측에서 강제 max+1 으로 덮어씀. 전체 단일 시퀀스 정책 (S245-P9 fix). */
  const nextSortOrder = await fetchAdminNextCafeMenuSortOrder();

  const admin = getSupabaseAdmin();

  /* INSERT — is_active default true (047). 신규 등록 후 운영자가 비공개 토글 가능. */
  const { error: insErr } = await admin
    .from('cafe_menu_items')
    .insert({
      id,
      img_src: '', // 신규 등록 시점은 빈값 — edit 에서 업로드
      ...toCafeMenuDbRow(v),
      sort_order: nextSortOrder, // 폼 입력 덮어쓰기
    });

  if (insErr) {
    /* unique 위반 (race condition · 동시 등록) */
    if (insErr.code === '23505') {
      return { ok: false, error: 'id_conflict', detail: id };
    }
    console.error('[createCafeMenuAction] insert failed', {
      code: insErr.code,
      message: insErr.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }

  revalidateTag(CAFE_MENU_CACHE_TAG, 'max');
  revalidatePath('/admin/menu');
  /* /admin/menu/new 라우터 캐시 무효화 — 재진입 시 fetchAdminNextCafeMenuSortOrder
     재실행 (방금 등록한 메뉴 반영 max+1) + 컴포넌트 fresh prop 수신 (S245-P10). */
  revalidatePath('/admin/menu/new');
  revalidatePath('/menu');

  return { ok: true, id };
}

/* ══════════════════════════════════════════════════════════════════════════
   updateCafeMenuAction — 메뉴 메타 UPDATE (S244)

   - admin 가드
   - Zod 검증
   - UPDATE cafe_menu_items (이미지 컬럼은 제외 — uploadCafeMenuImageAction 분리)
   - status 변경 시 ID prefix 재계산은 미수행 (PK 변경 위험 — DEC: id 는 영구 잠금)
   ══════════════════════════════════════════════════════════════════════════ */

export type UpdateCafeMenuResult =
  | { ok: true }
  | {
      ok: false;
      error: 'unauthorized' | 'validation_failed' | 'not_found' | 'server_error';
      detail?: string;
    };

const UpdateCafeMenuSchema = MenuMetaSchema.extend({
  id: CafeMenuIdSchema,
});

export async function updateCafeMenuAction(
  input: z.infer<typeof UpdateCafeMenuSchema>,
): Promise<UpdateCafeMenuResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = UpdateCafeMenuSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validation_failed',
      detail: formatZodFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }
  const { id, ...v } = parsed.data;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('cafe_menu_items')
    .update(toCafeMenuDbRow(v))
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[updateCafeMenuAction] update failed', {
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }
  if (!data) return { ok: false, error: 'not_found' };

  revalidateTag(CAFE_MENU_CACHE_TAG, 'max');
  revalidatePath('/admin/menu');
  revalidatePath(`/admin/menu/${id}/edit`);
  revalidatePath('/menu');

  return { ok: true };
}

/* ══════════════════════════════════════════════════════════════════════════
   uploadCafeMenuImageAction — 이미지 업로드/교체 (S244)

   처리 (uploadProductImageAction 답습 + 단일 이미지 정책):
   1) admin 가드 + file 검증 (5MB · MIME)
   2) processAdminImage — sharp webp + plaiceholder LQIP + dominant color
   3) Storage menu-images/{id}/cm-{ts}-{rand}.webp upload
   4) cafe_menu_items UPDATE — img_src / blur_data_url / width / height / bg
   5) 이전 이미지 Storage cleanup (best-effort)
   6) revalidate
   ══════════════════════════════════════════════════════════════════════════ */

export type UploadCafeMenuImageResult =
  | {
      ok: true;
      imgSrc: string;
      blurDataUrl: string;
      width: number;
      height: number;
    }
  | {
      ok: false;
      error:
        | 'unauthorized'
        | 'validation_failed'
        | 'invalid_image'
        | 'not_found'
        | 'server_error';
      detail?: string;
    };

export async function uploadCafeMenuImageAction(
  formData: FormData,
): Promise<UploadCafeMenuImageResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const id = String(formData.get('id') ?? '');
  const file = formData.get('file');

  if (!CafeMenuIdSchema.safeParse(id).success) {
    return { ok: false, error: 'validation_failed', detail: 'id' };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'validation_failed', detail: 'file_missing' };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: 'validation_failed', detail: 'file_too_large' };
  }

  /* 존재 확인 + 이전 img_src 추출 (cleanup 용) */
  const admin = getSupabaseAdmin();
  const { data: existingRow, error: selErr } = await admin
    .from('cafe_menu_items')
    .select('id, img_src')
    .eq('id', id)
    .maybeSingle();
  if (selErr) {
    console.error('[uploadCafeMenuImageAction] select failed', selErr.message);
    return { ok: false, error: 'server_error' };
  }
  if (!existingRow) return { ok: false, error: 'not_found' };

  const original = Buffer.from(await file.arrayBuffer());

  const processed = await processAdminImage(original);
  if (!processed.ok) {
    return { ok: false, error: 'invalid_image' };
  }
  const { image } = processed;

  const filename = buildAdminImageFilename('cm');
  const storagePath = `${id}/${filename}`;

  const { error: uploadErr } = await admin.storage
    .from(MENU_IMAGES_BUCKET)
    .upload(storagePath, image.buffer, {
      contentType: 'image/webp',
      upsert: false,
    });
  if (uploadErr) {
    console.error('[uploadCafeMenuImageAction] storage upload failed', {
      message: uploadErr.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }

  const { data: urlData } = admin.storage
    .from(MENU_IMAGES_BUCKET)
    .getPublicUrl(storagePath);

  const newImgSrc = urlData.publicUrl;

  /* DB UPDATE — img_src / blur / width / height / bg (dominant color 자동 갱신) */
  const { error: updErr } = await admin
    .from('cafe_menu_items')
    .update({
      img_src: newImgSrc,
      blur_data_url: image.base64,
      width: image.width,
      height: image.height,
      bg: image.colorHex,
    })
    .eq('id', id);

  if (updErr) {
    console.error('[uploadCafeMenuImageAction] update failed', updErr.message);
    /* 업로드 rollback (best-effort) */
    await admin.storage.from(MENU_IMAGES_BUCKET).remove([storagePath]);
    return { ok: false, error: 'server_error' };
  }

  /* 이전 이미지 cleanup (Storage public URL → path 추출 · best-effort).
     Storage URL 형태: .../storage/v1/object/public/menu-images/{id}/{filename}
     prefix 가 다르면 (public/ 정적 자산 시점 이전 메뉴) skip. */
  const prevSrc = existingRow.img_src as string;
  if (prevSrc && prevSrc.includes('/menu-images/')) {
    const match = prevSrc.match(/\/menu-images\/(.+)$/);
    if (match && match[1] !== `${id}/${filename}`) {
      const { error: rmErr } = await admin.storage
        .from(MENU_IMAGES_BUCKET)
        .remove([match[1]]);
      if (rmErr) {
        console.error('[uploadCafeMenuImageAction] prev cleanup failed', {
          path: match[1],
          message: rmErr.message?.slice(0, 200),
        });
      }
    }
  }

  revalidateTag(CAFE_MENU_CACHE_TAG, 'max');
  revalidatePath('/admin/menu');
  revalidatePath(`/admin/menu/${id}/edit`);
  revalidatePath('/menu');

  return {
    ok: true,
    imgSrc: newImgSrc,
    blurDataUrl: image.base64,
    width: image.width,
    height: image.height,
  };
}
