'use client';

/* ══════════════════════════════════════════
   PreviewHeightSync — iframe height 자동 fit (S148 PR-2 advisory §6.1 D-1)

   책임:
   - /preview/* 가 어드민 폼 iframe 안에 임베드됐을 때만 동작.
   - document.body height 를 ResizeObserver 로 측정 → parent (어드민) 에 postMessage 송신.
   - 어드민 SettingsForm 가 message 수신 → iframe height style 동기.

   메시지 형식:
     { type: 'gtr:preview:height', height: number }

   보안:
   - postMessage targetOrigin 은 window.location.origin (같은 origin 만).
   - 어드민 측 수신 핸들러도 e.origin === window.location.origin 검사.
   - frame-ancestors 'self' (proxy.ts) 가 외부 origin 임베드 차단 → 같은 origin 만 메시지 송수신.
   ══════════════════════════════════════════ */

import { useEffect } from 'react';

export default function PreviewHeightSync() {
  useEffect(() => {
    /* iframe 안이 아니면 (직접 방문) noop */
    if (window.parent === window) return;

    const send = () => {
      const h = document.body.scrollHeight;
      window.parent.postMessage(
        { type: 'gtr:preview:height', height: h },
        window.location.origin,
      );
    };

    /* 초기 1회 + 이후 ResizeObserver */
    send();
    const ro = new ResizeObserver(send);
    ro.observe(document.body);

    /* 이미지 로드 등 비동기 변경 대비 — load 이벤트도 1회 send */
    window.addEventListener('load', send);
    return () => {
      ro.disconnect();
      window.removeEventListener('load', send);
    };
  }, []);

  return null;
}
