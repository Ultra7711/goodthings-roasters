/* ══════════════════════════════════════════
   admin/bizInquiries.ts — 비즈 문의 라벨 변환 + 검색/페이지네이션 파싱 (S250-3 · S304)
   biz.ts 의 옵션(value→label)을 재사용해 어드민 표시용 한글 라벨 해석.
   목록 스케일 대응(상태 필터·검색·페이지네이션)은 newsletter.ts 답습.
   ══════════════════════════════════════════ */

import { z } from 'zod';
import {
  BIZ_TYPE_OPTIONS,
  BIZ_VOLUME_OPTIONS,
  BIZ_CYCLE_OPTIONS,
  BIZ_PRODUCT_OPTIONS,
  type BizDropdownOption,
} from '@/lib/biz';
import type { BizInquiryStatus } from './bizInquiriesServer';

function resolveLabel(options: BizDropdownOption[], value: string | null): string {
  if (!value) return '—';
  return options.find((o) => o.value === value)?.label ?? value;
}

export const describeBizType = (v: string | null) => resolveLabel(BIZ_TYPE_OPTIONS, v);
export const describeBizVolume = (v: string | null) => resolveLabel(BIZ_VOLUME_OPTIONS, v);
export const describeBizCycle = (v: string | null) => resolveLabel(BIZ_CYCLE_OPTIONS, v);
export const describeBizProducts = (values: string[]): string =>
  values.length === 0 ? '—' : values.map((v) => resolveLabel(BIZ_PRODUCT_OPTIONS, v)).join(', ');

export const BIZ_STATUS_LABEL: Record<BizInquiryStatus, string> = {
  pending: '신규',
  contacted: '연락중',
  closed: '종결',
};

/* 상태 전이 순서 — UI 다음 상태 버튼용 */
export const BIZ_STATUS_ORDER: BizInquiryStatus[] = ['pending', 'contacted', 'closed'];

/* ── 목록 검색/페이지네이션 (S304 · newsletter.ts 답습) ─────────────────── */

export const BIZ_PAGE_SIZE = 20;

export type BizStatusTab = 'all' | 'pending' | 'contacted' | 'closed';

/* q → PostgREST ilike 안전 sanitize (newsletter.sanitizeNewsletterQuery 동일 규칙) */
export function sanitizeBizQuery(raw: string): string {
  return raw
    .trim()
    .replace(/[%_,()*"\\]/g, '')
    .slice(0, 60);
}

const BizSearchParamsSchema = z.object({
  status: z.enum(['all', 'pending', 'contacted', 'closed']).default('all'),
  q: z.string().default(''),
  page: z.coerce.number().int().min(1).max(9999).default(1),
});

export type BizSearchParams = z.infer<typeof BizSearchParamsSchema>;

export function parseBizSearchParams(
  raw: Record<string, string | string[] | undefined>,
): BizSearchParams {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') flat[k] = v;
    else if (Array.isArray(v) && v.length > 0) flat[k] = v[0];
  }
  const parsed = BizSearchParamsSchema.safeParse(flat);
  if (parsed.success) return parsed.data;
  return BizSearchParamsSchema.parse({});
}
