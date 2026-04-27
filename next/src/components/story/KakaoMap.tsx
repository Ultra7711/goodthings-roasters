'use client';

/* ══════════════════════════════════════════
   KakaoMap — Kakao Maps JavaScript SDK 임베드
   - `NEXT_PUBLIC_KAKAO_MAP_JS_KEY` 필수 (developers.kakao.com 앱의 JavaScript 키).
     OAuth 의 REST API 키와 다른 키이므로 혼동 주의.
   - 플랫폼 > Web 에 배포 도메인 등록 필수 (localhost 포함).
   - SDK 는 autoload=false 로 로드 후 `kakao.maps.load` 로 초기화 — Next.js SSR 안전.
   - 마커 클릭 시 CustomOverlay 말풍선 토글 → 상세보기·길찾기 링크 제공.
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
          panTo: (latlng: unknown) => void;
          getProjection: () => {
            containerPointFromCoords: (coords: unknown) => { x: number; y: number };
            coordsFromContainerPoint: (point: unknown) => unknown;
          };
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
    if (window.kakao?.maps) return Promise.resolve();
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('kakao sdk load failed')), { once: true });
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

/* 말풍선 HTML 생성 — 길찾기·상세보기 두 버튼. 링크는 새 탭.
   닫기: 마커 재클릭 또는 지도 빈 영역 클릭.
   onInteract: overlay 내부 mousedown 시 호출 — map click 핸들러가 플래그를 읽어
   overlay 내부 클릭(링크 포함)을 외부 클릭과 구별한다. */
function buildOverlayContent({
  placeName,
  placeId,
  lat,
  lng,
  onInteract,
}: {
  placeName: string;
  placeId?: string;
  lat: number;
  lng: number;
  onInteract: () => void;
}): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'st-map-overlay';
  wrap.addEventListener('mousedown', (e) => { e.stopPropagation(); onInteract(); });
  wrap.addEventListener('click', (e) => e.stopPropagation());

  const detailHref = placeId
    ? `https://place.map.kakao.com/${placeId}`
    : `https://map.kakao.com/link/map/${encodeURIComponent(placeName)},${lat},${lng}`;
  const toHref = `https://map.kakao.com/link/to/${encodeURIComponent(placeName)},${lat},${lng}`;

  // textContent / setAttribute 만 사용 — placeName 이 외부 입력으로 확장돼도 XSS 차단.
  const nameEl = document.createElement('div');
  nameEl.className = 'st-map-overlay-name';
  nameEl.textContent = placeName;

  const actionsEl = document.createElement('div');
  actionsEl.className = 'st-map-overlay-actions';

  const toLink = document.createElement('a');
  toLink.className = 'st-map-overlay-btn';
  toLink.href = toHref;
  toLink.target = '_blank';
  toLink.rel = 'noopener noreferrer';
  toLink.textContent = '길찾기';
  toLink.addEventListener('click', (e) => e.stopPropagation());

  const detailLink = document.createElement('a');
  detailLink.className = 'st-map-overlay-btn st-map-overlay-btn--primary';
  detailLink.href = detailHref;
  detailLink.target = '_blank';
  detailLink.rel = 'noopener noreferrer';
  detailLink.textContent = '상세보기';
  detailLink.addEventListener('click', (e) => e.stopPropagation());

  actionsEl.append(toLink, detailLink);
  wrap.append(nameEl, actionsEl);

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
    let docClickHandler: ((e: MouseEvent) => void) | null = null;

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

          /* 브랜드 커스텀 마커 — 40×52 티어드롭 (BUG-146 1.4× 확대), 바닥 중앙 앵커 */
          const MARKER_HEIGHT = 52;
          const MARKER_HALF_HEIGHT = MARKER_HEIGHT / 2; // 26 — 마커 시각 중앙 보정
          const POPUP_VIEW_OFFSET = 60; // 팝업 open 시 추가 보정 (yAnchor=1.35 + 컨텐트 ≈ 80px 고려)
          const markerImage = new kakao.MarkerImage(
            '/images/icons/map_marker.svg',
            new kakao.Size(40, MARKER_HEIGHT),
            { offset: new kakao.Point(20, MARKER_HEIGHT) },
          );
          const marker = new kakao.Marker({ position: center, map, image: markerImage });

          /* overlay 내부 mousedown 플래그 — Kakao SDK 는 좌표 기반으로 map click 을
             발행하므로 DOM stopPropagation 만으로는 구별 불가. mousedown 에서 플래그를
             세우면 map click 핸들러가 overlay 내부 클릭(링크 포함)을 건너뛸 수 있다. */
          let overlayInteracted = false;
          let popupOpen = false;

          const overlay = new kakao.CustomOverlay({
            position: center,
            content: buildOverlayContent({
              placeName, placeId, lat, lng,
              onInteract: () => { overlayInteracted = true; },
            }),
            yAnchor: 1.35,
          });

          /* BUG-146 follow-up — 마커 anchor 가 lat/lng (마커 바닥) 에 있어
             기본 setCenter 시 마커 시각 중앙이 viewport 중앙보다 26px 위로 쏠림.
             팝업 open 시에는 yAnchor=1.35 로 추가 위쪽 확장 → 더 쏠림.
             projection 으로 lat/lng 의 화면 픽셀 위치를 가져와 시각 중앙이
             viewport 중앙에 오도록 보정된 center 좌표 계산. */
          const recenter = (smooth: boolean) => {
            const proj = map.getProjection();
            const anchorPx = proj.containerPointFromCoords(center);
            const offsetY = popupOpen
              ? MARKER_HALF_HEIGHT + POPUP_VIEW_OFFSET
              : MARKER_HALF_HEIGHT;
            const adjustedCoord = proj.coordsFromContainerPoint(
              new kakao.Point(anchorPx.x, anchorPx.y - offsetY),
            );
            if (smooth) map.panTo(adjustedCoord);
            else map.setCenter(adjustedCoord);
          };

          /* 초기 진입 시 마커 시각 중앙 보정 */
          recenter(false);

          /* 컨테이너 리사이즈 시 relayout + 보정된 중심 재설정 (BP 전환·회전 대응) */
          ro = new ResizeObserver(() => {
            map.relayout();
            recenter(false);
          });
          ro.observe(containerRef.current);

          kakao.event.addListener(marker, 'click', () => {
            if (overlay.getMap()) {
              overlay.setMap(null);
              popupOpen = false;
            } else {
              overlay.setMap(map);
              popupOpen = true;
            }
            recenter(true);
          });
          kakao.event.addListener(map, 'click', () => {
            if (overlayInteracted) { overlayInteracted = false; return; }
            if (popupOpen) {
              overlay.setMap(null);
              popupOpen = false;
              recenter(true);
            }
          });

          /* 지도 외부 클릭 시 팝업 닫기 */
          docClickHandler = (e: MouseEvent) => {
            if (containerRef.current?.contains(e.target as Node)) return;
            if (popupOpen) {
              overlay.setMap(null);
              popupOpen = false;
              recenter(true);
            }
          };
          document.addEventListener('click', docClickHandler);
        });
      })
      .catch((err) => console.warn('[KakaoMap]', err));

    return () => {
      cancelled = true;
      ro?.disconnect();
      if (docClickHandler) document.removeEventListener('click', docClickHandler);
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
