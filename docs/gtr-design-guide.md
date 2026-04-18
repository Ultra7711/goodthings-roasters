# GTR Design Guide — Good Things Roasters

> 모던한 정갈함 속의 따뜻함.
> 매장 사진 44장 분석 + 리서치 4트랙 결과를 기반으로 만든 디자인 시스템 가이드.
>
> **시각 버전:** `gtr-design-guide.html`
> **레이아웃 와이어프레임:** `layout-wireframe-v2.md` / `layout-wireframe-v2.html`
> **UX 라이팅:** `ux-writing-v1.md`

- v2.0 — 2026.04.08 (실제 구현 토큰 체계 반영)
- Desktop 1440px 기준
- Inter + Pretendard

---

## Part 0: Brand Essence & UX Principles

### 브랜드 에센스

**"good things, take time."**

좋은 것에는 시간이 필요합니다.
빠르게 만들 수 있어도, 그렇게 하지 않습니다.

### 차별점

| # | 차별점 | 설명 |
|---|--------|------|
| 1 | MANO 추출 | 미래적 추출 장비, 일반 머신과 다른 구조·맛 |
| 2 | 자체 베이커리 | 매일 아침 매장에서 직접 굽는 빵 (킬러: 버터떡) |
| 3 | 공간 경험 | 화이트·메탈·우드의 정갈한 인테리어 |
| 4 | 온라인 카페 메뉴 | 경쟁사에 없는 메뉴 페이지 |
| 5 | 풍미 노트 시각화 | 레이더 차트 + 로스팅 스테이지 |

### 전환 목표

| 순위 | 목표 | 핵심 장치 |
|------|------|-----------|
| 1차 | 매장 방문 유도 | 히어로 영상, 카페 메뉴, Come Visit Us |
| 2차 | 브랜드 인지·충성도 | The Story, Good Days |
| 3차 | 원두 온라인 구매 | Shop, 상품 상세, 장바구니 |
| 4차 | 구독(정기배송) 전환 | 상품 상세 구독 탭, 마이페이지 |

### UX 설계 원칙

1. **보여주되, 설명하지 않는다** — 이미지와 영상이 먼저, 텍스트는 보조
2. **여유로운 페이싱** — 여백이 콘텐츠보다 많아도 괜찮다
3. **감각의 트리거** — "가보고 싶다"를 만드는 시각 경험
4. **정보의 계층화** — 1차 정보만 노출, 나머지는 인터랙션으로
5. **구매 허들 최소화** — 최소 클릭, 게스트 주문 지원
6. **매장 방문 = 궁극의 CTA** — 온라인의 목적은 오프라인 연결
7. **디테일이 신뢰를 만든다** — 미세한 모션, 정돈된 타이포

### 이미지 톤 가이드

| 항목 | DO | DON'T |
|------|-----|-------|
| 조명 | 자연광 기반, 부드러운 그림자 | 형광등, 과도한 플래시 |
| 색온도 | 약간 따뜻한 중립 | 차가운 블루 톤 |
| 채도 | 낮은~중간, 자연스러운 | HDR, 과채도 |
| 인물 | 최소화, 공간과 제품 중심 | 인물 클로즈업 |
| 배경 | 실제 매장 공간 or 깨끗한 단색 | 복잡한 배경 |

### 모션 & 인터랙션

| 단계 | 기법 | 비고 |
|------|------|------|
| 기본 | 스크롤 리빌, Stagger, Blur→Sharp | 현재 구현 |
| 고급 | 스크롤 연동 동적 블러, opacity/scale | Next.js 전환 시 |

**안티패턴:** 패럴랙스, 3D tilt, 네온 글로우, 바운스 이징, 빠른 자동 캐러셀

---

## Part 1: Color System

매장 오프라인 공간에서 추출한 웜 뉴트럴 톤을 디지털로 번역합니다.
순백·순흑이 아닌 따뜻한 뉘앙스가 핵심입니다.

### Background

