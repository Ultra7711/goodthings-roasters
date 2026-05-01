'use client';

/* ══════════════════════════════════════════
   AdminSidebar — S125: 시안 shell.jsx Sidebar 100% inline style 이식.
   - 시안 SVG 아이콘 (lucide-flavor) 그대로 사용
   - usePathname 으로 active 결정
   - 사용자 카드: 클릭 시 supabase signOut → /admin/login
   ══════════════════════════════════════════ */

import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { CSSProperties } from 'react';
import { supabase } from '@/lib/supabase';

/* ── 시안 inline SVG 아이콘 ── */
const Icons = {
  dashboard: (p: React.SVGProps<SVGSVGElement> = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
    </svg>
  ),
  orders: (p: React.SVGProps<SVGSVGElement> = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  ),
  product: (p: React.SVGProps<SVGSVGElement> = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m7.5 4.27 9 5.15" /><path d="M21 8 12 13 3 8" />
      <path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8" />
      <path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
    </svg>
  ),
  subscription: (p: React.SVGProps<SVGSVGElement> = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 12a9 9 0 1 1-3.5-7.1" /><path d="M21 4v5h-5" />
    </svg>
  ),
  customers: (p: React.SVGProps<SVGSVGElement> = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  stats: (p: React.SVGProps<SVGSVGElement> = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 6-6" />
    </svg>
  ),
  settings: (p: React.SVGProps<SVGSVGElement> = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  cafeMenu: (p: React.SVGProps<SVGSVGElement> = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 11h3a8 8 0 0 1 0 0v9" /><path d="M6 11V8a3 3 0 1 1 6 0v3" />
      <path d="M2 11h12v3a8 8 0 0 1-8 8 8 8 0 0 1-4-1z" />
    </svg>
  ),
  gooddays: (p: React.SVGProps<SVGSVGElement> = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  ),
  chevronDown: (p: React.SVGProps<SVGSVGElement> = {}) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
};

type NavItem = {
  href: string;
  label: string;
  icon: (p?: React.SVGProps<SVGSVGElement>) => React.ReactElement;
  badge?: number;
};
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: '운영',
    items: [
      { href: '/admin', label: '대시보드', icon: Icons.dashboard },
      { href: '/admin/orders', label: '주문', icon: Icons.orders },
      { href: '/admin/subscriptions', label: '정기배송', icon: Icons.subscription },
    ],
  },
  {
    label: '카탈로그',
    items: [
      { href: '/admin/products', label: '상품', icon: Icons.product },
      { href: '/admin/menu', label: '카페 메뉴', icon: Icons.cafeMenu },
      { href: '/admin/users', label: '고객', icon: Icons.customers },
      { href: '/admin/gooddays', label: '굿데이즈', icon: Icons.gooddays },
    ],
  },
  {
    label: '인사이트',
    items: [{ href: '/admin/analytics', label: '통계', icon: Icons.stats }],
  },
  {
    label: '설정',
    items: [{ href: '/admin/settings', label: '사이트 설정', icon: Icons.settings }],
  },
];

type Props = {
  email: string;
  displayName: string | null;
  title: string | null;
};

export default function AdminSidebar({ email, displayName, title }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const name = displayName?.trim() || email.split('@')[0] || 'Admin';
  const initial = name.charAt(0).toUpperCase();
  const subtitle = title?.trim() || '관리자';

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('로그아웃 실패', { description: error.message });
      return;
    }
    router.replace('/admin/login');
    router.refresh();
  }

  function itemStyle(isActive: boolean): CSSProperties {
    return {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '7px 10px',
      borderRadius: 6,
      fontSize: 13,
      fontWeight: isActive ? 500 : 400,
      color: isActive ? 'var(--sidebar-active-fg)' : 'var(--sidebar-fg)',
      background: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
      cursor: 'pointer',
      position: 'relative',
      letterSpacing: '-0.005em',
      textDecoration: 'none',
    };
  }

  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        background: 'var(--sidebar-bg)',
        color: 'var(--sidebar-fg)',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--sidebar-border)',
      }}
    >
      {/* brand */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--sidebar-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'var(--sidebar-accent)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-serif)',
              fontWeight: 500,
              fontSize: 15.4,
              letterSpacing: '-0.02em',
            }}
          >
            G
          </div>
          <div style={{ lineHeight: 1.1 }}>
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--sidebar-fg)',
                letterSpacing: '-0.01em',
              }}
            >
              Good Things
            </div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: 'var(--sidebar-fg-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Roasters · Admin
            </div>
          </div>
        </div>
      </div>

      {/* nav */}
      <nav
        style={{
          padding: '14px 12px',
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        {NAV_GROUPS.map((g) => (
          <div key={g.label}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--sidebar-fg-subtle)',
                padding: '0 10px 6px',
              }}
            >
              {g.label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {g.items.map((it) => {
                const isActive =
                  it.href === '/admin' ? pathname === '/admin' : pathname.startsWith(it.href);
                const Icon = it.icon;
                return (
                  <a key={it.href} href={it.href} style={itemStyle(isActive)}>
                    {isActive && (
                      <div
                        style={{
                          position: 'absolute',
                          left: -12,
                          top: 8,
                          bottom: 8,
                          width: 2,
                          background: 'var(--sidebar-accent)',
                          borderRadius: 2,
                        }}
                      />
                    )}
                    <Icon style={{ opacity: isActive ? 1 : 0.75, flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{it.label}</span>
                    {it.badge != null && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: 999,
                          background: 'var(--sidebar-accent)',
                          color: '#fff',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {it.badge}
                      </span>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* user card → logout on click */}
      <div style={{ padding: 12, borderTop: '1px solid var(--sidebar-border)' }}>
        <button
          type="button"
          onClick={handleLogout}
          aria-label="로그아웃"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 10px',
            borderRadius: 8,
            background: 'var(--sidebar-bg-elevated)',
            cursor: 'pointer',
            border: 'none',
            width: '100%',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              background: '#3a352f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
          <div style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
            <div
              style={{
                fontSize: 12,
                color: 'var(--sidebar-fg)',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={email}
            >
              {name}
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: 'var(--sidebar-fg-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {subtitle}
            </div>
          </div>
          <div style={{ color: 'var(--sidebar-fg-muted)' }}>
            <Icons.chevronDown />
          </div>
        </button>
      </div>
    </aside>
  );
}
