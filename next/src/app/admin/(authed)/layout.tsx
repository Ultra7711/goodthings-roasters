/* ══════════════════════════════════════════
   Admin Authed Layout
   - getAdminClaims() 가드 — 비인증/비admin 시 /admin/login 리다이렉트.
   - 사이드바 + 상단바 + 메인 영역.
   - Next.js 16 cacheComponents: 인증 체크를 inner async 컴포넌트로 분리하여
     Suspense 경계에 넣는다. (mypage 패턴과 동일.)
   ══════════════════════════════════════════ */

import { Suspense, type ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getAdminClaims } from '@/lib/auth/getClaims';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminTopbar from '@/components/admin/AdminTopbar';
import { AdminTopbarActionsProvider } from '@/components/admin/AdminTopbarActions';

export default function AdminAuthedLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AdminLayoutSkeleton />}>
      <AdminAuthedInner>{children}</AdminAuthedInner>
    </Suspense>
  );
}

async function AdminAuthedInner({ children }: { children: ReactNode }) {
  const claims = await getAdminClaims();
  if (!claims) redirect('/admin/login');

  return (
    <AdminTopbarActionsProvider>
      {/* 시안 AdminShell 패턴: flex row, sidebar 240px + flex-1 main. .gtr-admin 클래스로 시안 base style (font-family, letter-spacing, line-height) 활성화. */}
      <div
        className="gtr-admin"
        style={{
          width: '100%',
          minHeight: '100vh',
          display: 'flex',
          background: 'var(--background)',
        }}
      >
        <AdminSidebar
          email={claims.email}
          displayName={claims.displayName}
          title={claims.title}
        />
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <AdminTopbar email={claims.email} displayName={claims.displayName} />
          <main
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '28px 32px',
            }}
          >
            {children}
          </main>
        </div>
      </div>
    </AdminTopbarActionsProvider>
  );
}

function AdminLayoutSkeleton() {
  return (
    <div
      className="gtr-admin"
      style={{
        width: '100%',
        minHeight: '100vh',
        display: 'flex',
        background: 'var(--background)',
      }}
    >
      <aside
        style={{
          width: 240,
          flexShrink: 0,
          background: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--sidebar-border)',
        }}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            height: 56,
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
          }}
        />
      </div>
    </div>
  );
}
