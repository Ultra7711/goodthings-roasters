'use client';

/* ══════════════════════════════════════════
   AdminSidebar
   - lucide-react 아이콘 답습 (S231 후속 — 시안 inline SVG 폐기)
   - usePathname 으로 active 결정
   - 사용자 카드: 클릭 시 supabase signOut → /admin/login
   - collapse / expand (Claude 사이드바 답습) + localStorage 영구 저장
   - sticky (top: 0 · height: 100vh)
   ══════════════════════════════════════════ */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { CSSProperties } from 'react';
import {
  BarChart3,
  Calendar,
  ChevronDown,
  ClipboardClock,
  Coffee,
  Image as ImageIcon,
  LayoutTemplate,
  Mail,
  Megaphone,
  Package2,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShoppingBag,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};
type NavGroup = { label: string; items: NavItem[] };

/* S233-fu: 감사 로그는 owner 만 노출. NAV_GROUPS 를 admin_level 별 함수로.
   S270 Phase 3b: 카페 이벤트 + 시그니처 = banners 통합 → [설정] 그룹으로 이동. */
function buildNavGroups(adminLevel: 'owner' | 'staff'): NavGroup[] {
  const settingsItems: NavItem[] = [
    { href: '/admin/settings', label: '사이트 설정', icon: Settings },
    { href: '/admin/cafe-events', label: '카페 이벤트', icon: Megaphone },
    { href: '/admin/signatures', label: '시그니처 배너', icon: Sparkles },
  ];
  if (adminLevel === 'owner') {
    settingsItems.push({ href: '/admin/audit', label: '감사 로그', icon: ClipboardClock });
  }
  return [
    {
      label: '운영',
      items: [
        { href: '/admin', label: '대시보드', icon: LayoutTemplate },
        { href: '/admin/orders', label: '주문', icon: ShoppingBag },
        { href: '/admin/subscriptions', label: '정기배송', icon: Calendar },
      ],
    },
    {
      label: '카탈로그',
      items: [
        { href: '/admin/products', label: '상품', icon: Package2 },
        { href: '/admin/menu', label: '카페 메뉴', icon: Coffee },
        { href: '/admin/users', label: '고객', icon: Users },
        { href: '/admin/gooddays', label: '굿데이즈', icon: ImageIcon },
      ],
    },
    {
      label: '인사이트',
      items: [
        { href: '/admin/analytics', label: '통계', icon: BarChart3 },
        { href: '/admin/newsletter', label: '뉴스레터', icon: Mail },
      ],
    },
    {
      label: '설정',
      items: settingsItems,
    },
  ];
}

/* collapse 영구 저장 — localStorage key. 운영자 선호 유지 (Claude 답습) */
const COLLAPSED_STORAGE_KEY = 'admin-sidebar-collapsed';
const SIDEBAR_WIDTH_EXPANDED = 240;
const SIDEBAR_WIDTH_COLLAPSED = 64;

type Props = {
  email: string;
  displayName: string | null;
  title: string | null;
  /** S233-fu: 사이드바 user card 에 owner/staff badge 표시. */
  adminLevel: 'owner' | 'staff';
};