| 이름 | Hex | CSS Token | 용도 |
|------|-----|-----------|------|
| Warm White | `#FAFAF8` | `--color-background-primary` | 메인 배경 |
| Warm Gray 50 | `#F5F3F0` | `--color-background-secondary` | 섹션 교차, 카드 배경 |
| Warm Gray 100 | `#ECEAE6` | `--color-background-tertiary` | 입력 필드, 깊은 카드 |
| Pure White | `#FFFFFF` | `--color-background-elevated` | 모달, 드롭다운 |

### Text

| 이름 | Hex | CSS Token | 용도 | WCAG 대비 |
|------|-----|-----------|------|-----------|
| Warm Black | `#1C1B19` | `--color-text-primary` | 헤드라인, 본문 | 16.8:1 |
| Warm Gray 600 | `#6B6863` | `--color-text-secondary` | 설명문, 캡션 | 5.2:1 |
| Warm Gray 400 | `#9C9890` | `--color-text-tertiary` | 힌트, placeholder | 3.1:1 |
| Warm White | `#FAFAF8` | `--color-text-inverse` | 다크 배경 위 텍스트 | — |
| Disabled | `#BBBBBB` | `--color-text-disabled` | 비활성 텍스트 | — |

### Dark Background Text (on-dark)

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--on-dark-primary` | `rgba(250,250,248,.95)` | 헤딩, 강조 |
| `--on-dark-secondary` | `rgba(250,250,248,.75)` | 본문, 서브 텍스트 |
| `--on-dark-tertiary` | `rgba(250,250,248,.55)` | 보조, 태그 |
| `--on-dark-muted` | `rgba(255,255,255,.42)` | 푸터 레이블, 소형 텍스트 |

### Icon

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--color-icon-default` | `var(--color-text-tertiary)` | 아이콘 기본 컬러 |

### Surface

| 이름 | Hex | CSS Token | 용도 |
|------|-----|-----------|------|
| Stone Gray | `#4A4845` | `--color-surface-stone` | 푸터, 다크 섹션 |
| Warm Sand | `#E8E2DA` | `--color-surface-warm` | 부드러운 표면 |

### Lines & Borders

| 이름 | 값 | CSS Token | 용도 |
|------|-----|-----------|------|
| Hairline | `rgba(28,27,25,.06)` | `--color-border-hairline` | 카드 내부, 미세 구분 |
| Primary | `rgba(28,27,25,.12)` | `--color-border-primary` | 카드 테두리, 인풋 |
| Strong | `rgba(28,27,25,.20)` | `--color-border-strong` | 섹션 구분선 |

### Interactive (CTA)

| 상태 | Hex | CSS Token |
|------|-----|-----------|
| Default | `#1C1B19` | `--color-btn-primary-bg` |
| Hover | `#2E2D2A` | `--color-btn-primary-bg-hover` |
| Active | `#0F0E0D` | `--color-btn-primary-bg-active` |
| Focus Ring | `rgba(74,72,69,.40)` | `--color-focus-ring` |

### System Feedback

| 이름 | Hex | CSS Token |
|------|-----|-----------|
| Success / Olive | `#5C7A4B` | `--color-success` |
| Error / Warm Red | `#C4554E` | `--color-error` |
| Info / Warm Blue | `#4A6B8A` | `--color-info` |
| Warning / Amber | `#B8943F` | `--color-warning` |
| Accent / Oak Brown | `#7A6B52` | `--color-accent-gold` |

### Extended Palettes

코어 팔레트를 90% 사용하고, 아래는 "양념"으로만 사용합니다.

**Stone** — `#4A4845` → `#6B6863` → `#9C9890` → `#D9D6D2`
**Oak** — `#7A6B52` → `#A08B6D` → `#C4A882` → `#E8DFD2`
**Espresso** — `#3C2F24` → `#5E4B3A` → `#8B7355` → `#D4C8B8`
**Olive** — `#4A5E3E` → `#6B7D5E` → `#8FA07E` → `#D5DED0`
**Cream** — `#B8943F` → `#D4B86A` → `#E8D49C` → `#F5EFE0`

### Gradients & Overlays

