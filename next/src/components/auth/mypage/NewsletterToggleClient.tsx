/* ══════════════════════════════════════════
   NewsletterToggleClient — 마이페이지 newsletter 수신 동의 토글 (S241 Phase 2)

   책임:
   - 마운트 시 getNewsletterStatus 호출 → 현재 status 표시
   - 토글 클릭 → setNewsletterSubscription · optimistic UI + 실패 시 rollback
   - 위치: AccountInfoRow 의 이메일 row 직속 아래 row

   디자인:
   - mp-info-row 패턴 답습 (label + value)
   - value 영역에 Radix Switch + 상태 텍스트 ("켜짐"/"꺼짐")
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';
import { useToast } from '@/hooks/useToast';
import {
  getNewsletterStatus,
  setNewsletterSubscription,
  type NewsletterStatusResult,
} from '@/lib/newsletter';

type LoadState = 'loading' | 'loaded' | 'hidden';

type Props = {
  /* S283: SSR prefetch 결과 (mypage page.tsx Promise.all). 제공 시 client fetch 폐기 →
     view 전환마다 "불러오는 중…" 노출 사라짐. fallback (undefined) 은 기존 mount fetch. */
  initialStatus?: NewsletterStatusResult;
};

/* SSR initialStatus → (loadState, enabled) 초기값 도출.
   undefined → loading (client fetch fallback).
   ok=true → loaded + enabled = (status === 'active').
   ok=false → hidden (unauthenticated/db_error). */
function deriveInitialState(
  initial: NewsletterStatusResult | undefined,
): { loadState: LoadState; enabled: boolean } {
  if (!initial) return { loadState: 'loading', enabled: false };
  if (initial.ok) return { loadState: 'loaded', enabled: initial.status === 'active' };
  return { loadState: 'hidden', enabled: false };
}

export default function NewsletterToggleClient({ initialStatus }: Props = {}) {
  const { show: toast } = useToast();
  const initial = deriveInitialState(initialStatus);
  const [loadState, setLoadState] = useState<LoadState>(initial.loadState);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [isPending, startTransition] = useTransition();

  /* SSR prefetch 미제공(initialStatus === undefined) 시에만 client fetch fallback.
     RLS owner_select 통과 (authenticated · user_id 매치). */
  useEffect(() => {
    if (initialStatus) return;
    let cancelled = false;
    getNewsletterStatus().then((res) => {
      if (cancelled) return;
      if (res.ok) {
        /* active → 켜짐 / unsubscribed | none → 꺼짐 */
        setEnabled(res.status === 'active');
        setLoadState('loaded');
      } else {
        /* unauthenticated 또는 db_error — 토글 row 자체 숨김 (graceful) */
        console.error('[newsletter.toggle] status fetch failed', res.error);
        setLoadState('hidden');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [initialStatus]);

  const isLoading = loadState === 'loading';

  const handleToggle = useCallback(
    (next: boolean) => {
      if (isLoading) return;
      /* Optimistic update */
      setEnabled(next);
      startTransition(async () => {
        const res = await setNewsletterSubscription(next);
        if (!res.ok) {
          /* Rollback */
          setEnabled(!next);
          toast(
            next
              ? '수신 동의 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.'
              : '수신 거부 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.',
          );
          return;
        }
        toast(next ? '뉴스레터 수신 동의됨' : '뉴스레터 수신 거부됨');
      });
    },
    [isLoading, toast],
  );

  /* fetch 실패 (unauthenticated · db_error) 시에만 row 숨김. loading 중에는 placeholder 텍스트
     로 row 자리를 차지해 다른 row 들과 함께 즉시 렌더 → fetch 완료 후 뒤늦게 끼어드는 layout
     shift 차단. */
  if (loadState === 'hidden') return null;

  return (
    <div className="mp-info-row">
      <span className="mp-info-label">뉴스레터 수신</span>
      <span className="mp-info-value mp-newsletter-toggle">
        <span
          className="mp-newsletter-status"
          /* OFF / 로딩 상태 = AddressSection 빈 상태와 동일 회색. */
          style={isLoading || !enabled ? { color: '#9C9890' } : undefined}
        >
          {isLoading
            ? '불러오는 중…'
            : enabled
              ? '뉴스레터를 수신합니다.'
              : '뉴스레터를 수신하지 않습니다.'}
        </span>
        <SwitchPrimitive.Root
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={isLoading || isPending}
          className="mp-switch"
          aria-label="뉴스레터 수신 동의"
        >
          <SwitchPrimitive.Thumb className="mp-switch-thumb" />
        </SwitchPrimitive.Root>
      </span>
    </div>
  );
}
