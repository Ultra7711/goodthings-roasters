/* ══════════════════════════════════════════════════════════════════════════
   lib/admin/aiPrompt.ts — 운영자 AI 배너 제작 표준 prompt (S239 B-1b)

   목적:
   - 운영자가 AI 에게 배너 제작을 요청할 때 사용할 표준 prompt 텍스트.
   - 2 stage 분리:
     - Stage 1 = 원본 이미지 → 텍스트/요소 제거 + BP 3 별 배경 이미지 재구성
       (이미지 처리 AI · Gemini / ChatGPT image / Imagen 추천)
     - Stage 2 = 원본 + 1단계 결과 → 폰트/색/위치/효과 정밀 분석 + 풀 HTML 생성
       (코드 생성 AI · Claude / ChatGPT 추천)
   - 어드민 폼 (settings 시그니처 · cafe-events) 의 "AI prompt 복사" 버튼에서 사용.

   배너 제작 워크플로우 (운영자 가이드):
   1. 시즌 컨셉 결정
   2. AI 로 배너 원본 이미지 생성 (텍스트 + 디자인 요소 포함된 완성본)
   3. **Stage 1 prompt** → 이미지 AI 에게 전달 → 배경 이미지 3종 + 안전 영역 메타
   4. **Stage 2 prompt** → 코드 AI 에게 전달 → 풀 HTML
   5. admin 업로드 → 이미지 3종 + .html + SEO 메타 텍스트 + alt
   6. /preview 4 brk 검증 → enabled=true 활성화

   설계:
   - signature 와 cafe-events 가 거의 동일한 모델이라 단일 builder 로 통합 + 영역
     라벨만 분기.
   ══════════════════════════════════════════════════════════════════════════ */

export type BannerKind = 'signature' | 'cafe-event';
export type PromptStage = 'stage1' | 'stage2';

interface BuildPromptOptions {
  kind: BannerKind;
  stage: PromptStage;
  /** 운영자가 결정한 BP 별 비율 (예: '1600/500'). 빈 값이면 AI 가 추정. */
  aspectDesktop?: string;
  aspectTablet?: string;
  aspectMobile?: string;
}

const KIND_LABEL: Record<BannerKind, string> = {
  'signature': '시그니처 chapter (메인 페이지 진입 영역)',
  'cafe-event': '카페 이벤트 배너 (카페 메뉴 chapter)',
};

/**
 * AI 에게 전달할 표준 prompt 텍스트 생성 (stage 별 분기).
 * 운영자가 admin UI 의 단계별 "AI prompt 복사" 버튼 클릭 시 clipboard 에 복사됨.
 */
export function buildBannerAiPrompt(options: BuildPromptOptions): string {
  return options.stage === 'stage1'
    ? buildStage1Prompt(options)
    : buildStage2Prompt(options);
}

/* ── Stage 1 — 배경 이미지 생성 (이미지 AI 용) ─────────────────────────── */

