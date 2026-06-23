/* ══════════════════════════════════════════
   Shop Product Detail Route — /shop/[slug]
   - SSG: generateStaticParams 로 빌드 타임에 모든 상품 라우트 프리렌더
   - 잘못된 slug 는 notFound() → 404
   - Next 15+ 에서 params 는 Promise → async 컴포넌트에서 await
   ══════════════════════════════════════════ */

import { notFound } from 'next/navigation';
import { extractKrName } from '@/lib/products';
import {
  fetchAllProductSlugs,
  fetchProductBySlug,
} from '@/lib/productsServer';
import ProductDetailPage from '@/components/product/ProductDetailPage';
import { JsonLd } from '@/components/seo/JsonLd';
import { productJsonLd, absoluteUrl } from '@/lib/seo/jsonLd';

type RouteParams = { slug: string };

export async function generateStaticParams(): Promise<RouteParams[]> {
  /* build-time 은 slug 만 필요 → 전체 row fetch(fetchProductBySlug) 대신
     lightweight variant 사용. */
  const slugs = await fetchAllProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<RouteParams> }) {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);
  if (!product) return { title: '상품을 찾을 수 없습니다' };
  const title = extractKrName(product.name);
  const description = product.desc.split('\n')[0];
  const ogImage = product.images[0] ? absoluteUrl(product.images[0].src) : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/shop/${slug}` },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `/shop/${slug}`,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
  };
}

export default async function ProductDetailRoute({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  /* S323 (ADR-012): S321 에서 productsServer 'use cache' + cacheLife(60s) 복원.
     admin 변경 즉시 반영은 revalidateTag(PRODUCTS_CACHE_TAG, 'max') 가 담당 →
     caller connection() 불필요. params 는 generateStaticParams 로 빌드타임 확정. */
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);
  if (!product) notFound();
  return (
    <>
      {/* SEO: 상품 structured data — 가격/재고/이미지 동적 반영 (rich result) */}
      <JsonLd data={productJsonLd(product)} />
      <ProductDetailPage product={product} />
    </>
  );
}
