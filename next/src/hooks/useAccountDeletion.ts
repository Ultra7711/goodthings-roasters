/* ══════════════════════════════════════════════════════════════════════════
   useAccountDeletion — TanStack Query Withdrawal Flow adapter (S161 PR-1)

   ADR-004 + UBIQUITOUS_LANGUAGE.md "Withdrawal Flow" Module.

   Result kind 반환 패턴 (useCart 와 다름):
   - caller (AccountManagement) 가 redirect 책임
   - 409 / 429 / network / success 분기를 caller 가 받아서 처리
   - hook 은 pure adapter

   Network error 만 throw → mutateAsync 호출자 try-catch 에서 처리.
   200/429 = result.kind 반환.

   탈퇴정책 변경(S336): 활성 구독 차단(409 subscription_active) 폐기 — 서버가 더 이상
   409 를 반환하지 않으므로 해당 분기 제거. 만일의 409 는 일반 error 로 처리(아래 !res.ok).
   구독 일괄취소 동의는 호출처(AccountDeleteSection)의 2차 확인 모달이 책임진다.
   ══════════════════════════════════════════════════════════════════════════ */

'use client';

import { useMutation } from '@tanstack/react-query';

export type AccountDeletionResult =
  | { kind: 'success' }
  | { kind: 'rate_limited' }
  | { kind: 'error' };

export async function postAccountDelete(): Promise<AccountDeletionResult> {
  const res = await fetch('/api/account/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: '탈퇴' }),
  });

  if (res.status === 429) return { kind: 'rate_limited' };

  if (!res.ok) return { kind: 'error' };

  return { kind: 'success' };
}

export function useDeleteAccount() {
  return useMutation<AccountDeletionResult, Error, void>({
    mutationFn: postAccountDelete,
  });
}
