/* ══════════════════════════════════════════════════════════════════════════
   lib/admin/aiPrompt.ts — 운영자 AI 배너 제작 표준 prompt (S239 B-1b · S276 Stage 2 · S277 정정)

   목적:
   - 운영자가 AI 에게 배너 자산을 의뢰할 때 사용할 두 표준 prompt:
     - **Stage 1**: 원본 이미지 → 텍스트/요소 제거 + BP 별 배경 이미지
       (이미지 처리 AI · Gemini 2.5 / ChatGPT GPT-4o image / Imagen 추천)
     - **Stage 2 (S276 · S277 정정)**: 시즌 컨셉 + 배경 이미지 → 4 BP responsive.html
       (범용 멀티모달 AI — Claude · GPT · Gemini 동등 사용 가능)

   배너 제작 워크플로우 (운영자 가이드 · S276 chain 완성):
   1. 시즌 컨셉 결정
   2. AI 로 배너 원본 이미지 생성 (텍스트 + 디자인 요소 포함된 완성본)
   3. **Stage 1 prompt** → 이미지 AI → 배경 이미지 (Desktop · Mobile) + 안전 영역 메타
      (S277: 안전영역 = 디테일 0 단색/그라데이션 비움 강제)
   4. **Stage 2 prompt** → 범용 멀티모달 AI (또는 디자이너) → responsive.html
      (S277: 사이트 톤 강제 폐기 · 디자인 자유 + 컨셉 추출 + invention 금지)
   5. admin "responsive HTML 자동 변환" (S275 Phase 2) → production.html 자동 저장
   6. SEO 메타 자동 채움 (autofill) + 4 BP iframe preview 시각 검증
   7. enabled=true 활성화

   디자이너 옵션 (안전망): Stage 2 결과를 "HTML 다운로드" → 디자이너 검수 + 보정
   → 다시 업로드 → 자동 변환.

   설계:
   - signature 와 cafe-events 가 거의 동일한 모델이라 단일 builder + 영역 라벨만 분기
   - Stage 2 는 spec-heavy (시스템 정합 강제) 이지만 디자인 결정은 컨셉에서 추출 (S277)
   - "시스템 정합" (4 BP wrap / 패딩 60·48·48·32 / 폰트 시스템 / 한영 매핑) = 변경 금지
   - "디자인 자유" (색상 / 배지 / divider / 레이아웃 / 오브젝트) = 컨셉에서 추출
   ══════════════════════════════════════════════════════════════════════════ */

export type BannerKind = 'signature' | 'cafe-event';

interface BuildPromptOptions {
  kind: BannerKind;
  /** 운영자가 결정한 BP 별 비율 (예: '1600/500'). 빈 값이면 AI 가 추정. */
  aspectDesktop?: string;
  aspectTablet?: string;
  aspectMobile?: string;
}

const KIND_LABEL: Record<BannerKind, string> = {
  'signature': '시그니처 chapter (메인 페이지 진입 영역)',
  'cafe-event': '카페 배너 (메인 §2.5 카페 메뉴 chapter)',
};

/**
 * AI 에게 전달할 표준 Stage 1 prompt 텍스트 생성.
 * 운영자가 admin UI 의 'AI prompt 복사' 버튼 클릭 시 clipboard 에 복사됨.
 */
