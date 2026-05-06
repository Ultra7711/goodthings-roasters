/* ══════════════════════════════════════════
   Good Days 갤러리 — 매거진 그리드 빌더 (S167 J-3 DB 전환)

   매거진 레이아웃:
     A(5장) — 2x 320px, 첫 셀을 2fr span
     B(3x1) — 420px 단일 행
     C(5장) — 2x 320px, 5번째 셀을 2fr span
     D(2x1) — 480px 단일 행
     E(1x1) — 560px full-bleed

   데이터 소스:
   - DB `gooddays_gallery` (036 마이그레이션, S167)
   - lib/gooddaysServer.ts:fetchGoodDaysGallery() 가 SSR 단계에서 fetch
   - buildGoodDaysGrid(gallery) 가 인자로 받아 row 구조 생성
   - featured 플래그 = row 의 span 슬롯 우선 배치

   pattern 5종은 hardcoded 유지 (다음 sprint 후보).
   ══════════════════════════════════════════ */

export type GdImageWithBlur = {
  src: string;
  blurDataURL: string;
  /** sharp 추출 — yet-another-react-lightbox Zoom plugin 활성화 조건 */
  width: number;
  height: number;
};

/** featured 플래그 포함 — buildGoodDaysGrid 가 span 슬롯 배치에 사용. */
export type GdGalleryItem = GdImageWithBlur & {
  featured?: boolean;
};

export type GdPattern = {
  cls: 'gd-row--a' | 'gd-row--b' | 'gd-row--c' | 'gd-row--d' | 'gd-row--e';
  count: number;
  /** -1 = featured 슬롯 없음 */
  spanIdx: number;
};

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
 *
 * @param gallery DB fetch 결과 (lib/gooddaysServer.ts:fetchGoodDaysGallery)
 */
export function buildGoodDaysGrid(gallery: readonly GdGalleryItem[]): GoodDaysGrid {
  const featuredPool = gallery.filter((img) => img.featured);
  const normalPool = gallery.filter((img) => !img.featured);

  /* 배치 순서 결정: 패턴별 span 슬롯에 featured 우선 */
  const orderedItems: GdImageWithBlur[] = [];
  let fIdx = 0;
  let nIdx = 0;
  let patIdx = 0;
  let placed = 0;
  const totalImages = gallery.length;

  while (placed < totalImages) {
    const pat = GD_PATTERNS[patIdx % GD_PATTERNS.length];
    for (let i = 0; i < pat.count && placed < totalImages; i++) {
      if (i === pat.spanIdx && fIdx < featuredPool.length) {
        orderedItems.push(featuredPool[fIdx++]);
      } else if (nIdx < normalPool.length) {
        orderedItems.push(normalPool[nIdx++]);
      } else if (fIdx < featuredPool.length) {
        orderedItems.push(featuredPool[fIdx++]);
      }
      placed++;
    }
    patIdx++;
  }

  const ordered: GdImageWithBlur[] = orderedItems.map((item) => ({
    src: item.src,
    blurDataURL: item.blurDataURL,
    width: item.width,
    height: item.height,
  }));

  /* 행 구조 생성 — 이미지가 떨어지면 플레이스홀더 셀 */
  const rows: GdRow[] = [];
  let idx = 0;
  let phIdx = 0;
  patIdx = 0;

  /* 빈 갤러리 — 1개 row 만 placeholder 로 채움 (UX: 빈 페이지 방지) */
  if (ordered.length === 0) {
    const pat = GD_PATTERNS[0];
    const cells: GdCell[] = [];
    for (let i = 0; i < pat.count; i++) {
      const span = i === pat.spanIdx;
      const bg = GD_PLACEHOLDER_COLORS[phIdx % GD_PLACEHOLDER_COLORS.length];
      cells.push({ kind: 'placeholder', bg, span });
      phIdx++;
    }
    rows.push({ pattern: pat, cells });
    return { rows, ordered };
  }

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
