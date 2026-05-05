/* ══════════════════════════════════════════════════════════════════════════
   useAccountDeletion — TanStack Query Withdrawal Flow adapter (S161 PR-1)

   ADR-004 + UBIQUITOUS_LANGUAGE.md "Withdrawal Flow" Module.

   Result kind 반환 패턴 (useCart 와 다름):
   - caller (AccountManagement) 가 redirect 책임
   - 409 / 429 / network / success 분기를 caller 가 받아서 처리
   - hook 은 pure adapter

   Network error 만 throw → mutateAsync 호출자 try-catch 에서 처리.
   200/409/429 = result.kind 반환.
   ══════════════════════════════════════════════════════════════════════════ */

'use client';

import { useMutation } from '@tanstack/react-query';

export type AccountDeletionResult =
  | { kind: 'success' }
  | { kind: 'subscription_active' }
  | { kind: 'rate_limited' }
  | { kind: 'error' };

async function postAccountDelete(): Promise<AccountDeletionResult> {
  const res = await fetch('/api/account/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: '탈퇴' }),
  });

  if (res.status === 409) {
    const json = (await res.json().catch(() => null)) as
      | { detail?: string }
      | null;
    if (json?.detail === 'subscription_active') return { kind: 'subscription_active' };
    return { kind: 'error' };
  }

  if (res.status === 429) return { kind: 'rate_limited' };

  if (!res.ok) return { kind: 'error' };

  return { kind: 'success' };
}

export function useDeleteAccount() {
  return useMutation<AccountDeletionResult, Error, void>({
    mutationFn: postAccountDelete,
  });
}
