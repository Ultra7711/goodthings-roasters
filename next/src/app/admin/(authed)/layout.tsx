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
    <div className="flex min-h-screen bg-background text-foreground">
      <AdminSidebar email={claims.email} />
      <div className="flex flex-1 flex-col">
        <AdminTopbar email={claims.email} />
        <main className="flex-1 overflow-x-hidden px-8 py-7">{children}</main>
      </div>
    </div>
  );
}

function AdminLayoutSkeleton() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-card md:block" />
      <div className="flex flex-1 flex-col">
        <header className="h-14 border-b border-border bg-card" />
      </div>
    </div>
  );
}
