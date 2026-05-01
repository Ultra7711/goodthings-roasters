/* ══════════════════════════════════════════
   Good Days 갤러리 데이터
   프로토타입 GD_IMAGES / GD_PATTERNS / GD_PLACEHOLDER_COLORS
   (L10628~10733) 그대로 이식.

   매거진 레이아웃:
     A(5장) — 2x 320px, 첫 셀을 2fr span
     B(3x1) — 420px 단일 행
     C(5장) — 2x 320px, 5번째 셀을 2fr span
     D(2x1) — 480px 단일 행
     E(1x1) — 560px full-bleed
   16장 1사이클 → 42장 = 2사이클 + 일부

   LQIP (S121): GD_BLUR_MAP 은 빌드 타임 prebuild (plaiceholder).
   재생성: npx tsx scripts/generate-gallery-blur.ts
   ══════════════════════════════════════════ */

import { GD_BLUR_MAP, type GdBlurEntry } from './gooddaysBlur';

/** GD_BLUR_MAP 누락 시 fallback — 1x1 sandy beige (--color-background-secondary).
    width/height 는 일반적 사진 비율 fallback. */
const FALLBACK_BLUR_ENTRY: GdBlurEntry = {
  blurDataURL:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGPgaAAAAIIAgB8U1XwAAAAASUVORK5CYII=',
  width: 1920,
  height: 1280,
};

function entryOf(src: string): GdBlurEntry {
  return GD_BLUR_MAP[src] ?? FALLBACK_BLUR_ENTRY;
}

export type GdImage = {
  src: string;
  featured?: boolean;
};

export type GdImageWithBlur = {
  src: string;
  blurDataURL: string;
  /** 빌드 타임 sharp 추출 — yet-another-react-lightbox Zoom plugin 활성화 조건 */
  width: number;
  height: number;
};

export type GdPattern = {
  cls: 'gd-row--a' | 'gd-row--b' | 'gd-row--c' | 'gd-row--d' | 'gd-row--e';
  count: number;
  /** -1 = featured 슬롯 없음 */
  spanIdx: number;
};

/* 갤러리 이미지 원본 — 42장 (프로토타입 그대로) */
export const GD_IMAGES: GdImage[] = [
  { src: '/images/gallery/KakaoTalk_20260328_161956706_01.webp', featured: true },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_02.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_03.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_04.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_05.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_06.webp', featured: true },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_07.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_08.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_09.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_10.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_11.webp', featured: true },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_12.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_13.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_14.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_15.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_16.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_17.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_18.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_19.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_20.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_21.webp', featured: true },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_22.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_23.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_24.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_25.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_26.webp', featured: true },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_27.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_28.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_29.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174_02.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174_04.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174_05.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174_06.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174_07.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174_08.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174_09.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174_10.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174_11.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174_12.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174_13.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174_14.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174_15.webp' },
];

export const GD_PATTERNS: GdPattern[] = [
  { cls: 'gd-row--a', count: 5, spanIdx: 0 },
  { cls: 'gd-row--b', count: 3, spanIdx: -1 },
  { cls: 'gd-row--c', count: 5, spanIdx: 4 },
  { cls: 'gd-row--d', count: 2, spanIdx: -1 },
  { cls: 'gd-row--e', count: 1, spanIdx: -1 },
];

/* Extended Palette 최연한 컬러 — 빈 셀 플레이스홀더 */
export const GD_PLACEHOLDER_COLORS = ['#E0D5C5', '#E8DFD2', '#D4C8B8', '#DDD0BE', '#F5EFE0'];

export type GdCell =
  | {
      kind: 'image';
      src: string;
      blurDataURL: string;
      width: number;
      height: number;
      orderedIdx: number;
      span: boolean;
    }
  | { kind: 'placeholder'; bg: string; span: boolean };

export type GdRow = {
  pattern: GdPattern;
  cells: GdCell[];
};

export type GoodDaysGrid = {
  rows: GdRow[];
  /** 라이트박스 네비게이션용 — orderedIdx 순서의 평탄 배열 (src + blurDataURL) */
  ordered: GdImageWithBlur[];
};

/**
 * 매거진 그리드를 구성한다.
 * 1) featured 이미지를 pattern 의 span 슬롯에 우선 배치
 * 2) 나머지는 normal 풀에서 순차 배치
 * 3) 이미지가 다 떨어지면 플레이스홀더 컬러 셀 채움
 */
export function buildGoodDaysGrid(): GoodDaysGrid {
  const featuredPool = GD_IMAGES.filter((img) => img.featured).map((img) => img.src);
  const normalPool = GD_IMAGES.filter((img) => !img.featured).map((img) => img.src);

  /* 배치 순서 결정: 패턴별 span 슬롯에 featured 우선 */
  const orderedSrc: string[] = [];
  let fIdx = 0;
  let nIdx = 0;
  let patIdx = 0;
  let placed = 0;
  const totalImages = GD_IMAGES.length;

  while (placed < totalImages) {
    const pat = GD_PATTERNS[patIdx % GD_PATTERNS.length];
    for (let i = 0; i < pat.count && placed < totalImages; i++) {
      if (i === pat.spanIdx && fIdx < featuredPool.length) {
        orderedSrc.push(featuredPool[fIdx++]);
      } else if (nIdx < normalPool.length) {
        orderedSrc.push(normalPool[nIdx++]);
      } else if (fIdx < featuredPool.length) {
        orderedSrc.push(featuredPool[fIdx++]);
      }
      placed++;
    }
    patIdx++;
  }

  const ordered: GdImageWithBlur[] = orderedSrc.map((src) => {
    const entry = entryOf(src);
    return {
      src,
      blurDataURL: entry.blurDataURL,
      width: entry.width,
      height: entry.height,
    };
  });

  /* 행 구조 생성 — 이미지가 떨어지면 플레이스홀더 셀 */
  const rows: GdRow[] = [];
  let idx = 0;
  let phIdx = 0;
  patIdx = 0;
  while (idx < ordered.length) {
    const pat = GD_PATTERNS[patIdx % GD_PATTERNS.length];
    const cells: GdCell[] = [];
    for (let i = 0; i < pat.count; i++) {
      const span = i === pat.spanIdx;
      if (idx < ordered.length) {
        const item = ordered[idx];
        cells.push({
          kind: 'image',
          src: item.src,
          blurDataURL: item.blurDataURL,
          width: item.width,
          height: item.height,
          orderedIdx: idx,
          span,
        });
        idx++;
      } else {
        const bg = GD_PLACEHOLDER_COLORS[phIdx % GD_PLACEHOLDER_COLORS.length];
        cells.push({ kind: 'placeholder', bg, span });
        phIdx++;
      }
    }
    rows.push({ pattern: pat, cells });
    patIdx++;
  }

  return { rows, ordered };
}