export function buildBannerAiPrompt(options: BuildPromptOptions): string {
  const { kind, aspectDesktop, aspectTablet, aspectMobile } = options;
  const label = KIND_LABEL[kind];

  const aspectBlock = [
    '- Desktop (필수): ' + (aspectDesktop || '(미지정 — 가로형 2:1~3:1)'),
    '- Mobile (필수):  ' + (aspectMobile || '(미지정 — 세로형 0.5:1~1:1.3)'),
    '- Tablet (선택):  ' + (aspectTablet || '(생성 권장 X — Desktop 자동 사용)'),
  ].join('\n');

  return [
    `# ${label} 배경 이미지 생성`,
    '',
    '추천 AI: **Gemini 2.5 · ChatGPT (GPT-4o image generation) · Imagen** 등 이미지 처리/생성 멀티모달 AI.',
    '',
    '## 🎯 이 작업의 본질',
    '',
    '단순한 "배경 이미지 추출" 이 아닙니다. **HTML 이 재구현할 요소들의 자리를 미리 감안한 베이스 이미지** 를 만드는 작업입니다.',
    '',
    '결과는 다음 두 조건을 동시 충족해야 합니다:',
    '1. 텍스트와 분리 가능한 디자인 요소가 제거된 **깨끗한 배경**',
    '2. HTML 요소 (헤드라인 · 메뉴 정보 · feature 바 · 배지 등) 가 들어갈 **자리가 메인 비주얼에 가려지지 않게 비워진** 베이스',
    '',
    '즉 BP 재구성 시 단순 crop/resize 가 아니라, HTML 요소 자리 확보를 위한 **컴포지션 재배치**.',
    '',
    '## 입력 자산 (운영자가 첨부)',
    '- **원본 이미지 1장** — AI 로 생성한 완성된 배너 (텍스트 · 작은 디자인 요소 포함)',
    '  → 이 prompt 와 함께 채팅에 직접 업로드',
    '',
    '## 출력 비율 (3 BP)',
    aspectBlock,
    '',
    '## 작업',
    '1. **원본 이미지 layer 식별** — 다음 3 layer 분석',
    '   - **배경 layer (보존 대상 · 절대 건드리지 말 것)**:',
    '     - 메인 비주얼 (상품 사진 · 텍스처 · 배경 색 · 자연 그림자)',
    '     - **제품 자체에 인쇄/각인/부착된 텍스트·로고·라벨** (예: 컵·병·패키지 위 브랜드 로고, 상품명 등)',
    '     - 자연 융합된 식자재 · 소품 (음료 옆 코코넛 · 원두 · 식물 등)',
    '   - **텍스트 layer (제거 대상)**: 배경 위 오버레이된 마케팅 텍스트 — 헤드라인 · 부제 · 메뉴명 · 캡션',
    '   - **분리 가능한 디자인 요소 layer (제거 대상)**: 배경 위 오버레이된 배지 · 라벨 · 작은 도형 · 아이콘 · 라인 등',
    '     (HTML 측에서 재현하므로 이미지에서 제거)',
    '',
    '   🚫 **금지 — 보존해야 하는 것을 제거하지 말 것**:',
    '     - 음료 컵/병/패키지 표면의 로고/문자 (제품의 일부 · HTML 재현 불가)',
    '     - 라벨이 부착된 식자재의 라벨 (상품 디자인)',
    '     - 제품과 자연 합성된 그림자 · 반사광',
    '',
    '2. **원본 레이아웃 구조 분석** — BP 재구성 시 잘림 방지',
    '   원본 배너의 영역 구조를 식별:',
    '   - **메인 비주얼 영역** (상품 사진 등 핵심 콘텐츠가 차지하는 영역)',
    '   - **헤드라인/부제 텍스트 영역**',
    '   - **메뉴/상품 정보 텍스트 영역** (메뉴명·설명 등)',
    '   - **feature/소개 바 영역** (예: 하단 가로 바 · 4종 아이콘 + 라벨)',
    '   - **배지/장식 영역** (예: 원형 라벨)',
    '   이 구조를 기억해서 BP 재구성 시 메인 비주얼 + 모든 텍스트/feature 영역이 잘리지 않도록 배치.',
    '',
    '3. **텍스트 + 오버레이 요소 제거** — 배경 layer 만 남긴 깨끗한 이미지 생성',
    '   - generative fill / inpainting 사용',
    '   - 제거된 영역의 배경 색·텍스처를 주변과 자연스럽게 연결',
    '   - **제품 자체는 손대지 말 것** — 텍스트가 보여도 그게 제품 위 인쇄/각인이면 그대로 유지',
    '',
    '4. **BP 2종 재구성** (Desktop + Mobile · Tablet 은 선택)',
    '   ⚠️ **핵심 — 잘림 방지**: 원본의 메인 비주얼 (상품 사진 등) 이 BP 재구성 후에도 **온전히 보여야** 합니다.',
    '   특히 원본에 하단 feature 바 같은 가로 영역이 있는 경우, 그 영역 분량을 고려해서 메인 비주얼이 그 위에 충분히 들어갈 공간 확보.',
    '   ',
    '   각 BP 별 권장 비율 및 배치:',
    '   - **Desktop (필수 · 가로형 · 권장 비율 2:1 ~ 3:1)**: 좌측 텍스트 영역 + 우측 메인 비주얼 (또는 상하 분할). 하단 feature 바 있으면 하단 ~15% 확보.',
    '   - **Mobile (필수 · 세로형 · 권장 비율 0.5:1 ~ 1:1.3)**: 상단 텍스트 + 중앙 메인 비주얼 + 하단 feature 바. 명확한 세로 컴포지션.',
    '   - **Tablet (선택 · 생성 안 함 권장)**: AI 이미지 모델이 Desktop 과 명확히 다른 Tablet 비율을 생성하기 어려움. admin 이 Tablet 비우면 Desktop 자동 사용 (fallback). **2장 생성으로 충분**.',
    '     운영자가 Tablet 별 디자인 명확히 원하면 → Desktop/Mobile 과 별도의 추가 호출로 생성 (1.5:1 ~ 2:1 비율).',
    '',
    '   🚫 **잘림 회피 체크**:',
    '   - 메인 비주얼 (상품 사진) 이 feature 바·텍스트 영역에 의해 잘리는지 확인',
    '   - 잘림 발생 시 → 이미지 컴포지션 재조정 (메인 비주얼 위치/크기 변경)',
    '',
    '4-A. **안전영역 = 비주얼 디테일 0 (필수 · 최우선 규칙)**',
    '   메인 비주얼은 한쪽으로 몰고 반대편을 의도적으로 비웁니다 — HTML 텍스트/요소가 들어갈 자리.',
    '',
    '   - **가로형**: 우측 50~60% 메인 비주얼 / **좌측 40~50% = 단색 또는 부드러운 그라데이션만 (디테일 0)**',
    '   - **세로형**: 하단 55~60% 메인 비주얼 / **상단 40~45% = 동일하게 단색/그라데이션 비움**',
    '',
    '   비움 색상 = 비주얼 톤과 정합되는 단색 또는 자연 ease-out fade (시각 주체에서 안전영역으로).',
    '',
    '   🚫 **안전영역 안에 절대 두지 말 것**: 코코넛 / 원두 / 잎 / 식재료 / 소품 / 작은 그림자 / 부분 텍스처 / 컬러 점 / 어떤 형태의 디테일도 금지.',
    '',
    '   ✅ **자가 검증**: "안전영역에 텍스트를 흰색 + 검정 두 가지로 가상 배치했을 때 둘 다 읽히는가?" → 둘 다 OK 여야 통과. 한쪽만 OK 면 비주얼 톤 단순화 부족 → 다시 재구성.',
    '',
    '   ⚠️ **이유**: 안전영역에 디테일이 남으면 Stage 2 가 텍스트 가독성 위해 어두운 overlay (`::after` 그라데이션) 를 깔게 되어 비주얼 시각 주체가 가려집니다. 안전영역을 깨끗하게 비워두면 overlay 자체가 불필요해집니다.',
    '',
    '5. **안전 영역 메타데이터 출력** — 각 BP 별 다음 정보를 좌표(%) 로 표기',
    '   - **텍스트 안전 영역**: 헤드라인/부제/CTA 가 들어갈 위치',
    '   - **메인 비주얼 영역**: 상품 사진이 표시되는 위치 (잘리면 안 되는 영역)',
    '   - **feature 바 영역** (있는 경우): 하단 또는 측면 바 위치',
    '   (디자이너가 responsive.html 작성 시 텍스트/요소 배치 기준으로 활용)',
    '',
    '## 출력 이미지 권장 크기 (HiDPI 대응 · 비율은 위에 명시한 BP 비율 유지)',
    '- **Desktop**: 폭 1600~2000px (Retina 대응 · 1320 표시 영역의 ~1.5x)',
    '- **Tablet** : 폭 1024~1400px',
    '- **Mobile** : 폭  720~1080px (Retina 대응 · 390 표시 영역의 ~2x)',
    '- **포맷**: WebP / JPEG / PNG 모두 OK — admin 업로드 시 WebP 자동 변환',
    '- **용량**: 변환 후 각 5MB 이하 (admin 업로드 제한)',
    '',
    '## BP 톤 일관성 의무 (필수)',
    '배경 이미지들은 동일한 시즌 배너의 BP 변형이므로 색감·톤이 **최대한 동일하게 보여야** 합니다.',
    '별개 이미지가 아니라 "같은 사진의 BP 자동 크롭" 처럼 보이는 게 목표.',
    'Desktop / Mobile 의 같은 부분이 색차로 다르게 보이면 viewport 전환 시 어색합니다.',
    '',
    '- 동일한 색온도 · 화이트 밸런스 유지',
    '- 동일한 그레이딩 (예: 따뜻한 톤이면 모두 같은 정도)',
    '- 동일한 채도 · 콘트라스트 · 명도',
    '- 노이즈/그레인이 있다면 동일한 강도로 적용',
    '- 동일한 그림자 방향·강도',
    '- **권장**: 별개 호출이 아니라 한 번의 작업으로 함께 생성',
    '  (각 BP 별 별도 prompt 호출 시 톤 미세 차이 발생 위험)',
    '- 운영자 검증 기준 — 나란히 놓고 봤을 때 동일한 시즌의 사진처럼 보일 것',
    '',
    '## 출력 형식',
    '',
    '**1. 배경 이미지 2장 (권장)** — Desktop · Mobile (각각 다운로드 가능한 형태)',
    '  Tablet 별도 디자인 원하면 추가 생성 (선택).',
    '',
    '**2. 영역 메타데이터** — 출력한 BP 마다 다음 템플릿 각각 적용 (기본 Desktop · Mobile 2개):',
    '',
    '```',
    '[BP 이름]',
    '  텍스트 안전 영역: 좌측 X~X% / 상단 X~X%',
    '  메인 비주얼 영역: 좌측 X~X% / 상단 X~X% (잘림 금지)',
    '  feature 바 영역: 하단 X~X% 전체 (있는 경우 · 없으면 "없음" 표기)',
    '```',
    '',
    '`X~X%` 는 각 BP 별 실측 좌표값으로 교체. 예:',
    '',
    '```',
    '[Desktop]',
    '  텍스트 안전 영역: 좌측 5~45% / 상단 20~80%',
    '  메인 비주얼 영역: 좌측 50~95% / 상단 10~85% (잘림 금지)',
    '  feature 바 영역: 하단 85~100% 전체',
    '```',
    '',
    '## 다음 단계 안내',
    '- 결과 이미지를 admin "이미지 (반응형)" 슬롯에 업로드',
    '- 영역 메타데이터를 **Stage 2 prompt** (admin "Stage 2 AI prompt 복사" 버튼) 에 함께 전달',
    '  → Claude Opus 4.7 가 responsive.html 작성',
    '  → admin "responsive HTML 자동 변환" 카드에 붙여넣기 → production HTML 자동 저장',
  ].join('\n');
}

