'use client';

/* ══════════════════════════════════════════
   AdminTopbar — S125: 시안 shell.jsx Topbar inline style 이식.
   - height 56px, padding 0 24px
   - 좌측: 페이지 타이틀 (pathname 자동 매핑)
   - 우측: 페이지 actions slot → 알림 벨 → 사용자 아바타
   ══════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AdminTopbarSlotAnchor } from '@/components/admin/AdminTopbarActions';
import type { AdminNotifications } from '@/lib/admin/notifications';

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
  '/admin/banners': '배너',
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

  /* 알림 — 마운트 + 페이지 네비 + 창 복귀(focus) 시 갱신. 실패해도 무시(보조 기능).
     focus 연타(alt-tab) 비용 방지를 위해 30초 dedup 가드. */
  const [notif, setNotif] = useState<AdminNotifications | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const bellWrapRef = useRef<HTMLDivElement | null>(null);
  const lastFetchRef = useRef(0);

  const NOTIF_DEDUP_MS = 30_000;
  const loadNotifications = useCallback((opts?: { dedup?: boolean }) => {
    const now = Date.now();
    if (opts?.dedup && now - lastFetchRef.current < NOTIF_DEDUP_MS) return;
    lastFetchRef.current = now;
    fetch('/api/admin/notifications')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: AdminNotifications | null) => {
        if (d) setNotif(d);
      })
      .catch(() => {});
  }, []);

  /* 마운트 + 페이지 네비 — 명시적 이동이므로 항상 최신 fetch */
  useEffect(() => {
    loadNotifications();
  }, [pathname, loadNotifications]);

  /* 창/탭 복귀(focus·visibility) — 30초 dedup 가드로 연속 호출 차단 */
  useEffect(() => {
    function onFocus() {
      loadNotifications({ dedup: true });
    }
    function onVisible() {
      if (document.visibilityState === 'visible') {
        loadNotifications({ dedup: true });
      }
    }
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadNotifications]);

  /* 드롭다운 외부 클릭 닫기 (ShippingDialog carrier dropdown 답습) */
  useEffect(() => {
    if (!notifOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!bellWrapRef.current) return;
      if (!bellWrapRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [notifOpen]);

  const totalNotif = notif?.total ?? 0;

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

        <div ref={bellWrapRef} style={{ position: 'relative' }}>
          <button
            type="button"
            aria-label={totalNotif > 0 ? `알림 ${totalNotif}건` : '알림'}
            aria-haspopup="menu"
            aria-expanded={notifOpen}
            onClick={() => setNotifOpen((v) => !v)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: notifOpen ? 'var(--neutral-soft)' : 'var(--surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--foreground-muted)',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <Bell />
            {totalNotif > 0 && (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  minWidth: 16,
                  height: 16,
                  padding: '0 4px',
                  borderRadius: 999,
                  background: 'var(--primary)',
                  color: 'var(--primary-foreground, #fff)',
                  fontSize: 10,
                  fontWeight: 700,
                  lineHeight: '16px',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {totalNotif > 99 ? '99+' : totalNotif}
              </span>
            )}
          </button>

          {notifOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: 280,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
                padding: 6,
                zIndex: 20,
              }}
            >
              <div
                style={{
                  padding: '6px 8px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--foreground-muted)',
                }}
              >
                할 일
              </div>

              {notif && totalNotif === 0 ? (
                <div
                  style={{
                    padding: '12px 8px',
                    fontSize: 13,
                    color: 'var(--foreground-subtle)',
                    textAlign: 'center',
                  }}
                >
                  처리할 항목이 없습니다
                </div>
              ) : (
                (notif?.items ?? []).map((it) => {
                  const has = it.count > 0;
                  return (
                    <Link
                      key={it.key}
                      href={it.href}
                      role="menuitem"
                      onClick={() => setNotifOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '8px 8px',
                        borderRadius: 6,
                        fontSize: 13,
                        textDecoration: 'none',
                        color: has
                          ? 'var(--foreground)'
                          : 'var(--foreground-subtle)',
                        fontWeight: has ? 500 : 400,
                      }}
                    >
                      <span>{it.label}</span>
                      <span
                        style={{
                          minWidth: 20,
                          height: 18,
                          padding: '0 6px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 600,
                          lineHeight: '18px',
                          textAlign: 'center',
                          background: has
                            ? 'var(--primary-soft)'
                            : 'var(--neutral-soft)',
                          color: has
                            ? 'var(--primary-soft-fg)'
                            : 'var(--foreground-muted)',
                        }}
                      >
                        {it.count}
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          )}
        </div>

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
