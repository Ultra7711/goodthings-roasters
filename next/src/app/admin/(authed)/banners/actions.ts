'use server';

/* ══════════════════════════════════════════════════════════════════════════
   /admin banners server actions (S270 Phase 3b · 071 통합)

   책임:
   1) getAdminClaims 가드 — 비admin 차단 (CRUD)
   2) Zod 검증 — discriminated union (kind 별 분기)
   3) INSERT / UPDATE / DELETE banners — service_role 불필요 (RLS admin write 허용)
   4) revalidateTag(bannerCacheTag(kind), 'max') — B2C kind 별 캐시 무효화

   설계:
   - cafe-events/actions.ts (S151 PR-2a) + settings/actions.ts signature 분기 통합.
   - discriminated input — kind 로 분기 + type narrowing (cafe_event 만 type 필수).
   - signature delete reject (DEC-S270 정책) — 운영자 실수 방지. enabled=false 권장.
   - 빈 문자열 date → NULL 변환 (DB date 컬럼은 빈 문자열 reject).
   ══════════════════════════════════════════════════════════════════════════ */

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { getAdminClaims } from '@/lib/auth/getClaims';
import {
  CafeEventBannerSchema,
  SignatureBannerSchema,
  BannerKindSchema,
  type BannerKind,
} from '@/lib/banners';
import { bannerCacheTag } from '@/lib/bannersServer';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { logActionError } from '@/lib/admin/logActionError';

/* ── Schemas ──────────────────────────────────────────────────────────── */

/** create — id 는 DB 가 gen_random_uuid 로 생성. discriminated union 각 분기 omit. */
const CreateCafeEventInputSchema = CafeEventBannerSchema.omit({ id: true });
const CreateSignatureInputSchema = SignatureBannerSchema.omit({ id: true });
const CreateBannerInputSchema = z.discriminatedUnion('kind', [
  CreateCafeEventInputSchema,
  CreateSignatureInputSchema,
]);

/** update — id 필수. */
const UpdateBannerInputSchema = z.discriminatedUnion('kind', [
  CafeEventBannerSchema,
  SignatureBannerSchema,
]);

const DeleteBannerInputSchema = z.object({
  id: z.string().uuid(),
  kind: BannerKindSchema,
});

export type CreateBannerInput = z.input<typeof CreateBannerInputSchema>;
export type UpdateBannerInput = z.input<typeof UpdateBannerInputSchema>;
export type DeleteBannerInput = z.input<typeof DeleteBannerInputSchema>;

export type BannerActionResult =
  | { ok: true; id: string }
  | {
      ok: false;
      error:
        | 'unauthorized'
        | 'validation_failed'
        | 'server_error'
        | 'not_found'
        | 'signature_delete_blocked';
      detail?: string;
    };

/* ── Helpers ──────────────────────────────────────────────────────────── */

/** DB date 컬럼은 "" reject → NULL 변환. */
function emptyToNull(s: string): string | null {
  return s === '' ? null : s;
}

/** Zod 에러 → 짧은 detail 문자열. */
function flattenZodError(err: z.ZodError): string {
  const fields = err.flatten().fieldErrors;
  return Object.entries(fields)
    .map(([k, v]) => `${k}:${(v as string[])[0] ?? 'invalid'}`)
    .join('; ')
    .slice(0, 200);
}

