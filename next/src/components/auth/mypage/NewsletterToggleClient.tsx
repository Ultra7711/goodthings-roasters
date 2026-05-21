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
import { getNewsletterStatus, setNewsletterSubscription } from '@/lib/newsletter';

type LoadState = 'loading' | 'loaded' | 'hidden';

export default function NewsletterToggleClient() {
  const { show: toast } = useToast();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [enabled, setEnabled] = useState(false);
  const [isPending, startTransition] = useTransition();

  /* 마운트 시 현재 status 조회. RLS owner_select 통과 (authenticated · user_id 매치). */
  useEffect(() => {
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
  }, []);

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
