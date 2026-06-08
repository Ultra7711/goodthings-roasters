/* ══════════════════════════════════════════
   admin/reviews.ts — 리뷰 모더레이션 라벨 + 검색/페이지네이션 파싱 (S314 Step 5)
   bizInquiries.ts 답습 (newsletter 스케일 대응 패턴).
   ══════════════════════════════════════════ */

import { z } from 'zod';
import type { ReviewStatus } from '@/types/review';

export const REVIEW_ADMIN_PAGE_SIZE = 20;

export type ReviewStatusTab = 'all' | ReviewStatus;
export type ReviewDomainTab = 'all' | 'product' | 'menu';

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: '검토 대기',
  approved: '게재',
  blocked: '차단',
  deleted: '삭제',
};

/* q → PostgREST ilike 안전 sanitize (bizInquiries 동일 규칙) */
export function sanitizeReviewQuery(raw: string): string {
  return raw
    .trim()
    .replace(/[%_,()*"\\]/g, '')
    .slice(0, 60);
}

const ReviewSearchParamsSchema = z.object({
  status: z.enum(['all', 'pending', 'approved', 'blocked', 'deleted']).default('all'),
  domain: z.enum(['all', 'product', 'menu']).default('all'),
  q: z.string().default(''),
  page: z.coerce.number().int().min(1).max(9999).default(1),
});

export type ReviewSearchParams = z.infer<typeof ReviewSearchParamsSchema>;

export function parseReviewSearchParams(
  raw: Record<string, string | string[] | undefined>,
): ReviewSearchParams {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') flat[k] = v;
    else if (Array.isArray(v) && v.length > 0) flat[k] = v[0];
  }
  const parsed = ReviewSearchParamsSchema.safeParse(flat);
  if (parsed.success) return parsed.data;
  return ReviewSearchParamsSchema.parse({});
}
