/* ══════════════════════════════════════════
   Shop Product Detail Route — /shop/[slug]
   - SSG: generateStaticParams 로 빌드 타임에 모든 상품 라우트 프리렌더
   - 잘못된 slug 는 notFound() → 404
   - Next 15+ 에서 params 는 Promise → async 컴포넌트에서 await
   ══════════════════════════════════════════ */

import { notFound } from 'next/navigation';
import { connection } from 'next/server';
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
  /* S279-D · DEC-S279-D-1: build-time 안전 lightweight variant.
     fetchProducts 는 caller 측 connection() 요구 — build-time 호출 불가. */
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
  /* S279-D · DEC-S279-D-1: productsServer 'use cache' 폐기로 caller 측
     connection() 명시 — admin 변경 즉시 PDP 반영 보장. */
  await connection();
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
