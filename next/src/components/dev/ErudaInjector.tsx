'use client';

import { useEffect, useState } from 'react';

/* S289 진단 자산 — iOS Safari 26 PDP/cart rubber-band white 측정용.

   URL 쿼리 가드: ?eruda=1 가 있을 때만 동작.
   쿼리 없으면 0 작동 → production 일반 사용자 노출 없음.

   사용:
     모바일 실기기에서 https://<deploy-url>/<path>?eruda=1 접속
     → 화면 우하단 색상 박스 표시 (mount 상태 시각 확인)
        - 노랑 LOADING = CDN script 로딩 중
        - 초록 READY = eruda init 성공, 박스 터치 = Console 패널 강제 열기
        - 빨강 FAILED = CDN 차단 또는 init 실패
     → READY 후 박스 터치 → Console 탭 자동 열림

   참조: lesson_pdp_overscroll_thrash.md L1 (실측 자산 의무)
*/
type ErudaWindow = Window & {
  eruda?: {
    init: () => void;
    show: (tab?: string) => void;
  };
};

type Status = 'idle' | 'loading' | 'ready' | 'failed';

const COLORS: Record<Exclude<Status, 'idle'>, string> = {
  loading: '#fbbf24',
  ready: '#10b981',
  failed: '#ef4444',
};

export default function ErudaInjector() {
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('eruda') !== '1') return;
    setStatus('loading');
    const w = window as ErudaWindow;
    if (w.eruda) {
      try {
        w.eruda.init();
        setStatus('ready');
      } catch {
        setStatus('failed');
      }
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/eruda';
    script.async = true;
    script.onload = () => {
      const ready = window as ErudaWindow;
      try {
        ready.eruda?.init();
        setStatus('ready');
      } catch {
        setStatus('failed');
      }
    };
    script.onerror = () => setStatus('failed');
    document.head.appendChild(script);
  }, []);

  if (status === 'idle') return null;

  return (
    <button
      type="button"
      onClick={() => {
        const w = window as ErudaWindow;
        try {
          w.eruda?.init();
          w.eruda?.show('console');
          setStatus('ready');
        } catch {
          setStatus('failed');
        }
      }}
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 2147483647,
        padding: '12px 16px',
        background: COLORS[status],
        color: '#ffffff',
        border: 'none',
        borderRadius: '24px',
        fontSize: '14px',
        fontWeight: 600,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        cursor: 'pointer',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      ERUDA {status.toUpperCase()}
    </button>
  );
}