function buildStage1Prompt(options: BuildPromptOptions): string {
  const { kind, aspectDesktop, aspectTablet, aspectMobile } = options;
  const label = KIND_LABEL[kind];

  const aspectBlock = [
    '- Desktop (필수): ' + (aspectDesktop || '(미지정 — 가로형 2:1~3:1)'),
    '- Mobile (필수):  ' + (aspectMobile || '(미지정 — 세로형 0.5:1~1:1.3)'),
    '- Tablet (선택):  ' + (aspectTablet || '(생성 권장 X — Desktop 자동 사용)'),
  ].join('\n');

  return [
    `# [Stage 1 / 2] ${label} 배경 이미지 생성`,
    '',
    '추천 AI: **Gemini 2.5 · ChatGPT (GPT-4o image generation) · Imagen** 등 이미지 처리/생성 멀티모달 AI.',
    '',
    '## 🎯 이 작업의 본질',
    '',
    '단순한 "배경 이미지 추출" 이 아닙니다. **Stage 2 의 HTML 이 재구현할 요소들의 자리를 미리 감안한 베이스 이미지** 를 만드는 작업입니다.',
    '',
    '결과는 다음 두 조건을 동시 충족해야 합니다:',
    '1. 텍스트와 분리 가능한 디자인 요소가 제거된 **깨끗한 배경**',
    '2. Stage 2 의 HTML 요소 (헤드라인 · 메뉴 정보 · feature 바 · 배지 등) 가 들어갈 **자리가 메인 비주얼에 가려지지 않게 비워진** 베이스',
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
    '5. **안전 영역 메타데이터 출력** — 각 BP 별 다음 정보를 좌표(%) 로 표기',
    '   - **텍스트 안전 영역**: 헤드라인/부제/CTA 가 들어갈 위치',
    '   - **메인 비주얼 영역**: 상품 사진이 표시되는 위치 (잘리면 안 되는 영역)',
    '   - **feature 바 영역** (있는 경우): 하단 또는 측면 바 위치',
    '   (다음 Stage 2 prompt 에 그대로 활용)',
    '',
    '## 출력 이미지 권장 크기 (HiDPI 대응 · 비율은 위에 명시한 BP 비율 유지)',
    '- **Desktop**: 폭 1600~2000px (Retina 대응 · 1320 표시 영역의 ~1.5x)',
    '- **Tablet** : 폭 1024~1400px',
    '- **Mobile** : 폭  720~1080px (Retina 대응 · 390 표시 영역의 ~2x)',
    '- **포맷**: WebP / JPEG / PNG 모두 OK — admin 업로드 시 WebP 자동 변환',
    '- **용량**: 변환 후 각 5MB 이하 (admin 업로드 제한)',
    '',
    '## BP 3종 톤 일관성 의무 (필수)',
    '3개 배경 이미지는 동일한 시즌 배너의 BP 변형이므로 색감·톤이 **최대한 동일하게 보여야** 합니다.',
    '별개 이미지가 아니라 "같은 사진의 BP 자동 크롭" 처럼 보이는 게 목표.',
    'Desktop / Tablet / Mobile 의 같은 부분이 색차로 다르게 보이면 viewport 전환 시 어색합니다.',
    '',
    '- 동일한 색온도 · 화이트 밸런스 유지',
    '- 동일한 그레이딩 (예: 따뜻한 톤이면 3장 모두 같은 정도)',
    '- 동일한 채도 · 콘트라스트 · 명도',
    '- 노이즈/그레인이 있다면 동일한 강도로 적용',
    '- 동일한 그림자 방향·강도',
    '- **권장**: 3장을 별개 호출이 아니라 한 번의 작업으로 함께 생성',
    '  (각 BP 별 별도 prompt 호출 시 톤 미세 차이 발생 위험)',
    '- 운영자 검증 기준 — 3장을 나란히 놓고 봤을 때 동일한 시즌의 사진처럼 보일 것',
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
    '- 결과 3장 이미지를 admin "이미지 3종" 슬롯에 업로드',
    '- 영역 메타데이터를 **Stage 2 prompt** 에 전달하여 HTML 생성 진행 (메인 비주얼·feature 바 위치가 텍스트 배치 기준)',
  ].join('\n');
}

/* ── Stage 2 — HTML 생성 (코드 AI 용) ───────────────────────────────── */