| 이름 | 값 | 용도 |
|------|-----|------|
| Hero Overlay | `rgba(28,27,25, .15→.40)` 하향 | 히어로 비디오 위 |
| Card Bottom | `rgba(28,27,25, .60→0)` 상향 | 카드 하단 텍스트 |
| Gallery Hover | `rgba(28,27,25, .30)` 단색 | 갤러리 호버 |

---

## Part 2: Typography

Inter(영문) + Pretendard(한글). 자간은 본문에서 기본값, 라벨·CTA에서 넓게.

### Font Stack

| 토큰 | 값 |
|------|-----|
| `--font-en` | `'Inter', sans-serif` |
| `--font-kr` | `'Pretendard Variable', 'Pretendard', sans-serif` |

### Type Scale

| 레벨 | 토큰 | Size | Weight | 용도 |
|------|------|------|--------|------|
| Display | `--type-display-size` | 48px | 400 | 히어로 슬로건 |
| H1 | `--type-h1-size` | 36px | 300 | 페이지 타이틀 |
| H2 | `--type-h2-size` | 32px | 300 | 섹션 헤딩 |
| H3 | `--type-h3-size` | 24px | 400 | 서브 헤딩, 블록 타이틀 |
| Price L | `--type-price-l-size` | 32px | 500 | 대형 가격 |
| Price M | `--type-price-m-size` | 20px | 600 | 중형 가격 |
| Heading M | `--type-heading-m-size` | 18px | 500 | 섹션 타이틀 (Recipe Guide 등) |
| Body L | `--type-body-l-size` | 18px | 500 | 강조 본문 |
| Heading S | `--type-heading-s-size` | 16px | 500 | 카드 타이틀 |
| Input | `--type-input-size` | 16px | 400 | 폼 입력 |
| Body M | `--type-body-m-size` | 15px | 400 | 기본 본문 |
| Body UI | `--type-body-ui-size` | 14px | 400 | UI 텍스트 |
| Body S | `--type-body-s-size` | 13px | 400 | 캡션, 보조 |
| Caption | `--type-caption-size` | 12px | — | 메타 정보, 푸터 |
| Label | `--type-label-size` | 11px | 600 | 배지, 태그 |

### Line Height

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--lh-tight` | 1.2 | 헤딩, 타이틀 |
| `--lh-snug` | 1.35 | 서브헤딩, 카드 |
| `--lh-normal` | 1.5 | 본문 기본 |
| `--lh-relaxed` | 1.7 | 읽기용 본문 |

### 영문 표기 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| 브랜드명 | Title Case | Good Things Roasters |
| 한국어 브랜드명 | 고정 | 굳띵즈 |
| 슬로건 | all lowercase | good things, take time |
| 섹션 라벨 | ALL CAPS (1~2단어) | MENU, SHOP, BEANS |
| CTA 영문 | Sentence case | Shop now, View all |
| 네비게이션 | Title Case | The Story, Good Days |

---

## Part 3: Spacing & Grid

여백이 콘텐츠보다 많아도 괜찮습니다. 빈 공간 자체가 "시간을 들였다"는 느낌.

### Spacing Scale (4px 기반)

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 56 · 64 · 80 · 96 · 120`

### Breakpoints

| 구간 | 너비 | 콘텐츠 max | 패딩 |
|------|------|-----------|------|
| Desktop (기준) | 1440px | 1320px | 60px |
| Laptop | 1024px | 944px | 40px |
| Tablet | 768px | 688px | 40px |
| Mobile | 360px | 328px | 16px |

> 반응형은 Next.js 전환 시 적용 예정. 현재 프로토타입은 Desktop 기준.

### Common Heights

| 요소 | 높이 | 비고 |
|------|------|------|
| 어나운스먼트 바 | 36px | bg `#1C1B19`, text `#FAFAF8` |
| 글로벌 헤더 | 60px | 글래스모피즘 (아래 참조) |
| 서브 페이지 헤더 | 60px | 글래스모피즘 (아래 참조) |
| 검색 패널 | 60px | 헤더 하단 인라인 |
| CTA 버튼 | 48px | Primary / Secondary 통일 |
| 탭 컴포넌트 | 48px | `--tab-height` |
| 닫기(X) 버튼 | 44px | `--close-btn-size` |

