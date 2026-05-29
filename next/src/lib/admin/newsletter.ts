/* ══════════════════════════════════════════
   admin/newsletter.ts — /admin/newsletter 순수 헬퍼 (S250-2)
   클라이언트(NewsletterClient) + 서버(newsletterServer) 공유 타입·상수·파싱.
   users.ts 패턴 답습 (parseSearchParams · sanitizeSearchQuery).
   ══════════════════════════════════════════ */

import { z } from 'zod';

export const NEWSLETTER_PAGE_SIZE = 20;

export type NewsletterStatusTab = 'all' | 'active' | 'unsubscribed';

export const NEWSLETTER_SOURCE_LABEL: Record<string, string> = {
  newsletter_form: '메인 폼',
  signup_default: '회원 가입',
  admin: '관리자 추가',
  other: '기타',
};

/* q → PostgREST ilike 안전 sanitize (users.sanitizeSearchQuery 동일 규칙) */
export function sanitizeNewsletterQuery(raw: string): string {
  return raw
    .trim()
    .replace(/[%_,()*"\\]/g, '')
    .slice(0, 60);
}

const SearchParamsSchema = z.object({
  status: z.enum(['all', 'active', 'unsubscribed']).default('all'),
  q: z.string().default(''),
  page: z.coerce.number().int().min(1).max(9999).default(1),
});

export type NewsletterSearchParams = z.infer<typeof SearchParamsSchema>;

export function parseNewsletterSearchParams(
  raw: Record<string, string | string[] | undefined>,
): NewsletterSearchParams {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') flat[k] = v;
    else if (Array.isArray(v) && v.length > 0) flat[k] = v[0];
  }
  const parsed = SearchParamsSchema.safeParse(flat);
  if (parsed.success) return parsed.data;
  return SearchParamsSchema.parse({});
}
