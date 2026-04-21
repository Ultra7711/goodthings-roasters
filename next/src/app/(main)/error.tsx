'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[MainError]', error);
  }, [error]);

  return (
    <div className="error-page">
      <p className="error-page-msg">페이지를 불러오는 중 오류가 발생했습니다.</p>
      <div className="error-page-actions">
        <button type="button" className="error-page-retry" onClick={reset}>
          다시 시도
        </button>
        <Link href="/" className="error-page-home">홈으로</Link>
      </div>
    </div>
  );
}
