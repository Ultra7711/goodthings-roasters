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
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchAdminProductRawBySlug } from '@/lib/productsServer';
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
      {/* 뒤로 가기 */}
      <Link
        href="/admin/products"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 8px 4px 4px',
          marginLeft: -4,
          marginBottom: 8,
          color: 'var(--foreground-muted)',
          fontSize: 12.5,
          textDecoration: 'none',
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        상품 목록으로
      </Link>

      {/* 헤더 */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h2
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: '-0.02em',
            }}
          >
            {product.name}
          </h2>
          <span
            className="gtr-mono"
            style={{ fontSize: 13, color: 'var(--foreground-muted)' }}
          >
            {product.slug}
          </span>
          {!product.is_active && (
            <span
              style={{
                display: 'inline-flex',
                padding: '2px 8px',
                borderRadius: 999,
                background: 'var(--neutral-soft)',
                color: 'var(--neutral-soft-fg)',
                fontSize: 11.5,
                fontWeight: 500,
              }}
            >
              비공개
            </span>
          )}
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 13,
            color: 'var(--foreground-muted)',
          }}
        >
          {product.category === 'coffee_bean' ? 'Coffee Bean' : 'Drip Bag'} · {product.display_price}
        </div>
      </div>

      {/* 이미지 reorder 섹션 */}
      <section
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--foreground-muted)',
            }}
          >
            이미지 갤러리
          </h3>
          <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
            {sortedImages.length}장
          </span>
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: 'var(--foreground-muted)',
            lineHeight: 1.6,
            marginBottom: 16,
          }}
        >
          1번 이미지가 <strong style={{ color: 'var(--foreground)' }}>카트 · 결제 · 상품 카드</strong>에 사용되는 대표 이미지입니다.
          대표를 바꾸려면 해당 이미지를 1번으로 이동시키세요.
        </div>

        {sortedImages.length === 0 ? (
          <div
            style={{
              padding: '48px 14px',
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--foreground-muted)',
              background: 'var(--surface-muted)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            등록된 이미지가 없습니다. 이미지 업로드는 다음 단계에서 추가됩니다.
          </div>
        ) : (
          <ProductImageReorderClient
            productId={product.id}
            initialImages={sortedImages.map((i) => ({
              id: i.id,
              src: i.src,
              blurDataUrl: i.blur_data_url,
            }))}
          />
        )}
      </section>

      {/* 5탭 편집 폼 (basic 탭 작동, 나머지 carry-over) */}
      <ProductEditForm product={product} />
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
