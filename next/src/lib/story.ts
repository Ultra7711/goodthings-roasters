/* ══════════════════════════════════════════
   Story 페이지 데이터
   프로토타입 #story-page (L4092~4175) 본문 그대로 이식.
   - 3개 two-col 섹션(Coffee/Brewing/Bakery): 라벨/제목/본문/이미지
   - 좌우 교차 배치(reverse) 플래그
   - 영문 본문은 sentence case + 브랜드명만 영문 유지(`굳띵즈`)
   ══════════════════════════════════════════ */

import storyBlurRaw from './story-blur.json';

export type StoryImageMeta = { blurDataURL: string; width: number; height: number };

const storyBlurMap: Record<string, StoryImageMeta> = storyBlurRaw as Record<string, StoryImageMeta>;

/** img path 에서 filename 추출 후 story-blur.json lookup. 매치 없으면 undefined. */
export function getStoryImageMeta(imgPath: string): StoryImageMeta | undefined {
  const filename = imgPath.split('/').pop();
  if (!filename) return undefined;
  return storyBlurMap[filename];
}

export type StoryTwoColItem = {
  label: string;
  heading: string;
  body: string;
  image: string;
  reverse: boolean;
};

/* 3개 섹션은 프로토타입 본문 그대로. <br><br> 단락 구분은 \n\n 으로 인코딩 후
   StoryTwoCol 컴포넌트에서 paragraph 로 분리한다. */
export const STORY_TWO_COL: StoryTwoColItem[] = [
  {
    label: 'Good Beans',
    heading: '좋은 원두를 씁니다.',
    body: '이름값이 아닌 맛으로 선택합니다.\n\n굳띵즈의 모든 원두는 산지 농장과의 직접 교류를 통해 선별됩니다. 수확 시기, 가공 방식, 건조 환경까지 확인한 생두만을 소량 입고하며, 로스팅 프로파일은 원두마다 개별적으로 설계합니다.',
    image: '/images/story/story_coffee.webp',
    reverse: false,
  },
  {
    label: 'Good Brew',
    heading: '내리는 시간이 맛이 됩니다.',
    body: '좋은 원두는 좋은 과정을 만나야 합니다.\n\n원두의 특성에 따라 분쇄도, 물의 온도, 추출 시간을 하나하나 조율합니다. 드립부터 에스프레소까지, 한 잔마다 최적의 방식으로 내립니다.',
    image: '/images/story/story_mano.webp',
    reverse: true,
  },
  {
    label: 'Good Taste',
    heading: '매장에서 직접 굽습니다.',
    body: '갓 구운 냄새가 공간에 머무는 시간.\n\n매일 아침 반죽부터 시작합니다. 좋은 재료와 충분한 발효 시간, 그리고 갓 구운 순간의 온기까지. 커피와 함께하는 한 조각을 위해 정성을 들입니다.',
    image: '/images/story/story_bakery.webp',
    reverse: false,
  },
];

/* Promise 섹션 — 센터 정렬, bg2 배경 */
export const STORY_PROMISE = {
  label: 'Our Promise',
  heading: '시간을 들여 만듭니다.',
  body: '빠르게 만들 수 있어도, 그렇게 하지 않습니다.\n좋은 것에는 시간이 필요하다는 것을 알기에, 모든 과정에 정성을 담습니다.',
};

/* Location 섹션 — 2fr:1fr 그리드 + Kakao Map JS SDK (지도) + 네이버 플레이스(말풍선 링크) */
export const STORY_LOCATION = {
  label: 'Location',
  name: 'Good Things Roasters',
  notice: '매장 이용 20:50까지  ·  라스트오더 20:30',
  /* 영업시간(요일별·휴무)은 site_settings.hours 로 이전 — ShopHoursAccordion 참조 */
  /* WGS84 좌표 — 네이버 플레이스 entry 기준 (map.naver.com/p/entry/place/1627274423) */
  lat: 36.0980474,
  lng: 128.4305856,
  zoomLevel: 3,
  /* 네이버 플레이스 상세 페이지 ID — 말풍선 "상세보기/길찾기" 링크용.
     map.naver.com/p/entry/place/{naverPlaceId}. 지도 SDK 는 카카오 유지(NCP 키 보류). */
  naverPlaceId: '1627274423',
  /* 상호명 — 말풍선 제목·길찾기 도착지 라벨. Location 섹션 제목(name) 과 분리. */
  naverPlaceName: '굳띵즈',
};

/* Hero 섹션 — 다크 배경 위에 EN/KR 순차 페이드 */
export const STORY_HERO = {
  en: 'good things, take time.',
  kr: '좋은 것에는 시간이 필요합니다.',
  background: '/images/story/story_hero_bg.webp',
};
