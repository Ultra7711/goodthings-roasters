/* ══════════════════════════════════════════
   Story 페이지 데이터
   프로토타입 #story-page (L4092~4175) 본문 그대로 이식.
   - 3개 two-col 섹션(Coffee/Brewing/Bakery): 라벨/제목/본문/이미지
   - 좌우 교차 배치(reverse) 플래그
   - 영문 본문은 sentence case + 브랜드명만 영문 유지(`굳띵즈`)
   ══════════════════════════════════════════ */

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
    label: 'Coffee',
    heading: '좋은 원두를 씁니다.',
    body: '이름값이 아닌 맛으로 선택합니다.\n\n굳띵즈의 모든 원두는 산지 농장과의 직접 교류를 통해 선별됩니다. 수확 시기, 가공 방식, 건조 환경까지 확인한 생두만을 소량 입고하며, 로스팅 프로파일은 원두마다 개별적으로 설계합니다.',
    image: '/images/story/story_coffee.webp',
    reverse: false,
  },
  {
    label: 'Brewing',
    heading: '내리는 시간이 맛이 됩니다.',
    body: '좋은 원두는 좋은 과정을 만나야 합니다.\n\n원두의 특성에 따라 분쇄도, 물의 온도, 추출 시간을 하나하나 조율합니다. 드립부터 에스프레소까지, 한 잔마다 최적의 방식으로 내립니다.',
    image: '/images/story/story_mano.webp',
    reverse: true,
  },
  {
    label: 'Bakery',
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

/* Location 섹션 — 2fr:1fr 그리드 + Kakao Map JS SDK */
export const STORY_LOCATION = {
  label: 'Location',
  name: 'Good Things Roasters',
  notice: '매장 이용 20:50까지  ·  라스트오더 20:30',
  hours: '화~금  12:00~21:00\n토~일  11:00~21:00\n월요일 휴무',
  /* Kakao Maps 좌표 (WGS84) — 매장 확정 좌표로 교체 필요 */
  lat: 36.0981256,
  lng: 128.4306089,
  zoomLevel: 3,
  /* Kakao 플레이스 상세 페이지 ID — map.kakao.com 에서 `kko.to` 단축 URL 경유 확인 */
  kakaoPlaceId: '2135570716',
  /* 카카오맵 상호명 — 말풍선·길찾기 링크용. Location 섹션 제목(name) 과 분리. */
  kakaoPlaceName: '굳띵즈',
};

/* Hero 섹션 — 다크 배경 위에 EN/KR 순차 페이드 */
export const STORY_HERO = {
  en: 'good things, take time.',
  kr: '좋은 것에는 시간이 필요합니다.',
  background: '/images/story/story_hero_bg.webp',
};
