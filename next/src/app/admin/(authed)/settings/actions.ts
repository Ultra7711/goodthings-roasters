'use server';

/* ══════════════════════════════════════════════════════════════════════════
   actions.ts — /admin/settings server actions (S129 Group H)

   책임:
   1) getAdminClaims 가드 — 비admin 차단
   2) Zod 검증 — notice / shipping / signature 영역별
   3) UPDATE 실 변경된 영역만 (dirty diff 는 클라이언트가 보냄)
   4) revalidatePath — /admin/settings + 메인 사이트 영역(/, /menu 등)

   설계:
   - 클라이언트가 변경된 영역만 payload 에 포함 (예: { notice: {...} }).
     영역 누락 → 해당 영역 미변경 → UPDATE 안 함.
   - upsert 사용 (key 없으면 INSERT). 운영 중 row 삭제 사고 회복.
   - service_role 불필요 — site_settings RLS 가 admin write 허용.
   ══════════════════════════════════════════════════════════════════════════ */

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { getAdminOwnerClaims } from '@/lib/auth/getClaims';
import {
  HomeFeaturedSettingsSchema,
  NoticeSettingsSchema,
  parseSiteSettingsRows,
  ShippingSettingsSchema,
  SignatureSettingsSchema,
  type SiteSettingKey,
  type SiteSettings,
} from '@/lib/siteSettings';
import { SITE_SETTINGS_CACHE_TAG } from '@/lib/siteSettingsServer';
import { createRouteHandlerClient } from '@/lib/supabaseServer';

const SaveInputSchema = z.object({
  notice: NoticeSettingsSchema.optional(),
  shipping: ShippingSettingsSchema.optional(),
  signature: SignatureSettingsSchema.optional(),
  home_featured: HomeFeaturedSettingsSchema.optional(),
});

export type SaveSettingsInput = z.input<typeof SaveInputSchema>;

export type SaveSettingsResult =
  | {
      ok: true;
      updatedKeys: SiteSettingKey[];
      /**
       * S255-A HIGH-4: 저장 직후 DB 로부터 다시 읽어 Zod transform 까지 적용한
       * fresh 값. 클라이언트가 setSavedSettings + setSettings 동시에 반영하여
       * "client 측 값 ≠ server-normalized 값" 으로 인한 dirty 잔존 해소.
       * (예외) fresh SELECT 자체가 실패하면 undefined — client 가 자신의
       * settings 로 fallback.
       */
      savedSettings?: SiteSettings;
    }
  | {
      ok: false;
      error: 'unauthorized' | 'validation_failed' | 'server_error' | 'no_changes';
      detail?: string;
    };

/**
 * 어드민이 /admin/settings 에서 [변경사항 저장] 누를 때 호출.
 *
 * @param input 변경된 영역만 포함된 부분 payload.
 *              예) { notice: {...} } — season/shipping 은 미변경
 */
export async function saveSiteSettingsAction(
  input: SaveSettingsInput,
): Promise<SaveSettingsResult> {
  /* 1) S232: owner (관리자) 만 사이트 설정 변경. staff (운영자) 는 차단. */
  const claims = await getAdminOwnerClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  /* 2) Zod 검증 */
  const parsed = SaveInputSchema.safeParse(input);
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      error: 'validation_failed',
      detail: Object.entries(fields)
        .map(([k, v]) => `${k}:${(v as string[])[0] ?? 'invalid'}`)
        .join('; ')
        .slice(0, 200),
    };
  }
  const data = parsed.data;

  /* 3) 변경된 영역만 추출 */
  const updates: Array<{ key: SiteSettingKey; value: unknown }> = [];
  if (data.notice) updates.push({ key: 'notice', value: data.notice });
  if (data.shipping) updates.push({ key: 'shipping', value: data.shipping });
  if (data.signature) updates.push({ key: 'signature', value: data.signature });
  if (data.home_featured) updates.push({ key: 'home_featured', value: data.home_featured });

  if (updates.length === 0) {
    return { ok: false, error: 'no_changes' };
  }

  /* 4) upsert — service_role 불필요 (RLS 가 admin write 허용) */
  const supabase = await createRouteHandlerClient();
  const { error } = await supabase
    .from('site_settings')
    .upsert(
      updates.map(({ key, value }) => ({
        key,
        value,
        updated_by: claims.userId,
      })),
      { onConflict: 'key' },
    );

  if (error) {
    console.error('[saveSiteSettingsAction] upsert failed', {
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }

  /* 5) revalidate — fetchSiteSettings 의 'use cache' 무효화 + 어드민 path.
        Next.js 16 revalidateTag 는 profile 두 번째 인자 mandatory.
        'max' = stale-while-revalidate (다음 요청 시 fresh fetch). */
  revalidateTag(SITE_SETTINGS_CACHE_TAG, 'max');
  revalidatePath('/admin/settings');

  /* S248: home_featured 변경 시 메인 페이지 (CafeMenuSection) cache 무효화. */
  if (updates.some((u) => u.key === 'home_featured')) {
    revalidatePath('/');
  }

  /* 6) S255-A HIGH-4: fresh SELECT 로 server-normalized 전체 settings 반환.
        클라이언트가 setSavedSettings + setSettings 동시 반영하여 stale cache /
        Zod transform 미세 차이로 인한 dirty 잔존 차단. 'use cache' 우회를 위해
        fetchSiteSettings 대신 inline SELECT 사용 (revalidateTag 직후 cache miss
        race 회피). */
  const updatedKeys = updates.map((u) => u.key);
  const { data: freshRows, error: fetchErr } = await supabase
    .from('site_settings')
    .select('key, value');

  if (fetchErr || !freshRows) {
    /* fresh fetch 실패해도 upsert 자체는 성공. client 가 자체 settings 로 fallback. */
    console.warn('[saveSiteSettingsAction] post-save fetch failed', {
      code: fetchErr?.code,
      message: fetchErr?.message?.slice(0, 200),
    });
    return { ok: true, updatedKeys };
  }

  return {
    ok: true,
    updatedKeys,
    savedSettings: parseSiteSettingsRows(
      freshRows as ReadonlyArray<{ key: string; value: unknown }>,
    ),
  };
}
