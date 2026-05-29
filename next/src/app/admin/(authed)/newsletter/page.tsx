/* ══════════════════════════════════════════════════════════════════════════
   AdminNewsletterPage — /admin/newsletter (S241 Phase 3 · S250-2 확장)

   - admin (owner + staff) 접근 · CSV 내보내기는 owner 전용
   - 섹션 탭(구독자 / 발송 / 발송 이력) · 구독자: 검색·상태필터·페이지네이션·CSV
   - 발송 / 발송 이력 탭 = Phase 2 (현재 "준비 중" placeholder)
   ══════════════════════════════════════════════════════════════════════════ */

import { redirect } from 'next/navigation';
import { getAdminClaims } from '@/lib/auth/getClaims';
import { fetchNewsletterSubscribers } from '@/lib/admin/newsletterServer';
import NewsletterClient from './NewsletterClient';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminNewsletterPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const [result, claims] = await Promise.all([
    fetchNewsletterSubscribers(raw),
    getAdminClaims(),
  ]);
  if (!claims) redirect('/admin/login');

  return (
    <NewsletterClient
      rows={result.rows}
      total={result.total}
      counts={result.counts}
      filters={result.filters}
      isOwner={claims.adminLevel === 'owner'}
    />
  );
}