/** Zod-parsed banner (id 유무 무관) → DB row payload. */
function toDbRow(b: z.infer<typeof UpdateBannerInputSchema> | z.infer<typeof CreateBannerInputSchema>) {
  const base = {
    kind: b.kind,
    enabled: b.enabled,
    custom_html_path: b.custom_html_path,
    image_path_desktop: b.image_path_desktop,
    image_path_tablet: b.image_path_tablet,
    image_path_mobile: b.image_path_mobile,
    image_blur_desktop: b.image_blur_desktop,
    image_blur_tablet: b.image_blur_tablet,
    image_blur_mobile: b.image_blur_mobile,
    aspect_desktop: b.aspect_desktop,
    aspect_tablet: b.aspect_tablet,
    aspect_mobile: b.aspect_mobile,
    image_alt: b.image_alt,
    headline_text: b.headline_text,
    subhead_text: b.subhead_text,
    cta_text: b.cta_text,
    cta_href: b.cta_href,
    start_date: emptyToNull(b.start_date),
    end_date: emptyToNull(b.end_date),
    sort_order: b.sort_order,
    /* type 은 cafe_event 분기일 때만. signature 는 DB NULL (CHECK constraint). */
    type: b.kind === 'cafe_event' ? b.type : null,
  };
  return base;
}

function revalidateBanner(kind: BannerKind) {
  /* Next.js 16 revalidateTag 는 profile 두 번째 인자 mandatory.
     'max' = stale-while-revalidate (다음 요청 시 fresh fetch). */
  revalidateTag(bannerCacheTag(kind), 'max');
  if (kind === 'cafe_event') {
    revalidatePath('/admin/cafe-events');
  } else {
    revalidatePath('/admin/signatures');
  }
  /* B2C 메인 페이지도 무효화 (chapter 즉시 반영). */
  revalidatePath('/');
}

/* ── Actions ──────────────────────────────────────────────────────────── */

export async function createBannerAction(
  input: CreateBannerInput,
): Promise<BannerActionResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = CreateBannerInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validation_failed',
      detail: flattenZodError(parsed.error),
    };
  }

  const supabase = await createRouteHandlerClient();
  const { data, error } = await supabase
    .from('banners')
    .insert({
      ...toDbRow(parsed.data),
      updated_by: claims.userId,
    })
    .select('id')
    .single();

  if (error || !data) {
    logActionError('[createBannerAction] insert failed', error, {
      kind: parsed.data.kind,
    });
    return { ok: false, error: 'server_error' };
  }

  revalidateBanner(parsed.data.kind);

  return { ok: true, id: data.id };
}

export async function updateBannerAction(
  input: UpdateBannerInput,
): Promise<BannerActionResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = UpdateBannerInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validation_failed',
      detail: flattenZodError(parsed.error),
    };
  }

  const supabase = await createRouteHandlerClient();
  const { data, error } = await supabase
    .from('banners')
    .update({
      ...toDbRow(parsed.data),
      updated_by: claims.userId,
    })
    .eq('id', parsed.data.id)
    .select('id')
    .single();

  if (error) {
    logActionError('[updateBannerAction] update failed', error, {
      kind: parsed.data.kind,
      id: parsed.data.id,
    });
    return { ok: false, error: 'server_error' };
  }
  if (!data) {
    return { ok: false, error: 'not_found' };
  }

  revalidateBanner(parsed.data.kind);

  return { ok: true, id: data.id };
}

export async function deleteBannerAction(
  input: DeleteBannerInput,
): Promise<BannerActionResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = DeleteBannerInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validation_failed',
      detail: flattenZodError(parsed.error),
    };
  }

  /* DEC-S270 — signature delete 차단. 운영자는 enabled=false 로 비활성만 가능.
     이유: signature partial UNIQUE (071) 가 1 row 보장 + 운영 멘탈 모델 = signature 는
     단일 인스턴스 (시즌 갱신은 같은 row 값 갈아끼움). 삭제 시 chapter 사라짐 사고 가능성. */
  if (parsed.data.kind === 'signature') {
    return { ok: false, error: 'signature_delete_blocked' };
  }

  const supabase = await createRouteHandlerClient();
  const { error } = await supabase
    .from('banners')
    .delete()
    .eq('id', parsed.data.id);

  if (error) {
    logActionError('[deleteBannerAction] delete failed', error, {
      kind: parsed.data.kind,
      id: parsed.data.id,
    });
    return { ok: false, error: 'server_error' };
  }

  revalidateBanner(parsed.data.kind);

  return { ok: true, id: parsed.data.id };
}
