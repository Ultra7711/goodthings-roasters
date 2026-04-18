/* ══════════════════════════════════════════
   Shop Product Detail Route — /shop/[slug]
   - SSG: generateStaticParams 로 빌드 타임에 모든 상품 라우트 프리렌더
   - 잘못된 slug 는 notFound() → 404
   - Next 15+ 에서 params 는 Promise → async 컴포넌트에서 await
   ══════════════════════════════════════════ */

import { notFound } from 'next/navigation';
import { PRODUCTS, extractKrName } from '@/lib/products';
import ProductDetailPage from '@/components/product/ProductDetailPage';

type RouteParams = { slug: string };

export function generateStaticParams(): RouteParams[] {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<RouteParams> }) {
  const { slug } = await params;
  const product = PRODUCTS.find((p) => p.slug === slug);
  if (!product) return { title: '상품을 찾을 수 없습니다 — good things' };
  return {
    title: `${extractKrName(product.name)} — good things`,
    description: product.desc.split('\n')[0],
  };
}

export default async function ProductDetailRoute({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  const product = PRODUCTS.find((p) => p.slug === slug);
  if (!product) notFound();
  return <ProductDetailPage product={product} />;
}
