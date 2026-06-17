'use server';

/* ══════════════════════════════════════════════════════════════════════════
   /admin banners server actions (S273 통합 단순화)

   책임:
   1) getAdminClaims 가드 — 비admin 차단 (CRUD)
   2) Zod 검증 — 단일 BannerSchema (S273 · discriminated union 폐기)
   3) INSERT / UPDATE / DELETE banners — service_role 불필요 (RLS admin write 허용)
   4) reorderBannersAction(kind, orderedIds[]) — 화살표 reorder 일괄 sort_order commit
   5) revalidatePath('/' + '/admin/banners') — B2C 메인 + admin list RSC 무효화

   S273 변경:
   - discriminated union → 단일 BannerSchema
   - type 필드 제거 (마이그 073 DROP)
   - internal_label 추가
   - signature delete reject 해제 — multi row 전제 (1번 카드가 노출 = 화살표 reorder)
   - reorderBannersAction 신설
   ══════════════════════════════════════════════════════════════════════════ */

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getAdminClaims } from '@/lib/auth/getClaims';
import { BannerSchema, BannerKindSchema, type BannerKind } from '@/lib/banners';
import { bannerCacheTag } from '@/lib/bannersServer';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { logActionError } from '@/lib/admin/logActionError';
import {
  buildProductionHtml,
  parseResponsiveHtml,
} from '@/lib/admin/bannerConvert';

/* ── Schemas (non-exported · 'use server' const export 금지 답습) ─────── */

const CreateBannerInputSchema = BannerSchema.omit({ id: true });
const UpdateBannerInputSchema = BannerSchema;
const DeleteBannerInputSchema = z.object({
  id: z.string().uuid(),
  kind: BannerKindSchema,
});
const ReorderBannersInputSchema = z.object({
  kind: BannerKindSchema,
  orderedIds: z.array(z.string().uuid()).min(1).max(50),
});

export type CreateBannerInput = z.input<typeof CreateBannerInputSchema>;
export type UpdateBannerInput = z.input<typeof UpdateBannerInputSchema>;
export type DeleteBannerInput = z.input<typeof DeleteBannerInputSchema>;
export type ReorderBannersInput = z.input<typeof ReorderBannersInputSchema>;

export type BannerActionResult =
  | { ok: true; id: string }
  | {
      ok: false;
      error:
        | 'unauthorized'
        | 'validation_failed'
        | 'server_error'
        | 'not_found';
      detail?: string;
    };

export type ReorderResult =
  | { ok: true }
  | {
      ok: false;
      error: 'unauthorized' | 'validation_failed' | 'server_error';
      detail?: string;
    };

export type ConvertResponsiveResult =
  | { ok: true; productionHtml: string; warnings: string[] }
  | {
      ok: false;
      error: 'unauthorized' | 'invalid_input' | 'parse_failed' | 'too_large';
      detail?: string;
    };

const MAX_RESPONSIVE_HTML_BYTES = 2 * 1024 * 1024;

/* ── Helpers ──────────────────────────────────────────────────────────── */

function emptyToNull(s: string): string | null {
  return s === '' ? null : s;
}

function flattenZodError(err: z.ZodError): string {
  const fields = err.flatten().fieldErrors;
  return Object.entries(fields)
    .map(([k, v]) => `${k}:${(v as string[])[0] ?? 'invalid'}`)
    .join('; ')
    .slice(0, 200);
}

function toDbRow(
  b: z.infer<typeof UpdateBannerInputSchema> | z.infer<typeof CreateBannerInputSchema>,
) {
  return {
    kind: b.kind,
    enabled: b.enabled,
    internal_label: b.internal_label,
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
  };
}


function revalidateBanner(kind: BannerKind) {
  /* S321 'use cache' 복원 — fetchEnabledByKind 가 cacheTag(bannerCacheTag(kind)).
   * revalidateTag 로 캐시 즉시 무효화 + revalidatePath 로 admin/메인 RSC payload
   * 재생성. cacheLife 60s 안전망과 함께 운영자 변경 즉시 반영. */
  revalidateTag(bannerCacheTag(kind), 'max');
  revalidatePath('/admin/banners');
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

  /* 성공 시 server-side redirect — client router.push 가 prefetch 된 stale RSC
     payload 사용하는 회귀 회피. NEXT_REDIRECT throw 로 client 자동 navigate +
     모든 cache 무효화. ?just_created flag 로 list 페이지가 toast 띄움. */
  redirect(`/admin/banners?kind=${parsed.data.kind}&just_created=1`);
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

  /* S273 — signature delete reject 해제. multi row 운영 모델 전제 (시즌별 갈아끼움). */
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

/**
 * 디자이너 responsive HTML → production HTML 자동 변환 (S275 Phase 2).
 *
 * - 디자이너 4 BP stacked responsive.html 텍스트 입력
 * - lib/admin/bannerConvert.ts 의 결정론적 변환 (cheerio + cascade resolver + clamp 산수)
 * - 출력 production HTML + 변환 경고 (BP wrap 누락 등) 반환
 * - 운영자는 client 에서 결과를 받아 uploadBannerHtml 로 Storage 저장
 * - 변환 실패 시 manual upload fallback 보존 (기존 흐름)
 *
 * 보안:
 * - admin 가드 (운영자만 변환 가능)
 * - 2MB upper bound (메모리 보호)
 * - sandbox 차단된 script / viewport meta 는 변환 단계에서 어차피 제거됨
 */
export async function convertResponsiveHtmlAction(
  responsiveHtml: string,
): Promise<ConvertResponsiveResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  if (typeof responsiveHtml !== 'string' || responsiveHtml.trim().length < 100) {
    return {
      ok: false,
      error: 'invalid_input',
      detail: 'responsive HTML 텍스트가 너무 짧습니다 (100자 이상)',
    };
  }
  if (responsiveHtml.length > MAX_RESPONSIVE_HTML_BYTES) {
    return { ok: false, error: 'too_large', detail: '2MB 이하만 허용됩니다' };
  }

  try {
    const parsed = parseResponsiveHtml(responsiveHtml);
    const { html, warnings } = buildProductionHtml(parsed);
    return { ok: true, productionHtml: html, warnings: [...warnings] };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown';
    logActionError('[convertResponsiveHtmlAction] convert failed', { message });
    return { ok: false, error: 'parse_failed', detail: message };
  }
}

/**
 * 어드민 화살표 reorder — orderedIds 배열 순서대로 sort_order 0..N-1 일괄 commit.
 * 1번 (sort_order=0) 카드가 selectActiveBanner 의 노출 배너.
 */
export async function reorderBannersAction(
  input: ReorderBannersInput,
): Promise<ReorderResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = ReorderBannersInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validation_failed',
      detail: flattenZodError(parsed.error),
    };
  }

  const { kind, orderedIds } = parsed.data;
  const supabase = await createRouteHandlerClient();

  /* 각 id 의 sort_order 를 index 값으로 UPDATE.
     RLS admin write 허용 — service_role 불필요.
     N=50 max → 50 round-trip. 일반적 운영 row 수 (1~10) 에서는 미체감. */
  for (let i = 0; i < orderedIds.length; i += 1) {
    const id = orderedIds[i]!;
    const { error } = await supabase
      .from('banners')
      .update({ sort_order: i, updated_by: claims.userId })
      .eq('id', id)
      .eq('kind', kind);

    if (error) {
      logActionError('[reorderBannersAction] update failed', error, {
        kind,
        id,
        targetIndex: i,
      });
      return { ok: false, error: 'server_error' };
    }
  }

  revalidateBanner(kind);

  return { ok: true };
}