### Header Glassmorphism

헤더는 솔리드 배경이 아닌 **반투명 + 블러(글래스모피즘)** 처리.
콘텐츠 영역의 `data-header-theme` 속성에 따라 라이트 ↔ 다크를 스크롤 기반으로 동적 전환.

#### 라이트 모드 (기본)

| 속성 | 값 |
|------|------|
| `background` | `rgba(250, 250, 248, .72)` |
| `backdrop-filter` | `blur(16px)` |
| `border-bottom` | `.5px solid rgba(0, 0, 0, .04)` |
| `box-shadow` | `0 1px 0 rgba(255, 255, 255, .08) inset` |

#### 다크 모드 (스크롤 전환)

| 속성 | 값 |
|------|------|
| `background` | `rgba(28, 27, 25, .75)` |
| `backdrop-filter` | `blur(16px)` |
| `border-bottom` | `.5px solid rgba(255, 255, 255, .06)` |

#### 변형

| 변형 | 차이점 |
|------|--------|
| 장바구니 헤더 | `rgba(250, 250, 248, .92)` — 92% 불투명 |
| 검색 패널 | `rgba(255, 255, 255, .72)` + `blur(16px)` |
| 검색 딤 오버레이 | `rgba(0, 0, 0, .35)` + `blur(4px)` |

#### 테마 전환

- 각 섹션에 `data-header-theme="dark"` 또는 `"light"` 속성 부여
- 스크롤 시 헤더 중앙 지점 기준 섹션 테마값을 읽어 `.hdr-dark` 클래스 토글
- 전환 트랜지션: `background 700ms ease, border-color 700ms ease, box-shadow 700ms ease`
- 메인 페이지 기본값: `dark` / 서브 페이지 기본값: `light`

---

## Part 4: Motion

### Duration Tokens

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--duration-hover` | 200ms | hover 인터랙션 |
| `--duration-transition` | 300ms | 일반 전환 (opacity, color) |
| `--duration-drawer` | 350ms | 드로어·아코디언 슬라이드 |
| `--duration-zoom` | 400ms | 이미지 줌 |
| `--duration-fade` | 600ms | 진입 fade-in |
| `--duration-slide` | 700ms | 진입 slide-up |

### Easing Tokens

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--ease-linear` | `linear` | 색상·opacity 선형 전환 |
| `--ease-default` | `ease-out` | 기본값 |
| `--ease-drawer` | `cubic-bezier(.25,.46,.45,.94)` | 드로어 전용 |
| `--ease-spring` | `cubic-bezier(.16,1,.3,1)` | 버튼/카드 hover, 페이지 진입 |

### 예외 (토큰화하지 않는 값)

아래 값들은 개별 용도가 명확하여 토큰으로 추상화하지 않습니다.

| 값 | 용도 |
|-----|------|
| 700ms | 스토리 페이지 헤더 테마 전환 |
| .5s | spring 애니메이션 조합 |
| .8s | 로스팅 바 채우기 |
| .15s | 마이크로 피드백 (버튼 배경) |
| 1.2s | 카드/이미지 줌 (느린 호버) |

---

## Part 5: Z-Index

