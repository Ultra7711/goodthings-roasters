/* ══════════════════════════════════════════════════════════════════════════
   AdminMenuEditPage — /admin/menu/[id]/edit (S244)

   - 메뉴 기본 정보 + 영양 정보 편집 폼 (2탭)
   - 이미지 섹션 (단일 업로드 + 미리보기)
   - 활성 토글 헤더
   - 위험 영역 (영구 삭제 · owner 전용)

   products/[slug]/edit/page.tsx 답습.
   ══════════════════════════════════════════════════════════════════════════ */

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getAdminClaims } from '@/lib/auth/getClaims';
import { fetchAdminCafeMenuById } from '@/lib/admin/cafeMenuServer';
import { AdminBackLink } from '@/components/admin/AdminBackLink';
import MenuActiveToggleClient from './MenuActiveToggleClient';
import MenuDangerZoneClient from './MenuDangerZoneClient';
import MenuEditForm from './MenuEditForm';
import MenuImageClient from './MenuImageClient';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function AdminMenuEditPage({ params }: PageProps) {
  return (
    <Suspense fallback={<EditSkeleton />}>
      <EditInner params={params} />
    </Suspense>
  );
}

const CAT_LABEL: Record<string, string> = {
  brewing: 'Brewing',
  tea: 'Tea',
  'non-coffee': 'Non-Coffee',
  dessert: 'Dessert',
};

async function EditInner({ params }: PageProps) {
  const { id } = await params;
  const [row, claims] = await Promise.all([
    fetchAdminCafeMenuById(decodeURIComponent(id)),
    getAdminClaims(),
  ]);
  if (!row) notFound();

  const isOwner = claims?.adminLevel === 'owner';

  return (
    <div>
      <AdminBackLink href="/admin/menu" label="카페 메뉴 목록으로" />

      {/* 헤더 — 타이틀 좌 / 메뉴 공개 토글 우 */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-3 flex-wrap min-w-0">
            <h2 className="m-0 text-2xl font-medium tracking-tight">
              {row.name}
            </h2>
            <span className="gtr-mono text-sm text-muted-foreground">
              {row.id}
            </span>
          </div>
          <MenuActiveToggleClient
            menuId={row.id}
            initialActive={row.is_active}
          />
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {CAT_LABEL[row.cat] ?? row.cat}
          {row.status && ` · ${row.status}`}
          {' · '}
          {row.price.toLocaleString('ko-KR')}원
        </div>
      </div>

      {/* 이미지 섹션 (폼 밖 별 섹션 · DEC-S244-5) */}
      <section className="bg-card border border-border rounded-lg p-5 mb-5">
        <div className="flex items-baseline gap-2 mb-3">
          <h3 className="m-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            이미지
          </h3>
          <span className="text-xs text-[var(--foreground-subtle)]">
            카드 · 영양 시트 공통
          </span>
        </div>
        <MenuImageClient
          menuId={row.id}
          initialImage={{
            src: row.img_src || null,
            blurDataUrl: row.blur_data_url,
            width: row.width,
            height: row.height,
          }}
        />
      </section>

      {/* 2탭 편집 폼 (basic · nutrition) */}
      <MenuEditForm mode="edit" row={row} />

      {/* 위험 영역 — 메뉴 영구 삭제 (owner 전용) */}
      <MenuDangerZoneClient
        menuId={row.id}
        menuName={row.name}
        isOwner={isOwner}
      />
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
