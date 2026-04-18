'use client';

/* ══════════════════════════════════════════
   KakaoMap — Kakao Maps JavaScript SDK 임베드
   - `NEXT_PUBLIC_KAKAO_MAP_JS_KEY` 필수 (developers.kakao.com 앱의 JavaScript 키).
     OAuth 의 REST API 키와 다른 키이므로 혼동 주의.
   - 플랫폼 > Web 에 배포 도메인 등록 필수 (localhost 포함).
   - SDK 는 autoload=false 로 로드 후 `kakao.maps.load` 로 초기화 — Next.js SSR 안전.
   - 마커 클릭 시 CustomOverlay 말풍선 토글 → 카카오맵 상세·길찾기 링크 제공.
   ══════════════════════════════════════════ */

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    kakao: {
      maps: {
        load: (cb: () => void) => void;
        LatLng: new (lat: number, lng: number) => unknown;
        Map: new (container: HTMLElement, opts: { center: unknown; level: number }) => unknown;
        Marker: new (opts: { position: unknown; map?: unknown }) => {
          setMap: (map: unknown) => void;
        };
        CustomOverlay: new (opts: {
          position: unknown;
          content: HTMLElement | string;
          yAnchor?: number;
          xAnchor?: number;
        }) => {
          setMap: (map: unknown) => void;
          getMap: () => unknown;
        };
        event: {
          addListener: (target: unknown, type: string, handler: () => void) => void;
        };
      };
    };
  }
}

const SDK_SRC_BASE = '//dapi.kakao.com/v2/maps/sdk.js';

function loadSdk(appkey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.kakao?.maps) return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>(
    'script[data-kakao-maps-sdk]',
  );
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('kakao sdk load failed')));
    });
  }

  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https:${SDK_SRC_BASE}?appkey=${appkey}&autoload=false`;
    s.async = true;
    s.dataset.kakaoMapsSdk = 'true';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('kakao sdk load failed'));
    document.head.appendChild(s);
  });
}

type Props = {
  lat: number;
  lng: number;
  level?: number;
  title?: string;
  placeName?: string;
  placeId?: string;
};

/* 말풍선 HTML 생성 — 상세·길찾기 두 버튼. 링크는 새 탭. */
function buildOverlayContent({
  placeName,
  placeId,
  lat,
  lng,
  onClose,
}: {
  placeName: string;
  placeId?: string;
  lat: number;
  lng: number;
  onClose: () => void;
}): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'st-map-overlay';

  const detailHref = placeId
    ? `https://place.map.kakao.com/${placeId}`
    : `https://map.kakao.com/link/map/${encodeURIComponent(placeName)},${lat},${lng}`;
  const toHref = `https://map.kakao.com/link/to/${encodeURIComponent(placeName)},${lat},${lng}`;

  wrap.innerHTML = `
    <button type="button" class="st-map-overlay-close" aria-label="닫기">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 3l8 8M11 3l-8 8"/></svg>
    </button>
    <div class="st-map-overlay-name">${placeName}</div>
    <div class="st-map-overlay-actions">
      <a class="st-map-overlay-btn" href="${detailHref}" target="_blank" rel="noopener noreferrer">카카오맵 상세</a>
      <a class="st-map-overlay-btn st-map-overlay-btn--primary" href="${toHref}" target="_blank" rel="noopener noreferrer">길찾기</a>
    </div>
  `;

  const closeBtn = wrap.querySelector<HTMLButtonElement>('.st-map-overlay-close');
  closeBtn?.addEventListener('click', onClose);

  return wrap;
}

export default function KakaoMap({
  lat,
  lng,
  level = 3,
  title,
  placeName = 'Good Things Roasters',
  placeId,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const appkey = process.env.NEXT_PUBLIC_KAKAO_MAP_JS_KEY;
    if (!appkey) {
      console.warn('[KakaoMap] NEXT_PUBLIC_KAKAO_MAP_JS_KEY not set');
      return;
    }
    let cancelled = false;

    loadSdk(appkey)
      .then(() => {
        if (cancelled) return;
        window.kakao.maps.load(() => {
          if (cancelled || !containerRef.current) return;
          const kakao = window.kakao.maps;
          const center = new kakao.LatLng(lat, lng);
          const map = new kakao.Map(containerRef.current, { center, level });
          const marker = new kakao.Marker({ position: center, map });

          const overlay = new kakao.CustomOverlay({
            position: center,
            content: buildOverlayContent({
              placeName,
              placeId,
              lat,
              lng,
              onClose: () => overlay.setMap(null),
            }),
            yAnchor: 1.35,
          });

          kakao.event.addListener(marker, 'click', () => {
            if (overlay.getMap()) overlay.setMap(null);
            else overlay.setMap(map);
          });
        });
      })
      .catch((err) => console.warn('[KakaoMap]', err));

    return () => {
      cancelled = true;
    };
  }, [lat, lng, level, placeName, placeId]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={title ?? 'Kakao Map'}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