/* ══════════════════════════════════════════════════════════════════════════
   Stage 2 — responsive.html 생성 prompt (S276)
   ══════════════════════════════════════════════════════════════════════════ */

interface BuildStage2Options {
  kind: BannerKind;
  /** Stage 1 결과 이미지 aspect (운영자 admin 폼에서 자동 측정). */
  aspectDesktop?: string;
  aspectTablet?: string;
  aspectMobile?: string;
  /** 운영자가 입력한 SEO 메타 — Stage 2 AI 가 prompt 안에서 그대로 사용. */
  headlineText?: string;
  subheadText?: string;
  ctaText?: string;
  imageAlt?: string;
}

/** aspect '1440/504' → wrap width × height 추정 (BP 별 base width 기준). */
function aspectToWh(aspect: string | undefined, baseWidth: number): string {
  const fallback = `${baseWidth}px (height 미지정)`;
  if (!aspect) return fallback;
  const m = /^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/.exec(aspect);
  if (!m) return fallback;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return fallback;
  }
  const targetHeight = Math.round((baseWidth * h) / w);
  return `${baseWidth}px × ${targetHeight}px (원본 ${w}:${h})`;
}

/**
 * Stage 2 AI 에게 전달할 spec-heavy prompt — 4 BP responsive.html 생성.
 *
 * 모델 정책 (S277 정정):
 *   - 범용 멀티모달 AI 사용 가능 (Claude · GPT · Gemini 동등)
 *   - 시스템 제약 만으로는 운영 규칙 (좌측 패딩 60/48/48/32 등) 모름 → spec-heavy 유지
 *   - 단 디자인 결정 (색상 / 배지 / divider / 레이아웃) 은 원본 컨셉에서 추출 (사이트 톤 강제 폐기)
 *   - S274 fair test 결과 ("Claude 1위") = 강제 prompt 환경 한정 의의 — S277 정정으로 평가 축이
 *     "컨셉 추출 충실도 + invention 자제력" 으로 바뀜 → 재평가 필요 (DEC-S277-P6)
 *
 * 운영자가 admin "Stage 2 AI prompt 복사" 버튼 클릭 시 clipboard 복사.
 * AI 결과 = responsive.html → admin "responsive HTML 자동 변환" (S275) → production.html.
 */
