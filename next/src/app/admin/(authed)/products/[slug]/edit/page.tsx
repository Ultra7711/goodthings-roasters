/* ══════════════════════════════════════════════════════════════════════════
   AdminProductEditPage — /admin/products/[slug]/edit (S218 Phase 1 추가)

   미니멀 첫 단계:
   - 상품 기본 정보 read-only
   - 이미지 갤러리 reorder UI (1번 = 카트/결제/카드 대표)

   carry-over (다음 세션):
   - 5탭 RHF + zod 폼 (basic / detail / option / shipping / seo)
   - product_volumes 옵션 관리
   - product_recipes 추출 가이드 관리
   - Storage 이미지 업로드 (Phase 2 = S219)
   ══════════════════════════════════════════════════════════════════════════ */

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { fetchAdminProductRawBySlug } from '@/lib/admin/productsServer';
import { Badge as ShadcnBadge } from '@/components/admin/ui/badge';
import { AdminBackLink } from '@/components/admin/AdminBackLink';
import ProductEditForm from './ProductEditForm';
import ProductImageReorderClient from './ProductImageReorderClient';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default function AdminProductEditPage({ params }: PageProps) {
  return (
    <Suspense fallback={<EditSkeleton />}>
      <EditInner params={params} />
    </Suspense>
  );
}

async function EditInner({ params }: PageProps) {
  const { slug } = await params;
  const product = await fetchAdminProductRawBySlug(decodeURIComponent(slug));
  if (!product) notFound();

  const sortedImages = [...product.product_images].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  return (
    <div>
      <AdminBackLink href="/admin/products" label="상품 목록으로" />

      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className="m-0 text-2xl font-medium tracking-tight">
            {product.name}
          </h2>
          <span className="gtr-mono text-sm text-muted-foreground">
            {product.slug}
          </span>
          {!product.is_active && (
            <ShadcnBadge
              variant="outline"
              className="border-transparent"
              style={{ background: 'var(--neutral-soft)', color: 'var(--neutral-soft-fg)' }}
            >
              비공개
            </ShadcnBadge>
          )}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {product.category === 'coffee_bean' ? 'Coffee Bean' : 'Drip Bag'} · {product.display_price}
        </div>
      </div>

      {/* 이미지 업로드 + reorder + 삭제 섹션 (S231-3) */}
      <section className="bg-card border border-border rounded-lg p-5 mb-5">
        <div className="flex items-baseline gap-2 mb-1">
          <h3 className="m-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            이미지 갤러리
          </h3>
          <span className="text-xs text-[var(--foreground-subtle)]">
            {sortedImages.length}장
          </span>
        </div>
        <div className="text-xs text-muted-foreground leading-relaxed mb-4">
          1번 이미지가 <strong className="text-foreground">카트 · 결제 · 상품 카드</strong>에 사용되는 대표 이미지입니다.
          대표를 바꾸려면 해당 이미지를 1번으로 이동시키세요.
        </div>

        <ProductImageReorderClient
          productId={product.id}
          productSlug={product.slug}
          initialImages={sortedImages.map((i) => ({
            id: i.id,
            src: i.src,
            blurDataUrl: i.blur_data_url,
            isActive: i.is_active,
          }))}
        />
      </section>

      {/* 3탭 편집 폼 (basic · detail · option) */}
      <ProductEditForm mode="edit" product={product} />
    </div>
  );
}

function EditSkeleton() {
  return (
    <div aria-hidden style={{ minHeight: 400 }}>
      <div
        style={{
          height: 24,
          width: 200,
          background: 'var(--surface-muted)',
          borderRadius: 4,
          marginBottom: 24,
        }}
      />
      <div
        style={{
          height: 200,
          background: 'var(--surface-muted)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
        }}
      />
    </div>
  );
}
