// overscroll 색상 토큰
// 수정 시 이 파일의 상수만 변경하면 전체 반영됨
export const WARM_BLACK  = '#1E1B16'; // --color-background-inverse  (어나운스바/히어로)
export const STONE_GRAY  = '#4A4845'; // --color-surface-stone        (푸터)
export const WARM_GRAY   = '#FBF8F3'; // --color-background-primary   (라이트 페이지)

// 기본값: 어나운스바 + 푸터가 있는 일반 페이지 기준
export const TOP_DEFAULT    = WARM_BLACK;
export const BOTTOM_DEFAULT = STONE_GRAY;

let topColor    = TOP_DEFAULT;
let bottomColor = BOTTOM_DEFAULT;

export const getTopColor    = () => topColor;
export const getBottomColor = () => bottomColor;
export const setTopColor    = (c: string) => { topColor = c; };
export const setBottomColor = (c: string) => { bottomColor = c; };
export const resetColors    = () => {
  topColor    = TOP_DEFAULT;
  bottomColor = BOTTOM_DEFAULT;
};