8단계 계층 시스템. 하드코딩 금지, 반드시 토큰 사용.

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--z-sticky` | 50 | sticky 헤더 |
| `--z-page` | 100 | 풀스크린 서브 페이지 (JS 동적 조정) |
| `--z-float` | 150 | 플로팅 버튼 |
| `--z-drawer` | 200 | 카트 드로어 (bg: 200, panel: 201) |
| `--z-modal` | 300 | 검색 오버레이 |
| `--z-lightbox` | 350 | 라이트박스 (전체화면 이미지 뷰어) |
| `--z-top` | 400 | 툴팁, 토스트 |
| `--z-dev` | 9000 | DEV 전용 |

---

## Part 6: Component Tokens

### CTA Button

| 토큰 | 값 | 비고 |
|------|-----|------|
| `--cta-btn-font-size` | `var(--type-body-m-size)` | 15px |
| `--cta-btn-font-weight` | 500 | |
| `--cta-btn-letter-spacing` | .04em | |
| `--cta-btn-padding-x` | 25px | Secondary |
| `--cta-btn-padding-x-primary` | 50px | Primary |
| 높이 | 48px | 모든 CTA 통일 |

### Tab

| 토큰 | 값 |
|------|-----|
| `--tab-height` | 48px |
| `--tab-font-family` | `var(--font-en)` |
| `--tab-font-size` | `var(--type-body-s-size)` |
| `--tab-font-weight` | 400 (활성: 500) |
| `--tab-letter-spacing` | .04em |
| `--tab-color` | `var(--color-text-secondary)` |
| `--tab-color-active` | `var(--color-text-primary)` |

### Text Link Button

| 토큰 | 값 |
|------|-----|
| `--text-link-font-size` | `var(--type-body-s-size)` |
| `--text-link-font-weight` | 500 |
| `--text-link-color` | `var(--color-text-primary)` |
| `--text-link-border` | `.5px solid var(--color-text-primary)` |
| `--text-link-opacity-hover` | .5 |

**Subtle variant** — 비권장 액션 (삭제 등)용. 기본 약하게, 호버 시 primary.

### Close (X) Button

4가지 변형: Primary Dark / Primary Light / Secondary Dark / Secondary Light

| 변형 | 배경 | 아이콘 컬러 | 호버 |
|------|------|-----------|------|
| Primary Dark | `rgba(0,0,0,.35)` | `#FAFAF8` | bg `rgba(0,0,0,.85)` |
| Primary Light | `rgba(0,0,0,.07)` | `#1C1B19` | bg `rgba(0,0,0,.85)`, color `#FAFAF8` |
| Secondary Dark | 없음 | `rgba(255,255,255,.5)` | color `#FAFAF8` |
| Secondary Light | 없음 | `rgba(17,17,17,.25)` | color `#1C1B19` |

### Arrow Button

Primary(100px SVG) / Secondary(40px SVG), 각각 dark/light 변형.

### Icon

- 모든 아이콘은 inline SVG + `stroke="currentColor"` 방식
- 기본 컬러: `var(--color-icon-default)`
- 텍스트 문자(›, +, −)로 아이콘 대체 금지 — 반드시 SVG 사용

---

## Part 7: UX Writing (요약)

> **상세 가이드:** `ux-writing-v1.md` (전체 페이지별 카피·필드 단위 정의)

### Voice Principles

| 항목 | 규칙 |
|------|------|
| 어조 | 차분하고 자신감 있는, 과시하지 않는 |
| 문장 | 짧고 여운이 있는 |
| 영문 | 소문자 선호, 간결 |
| 한글 | 존댓말, 부드러운 |
| 안티패턴 | "최고급!", "한정 수량!", "지금 바로!" |

### CTA 톤

| 타입 | 패턴 | 예시 |
|------|------|------|
| Primary | "~하기" | 장바구니에 담기 · 결제하기 |
| Secondary | 보조 액션 | 쇼핑 계속하기 · 모든 상품 보기 |
| Link | 인라인 | 비밀번호를 잊으셨나요? |

> "~하세요" 지양. 급한 톤 금지.

---

## Part 8: User Flows

**Flow A: 매장 방문 유도 (1차 전환)**
히어로 영상 → 시즌 배너 → 카페 메뉴 카드 → 카페 메뉴 페이지 → Come Visit Us

**Flow B: 원두 구매 (2차 전환)**
상품 스크롤 → Shop → 상품 상세 → 장바구니 → 결제 → 주문 완료

**Flow C: 구독 전환 (3차 전환)**
상품 상세 → 정기배송 탭 → 배송 주기 선택 → 결제 (구독)

**Flow D: 브랜드 탐색**
히어로 → 스토리 섹션 → The Story → 갤러리

**Flow E: 회원 관리**
로그인 아이콘 → 로그인/회원가입 → 마이페이지

**Flow F: 검색**
검색 아이콘 → 검색 오버레이 → 검색 결과 → 상품/메뉴

---

*Design Guide v2.0 — 2026.04.08*
*실제 구현 토큰 체계 기준 · 브랜드 에센스 통합*
*good things, take time.*
