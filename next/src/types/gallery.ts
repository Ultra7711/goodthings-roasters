/* ══════════════════════════════════════════
   Gallery Types
   프로토타입 GD_IMAGES / GD_PATTERNS 구조 기반
   ══════════════════════════════════════════ */

export type GalleryImage = {
  /** 이미지 경로 */
  src: string;
  /** 대형 셀(span) 우선 배치 여부 */
  featured?: boolean;
  /** 접근성 대체 텍스트 */
  alt?: string;
};

/** 행 패턴 정의 */
export type RowPattern = {
  /** CSS 클래스 접미사 (a ~ e) */
  cls: string;
  /** 행에 배치할 이미지 수 */
  count: number;
  /** span(2-row) 셀 인덱스 (-1이면 없음) */
  spanIdx: number;
};

/** 5종 행 패턴 순환 정의 */
export const GD_PATTERNS: RowPattern[] = [
  { cls: 'a', count: 5, spanIdx: 0 },
  { cls: 'b', count: 3, spanIdx: -1 },
  { cls: 'c', count: 5, spanIdx: 4 },
  { cls: 'd', count: 2, spanIdx: -1 },
  { cls: 'e', count: 1, spanIdx: -1 },
];

/** 빈 셀 플레이스홀더 색상 */
export const GD_PLACEHOLDER_COLORS = [
  '#D9D6D2',
  '#E8DFD2',
  '#D4C8B8',
  '#D5DED0',
  '#F5EFE0',
];
