'use client';

/* ══════════════════════════════════════════
   AdminTopbar — Claude Design 핸드오프 적용.
   - 좌측: 페이지 타이틀 (pathname 자동 매핑)
   - 우측: 알림 벨 (시각만, 실제 알림 시스템 미구현) + 사용자 아바타 + 로그아웃
   ══════════════════════════════════════════ */

import { usePathname, useRouter } from 'next/navigation';
import { Bell, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/admin/ui/button';

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
  '/admin/users': '고객',
  '/admin/gooddays': '굿데이즈',
  '/admin/analytics': '통계',
  '/admin/settings': '사이트 설정',
};

function resolvePageTitle(pathname: string): string {
  /* exact match → 그 외엔 prefix match */
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (path !== '/admin' && pathname.startsWith(path)) return title;
  }
  return 'Admin';
}

export default function AdminTopbar({ email, displayName }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const title = resolvePageTitle(pathname);
  const name = displayName?.trim() || email.split('@')[0] || 'Admin';
  const initial = name.charAt(0).toUpperCase();

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('로그아웃 실패', { description: error.message });
      return;
    }
    router.replace('/admin/login');
    router.refresh();
  }

  return (
    <header
      className="flex h-14 shrink-0 items-center gap-3 px-6"
      style={{
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <h1
        className="gtr-serif m-0 text-xl font-medium"
        style={{ letterSpacing: '-0.015em' }}
      >
        {title}
      </h1>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          aria-label="알림"
          className="relative flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--surface-muted)]"
          style={{
            border: '1px solid var(--border)',
            background: 'var(--card)',
            color: 'var(--foreground-muted)',
          }}
        >
          <Bell size={16} />
          <span
            aria-hidden
            className="absolute h-1.5 w-1.5 rounded-full"
            style={{
              top: 6,
              right: 7,
              background: 'var(--primary)',
            }}
          />
        </button>

        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold"
          style={{
            background: 'var(--neutral-soft)',
            color: 'var(--foreground)',
          }}
          title={email}
        >
          {initial}
        </div>

        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="size-4" />
          로그아웃
        </Button>
      </div>
    </header>
  );
}