export function buildStage2Prompt(options: BuildStage2Options): string {
  const {
    kind,
    aspectDesktop,
    aspectMobile,
    headlineText,
    subheadText,
    ctaText,
    imageAlt,
  } = options;
  const label = KIND_LABEL[kind];

  const wrapWh = [
    '  - .landscape-max-wrap: ' + aspectToWh(aspectDesktop, 1440),
    '  - .landscape-min-wrap: ' + aspectToWh(aspectDesktop, 768),
    '  - .portrait-max-wrap:  ' + aspectToWh(aspectMobile, 767),
    '  - .portrait-min-wrap:  ' + aspectToWh(aspectMobile, 360),
  ].join('\n');

  const userText =
    [
      headlineText && `- 헤드라인: "${headlineText}"`,
      subheadText && `- 부제: "${subheadText}"`,
      ctaText && `- CTA 라벨: "${ctaText}"`,
      imageAlt && `- 이미지 alt: "${imageAlt}"`,
    ]
      .filter(Boolean)
      .join('\n') ||
    '  (운영자 입력 없음 — 본 출력에 텍스트 요소 표시 없이 배경 + 시각 주체만 렌더하세요. 임의 단어/문장 자동 생성 금지.)';

  return [
    `# ${label} responsive.html 생성 (Stage 2)`,
    '',
    '추천 AI: **범용 멀티모달 AI** (Claude · GPT · Gemini 동등 사용 가능). 본 prompt 의 운영 규칙을 정확히 따를 것.',
    '',
    '## 🎯 이 작업의 본질',
    '',
    '디자이너가 4 BP 양 끝점 (가로형 1440 + 768 + 세로형 767 + 360) 에서 폰트/패딩/위치를 결정한 **stacked 시각 데모 HTML** 을 작성하는 작업입니다.',
    '',
    '결과 = 4 wrap (.landscape-max-wrap / .landscape-min-wrap / .portrait-max-wrap / .portrait-min-wrap) 이 body 안에 세로로 쌓인 단일 .html 파일.',
    '',
    '운영자는 결과를 admin "responsive HTML 자동 변환" 에 붙여넣기 → cascade resolver 가 자동으로 production.html (단일 .banner-wrap + container query + cqw clamp fluid) 로 변환합니다.',
    '',
    '## 📋 시스템 제약 (변경 절대 금지)',
    '',
    '### 1. 4 BP wrap class 명명 + 크기',
    '각 BP 별 wrap div 의 class 명과 width × height 는 정확히 다음을 따를 것 (변경 시 자동 변환 깨짐):',
    '',
    wrapWh,
    '',
    'wrap 의 HTML 구조:',
    '```html',
    '<div class="banner-wrap landscape-max-wrap" style="width: ...; height: ...;">',
    '  <img class="bg" src="ube_banner_desktop.png" alt="..." />',
    '  <div class="banner-text"> ...콘텐츠... </div>',
    '</div>',
    '```',
    '- 가로형 max + min 은 `*_desktop.png` 재사용 (Stage 1 출력)',
    '- 세로형 max + min 은 `*_mobile.png` 재사용 (Stage 1 출력)',
    '- Tablet 별 이미지 별도 생성 X — Desktop 자동 사용 (Stage 1 권장)',
    '',
    '### 2. 폰트 시스템 (Pretendard + Inter 두 패밀리만)',
    '`<head>` 에 다음 정확히 포함:',
    '```html',
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>',
    '<link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css" rel="stylesheet">',
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300..900&display=swap" rel="stylesheet">',
    '```',
    '`:root` 토큰:',
    '```css',
    ':root {',
    "  --font-en: 'Inter', sans-serif;",
    "  --font-kr: 'Pretendard Variable', 'Pretendard', sans-serif;",
    '}',
    '```',
    '🚫 **금지**: Noto Sans KR · Outfit · Montserrat 등 추가 패밀리. 사이트 다른 페이지 폰트 정합 깨짐.',
    '',
    '### 3. 한/영 매핑 규칙 (각 텍스트 요소 클래스에 font-family 명시)',
    '- **한글 문자 포함 (한/영 혼용 포함)** → `font-family: var(--font-kr)`',
    '  - 예: 부제, 메뉴 한글명, 본문, 캡션',
    '- **순수 영문 (대문자 라벨 · 헤드라인 · 시리즈명)** → `font-family: var(--font-en)`',
    '  - 예: "Good Things UBE Series", "UBE MILK", 영문 헤드라인',
    '🚫 **금지**: body inherit 만 의존하고 클래스에 font-family 명시 안 함 (영문 라벨이 Pretendard 로 떨어지는 회귀).',
    '',
    '## 📐 운영 규칙 (사이트 톤 정합 의무)',
    '',
    '### 1. 좌측 패딩 표준 (외부 페이지 정렬 의무)',
    '배너는 풀블리드로 노출되므로 외부 페이지 콘텐츠 영역과 좌측 정렬을 맞춰야 합니다:',
    '- `.landscape-max-wrap` 좌측 패딩: **60px**',
    '- `.landscape-min-wrap` 좌측 패딩: **48px**',
    '- `.portrait-max-wrap` 좌측 패딩 (텍스트): **48px**',
    '- `.portrait-min-wrap` 좌측 패딩 (텍스트): **32px**',
    '🚫 **금지**: 임의 패딩 (72px · 120px 등). 디자이너 자유 영역 아님.',
    '',
    '### 2. 폰트 크기 가이드 (양 끝점 모델 — production clamp 식의 양 끝점)',
    '각 클래스의 4 BP 별 값이 production clamp 식의 양 끝점이 되므로, 양 끝점만 잘 결정하면 중간 viewport 는 자동 보간:',
    '',
    '| 요소 | landscape-max (1440) | landscape-min (768) | portrait-max (767) | portrait-min (360) |',
    '|------|----------------------|---------------------|--------------------|--------------------|',
    '| 헤드라인 (영문) | 56~64px | 32~40px | 48~64px | 28~36px |',
    '| 부제 (한글) | 18~22px | 13~16px | 18~22px | 13~15px |',
    '| 시리즈 라벨 (영문) | 13~15px | 10~12px | 13~15px | 10~12px |',
    '| 메뉴 한글 | 15~17px | 11~13px | 14~16px | 11~13px |',
    '| 메뉴 영문 | 10~12px | 9~11px | 10~12px | 9~11px |',
    '| 메뉴 설명 (한글) | 12~14px | 9~11px | 11~13px | 10~12px |',
    '| 배지 라벨 | 13~15px | 8~10px | 13~15px | 6~8px |',
    '',
    '값은 시즌 컨셉에 따라 가이드 범위 안에서 자유. 단 양 끝점 차이 너무 크면 (예: 64 → 16) 중간 viewport 가 어색하니 가이드 범위 안 유지.',
    '',
    '### 3. 디자인 언어 추출 (원본 컨셉에서 추출)',
    '',
    '디자인 톤은 원본 컨셉 이미지에서 **추출** 한 후 HTML 로 재현하세요. 특정 시즌의 디자인 결정을 일반 디자인 룰처럼 강요하지 않습니다.',
    '',
    '1. **색상 팔레트** — 배경 톤 / 텍스트 톤 / 강조 색상 (운영자 시즌 컨셉 그대로 답습)',
    '2. **레이아웃 패턴** — 좌측 stack / 중앙 정렬 / 카드 그리드 / 리스트 등 (원본 컨셉에 있는 형태 그대로)',
    '3. **오브젝트 종류** — 배지 / divider / marker / icon / 그라데이션 line 등 (원본 컨셉에 있을 때만 재현)',
    '4. **폰트 무드** — 본문 weight / 헤드라인 style / 자간 등 (원본 컨셉 톤)',
    '',
    '🚫 **금지**: 원본 컨셉에 없는 element/색상/오브젝트 자체 추가 (= invention).',
    '✅ **허용**: 원본 컨셉에 있는 element 를 시스템 정합 패딩/폰트 가이드로 재현 (단 텍스트는 운영자 입력만).',
    '',
    '### 4. invention 금지 (element + 단어 양쪽)',
    '',
    '운영자가 입력한 텍스트와 원본 컨셉 이미지에 있는 element 만 사용하세요. 빈 슬롯을 채우려고 다음을 추가하지 마세요:',
    '',
    '**element invention 금지**:',
    '- 배지 (border-radius:50% / stamp / circle label / backdrop-blur 등)',
    '- divider / hr / 색상 강조 1px 라인',
    '- ingredient-marker 같은 글머리표 line',
    '- `::after` / `::before` 어두운 그라데이션 overlay (텍스트 가독 마스크)',
    '- 카드 그리드 / 4분할 정보 박스 / 메뉴 카드',
    '- 하단/측면 메뉴 bar (특정 시즌 패턴 · 일반 룰 아님)',
    '- 아이콘 / SVG (운영자 미입력)',
    '- `<em>` italic 강조 색상 변형 / gradient text',
    '',
    '**단어 invention 금지** (운영자 입력 외 자동 생성 금지):',
    '- 마케팅 일반 단어: "New" / "Signature" / "Limited" / "Exclusive" / "Premium" / "Best" / "Hot" / "Pick"',
    '- 한글 마케팅: "시즌 한정" / "한정" / "신상" / "신메뉴" / "베스트" / "추천" / "프리미엄"',
    '- 시리즈명/시즌명 자동 추가',
    '- 헤드라인 영문/한글 자동 변환 또는 병기 추가',
    '- 부제 BP 별 자동 축약/번역/변형 (운영자가 BP 별 별도 입력 안 했으면 동일 텍스트 사용)',
    '',
    '**안전영역 부족 대응**:',
    '- 폰트 크기 축소 (가이드 범위 안) 또는 줄바꿈으로 해결',
    '- **새 영역 발명 금지** (검정 overlay / 카드 분할 / 정보 박스 추가 등)',
    '- 그래도 안 들어가면 → "Stage 1 안전영역이 부족하다" 운영자에게 알림 (HTML 주석으로)',
    '',
    '### 5. portrait (768 미만) 강조 — 침범 위험 더 큼',
    '',
    '위의 모든 룰 (좌측 패딩 / 디자인 추출 / invention 금지) 은 **4 BP 모두 (landscape-max / landscape-min / portrait-max / portrait-min) 동일 적용**.',
    '',
    'portrait 는 폭이 좁아 텍스트 침범 위험이 더 큽니다:',
    '- 시각 주체가 화면 중앙/전체 가까이면 텍스트는 상단 또는 하단 줄에 분리 배치',
    '- Stage 1 안전영역 비율 (상단 40~45%) 엄수 — Stage 1 결과 이미지가 안전영역 안 비웠으면 운영자에게 재요청',
    '- 텍스트 양 많으면 BP 별 별도 입력 받기 (운영자 입력 슬롯 한계 · 별도 운영 결정)',
    '',
    '## 📝 입력 자산 (운영자가 채팅에 첨부)',
    '',
    '1. **Stage 1 결과 배경 이미지** — Desktop · Mobile 각 1장 (필수)',
    '2. **Stage 1 안전 영역 메타데이터** — 텍스트/메인 비주얼/feature 바 좌표 (참고)',
    '3. **운영자 입력 SEO 메타** (입력된 슬롯만 그대로 사용 · 미입력 슬롯은 출력에 텍스트 요소를 두지 않음 · 임의 단어/문장 자동 생성 금지):',
    userText,
    '',
    '## 📦 출력 형식 (단일 .html 파일)',
    '',
    '```html',
    '<!DOCTYPE html>',
    '<html lang="ko">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '  <title>{시즌명} Banner — fluid scaling endpoints</title>',
    '  <link rel="preconnect" href="...">',
    '  <link href="...pretendardvariable.min.css" rel="stylesheet">',
    '  <link href="...family=Inter:wght@300..900" rel="stylesheet">',
    '  <style>',
    '    /* :root 토큰 (font 시스템 + color 팔레트) */',
    '    /* body 데모 layout (stacked · padding · gap · background sand) */',
    '    /* .section / .label / .banner-wrap 데모 wrapper rules */',
    '    /* 가로형 max 기본값 (.headline · .subheadline 등) */',
    '    /* .landscape-min-wrap .X { ... } override (가로형 min 값) */',
    '    /* .portrait-max-wrap .X { ... } override (세로형 max 값) */',
    '    /* .portrait-min-wrap .X { ... } override (세로형 min 값) */',
    '  </style>',
    '</head>',
    '<body>',
    '  <div class="section"><p class="label">🖥 가로형 최대 — 1440px</p>',
    '    <div class="banner-wrap landscape-max-wrap" style="width: 1440px; height: ...">',
    '      <img class="bg" src="..._desktop.png" alt="...">',
    '      <div class="banner-text"> ...콘텐츠... </div>',
    '    </div></div>',
    '  <div class="section"><p class="label">📟 가로형 최소 — 768px</p>',
    '    <div class="banner-wrap landscape-min-wrap" style="width: 768px; height: ...">',
    '      <img class="bg" src="..._desktop.png" alt="...">',
    '      <div class="banner-text"> ...콘텐츠... </div>',
    '    </div></div>',
    '  <div class="section"><p class="label">📱 세로형 최대 — 767px</p>',
    '    <div class="banner-wrap portrait-max-wrap" style="width: 767px; height: ...">',
    '      <img class="bg" src="..._mobile.png" alt="...">',
    '      <div class="banner-text"> ...콘텐츠... </div>',
    '    </div></div>',
    '  <div class="section"><p class="label">📱 세로형 최소 — 360px</p>',
    '    <div class="banner-wrap portrait-min-wrap" style="width: 360px; height: ...">',
    '      <img class="bg" src="..._mobile.png" alt="...">',
    '      <div class="banner-text"> ...콘텐츠... </div>',
    '    </div></div>',
    '</body>',
    '</html>',
    '```',
    '',
    '## 🔍 자가 검증 체크리스트 (출력 전 모두 확인)',
    '',
    '- [ ] 4 wrap class 명명 정확 (.landscape-max-wrap / .landscape-min-wrap / .portrait-max-wrap / .portrait-min-wrap)',
    '- [ ] 각 wrap 의 width × height 가 위 시스템 제약 표와 일치',
    '- [ ] 좌측 패딩 60 / 48 / 48 / 32 정확 (임의 패딩 금지)',
    '- [ ] 폰트 패밀리 = Pretendard + Inter 만 (Noto Sans / Outfit 등 추가 패밀리 0)',
    '- [ ] 각 텍스트 클래스에 font-family 명시 (한글 → --font-kr · 영문 → --font-en)',
    '- [ ] 색상 팔레트 = 원본 컨셉 이미지에서 추출 (사이트 다른 페이지 톤 강요 X)',
    '- [ ] invention 0 — 원본 컨셉에 없는 element (배지/divider/marker/overlay/카드 그리드 등) 추가 안 함',
    '- [ ] invention 0 — 운영자 입력 외 단어 (New / Signature / 시즌 한정 등) 자동 생성 안 함',
    '- [ ] 부제 BP 별 자동 축약/번역 0 (운영자 미입력이면 동일 텍스트 사용)',
    '- [ ] 헤드라인 `<em>` italic 변형 / 색상 변형 / gradient text 0',
    '- [ ] `::after` / `::before` 어두운 overlay 0 (Stage 1 안전영역이 비어 있으면 불필요)',
    '- [ ] 폰트 크기가 위 가이드 범위 안',
    '- [ ] 4 BP wrap CSS 패턴 정확 (base + wrap class prefix override) — production 자동 변환 호환',
    '- [ ] portrait (768 미만) 도 동일 룰 적용 (안전영역 / invention 금지 / 디자인 추출)',
    '',
    '## 다음 단계 안내',
    '',
    '결과 .html 파일을 다운로드 또는 텍스트로 복사 → admin "responsive HTML 자동 변환" 카드 (또는 "텍스트 붙여넣기") → 자동 변환 실행 → production.html 자동 저장 → 4 BP iframe preview 시각 검증.',
    '',
    '디자이너 검수 옵션: admin "HTML 다운로드" 버튼으로 저장된 production.html 을 디자이너에게 전달 → 손본 후 다시 업로드.',
  ].join('\n');
}