function buildStage2Prompt(options: BuildPromptOptions): string {
  const { kind, aspectDesktop, aspectTablet, aspectMobile } = options;
  const label = KIND_LABEL[kind];

  const aspectBlock =
    aspectDesktop || aspectTablet || aspectMobile
      ? [
          '- Desktop: ' + (aspectDesktop || '(미지정)'),
          '- Tablet:  ' + (aspectTablet || '(미지정)'),
          '- Mobile:  ' + (aspectMobile || '(미지정)'),
        ].join('\n')
      : '- 운영자가 입력한 비율 (admin 의 aspect 입력)';

  return [
    `# [Stage 2 / 2] ${label} HTML 생성`,
    '',
    '추천: **Claude.ai/design** (https://claude.ai/design · Anthropic 의 디자인 특화 모드) — HTML/CSS 생성 + 라이브 미리보기 + 즉시 수정 워크플로우 우수. 코드 블록 + 시각 결과 즉시 확인 가능.',
    '',
    '대안: ChatGPT (GPT-4o / GPT-4.5) · Gemini 2.5 Pro — 시각 분석 정확도 양호.',
    '',
    '## 입력 자산 (운영자가 첨부)',
    '운영자는 다음 자산을 **모두** 이 prompt 와 함께 채팅에 업로드해야 합니다:',
    '',
    '- **원본 이미지 1장 (최우선 참고)** — Stage 1 입력과 동일한 완성된 배너 이미지.',
    '  텍스트의 폰트·크기·색·위치·효과·전체 레이아웃을 최대한 정확히 재현하는 게 본 작업의 핵심.',
    '- **Stage 1 결과 배경 이미지 3장** — Desktop / Tablet / Mobile (텍스트·요소 제거된 베이스)',
    '- **Stage 1 출력 영역 메타데이터** (텍스트로 복사 첨부)',
    '  - 텍스트 안전 영역 / 메인 비주얼 영역 / feature 바 영역 (BP 별 좌표 %)',
    '  - 이 영역 좌표가 **HTML 요소 배치의 기준** 이 됩니다',
    '',
    '## 비율',
    aspectBlock,
    '',
    '## 텍스트 내용 (운영자 입력)',
    '- 헤드라인: (운영자 입력)',
    '- 부제: (운영자 입력)',
    '- CTA 라벨: (운영자 입력)',
    '- 시즌 컨셉: (운영자 입력)',
    '',
    '## 작업 절차',
    '',
    '### 🚨 핵심 원칙 — 콘텐츠는 원본에서, 위치는 Stage 1 메타데이터에서',
    '',
    '원본 이미지와 Stage 1 결과의 레이아웃이 **다를 수 있습니다** (예: 원본 = 세로 포스터, Stage 1 desktop = 가로형). 이 경우 원본의 위치를 그대로 따르면 어색해집니다. 다음 규칙으로 분리하세요:',
    '',
    '| 영역 | 결정 기준 |',
    '| --- | --- |',
    '| 콘텐츠 내용 (텍스트 · 메뉴명 · 설명 · feature 라벨 등) | **원본 그대로 인용** (의역/생략 금지) |',
    '| 폰트 · 색 · 효과 · weight · letter-spacing | **원본 정확 모사** |',
    '| **콘텐츠 배치 위치 · 정렬** | **Stage 1 메타데이터 절대 우선** (원본 위치 그대로 따르지 말 것) |',
    '| 메인 비주얼 영역 | Stage 1 (텍스트 콘텐츠 절대 배치 금지 · 이미지가 보이는 영역) |',
    '| feature 바 영역 | Stage 1 (별 영역으로 분리 · 원본의 feature 정보 그대로) |',
    '',
    '예시:',
    '- 원본 = 세로 포스터 · 메뉴명이 상품 아래 가운데 → Stage 1 desktop = 가로형 · 텍스트 안전 영역 = 좌측 5~45%',
    '  → 메뉴명/설명을 좌측 텍스트 영역의 **하단 부분** 에 배치 (헤드라인 아래). 상품 옆/위 절대 X.',
    '- 원본 = 우상단 배지 → Stage 1 desktop = 텍스트 안전 영역이 좌측이면',
    '  → 배지를 텍스트 영역 안의 적절한 위치 (예: 우상단 작은 영역) 또는 feature 바 옆에 배치',
    '',
    '**Stage 1 메타데이터의 텍스트 안전 영역 = 모든 텍스트 (헤드라인 + 부제 + 메뉴명 + 설명 + CTA + 배지 텍스트 등) 가 들어갈 자리.** 메인 비주얼 영역에는 텍스트 절대 배치 금지.',
    '',
    '운영자 입력이 안 됐다고 원본 콘텐츠를 제거하지 마세요. 운영자 입력 = "그 영역만 시즌별 갱신 가능" 의 의미이지, "다른 영역 = 제거" 가 아닙니다.',
    '',
    '### 보존 (HTML 로 재현) — 거의 모든 것',
    '- **운영자 입력 헤드라인 · 부제 · CTA** — 원본의 해당 영역 위치에 대체',
    '- **원본의 모든 텍스트 콘텐츠** — 메뉴명 · 상품명 · 메뉴 설명 · feature 라벨 · 인증 마크 · 시리즈 라벨 · eyebrow 등',
    '  (원본 이미지에서 텍스트를 직접 읽어 HTML 에 그대로 입력. 의역/생략 금지.)',
    '- **원본의 디자인 요소** — 배지 (원형 라벨) · 라인 · 도형 · 아이콘 · 패턴 등',
    '  (CSS · inline SVG 로 재현)',
    '',
    '### 제거 — 거의 없음',
    '- 너무 미세한 노이즈/그레인/패턴 디테일 정도만 단순화. 가능한 충실 재현이 목표.',
    '',
    '### 폰트 정확 모사 (임의 스타일 추가 절대 금지)',
    '- 원본 폰트가 sans (직선체) → 결과도 sans · **italic / cursive / oblique 절대 금지**',
    '- 원본 폰트가 bold → 결과도 동일 weight',
    '- 원본 letter-spacing · 줄간격 그대로',
    '- "스타일리시" · "고급스러운" · "감각적인" 같은 주관 해석으로 임의 효과 (italic / gradient / shadow / 회전 등) 추가 금지',
    '- Google Fonts 에서 원본과 가장 시각적으로 일치하는 폰트 선택',
    '  - 한글 sans → `Noto Sans KR` / `Pretendard` (안전한 default)',
    '  - 영문 sans bold → `Inter` / `Manrope` / `Noto Sans`',
    '  - serif → `Noto Serif KR` / `Playfair Display` 등',
    '- 폰트 추정 정확도 = 결과 품질의 가장 큰 변수',
    '',
    '### 작은 디테일도 큰 요소와 동일 정밀도로 분석',
    '',
    '헤드라인 같은 큰 영역만 신경 쓰지 말고, 배지·아이콘·장식 도형·라인·소형 라벨 등 작은 영역도 같은 정밀도로 측정·재현합니다. 운영자가 결과를 1:1 비교했을 때 작은 요소의 차이가 가장 눈에 띕니다.',
    '',
    '각 디테일 요소별 측정 항목:',
    '- **size**: width / height (px 또는 이미지 폭 대비 %)',
    '- **border**: 두께 (1px / 1.5px / 2px) · 색 · 스타일 (solid / dashed)',
    '- **shape**: 원형 (`border-radius: 50%`) / 둥근 사각 / 다각형 / 자유 형태',
    '- **fill / background**: hex 색 · 투명도 · gradient (있는 경우)',
    '- **shadow**: offset · blur · color · opacity',
    '- **내부 텍스트**: 폰트 · 사이즈 · weight · letter-spacing · 색 · 정렬 · 줄 수',
    '- **위치**: 컨테이너 기준 absolute 좌표 (top/right/bottom/left %)',
    '',
    '### 복잡한 도형 = inline SVG 권장 (CSS 보다 정밀)',
    '',
    '원형 outline + 안 텍스트 · 마스킹 도형 · 비정형 패턴 등 **CSS 로 표현하기 어려운 정밀 도형은 inline `<svg>` 로 직접 작성**:',
    '',
    '```html',
    '<svg viewBox="0 0 100 100" width="84" height="84">',
    '  <circle cx="50" cy="50" r="48" fill="none" stroke="#xxx" stroke-width="2"/>',
    '  <text x="50" y="50" text-anchor="middle" font-family="..." font-size="13" fill="#xxx">텍스트</text>',
    '</svg>',
    '```',
    '',
    '- 단순 표준 아이콘 → 무료 SVG 라이브러리 (Lucide / Heroicons 등) 답습',
    '- brand-specific 또는 비표준 도형 → inline `<svg>` 직접 작성',
    '- CSS border-radius + 텍스트 결합으로 만들 수 있어도, 정밀도가 부족하면 SVG 로 전환',
    '',
    '### 작업 단계',
    '1. **원본 이미지에서 콘텐츠 수집** — 모든 텍스트 (헤드라인 · 부제 · 메뉴명 · 설명 · feature 라벨 · 배지 텍스트 등) 를 그대로 읽기',
    '2. **원본 스타일 분석** — 각 텍스트 영역의 폰트 · 색 · 사이즈 · weight · letter-spacing · 정렬 · 효과',
    '3. **Stage 1 메타데이터 확인** — 각 BP 별 텍스트 안전 영역 / 메인 비주얼 영역 / feature 바 영역 좌표',
    '4. **콘텐츠를 메타데이터 영역에 재배치** — 원본 콘텐츠를 Stage 1 의 새 레이아웃에 적응',
    '   - 모든 텍스트 (헤드라인 + 부제 + 메뉴명 + 설명 + 배지 등) = 텍스트 안전 영역 안에 배치',
    '   - 원본의 위계 (헤드라인 위 → 부제 아래 → 메뉴명/설명 더 아래) 는 답습',
    '   - 메인 비주얼 영역 = 텍스트 절대 X (이미지가 차지)',
    '   - feature 바 영역 = 원본의 feature 정보 (아이콘 + 라벨) 그대로 별 영역으로',
    '5. **HTML 구조 작성** — 의미 단위 semantic 태그 (`<h1>` · `<h2>` · `<p>` · `<ul>` 등)',
    '6. **운영자 입력 대체** — 원본 헤드라인을 운영자 입력 헤드라인으로 (스타일은 원본 그대로)',
    '7. **CSS 작성** — Stage 1 메타데이터 좌표 그대로 absolute positioning + 3 BP 명시 분기',
    '8. **아이콘은 무료 SVG 라이브러리에서 가져오기** — inline `<svg>` 로 박을 것 (CDN link 비추천 · sandbox CSP 차단 risk). 영역별 추천:',
    '   - **Lucide** (https://lucide.dev) — modern · clean · 가장 추천 default',
    '   - **Heroicons** (https://heroicons.com) — Tailwind 팀 · outline + solid 2종',
    '   - **Phosphor Icons** (https://phosphoricons.com) — 다양한 weight 옵션',
    '   - **Tabler Icons** (https://tabler.io/icons) — 4000+ 종 · stroke-based',
    '   - **Material Symbols** (https://fonts.google.com/icons) — Google · 풍부한 카테고리',
    '   - **SVG Repo** (https://www.svgrepo.com) — 500K+ 카탈로그 · 다양한 스타일',
    '   라이센스 모두 MIT 또는 CC0 (상업 사용 가능). `currentColor` 또는 명시 hex 로 색 통제.',
    '9. **BP 별 명시 분기** — Desktop / Tablet / Mobile 각 viewport 의 콘텐츠 배치/크기/정렬 별도 조정',
    '10. **검증** — 결과를 브라우저에서 열었을 때 콘텐츠는 원본 그대로 + 레이아웃은 Stage 1 메타데이터 그대로',
    '',
    '## 🟢 DO / 🔴 DON\'T 예시',
    '',
    '🟢 **DO** — 원본의 모든 텍스트 (헤드라인 + 메뉴명 + 설명 + feature 라벨 등) 를 그대로 인용',
    '🟢 **DO** — 텍스트 콘텐츠 배치 위치는 **Stage 1 메타데이터의 텍스트 안전 영역 안**',
    '🟢 **DO** — 원본 위계 (헤드라인 위 → 부제 아래 → 메뉴/설명 더 아래) 답습',
    '🟢 **DO** — 메인 비주얼 영역 위에 텍스트 절대 배치 X (이미지가 보이게)',
    '🟢 **DO** — feature 바는 별 영역으로 분리 (원본 위치 유지 · 하단 가로 바 등)',
    '🟢 **DO** — 원본 폰트 정확 모사 (sans → sans · italic 추가 X)',
    '🟢 **DO** — 운영자 입력 헤드라인을 원본 헤드라인 자리 (Stage 1 메타데이터 상단) 에 대체',
    '',
    '🔴 **DON\'T** — 원본 폰트가 sans 인데 italic / cursive / oblique 사용',
    '🔴 **DON\'T** — 원본 메뉴 정보 / feature 정보 / 인증 마크를 제거',
    '🔴 **DON\'T** — **원본의 위치 그대로 재현** (Stage 1 레이아웃이 다른 경우 어색해짐) — 위치는 Stage 1 메타데이터 우선',
    '🔴 **DON\'T** — 메인 비주얼 위에 텍스트 배치 (예: 상품 위에 메뉴 설명 박기)',
    '🔴 **DON\'T** — "고급스러운" / "스타일리시" 같은 주관 해석으로 디자인 변경',
    '🔴 **DON\'T** — 원본에 없는 텍스트를 임의로 창작',
    '🔴 **DON\'T** — gradient · 그림자 · 회전 등 효과를 원본에 없는데 임의로 추가',
    '🔴 **DON\'T** — 운영자 입력 미작성 = 원본 콘텐츠 제거 로 해석',
    '',
    '→ 결과 = **콘텐츠는 원본 그대로, 레이아웃은 Stage 1 메타데이터 그대로** 인 HTML. 운영자 헤드라인/부제/CTA 만 그 영역에서 시즌별 갱신 가능.',
    '',
    '## 출력 조건',
    '- 단일 풀 HTML (`<!DOCTYPE html>` + `<html>` + `<head>` + `<body>`)',
    '- `<iframe sandbox srcDoc>` 에 임베드됨 → script 자동 차단',
    '- 이미지는 다음 placeholder 사용 (서버가 자동 치환):',
    '  - `{{IMAGE_DESKTOP}}` / `{{IMAGE_TABLET}}` / `{{IMAGE_MOBILE}}` / `{{IMAGE_ALT}}`',
    '- **미디어쿼리 — 3 BP 모두 명시 분기 의무**:',
    '  - Desktop (기본 / `min-width: 1024px`)',
    '  - Tablet (`@media (max-width: 1023px) and (min-width: 768px)`)',
    '  - Mobile (`@media (max-width: 767px)`)',
    '- 폰트: 시즌 컨셉에 맞춰 자유 선택 (Google Fonts `<link>` 직접 import 가능)',
    '- 디자인 자유 — 사선 텍스트 · 마스킹 · 그라데이션 · 텍스처 오버레이 등 자유',
    '- a11y: 의미 있는 텍스트는 `<h1>/<h2>/<p>` 등 semantic 태그 사용',
    '- 외부 fetch / cookie 접근 / window 조작 안 됨 (sandbox 차단)',
    '',
    '## 출력 형식',
    '- 풀 HTML 코드 블록 1개만 출력 (` ```html ` 으로 감싸기)',
    '- 코드 블록 외부 설명은 운영자가 무시함 — 코드 안에 모든 결정 사항이 들어가야 함',
    '- 운영자가 admin "텍스트 붙여넣기" 또는 .html 파일로 저장 후 업로드',
  ].join('\n');
}
