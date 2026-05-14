import type { ReactNode } from 'react';

/* ══════════════════════════════════════════════════════════════════════════
   AdminPageHeader — 어드민 페이지 헤더 표준 (S227 DEC-8)

   답습 source (5 페이지):
   - /admin (Dashboard) · /admin/orders · /admin/users
   - /admin/products · /admin/subscriptions

   기준 (admin-design.md §5-1):
   - mb-5 (기본) — Settings 등 mb-6 도 허용
   - h2 = text-2xl font-medium tracking-tight
   - subtitle = text-sm text-muted-foreground

   subtitle 권장 패턴: "총 N건의 주문 · M건 처리 대기" 처럼 카운트 흡수.
   별 AdminListMeta 컴포넌트 추출 안 함 (DEC-14 변경 · 1 caller hypothetical).

   참조: ADR-009 · admin-design.md §5-1 · §13
   ══════════════════════════════════════════════════════════════════════════ */

type AdminPageHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  /** 우측 슬롯 — 보통 Topbar 사용 권장. 페이지 헤더 안 액션이 필요한 경우만. */
  rightSlot?: ReactNode;
  /** 기본 'mb-5'. Settings 같은 폼 페이지는 'mb-6' 허용. */
  className?: string;
};

export function AdminPageHeader({
  title,
  subtitle,
  rightSlot,
  className = 'mb-5',
}: AdminPageHeaderProps) {
  return (
    <div className={`${className} flex items-baseline justify-between`}>
      <div>
        <h2 className="m-0 text-2xl font-medium tracking-tight">{title}</h2>
        {subtitle != null && (
          <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
        )}
      </div>
      {rightSlot && <div>{rightSlot}</div>}
    </div>
  );
}
