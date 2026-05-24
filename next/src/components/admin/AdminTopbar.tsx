'use client';

/* ══════════════════════════════════════════
   AdminTopbar — S125: 시안 shell.jsx Topbar inline style 이식.
   - height 56px, padding 0 24px
   - 좌측: 페이지 타이틀 (pathname 자동 매핑)
   - 우측: 페이지 actions slot → 알림 벨 → 사용자 아바타
   ══════════════════════════════════════════ */

import { usePathname } from 'next/navigation';
import { AdminTopbarSlotAnchor } from '@/components/admin/AdminTopbarActions';

const Bell = (p: React.SVGProps<SVGSVGElement> = {}) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

type Props = {
  email: string;
  displayName: string | null;
};

const PAGE_TITLES: Record<string, string> = {
  '/admin': '대시보드',
  '/admin/orders': '주문',
  '/admin/subscriptions': '정기배송',
  '/admin/products': '상품',
  '/admin/menu': '카페 메뉴',
  '/admin/cafe-events': '카페 배너',
  '/admin/signatures': '시그니처 배너',
  '/admin/users': '고객',
  '/admin/gooddays': '굿데이즈',
  '/admin/analytics': '통계',
  '/admin/settings': '사이트 설정',
};

function resolvePageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (path !== '/admin' && pathname.startsWith(path)) return title;
  }
  return 'Admin';
}

export default function AdminTopbar({ email, displayName }: Props) {
  const pathname = usePathname();
  const title = resolvePageTitle(pathname);
  const name = displayName?.trim() || email.split('@')[0] || 'Admin';
  const initial = name.charAt(0).toUpperCase();

  return (
    <header
      style={{
        height: 56,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        gap: 12,
        /* 스크롤 시에도 페이지 타이틀 + actions(저장 버튼 등) 항상 노출 (S129 H-5 후속 UX). */
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 500,
            letterSpacing: '-0.015em',
          }}
        >
          {title}
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <AdminTopbarSlotAnchor style={{ display: 'flex', alignItems: 'center', gap: 8 }} />

        <button
          type="button"
          aria-label="알림"
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--foreground-muted)',
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          <Bell />
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: 6,
              right: 7,
              width: 6,
              height: 6,
              borderRadius: 999,
              background: 'var(--primary)',
            }}
          />
        </button>

        <div
          title={email}
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background: 'var(--neutral-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--foreground)',
            marginLeft: 4,
          }}
        >
          {initial}
        </div>
      </div>
    </header>
  );
}
