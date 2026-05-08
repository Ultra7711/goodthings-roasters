/* ══════════════════════════════════════════
   Legal Detail Route — /legal/[slug]
   ──────────────────────────────────────────
   - SSG: generateStaticParams 로 빌드 타임에 5개 약관 라우트 프리렌더
   - 잘못된 slug 는 notFound() → 404
   - SEO 인덱싱 권장 (이용약관·개인정보처리방침 등 trust signal)
   ══════════════════════════════════════════ */

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  LEGAL_SLUGS,
  getLegalDoc,
  isLegalSlug,
} from './content';
import LegalPage from '@/components/legal/LegalPage';

type RouteParams = { slug: string };

export function generateStaticParams(): RouteParams[] {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isLegalSlug(slug)) {
    return { title: '문서를 찾을 수 없습니다 — good things' };
  }
  const doc = getLegalDoc(slug);
  return {
    title: `${doc.title} — good things`,
    description: doc.description,
    alternates: {
      canonical: `/legal/${slug}`,
    },
    openGraph: {
      title: `${doc.title} — good things`,
      description: doc.description,
      type: 'article',
    },
  };
}

/* BUG-006 Stage C 패턴 답습 — cacheComponents 활성 환경에서 await params 가 dynamic API.
   Suspense 경계 안 inner async 컴포넌트로 분리하여 prerender / RSC 호환 보장. */
async function LegalContent({ slug }: { slug: string }) {
  if (!isLegalSlug(slug)) notFound();
  const doc = getLegalDoc(slug);
  return <LegalPage doc={doc} />;
}

export default async function LegalRoute({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  return (
    <Suspense fallback={null}>
      <LegalContent slug={slug} />
    </Suspense>
  );
}
