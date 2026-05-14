import Link from 'next/link';

/* ══════════════════════════════════════════════════════════════════════════
   AdminBackLink — 상세 페이지 표준 "← 목록" 링크 (S227 DEC-12)

   답습 source:
   - OrderDetailClient.tsx:90-98 (chevron-left 14×14 stroke 1.8)
   - products/[slug]/edit/page.tsx:55-64 (동일 구조)

   참조: ADR-009 · admin-design.md §13
   ══════════════════════════════════════════════════════════════════════════ */

type AdminBackLinkProps = {
  href: string;
  /** 기본 "목록으로". 도메인별 커스텀: "주문 목록으로" / "상품 목록으로" / "사용자 목록으로" */
  label?: string;
};

export function AdminBackLink({ href, label = '목록으로' }: AdminBackLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 py-1 pr-2 pl-1 -ml-1 mb-2 text-xs text-muted-foreground rounded no-underline cursor-pointer hover:bg-accent"
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
        aria-hidden="true"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      {label}
    </Link>
  );
}
