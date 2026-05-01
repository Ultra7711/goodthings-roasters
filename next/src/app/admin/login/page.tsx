/* ══════════════════════════════════════════
   Admin Login Page (/admin/login)
   - 메인 사이트 /login 과 분리. OAuth 미지원 — 이메일+비밀번호 전용.
   - 인증 후 is_admin() 검증 → 비admin 이면 즉시 signOut + 거부 메시지.
   - 이미 admin 으로 로그인한 상태면 /admin 우회.
   - Next.js 16 cacheComponents: 인증 체크를 inner async 로 분리.
   ══════════════════════════════════════════ */

import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdminClaims } from '@/lib/auth/getClaims';
import AdminLoginForm from './AdminLoginForm';

export const metadata: Metadata = {
  title: '관리자 로그인 · Good Things Roasters',
};

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
      <AdminLoginGuard />
    </Suspense>
  );
}

async function AdminLoginGuard() {
  const claims = await getAdminClaims();
  if (claims) redirect('/admin');
  return <LoginShell><AdminLoginForm /></LoginShell>;
}

function LoginShell({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      {children}
    </div>
  );
}