export default function AdminSidebar({ email, displayName, title, adminLevel }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const name = displayName?.trim() || email.split('@')[0] || 'Admin';
  const initial = name.charAt(0).toUpperCase();
  /* title 이 명시적이면 그대로 / 없으면 admin_level 라벨로 fallback */
  const subtitle = title?.trim() || (adminLevel === 'owner' ? '관리자' : '운영자');
  const levelLabel = adminLevel === 'owner' ? '관리자' : '운영자';
  /* badge 노출 조건:
     - title 이 명시적으로 있을 것 (없으면 subtitle 자체가 권한 라벨)
     - title 이 admin_level 라벨과 다를 것 (029 backfill default '관리자' 와 우연 일치 회피) */
  const trimmedTitle = title?.trim() ?? '';
  const showLevelBadge =
    trimmedTitle.length > 0 && trimmedTitle !== levelLabel;
  const navGroups = useMemo(() => buildNavGroups(adminLevel), [adminLevel]);

  /* collapse/expand 상태 — localStorage 영구 저장 (Claude 답습 · S231 후속).
     SSR 시 false 초기값 → 첫 mount 후 localStorage 동기화. */
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_STORAGE_KEY);
      if (saved === '1') setCollapsed(true);
    } catch {
      /* localStorage 접근 불가 (private mode 등) — 기본 false 유지 */
    }
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* 저장 실패해도 세션 안에서는 동작 */
    }
  }

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
      padding: collapsed ? '8px 0' : '8px 10px',
      justifyContent: collapsed ? 'center' : 'flex-start',
      borderRadius: 6,
      fontSize: 16,
      lineHeight: '20px',
      fontWeight: isActive ? 500 : 400,
      /* 활성 = 베이지 (워드마크와 통일) · 비활성 = dim 회색 (S231 후속) */
      color: isActive ? 'var(--sidebar-fg)' : 'var(--sidebar-fg-dim)',
      background: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
      cursor: 'pointer',
      position: 'relative',
      letterSpacing: '-0.005em',
      textDecoration: 'none',
    };
  }

  const sidebarWidth = collapsed
    ? SIDEBAR_WIDTH_COLLAPSED
    : SIDEBAR_WIDTH_EXPANDED;

  return (
    <aside
      style={{
        width: sidebarWidth,
        flexShrink: 0,
        background: 'var(--sidebar-bg)',
        color: 'var(--sidebar-fg)',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--sidebar-border)',
        /* sticky — body 스크롤 시 viewport 안 고정 (S231 후속) */
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflow: 'auto',
        /* collapse 부드러운 width 전환 (S231 후속) */
        transition: 'width 200ms ease',
      }}
    >
      {/* brand — 워드마크 + Admin 캡션 + collapse 토글 (S231 후속)
          padding: 우측 12 (nav 답습 — 토글 button 이 sidebar 우측 끝에 더 가깝게)
                   좌측 22 (워드마크 'g' 글리프 시각 정렬 유지) */}
      <div
        style={{
          padding: collapsed ? '14px 8px' : '18px 12px 14px 22px',
          borderBottom: '1px solid var(--sidebar-border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: collapsed ? 'center' : 'flex-start',
            justifyContent: collapsed ? 'center' : 'space-between',
            gap: 8,
          }}
        >
          {!collapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, minWidth: 0 }}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 680 142"
            role="img"
            aria-label="Good Things"
            style={{
              height: 23,
              width: 'auto',
              display: 'block',
              color: 'var(--sidebar-fg)',
              fill: 'currentColor',
              /* SVG aspect=680/142, height 23 → width 110.2px ≈ "ROASTERS · ADMIN" 폭.
                 글리프 'g' minX≈20.6 → 110.2 환산 시 좌측 여백 ≈3.3px.
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
          )}
          {/* collapse / expand 토글 (Claude 답습) — 아이콘 크기 nav 답습 (20px) */}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
            title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 6,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--sidebar-fg-muted)',
              flexShrink: 0,
            }}
          >
            {collapsed ? (
              <PanelLeftOpen size={20} />
            ) : (
              <PanelLeftClose size={20} />
            )}
          </button>
        </div>
      </div>

      {/* nav */}
      <nav
        style={{
          padding: collapsed ? '14px 8px' : '14px 12px',
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        {navGroups.map((g) => (
          <div key={g.label}>
            {!collapsed && (
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--sidebar-fg-subtle)',
                  padding: '0 10px 6px',
                }}
              >
                {g.label}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {g.items.map((it) => {
                const isActive =
                  it.href === '/admin' ? pathname === '/admin' : pathname.startsWith(it.href);
                const Icon = it.icon;
                return (
                  /* next/link — client-side navigation. <a href> 풀 리로드 시
                     SSR collapsed=false 깜박임 회피 (S231 후속 버그 fix). */
                  <Link
                    key={it.href}
                    href={it.href}
                    style={itemStyle(isActive)}
                    title={collapsed ? it.label : undefined}
                  >
                    {isActive && !collapsed && (
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
                    <Icon size={20} style={{ opacity: isActive ? 1 : 0.75, flexShrink: 0, display: 'block' }} />
                    {!collapsed && (
                      /* 텍스트 baseline 미세 정렬 — 아이콘 viewBox 정중앙 vs 한글 baseline 어긋남 보정 (1px) */
                      <span style={{ flex: 1, transform: 'translateY(1px)' }}>{it.label}</span>
                    )}
                    {!collapsed && it.badge != null && (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: 999,
                          background: 'var(--sidebar-accent)',
                          color: 'var(--primary-foreground)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {it.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* user card → logout on click · collapsed 시 avatar 만 */}
      <div
        style={{
          padding: collapsed ? 8 : 12,
          borderTop: '1px solid var(--sidebar-border)',
        }}
      >
        <button
          type="button"
          onClick={handleLogout}
          aria-label="로그아웃"
          title={collapsed ? `${name} (로그아웃)` : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 10,
            padding: collapsed ? 6 : '8px 10px',
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
              width: 32,
              height: 32,
              borderRadius: 999,
              background: 'var(--sidebar-avatar-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--sidebar-active-fg)',
              fontSize: 16,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
          {!collapsed && (
            <>
              <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
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
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    color: 'var(--sidebar-fg-muted)',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {subtitle}
                  </span>
                  {showLevelBadge && (
                    <span
                      aria-label={`권한 단계: ${levelLabel}`}
                      style={{
                        flexShrink: 0,
                        padding: '1px 6px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 500,
                        letterSpacing: '0.02em',
                        color: adminLevel === 'owner' ? 'var(--sidebar-fg)' : 'var(--sidebar-fg-muted)',
                        border: `1px solid ${adminLevel === 'owner' ? 'var(--sidebar-fg)' : 'var(--sidebar-fg-muted)'}`,
                        opacity: adminLevel === 'owner' ? 1 : 0.7,
                      }}
                    >
                      {levelLabel}
                    </span>
                  )}
                </div>
              </div>
              <ChevronDown size={14} style={{ color: 'var(--sidebar-fg-muted)' }} />
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
