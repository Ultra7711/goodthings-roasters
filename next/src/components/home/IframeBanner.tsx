'use client';

/* ══════════════════════════════════════════════════════════════════════════
   IframeBanner — viewport 변경 시 iframe srcDoc 미디어쿼리 재평가 보정

   배경:
   - cafe-events / signature chapter 는 운영자 HTML 을 `<iframe sandbox srcDoc>`
     로 임베드.
   - iframe document 는 별도 viewport 라 부모 viewport 변경 (chrome DevTools
     device emulation 등) 시 내부 `@media` 평가가 지연되는 quirk 존재.
   - 실 device 는 viewport 변경 자체가 없어서 영향 없음.
   - **admin /preview/signature · /admin/cafe-events 의 4 brk 토글 운영자 UX**
     관점에서 신뢰도 확보가 목적.

   방식:
   - 부모 width 를 ResizeObserver 로 추적.
   - brk 인덱스 (0=mobile / 1=tablet / 2=desktop) 가 변경될 때만 setBrk.
   - iframe key={brk} → brk 변경 시 iframe remount → srcDoc 재해석 → 새 viewport
     기준 미디어쿼리 평가.
   - 동일 brk 안에서의 연속 resize 는 무시 → 깜빡임 최소화.

   사용처:
   - EventBanner.tsx (cafe-events)
   - SignatureChapterView.tsx (signature chapter)
   ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState, type CSSProperties } from 'react';

type BrkIndex = 0 | 1 | 2;

function getBrk(w: number): BrkIndex {
  if (w >= 1024) return 2;
  if (w >= 768) return 1;
  return 0;
}

export interface IframeBannerProps {
  srcDoc: string;
  title: string;
  className?: string;
  /** EventBanner 가 brk CSS 셀렉터에 사용 (`[data-event-id="..."]`). */
  'data-event-id'?: string;
  /** iframe 자체 style override 필요 시. 기본값으로 충분한 경우 생략. */
  iframeStyle?: CSSProperties;
}

export default function IframeBanner({
  srcDoc,
  title,
  className,
  iframeStyle,
  ...rest
}: IframeBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  /* SSR 기본값 = desktop. mount 후 ResizeObserver 가 실측 → 다른 brk 면 remount. */
  const [brk, setBrk] = useState<BrkIndex>(2);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const next = getBrk(el.clientWidth);
      setBrk((prev) => (prev === next ? prev : next));
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const defaultIframeStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    height: 'auto',
    border: 0,
    background: 'transparent',
    ...iframeStyle,
  };

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <iframe
        key={brk}
        srcDoc={srcDoc}
        title={title}
        className={className}
        sandbox="allow-same-origin"
        loading="lazy"
        referrerPolicy="no-referrer"
        style={defaultIframeStyle}
        {...rest}
      />
    </div>
  );
}
