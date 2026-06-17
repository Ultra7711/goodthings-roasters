/* ══════════════════════════════════════════
   sitemap.ts — 검색엔진 색인용 URL 목록 (SEO 1차)

   - 정적 공개 페이지 (홈/shop/menu/story/gooddays/wholesale)
   - 상품 상세 (/shop/[slug]) — fetchAllProductSlugs (anon · connection() 불요)
   - 법적 문서 (/legal/[slug]) — LEGAL_SLUGS 상수
   - 비공개/기능 페이지는 제외 (robots.ts disallow 와 정합)
   ══════════════════════════════════════════ */

import type { MetadataRoute } from 'next';
import { fetchAllProductSlugs } from '@/lib/productsServer';
import { LEGAL_SLUGS } from '@/app/(main)/legal/[slug]/content';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://goodthingsroasters.com';

/** 정적 공개 페이지 — [경로, 변경빈도, 우선순위] */
const STATIC_ROUTES: ReadonlyArray<
  [string, MetadataRoute.Sitemap[number]['changeFrequency'], number]
> = [
  ['', 'daily', 1.0],
  ['/shop', 'daily', 0.9],
  ['/menu', 'daily', 0.9],
  ['/story', 'monthly', 0.6],
  ['/gooddays', 'monthly', 0.6],
  ['/wholesale', 'monthly', 0.4],
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map(
    ([path, changeFrequency, priority]) => ({
      url: `${BASE_URL}${path}`,
      lastModified: now,
      changeFrequency,
      priority,
    }),
  );

  const slugs = await fetchAllProductSlugs();
  const productEntries: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${BASE_URL}/shop/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const legalEntries: MetadataRoute.Sitemap = LEGAL_SLUGS.map((slug) => ({
    url: `${BASE_URL}/legal/${slug}`,
    lastModified: now,
    changeFrequency: 'yearly',
    priority: 0.3,
  }));

  return [...staticEntries, ...productEntries, ...legalEntries];
}
