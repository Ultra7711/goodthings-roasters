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
  cafeEvent: (p: React.SVGProps<SVGSVGElement> = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 11l18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
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
      { href: '/admin/cafe-events', label: '카페 이벤트', icon: Icons.cafeEvent },
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
      fontSize: 14,
      lineHeight: '18px',
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
      {/* brand — 메인 사이트 헤더와 동일한 워드마크 SVG + Admin 캡션
            좌측 라인은 nav padding 12px + item padding 10px = 22px 와 정렬. */}
      <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--sidebar-border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 680 142"
            role="img"
            aria-label="Good Things"
            style={{
              height: 20,
              width: 'auto',
              display: 'block',
              color: 'var(--sidebar-fg)',
              fill: 'currentColor',
              /* SVG aspect=680/142, height 20 → width 95.77px.
                 글리프 'g' minX≈20.6 → 95.77 환산 시 좌측 여백 ≈2.9px.
                 메뉴 라인 (padding 22px) 과 시각 정렬 위해 -3px 보정. */
              marginLeft: -3,
            }}
          >
            <polygon points="357.6493 27.2046 339.6493 27.2046 339.6493 44.0773 328.9311 44.0773 328.9311 59.1319 339.6493 59.1319 339.6493 101.2046 357.6493 101.2046 357.6493 59.1319 368.3675 59.1319 368.3675 44.0773 357.6493 44.0773 357.6493 27.2046" />
            <path d="M267.5625,47.602c-4.5569-3.3784-10.093-5.3652-16.0682-5.3652-15.5443,0-28.1454,13.407-28.1454,29.9454s12.6012,29.9455,28.1454,29.9455c5.9752,0,11.5113-1.9868,16.0682-5.3652v4.4562h18V19.1095h-18v28.4925ZM254.758,86.7459c-7.3655,0-13.3364-6.5204-13.3364-14.5637s5.9709-14.5637,13.3364-14.5637c6.0793,0,11.1985,4.4464,12.8045,10.5203v8.0867c-1.606,6.0739-6.7252,10.5203-12.8045,10.5203Z" />
            <rect x="441.922" y="44.0773" width="18" height="57.1273" />
            <circle cx="451.0902" cy="27.3409" r="11" />
            <path d="M578.3129,43.4318l.0443,4.4272c-3.1327-2.7106-8.2188-5.6545-15.5489-5.6545-11.6182,0-27.6545,6.5454-27.6545,28.3091,0,6.3818,1.3091,29.6182,26.8364,29.6182,8.801,0,13.9335-2.7527,16.8364-5.3906l.0591,5.8997s-.9205,9.3091-11.8227,9.3091c-8.3455,0-10.9637-5.5636-10.9637-5.5636h-17.0182s4.0909,21.2727,28.1455,21.2727,29.6591-20.4182,29.6591-25.0182l-.5727-57.2091h-18ZM565.6629,85.8955c-7.3655,0-13.3364-6.5204-13.3364-14.5637s5.9709-14.5637,13.3364-14.5637,13.3364,6.5204,13.3364,14.5637-5.9709,14.5637-13.3364,14.5637Z" />
            <path d="M63.8171,43.3818l.0443,4.4272c-3.1327-2.7106-8.2188-5.6545-15.5489-5.6545-11.6182,0-27.6545,6.5454-27.6545,28.3091,0,6.3818,1.3091,29.6182,26.8364,29.6182,8.801,0,13.9335-2.7527,16.8364-5.3906l.0591,5.8997s-.9205,9.3091-11.8227,9.3091c-8.3455,0-10.9637-5.5636-10.9637-5.5636h-17.0182s4.0909,21.2727,28.1455,21.2727,29.6591-20.4182,29.6591-25.0182l-.5727-57.2091h-18ZM51.1671,85.8455c-7.3655,0-13.3364-6.5204-13.3364-14.5637s5.9709-14.5637,13.3364-14.5637,13.3364,6.5204,13.3364,14.5637-5.9709,14.5637-13.3364,14.5637Z" />
            <path d="M505.2084,42.7682c-7.9653,0-12.7753,3.2297-15.0136,5.261v-3.952h-18v57.1273h18v-33.4c0-4.0909,2.5773-10.4728,10.5954-10.4728s9.2046,9.3273,9.2046,9.3273v34.5455h18v-34.5455c0-17.6727-12.6409-23.8909-22.7864-23.8909Z" />
            <path d="M408.9902,42.7682c-7.7888,0-12.5494,3.0837-14.85,5.1199v-28.6835h-18v82h18v-35.2197c.6652-3.926,3.5295-8.6531,10.4318-8.6531,8.0182,0,9.2045,9.3273,9.2045,9.3273v34.5455h18v-34.5455c0-17.6727-12.6409-23.8909-22.7864-23.8909Z" />
            <path d="M654.977,72.1798c-3.3117-3.0418-8.434-4.4457-15.5883-6.2494-9.0935-2.2925-16.1961-2.7531-16.1961-6.4971,0-3.1037,4.8378-4.2306,9.1287-4.2306,9.1708,0,8.9838,5.1982,8.9838,5.1982h17.1823c0-9.2549-9.2549-18.6781-25.2406-18.6781s-27.0916,7.7405-27.0916,19.3512c0,4.3683,1.6161,8.1512,4.365,11.1059,3.3117,3.0418,8.434,4.4457,15.5883,6.2494,9.0935,2.2925,16.1961,2.7531,16.1961,6.4971,0,3.1037-4.8378,4.2306-9.1287,4.2306-9.1708,0-10.2178-5.7123-10.2178-5.7123h-17.1823c0,9.2549,10.4889,19.1922,26.4746,19.1922s27.0916-7.7405,27.0916-19.3512c0-4.3683-1.6161-8.1512-4.365-11.1059Z" />
            <path d="M120.858,42.2368c-16.8999,0-30.6,13.407-30.6,29.9455s13.7001,29.9454,30.6,29.9454,30.6-13.407,30.6-29.9454-13.7001-29.9455-30.6-29.9455ZM120.858,86.7459c-7.3655,0-13.3364-6.5204-13.3364-14.5637s5.9709-14.5637,13.3364-14.5637,13.3364,6.5204,13.3364,14.5637-5.9709,14.5637-13.3364,14.5637Z" />
            <path d="M187.6216,42.2368c-16.9,0-30.6,13.407-30.6,29.9455s13.7001,29.9454,30.6,29.9454,30.6-13.407,30.6-29.9454-13.7001-29.9455-30.6-29.9455ZM187.6216,86.7459c-7.3655,0-13.3364-6.5204-13.3364-14.5637s5.9709-14.5637,13.3364-14.5637,13.3364,6.5204,13.3364,14.5637-5.9709,14.5637-13.3364,14.5637Z" />
          </svg>
          <div
            style={{
              fontSize: 14,
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
                fontSize: 14,
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
                    <Icon style={{ opacity: isActive ? 1 : 0.75, flexShrink: 0, display: 'block' }} />
                    <span style={{ flex: 1 }}>{it.label}</span>
                    {it.badge != null && (
                      <span
                        style={{
                          fontSize: 14,
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
              fontSize: 14,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
          <div style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
            <div
              style={{
                fontSize: 14,
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
                fontSize: 14,
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
