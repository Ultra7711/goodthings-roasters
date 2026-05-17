'use server';

/* ══════════════════════════════════════════════════════════════════════════
   actions.ts — /admin/cafe-events server actions (S151 PR-2a)

   책임:
   1) getAdminClaims 가드 — 비admin 차단
   2) Zod 검증 — CafeEventSchema (create 는 id 제외 / update 는 id 포함)
   3) INSERT / UPDATE / DELETE — service_role 불필요 (RLS 가 admin write 허용)
   4) revalidateTag(CAFE_EVENTS_CACHE_TAG, 'max') — B2C 캐시 무효화

   설계:
   - settings/actions.ts 동일 패턴 (admin 가드 → Zod → DB → revalidate).
   - 빈 문자열 date 는 NULL 로 변환 (DB date 컬럼은 빈 문자열 reject).
   - "동시 활성 max 1" 는 DB 제약이 아니라 어드민 운영 책임 — 폼에서 visual cue 만.
   - 060 iframe 진화 — custom_html_path + aspect_desktop/tablet/mobile.
   ══════════════════════════════════════════════════════════════════════════ */

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { getAdminClaims } from '@/lib/auth/getClaims';
import { CafeEventSchema } from '@/lib/cafeEvents';
import { CAFE_EVENTS_CACHE_TAG } from '@/lib/cafeEventsServer';
import { createRouteHandlerClient } from '@/lib/supabaseServer';

/* ── Schemas ──────────────────────────────────────────────────────────── */

/** create 시 — id 는 DB 가 gen_random_uuid 로 생성. */
const CreateInputSchema = CafeEventSchema.omit({ id: true });

/** update 시 — id 필수. */
const UpdateInputSchema = CafeEventSchema;

export type CreateCafeEventInput = z.input<typeof CreateInputSchema>;
export type UpdateCafeEventInput = z.input<typeof UpdateInputSchema>;

export type CafeEventActionResult =
  | { ok: true; id: string }
  | {
      ok: false;
      error: 'unauthorized' | 'validation_failed' | 'server_error' | 'not_found';
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

/** Zod-parsed event → DB row payload. date 만 NULL 변환. id 는 호출부가 처리. */
function toDbRow(ev: Omit<z.infer<typeof CafeEventSchema>, 'id'>) {
  return {
    type: ev.type,
    enabled: ev.enabled,
    custom_html_path: ev.custom_html_path,
    aspect_desktop: ev.aspect_desktop,
    aspect_tablet: ev.aspect_tablet,
    aspect_mobile: ev.aspect_mobile,
    image_alt: ev.image_alt,
    start_date: emptyToNull(ev.start_date),
    end_date: emptyToNull(ev.end_date),
    sort_order: ev.sort_order,
  };
}

/* ── Actions ──────────────────────────────────────────────────────────── */

export async function createCafeEventAction(
  input: CreateCafeEventInput,
): Promise<CafeEventActionResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = CreateInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validation_failed',
      detail: flattenZodError(parsed.error),
    };
  }

  const supabase = await createRouteHandlerClient();
  const { data, error } = await supabase
    .from('cafe_events')
    .insert({
      ...toDbRow(parsed.data),
      updated_by: claims.userId,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[createCafeEventAction] insert failed', {
      code: error?.code,
      message: error?.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }

  revalidateTag(CAFE_EVENTS_CACHE_TAG, 'max');
  revalidatePath('/admin/cafe-events');

  return { ok: true, id: data.id };
}

export async function updateCafeEventAction(
  input: UpdateCafeEventInput,
): Promise<CafeEventActionResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = UpdateInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validation_failed',
      detail: flattenZodError(parsed.error),
    };
  }

  const supabase = await createRouteHandlerClient();
  const { data, error } = await supabase
    .from('cafe_events')
    .update({
      ...toDbRow(parsed.data),
      updated_by: claims.userId,
    })
    .eq('id', parsed.data.id)
    .select('id')
    .single();

  if (error) {
    console.error('[updateCafeEventAction] update failed', {
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }
  if (!data) {
    return { ok: false, error: 'not_found' };
  }

  revalidateTag(CAFE_EVENTS_CACHE_TAG, 'max');
  revalidatePath('/admin/cafe-events');

  return { ok: true, id: data.id };
}

export async function deleteCafeEventAction(
  id: string,
): Promise<CafeEventActionResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, error: 'validation_failed', detail: 'invalid_uuid' };
  }

  const supabase = await createRouteHandlerClient();
  const { error } = await supabase.from('cafe_events').delete().eq('id', id);

  if (error) {
    console.error('[deleteCafeEventAction] delete failed', {
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }

  revalidateTag(CAFE_EVENTS_CACHE_TAG, 'max');
  revalidatePath('/admin/cafe-events');

  return { ok: true, id };
}
