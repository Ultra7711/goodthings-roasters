/* ══════════════════════════════════════════
   /unsubscribe — newsletter 구독 취소 (S241 D-25 · Phase 1)

   - 발송 메일 footer 의 /unsubscribe?token=<uuid> 진입 처리.
   - server component — RPC unsubscribe_by_token (SECURITY DEFINER · 토큰 매치 +
     active 일 때만 UPDATE) 즉시 호출.
   - 결과 UI: 처리 완료 / 이미 취소됨 / 토큰 오류.
   - 메인 (main) route group 의 SiteHeader/Footer 사용.
   ══════════════════════════════════════════ */

import type { Metadata } from 'next';
import { unsubscribeByToken } from '@/lib/newsletter';

export const metadata: Metadata = {
  title: '뉴스레터 구독 취소 · 굳띵즈',
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="unsubscribe-page">
        <div className="unsubscribe-inner">
          <h1 className="unsubscribe-h">잘못된 접근입니다</h1>
          <p className="unsubscribe-body">
            구독 취소 링크가 올바르지 않습니다. 발송 메일의 링크를 다시 확인해 주세요.
          </p>
        </div>
      </main>
    );
  }

  const result = await unsubscribeByToken(token);

  if (!result.ok) {
    return (
      <main className="unsubscribe-page">
        <div className="unsubscribe-inner">
          <h1 className="unsubscribe-h">처리 실패</h1>
          <p className="unsubscribe-body">
            {result.error === 'invalid_token'
              ? '잘못된 링크입니다. 발송 메일의 링크를 다시 확인해 주세요.'
              : '일시적 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'}
          </p>
        </div>
      </main>
    );
  }

  if (result.updated) {
    return (
      <main className="unsubscribe-page">
        <div className="unsubscribe-inner">
          <h1 className="unsubscribe-h">구독이 취소되었습니다</h1>
          <p className="unsubscribe-body">
            앞으로 뉴스레터를 받지 않으십니다. 굳띵즈를 다시 만나고 싶으실 때 언제든
            메인 페이지 하단에서 다시 구독하실 수 있습니다.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="unsubscribe-page">
      <div className="unsubscribe-inner">
        <h1 className="unsubscribe-h">이미 구독 취소되었습니다</h1>
        <p className="unsubscribe-body">
          해당 이메일은 이미 구독이 취소된 상태이거나 만료된 링크입니다.
        </p>
      </div>
    </main>
  );
}
