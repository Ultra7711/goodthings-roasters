/* ══════════════════════════════════════════
   AdminFormSkeleton — admin edit 페이지 공통 Suspense fallback

   products/[slug]/edit · menu/[id]/edit 가 동일 레이아웃
   (BackLink + 헤더 + 이미지 섹션 카드 + 편집 폼 카드 + 위험영역)
   을 공유 → 단일 스켈레톤으로 통일 (이전: 각 페이지 복붙 EditSkeleton).

   색: admin 표준 placeholder 토큰 var(--surface-muted) 사용
       (admin 전역 컨벤션 정합 · 메인 .skel 검정 오버레이는 admin 테마와 별개).
   입자도: 중입자 — 영역/필드 단위 통박스. 폼 카드까지 reserve 하여
           실제 폼 swap 시 CLS 최소화 (이전엔 이미지 박스만 reserve).
   ══════════════════════════════════════════ */

import type { ReactNode } from 'react';

const SKEL = 'var(--surface-muted)';

/* 폼 필드 라벨 폭 다양성 (px) — 단조로운 동일 폭 방지. */
const FIELD_LABEL_WIDTHS = [64, 48, 72, 56];

function Box({
  h,
  w = '100%',
  mb,
}: {
  h: number;
  w?: number | string;
  mb?: number;
}) {
  return (
    <div style={{ height: h, width: w, background: SKEL, borderRadius: 4, marginBottom: mb }} />
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <section
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 20,
        marginBottom: 20,
      }}
    >
      {children}
    </section>
  );
}

export default function AdminFormSkeleton() {
  return (
    <div aria-hidden>
      {/* 목록 back link */}
      <Box h={16} w={120} mb={24} />

      {/* 헤더 — 제목 + 보조줄 */}
      <div style={{ marginBottom: 24 }}>
        <Box h={28} w={240} mb={8} />
        <Box h={16} w={160} />
      </div>

      {/* 이미지 섹션 카드 — 섹션 제목 + 이미지 영역 */}
      <Card>
        <Box h={14} w={80} mb={16} />
        <Box h={140} />
      </Card>

      {/* 편집 폼 카드 — 필드(라벨 + 인풋) × 4 */}
      <Card>
        {FIELD_LABEL_WIDTHS.map((w, i) => (
          <div key={i} style={{ marginBottom: i === FIELD_LABEL_WIDTHS.length - 1 ? 0 : 16 }}>
            <Box h={12} w={w} mb={6} />
            <Box h={40} />
          </div>
        ))}
      </Card>
    </div>
  );
}
