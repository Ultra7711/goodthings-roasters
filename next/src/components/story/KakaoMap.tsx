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
        Size: new (w: number, h: number) => unknown;
        Point: new (x: number, y: number) => unknown;
        MarkerImage: new (
          src: string,
          size: unknown,
          options?: { offset?: unknown },
        ) => unknown;
        Map: new (container: HTMLElement, opts: { center: unknown; level: number }) => {
          addControl: (control: unknown, position: unknown) => void;
          relayout: () => void;
          setCenter: (latlng: unknown) => void;
        };
        Marker: new (opts: { position: unknown; map?: unknown; image?: unknown }) => {
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
        ZoomControl: new () => unknown;
        ControlPosition: {
          TOPLEFT: unknown;
          TOP: unknown;
          TOPRIGHT: unknown;
          LEFT: unknown;
          RIGHT: unknown;
          BOTTOMLEFT: unknown;
          BOTTOM: unknown;
          BOTTOMRIGHT: unknown;
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

/* 말풍선 HTML 생성 — 길찾기·카카오맵 상세 두 버튼. 링크는 새 탭.
   닫기: 마커 재클릭 또는 지도 빈 영역 클릭. */
function buildOverlayContent({
  placeName,
  placeId,
  lat,
  lng,
}: {
  placeName: string;
  placeId?: string;
  lat: number;
  lng: number;
}): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'st-map-overlay';

  const detailHref = placeId
    ? `https://place.map.kakao.com/${placeId}`
    : `https://map.kakao.com/link/map/${encodeURIComponent(placeName)},${lat},${lng}`;
  const toHref = `https://map.kakao.com/link/to/${encodeURIComponent(placeName)},${lat},${lng}`;

  wrap.innerHTML = `
    <div class="st-map-overlay-name">${placeName}</div>
    <div class="st-map-overlay-actions">
      <a class="st-map-overlay-btn" href="${toHref}" target="_blank" rel="noopener noreferrer">길찾기</a>
      <a class="st-map-overlay-btn st-map-overlay-btn--primary" href="${detailHref}" target="_blank" rel="noopener noreferrer">카카오맵 상세</a>
    </div>
  `;

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
    let ro: ResizeObserver | null = null;

    loadSdk(appkey)
      .then(() => {
        if (cancelled) return;
        window.kakao.maps.load(() => {
          if (cancelled || !containerRef.current) return;
          const kakao = window.kakao.maps;
          const center = new kakao.LatLng(lat, lng);
          const map = new kakao.Map(containerRef.current, { center, level });
          /* 확대/축소 게이지 컨트롤 — 우상단 */
          map.addControl(new kakao.ZoomControl(), kakao.ControlPosition.TOPRIGHT);
          /* 컨테이너 리사이즈 시 relayout + 중심 재설정 (BP 전환·회전 대응) */
          ro = new ResizeObserver(() => {
            map.relayout();
            map.setCenter(center);
          });
          ro.observe(containerRef.current);
          /* 브랜드 커스텀 마커 — 28×36 티어드롭, 바닥 중앙 앵커 */
          const markerImage = new kakao.MarkerImage(
            '/images/icons/map_marker.svg',
            new kakao.Size(28, 36),
            { offset: new kakao.Point(14, 36) },
          );
          const marker = new kakao.Marker({ position: center, map, image: markerImage });

          const overlay = new kakao.CustomOverlay({
            position: center,
            content: buildOverlayContent({ placeName, placeId, lat, lng }),
            yAnchor: 1.35,
          });

          kakao.event.addListener(marker, 'click', () => {
            if (overlay.getMap()) overlay.setMap(null);
            else overlay.setMap(map);
          });
          /* 지도 빈 영역 클릭 → 말풍선 닫기 */
          kakao.event.addListener(map, 'click', () => {
            if (overlay.getMap()) overlay.setMap(null);
          });
        });
      })
      .catch((err) => console.warn('[KakaoMap]', err));

    return () => {
      cancelled = true;
      ro?.disconnect();
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
