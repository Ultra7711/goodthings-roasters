/* ══════════════════════════════════════════════════════════════════════════
   useSubscriptions — TanStack Query Subscription Editor adapter (S161 PR-1)

   ADR-004 + UBIQUITOUS_LANGUAGE.md "Subscription Editor" Module 의 데이터 seam.
   useCart 패턴 그대로 차용 (S161 Q4 옵션 3).

   Adapter strategy:
   - Production = fetch `/api/subscriptions/*`
   - Test = vitest in-memory (queryClient.setQueryData 직접 주입)
   - Two adapters = real seam.

   Optimistic update:
   - cycle update: cycle 값만 즉시 반영. nextDate 는 onSuccess 의 server response 적용.
   - cancel: list 에서 즉시 제거.
   - skip/pause/resume: server response 적용 (computation 서버 권위).
   ══════════════════════════════════════════════════════════════════════════ */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Subscription, SubscriptionCycle } from '@/types/subscription';
import { showToast } from '@/lib/toastStore';

type ApiEnvelope<T> = { data?: T; error?: { code?: string } };

export const SUBSCRIPTIONS_QUERY_KEY = ['subscriptions'] as const;

/* ══════════════════════════════════════════
   Query
   ══════════════════════════════════════════ */

export async function fetchSubscriptions(): Promise<Subscription[]> {
  const res = await fetch('/api/subscriptions', { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`subscriptions_fetch_${res.status}`);
  const body = (await res.json()) as ApiEnvelope<Subscription[]>;
  return body.data ?? [];
}

export function useSubscriptionsQuery(initialData?: Subscription[]) {
  const query = useQuery({
    queryKey: SUBSCRIPTIONS_QUERY_KEY,
    queryFn: fetchSubscriptions,
    staleTime: 30_000,
    initialData,
  });
  return {
    subscriptions: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

/* ══════════════════════════════════════════
   Mutations — common context
   ══════════════════════════════════════════ */

type CtxSnapshot = { previous: Subscription[] | undefined };

function snapshotAndCancel(
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<CtxSnapshot> {
  return queryClient
    .cancelQueries({ queryKey: SUBSCRIPTIONS_QUERY_KEY })
    .then(() => ({
      previous: queryClient.getQueryData<Subscription[]>(SUBSCRIPTIONS_QUERY_KEY),
    }));
}

function rollbackOnError(
  queryClient: ReturnType<typeof useQueryClient>,
  context: CtxSnapshot | undefined,
) {
  if (context?.previous !== undefined) {
    queryClient.setQueryData(SUBSCRIPTIONS_QUERY_KEY, context.previous);
  }
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient
    .invalidateQueries({ queryKey: SUBSCRIPTIONS_QUERY_KEY })
    .catch((err) => {
      if (process.env.NODE_ENV === 'development') console.error('[useSubscriptions] invalidate failed', err);
    });
}

function applyServerUpdate(
  queryClient: ReturnType<typeof useQueryClient>,
  updated: Subscription,
) {
  queryClient.setQueryData<Subscription[]>(SUBSCRIPTIONS_QUERY_KEY, (prev) =>
    prev?.map((s) => (s.id === updated.id ? updated : s)),
  );
}

/* ══════════════════════════════════════════
   PATCH /api/subscriptions/:id — cycle 변경
   Invariant: paused 상태에서 cycle 변경 시 caller 가 "재개 후 적용" 안내 책임.
   ══════════════════════════════════════════ */

export function useUpdateSubscriptionCycle() {
  const queryClient = useQueryClient();

  return useMutation<
    Subscription,
    Error,
    { id: string; cycle: SubscriptionCycle },
    CtxSnapshot
  >({
    mutationFn: async ({ id, cycle }) => {
      const res = await fetch(`/api/subscriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ cycle }),
      });
      if (!res.ok) throw new Error(`http_${res.status}`);
      const body = (await res.json()) as ApiEnvelope<Subscription>;
      if (!body.data) throw new Error('no_data');
      return body.data;
    },
    onMutate: async ({ id, cycle }) => {
      const ctx = await snapshotAndCancel(queryClient);
      queryClient.setQueryData<Subscription[]>(SUBSCRIPTIONS_QUERY_KEY, (prev) =>
        prev?.map((s) => (s.id === id ? { ...s, cycle } : s)),
      );
      return ctx;
    },
    onSuccess: (updated) => {
      applyServerUpdate(queryClient, updated);
    },
    onError: (err, _vars, context) => {
      if (process.env.NODE_ENV === 'development') console.error('[useUpdateSubscriptionCycle] failed', err);
      showToast('주기 변경에 실패했습니다. 다시 시도해 주세요.');
      rollbackOnError(queryClient, context);
    },
    onSettled: () => invalidate(queryClient),
  });
}

/* ══════════════════════════════════════════
   DELETE /api/subscriptions/:id — soft cancel
   Optimistic: list 에서 즉시 제거.
   ══════════════════════════════════════════ */

export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string, CtxSnapshot>({
    mutationFn: async (id) => {
      const res = await fetch(`/api/subscriptions/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(`http_${res.status}`);
    },
    onMutate: async (id) => {
      const ctx = await snapshotAndCancel(queryClient);
      queryClient.setQueryData<Subscription[]>(SUBSCRIPTIONS_QUERY_KEY, (prev) =>
        prev?.filter((s) => s.id !== id),
      );
      return ctx;
    },
    onError: (err, _id, context) => {
      if (process.env.NODE_ENV === 'development') console.error('[useCancelSubscription] failed', err);
      showToast('해지에 실패했습니다. 다시 시도해 주세요.');
      rollbackOnError(queryClient, context);
    },
    onSettled: () => invalidate(queryClient),
  });
}

/* ══════════════════════════════════════════
   POST /api/subscriptions/:id/skip — 1 회 배송 건너뛰기
   nextDate 계산은 서버 권위 — optimistic 미적용.
   ══════════════════════════════════════════ */

export function useSkipSubscription() {
  const queryClient = useQueryClient();

  return useMutation<Subscription, Error, string, CtxSnapshot>({
    mutationFn: async (id) => {
      const res = await fetch(`/api/subscriptions/${id}/skip`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(`http_${res.status}`);
      const body = (await res.json()) as ApiEnvelope<Subscription>;
      if (!body.data) throw new Error('no_data');
      return body.data;
    },
    onMutate: async () => snapshotAndCancel(queryClient),
    onSuccess: (updated) => applyServerUpdate(queryClient, updated),
    onError: (err, _id, context) => {
      if (process.env.NODE_ENV === 'development') console.error('[useSkipSubscription] failed', err);
      showToast('건너뛰기에 실패했습니다. 다시 시도해 주세요.');
      rollbackOnError(queryClient, context);
    },
    onSettled: () => invalidate(queryClient),
  });
}

/* ══════════════════════════════════════════
   POST /api/subscriptions/:id/pause — 일시정지
   Optimistic: status='paused'.
   ══════════════════════════════════════════ */

export function usePauseSubscription() {
  const queryClient = useQueryClient();

  return useMutation<Subscription, Error, string, CtxSnapshot>({
    mutationFn: async (id) => {
      const res = await fetch(`/api/subscriptions/${id}/pause`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(`http_${res.status}`);
      const body = (await res.json()) as ApiEnvelope<Subscription>;
      if (!body.data) throw new Error('no_data');
      return body.data;
    },
    onMutate: async (id) => {
      const ctx = await snapshotAndCancel(queryClient);
      queryClient.setQueryData<Subscription[]>(SUBSCRIPTIONS_QUERY_KEY, (prev) =>
        prev?.map((s) => (s.id === id ? { ...s, status: 'paused' } : s)),
      );
      return ctx;
    },
    onSuccess: (updated) => applyServerUpdate(queryClient, updated),
    onError: (err, _id, context) => {
      if (process.env.NODE_ENV === 'development') console.error('[usePauseSubscription] failed', err);
      showToast('일시정지에 실패했습니다. 다시 시도해 주세요.');
      rollbackOnError(queryClient, context);
    },
    onSettled: () => invalidate(queryClient),
  });
}

/* ══════════════════════════════════════════
   POST /api/subscriptions/:id/resume — 재개
   Optimistic: status='active'.
   ══════════════════════════════════════════ */

export function useResumeSubscription() {
  const queryClient = useQueryClient();

  return useMutation<Subscription, Error, string, CtxSnapshot>({
    mutationFn: async (id) => {
      const res = await fetch(`/api/subscriptions/${id}/resume`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(`http_${res.status}`);
      const body = (await res.json()) as ApiEnvelope<Subscription>;
      if (!body.data) throw new Error('no_data');
      return body.data;
    },
    onMutate: async (id) => {
      const ctx = await snapshotAndCancel(queryClient);
      queryClient.setQueryData<Subscription[]>(SUBSCRIPTIONS_QUERY_KEY, (prev) =>
        prev?.map((s) => (s.id === id ? { ...s, status: 'active' } : s)),
      );
      return ctx;
    },
    onSuccess: (updated) => applyServerUpdate(queryClient, updated),
    onError: (err, _id, context) => {
      if (process.env.NODE_ENV === 'development') console.error('[useResumeSubscription] failed', err);
      showToast('재개에 실패했습니다. 다시 시도해 주세요.');
      rollbackOnError(queryClient, context);
    },
    onSettled: () => invalidate(queryClient),
  });
}
