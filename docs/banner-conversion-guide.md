# 배너 데모 HTML → production HTML 변환 가이드

> **위치**: `docs/banner-conversion-guide.md` (git tracked · 단일 SoT)
> **적용**: signature chapter · cafe-events 배너 양쪽 동일 모델
> **갱신 이력**: S237 iframe srcDoc 모델 도입 → S239 container query + cqw fluid 전환 → S240 폰트 토큰 정합 (Pretendard / Inter) + responsive 4 BP 양 끝점 모델 → S246 LQIP base64 dataURL placeholder (`{{IMAGE_BLUR_*}}`) + inline style 적용

GoodThings Roasters 의 운영자 데모 HTML (`*_responsive.html`) 을 **iframe 모델 production HTML** (`*_production.html`) 로 변환하는 작업 명세.

---

## 입력 / 출력

**입력** — 디자이너 데모 (`*_responsive.html`)
- `<body>` 안에 **4 BP section stacked — fluid scaling 양 끝점 모델** (S240 도입):
  - `.landscape-max-wrap` — 가로형 최대 (1440 = production clamp 가로형 max)
  - `.landscape-min-wrap` — 가로형 최소 (768 = production clamp 가로형 min)
  - `.portrait-max-wrap` — 세로형 최대 (767 = production clamp 세로형 max)
  - `.portrait-min-wrap` — 세로형 최소 (360 = production clamp 세로형 min)
- **이미지 참조는 2장만**: 가로형 (`*_desktop.png`) · 세로형 (`*_mobile.png`)
  - 가로형 max + min section 모두 `*_desktop.png` 재사용
  - 세로형 max + min section 모두 `*_mobile.png` 재사용
  - AI prompt 출력 = 2장 (Desktop · Mobile) 과 1:1 정합 — 별도 tablet/mobile-min 이미지 생성 불필요
- section 마다 `<p class="label">🖥 가로형 최대 — 1440px</p>` 같은 메타 라벨
- `body { padding: 40px 20px; gap: 48px; background: #f5f0ea; }` 같은 stacked 데모 레이아웃
- `.banner-wrap { border-radius: 12px; box-shadow: ...; }` 같은 section 박스 분리
- 폰트/패딩 등은 **고정 px** — 각 section 의 값이 곧 production clamp 식의 양 끝점 (디자이너 결정 영역)

**디자이너 작업 의미**: 가로형/세로형 각각의 max + min 양 끝점에서 직접 시각 검증 후 폰트/패딩값 결정. production clamp 식이 그 사이를 fluid 보간하므로 중간 viewport (예: 1024 · 500 등) 는 자동 적정값.

**출력** — production HTML (`*_production.html`)
- `<body>` 안에 단일 `.banner-wrap` + **container query 분기** 로 BP 별 콘텐츠 자동 분기
- 폰트/패딩 등은 **`clamp(min, intercept + slope·cqw, max)` fluid** — responsive 의 BP 별 px 값이 양 끝점
- `<img class="bg bg-desktop|bg-tablet|bg-mobile" src="{{IMAGE_DESKTOP|TABLET|MOBILE}}" alt="{{IMAGE_ALT}}">`
- 메타 라벨 · stacked 레이아웃 · 박스 분리 · viewport meta 모두 제거
- iframe 모델 (`sandbox="allow-same-origin"` + `srcDoc`) 안에서 동작

---

## 왜 container query + cqw 인가 (S239 전환 사유)

iframe srcDoc 안의 viewport 는 외부 wrapper width 와 미세하게 일치하지 않음 (스크롤바 · about:srcdoc · iframe quirk · padding 영향). 결과: `@media (max-width: 767px)` 같은 viewport 기반 분기가 외부 wrapper 분기와 어긋나면서 BP 경계에서 **레이아웃 mismatch** (가로형 ↔ 세로형 전환 지점에서 frame 가로 + mobile 이미지 동시 노출 등) 발생.

해결: **외부 wrapper (`.sig-bleed` / `.ev-banner-bleed`) + iframe 안 `.banner-wrap` 양쪽 모두 container** 로 등록 → 둘 다 외부 wrapper width 기준 분기 → 항상 동시 매치 → mismatch 0.

```
[Main Page]
└─ .sig-bleed / .ev-banner-bleed  ← container-type: inline-size (외부 등록)
   └─ <iframe srcDoc=...>          ← 외부 container width 가 iframe width = inner container width
      └─ <html>
         └─ .banner-wrap            ← container-type: inline-size (내부 등록)
            └─ @container (max-width: 767px) { ... }
```

---

## 시스템 컨텍스트

### 외부 wrapper (Next.js 측 · 변경 금지 — 이미 정합 완료)

**signature**: `SignatureChapterView.tsx` 의 inline `<style>` + `.sig-bleed` CSS

```css
.sig-bleed {
  container-type: inline-size;  /* S239 — 외부 wrapper container 등록 */
  max-width: 1440px;
  margin: 0 auto;
  padding: 0 60px;
  box-sizing: border-box;
}

/* aspect-ratio 분기 — props 로 받은 BP 별 비율 주입 */
.sig-iframe { height: auto; aspect-ratio: ${aspectDesktop}; }
@container (max-width: 1023px) { .sig-iframe { aspect-ratio: ${aspectTablet}; } }
@container (max-width: 767px)  { .sig-iframe { aspect-ratio: ${aspectMobile}; } }
```

**cafe-events**: `EventBanner.tsx` 의 inline `<style>` + `.ev-banner-bleed` CSS — 동일 패턴.

| viewport (= 외부 wrapper width) | iframe aspect | banner-wrap 안 콘텐츠 |
|---|---|---|
| `>= 1024px` | `aspect_desktop` (admin 자동 측정) | desktop section 표시 (`.bg-desktop` display block) |
| `768~1023px` | `aspect_tablet` (admin 자동 측정) | tablet section 표시 (`.bg-tablet` display block) |
| `< 768px`  | `aspect_mobile` (admin 자동 측정) | mobile section 표시 (`.bg-mobile` display block) |

### placeholder 치환 키 (정규식 `\{\{\s*KEY\s*\}\}` global replace)

- `{{IMAGE_DESKTOP}}` → `image_path_desktop` URL
- `{{IMAGE_TABLET}}`  → `image_path_tablet` URL (빈 값 시 desktop fallback)
- `{{IMAGE_MOBILE}}`  → `image_path_mobile` URL (빈 값 시 desktop fallback)
- `{{IMAGE_ALT}}`     → `image_alt` 값
- `{{IMAGE_BLUR_DESKTOP}}` → `image_blur_desktop` base64 LQIP dataURL (S246 · 068)
- `{{IMAGE_BLUR_TABLET}}`  → `image_blur_tablet` (빈 값 시 desktop blur fallback)
- `{{IMAGE_BLUR_MOBILE}}`  → `image_blur_mobile` (빈 값 시 desktop blur fallback)

### sandbox 제약

- `allow-same-origin` 만 허용 → `<script>` 동작 안 함 (외부 폰트/CSS/SVG OK)
- `<body>` background 는 `transparent` — 외부 sand bg (`var(--color-surface-warm)`) 와 융합

### responsive aspect-ratio = admin 입력 SoT 일치 의무

운영자가 admin 폼에 입력하는 BP 별 aspect_ratio (= 이미지 자동 측정값) 가 **SoT**. 디자이너 responsive.html 의 `.desktop-wrap { aspect-ratio: X/Y }` 등은 이 SoT 와 정확히 일치해야 production 변환 reference 가 정합. 불일치 시:
- 디자이너가 본 시각 데모와 실 노출 비율이 다름
- production 변환된 텍스트/요소 위치가 어긋남
- 안전 영역 가이드가 부정확해짐

→ 디자이너에게 운영자 admin 입력 비율 (또는 실제 이미지 dimensions) 을 명시적으로 전달. responsive.html 작성 전에 합의.

---

## 변환 규칙

### 1. `<head>` 기본 reset

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; overflow: hidden; }
body {
  font-family: var(--font-kr);  /* ← §7 폰트 시스템 참조 */
  background: transparent;       /* ← 외부 sand bg 융합 핵심 */
}

:root {
  --font-en: 'Inter', sans-serif;
  --font-kr: 'Pretendard Variable', 'Pretendard', sans-serif;
  /* …color tokens… */
}
```

**금지**:
- ❌ `<meta name="viewport" content="width=device-width, initial-scale=1.0">` — production 은 viewport meta 불필요 (외부 container 가 width 결정)
- ❌ `body { background: #f5f0ea }` 같은 명시적 bg (외부 bg 와 분리감)
- ❌ `body { padding: 40px 20px; gap: 48px; }` (stacked 데모 레이아웃 잔존)

### 2. 내부 `.banner-wrap` container 등록

```css
.banner-wrap {
  container-type: inline-size;  /* ← S239 핵심 — 외부 wrapper width 기준 분기 */
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
```

**금지**:
- ❌ `.banner-wrap { border-radius: 12px; box-shadow: ...; }` (section 분리 데모용)
- ❌ `.banner-wrap { aspect-ratio: 1320/480 }` (외부 iframe 컨테이너가 결정)
- ❌ `container-type` 누락 (cqw 단위 작동 안 함 + 분기 viewport 기준으로 회귀)

### 3. `<img class="bg">` → BP class + placeholder + LQIP blur (S246)

각 BP 별 3개 `<img>` 동시 두기 + `@container` 로 display 분기. **S246 부터 LQIP base64
blur 를 `style` inline 으로 부착** — 이미지 로드 전 base64 LQIP 가 background 으로 표시되어
이미지 fetch 동안 빈 영역이 안 보임. 로드 완료 시 자연스럽게 페이드.

```html
<img class="bg bg-desktop"
     src="{{IMAGE_DESKTOP}}"
     alt="{{IMAGE_ALT}}"
     style="background-image:url('{{IMAGE_BLUR_DESKTOP}}');background-size:cover;background-position:center;">
<img class="bg bg-tablet"
     src="{{IMAGE_TABLET}}"
     alt="{{IMAGE_ALT}}"
     style="background-image:url('{{IMAGE_BLUR_TABLET}}');background-size:cover;background-position:center;">
<img class="bg bg-mobile"
     src="{{IMAGE_MOBILE}}"
     alt="{{IMAGE_ALT}}"
     style="background-image:url('{{IMAGE_BLUR_MOBILE}}');background-size:cover;background-position:center;">
```

**왜 inline `style` 인가**: 외부 CSS 룰로 background-image 를 분기하려면 각 BP 별 별도
selector 필요 + LQIP 가 image 별 다른 dataURL 이라 selector 단위로 분리 어려움. inline
style 이 가장 단순. iframe srcDoc 모델이라 `style` attribute 사용 허용.

**LQIP 빈 값 처리**: 마이그 068 이전 등록된 이미지 또는 plaiceholder 실패 시 빈 문자열.
`background-image: url('')` 은 invalid → 브라우저가 무시 → image 만 표시 (기존 동작과
동일 fallback).

```css
/* display 는 BP selector 가 결정 — specificity 평준화 필수 */
.banner-wrap img.bg {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
}
.banner-wrap img.bg-desktop { display: block; }
.banner-wrap img.bg-tablet,
.banner-wrap img.bg-mobile  { display: none; }

@container (max-width: 1023px) and (min-width: 768px) {
  .banner-wrap img.bg-desktop,
  .banner-wrap img.bg-mobile  { display: none; }
  .banner-wrap img.bg-tablet  { display: block; }
}
@container (max-width: 767px) {
  .banner-wrap img.bg-desktop,
  .banner-wrap img.bg-tablet  { display: none; }
  .banner-wrap img.bg-mobile  { display: block; }
}
```

**중요 — CSS specificity 함정**:
- ❌ `.banner-wrap img.bg { display: block; }` 절대 금지 — specificity (0,2,1) 가 `.bg-desktop` (0,1,0) 보다 높아 모든 분기 무효화
- ✅ `.banner-wrap img.bg-desktop` 처럼 모든 BP selector 를 같은 specificity 로 평준화

### 4. 폰트 / 패딩 / 위치 → clamp + cqw fluid

#### 핵심 공식

responsive 의 BP 별 polyphony (예: desktop 64px · tablet 48px) → production 의 단일 fluid clamp(min, intercept + slope·cqw, max):

```
slope     = (max - min) / ((w_max - w_min) × 0.01)
intercept = min - slope × (w_min × 0.01)
```

여기서:
- `w_max` = max 값이 적용되는 컨테이너 width (예: Desktop = 1440)
- `w_min` = min 값이 적용되는 컨테이너 width (예: Tablet = 768)
- `× 0.01` = cqw 단위 환산 (1cqw = container width × 0.01)

#### 가로형 구간 (768 ~ 1440)

responsive 의 Desktop · Tablet 값이 양 끝점:

```
[Desktop 1440px] → max (responsive .desktop-wrap 값)
[Tablet  768px ] → min (responsive .tablet-wrap 값)
```

**예 — 헤드라인 (desktop 64 · tablet 48)**:
```
slope     = (64 - 48) / ((1440 - 768) × 0.01) = 16 / 6.72 = 2.38
intercept = 48 - 2.38 × 7.68                  = 29.72
→ font-size: clamp(48px, 29.72px + 2.38cqw, 64px);
```

#### 세로형 구간 (360 ~ 767)

별도 `@container` 블록 안에서 분리 식:

```
[Tablet  767px] → max (mobile 식의 상단)
[Mobile  360px] → min (mobile 식의 하단)
```

**예 — 모바일 헤드라인 (28 ~ 38)**:
```
slope     = (38 - 28) / ((767 - 360) × 0.01) = 10 / 4.07 = 2.46
intercept = 28 - 2.46 × 3.60                  = 19.14
→ font-size: clamp(28px, 19.14px + 2.46cqw, 38px);
```

```css
/* 가로형 구간 — 기본 (>= 768) */
.headline {
  font-size: clamp(48px, 29.72px + 2.38cqw, 64px);
}

/* 세로형 구간 — < 768 */
@container (max-width: 767px) {
  .mobile-text .headline {
    font-size: clamp(28px, 19.14px + 2.46cqw, 38px);
  }
}
```

#### 동일 패턴 적용 대상

- font-size (모든 텍스트 요소)
- padding · margin (BP 별 값 다른 경우)
- width · height (배지 크기 등)
- top · left · right · bottom (절대 위치 요소)
- border-width (BP 별 다른 경우는 드물지만 동일 패턴 가능)

### 5. 콘텐츠 분기 — desktop/tablet 공통 + mobile 분기

데모의 `.desktop-wrap` 안 콘텐츠 (`.menu-row`, `.badge-bar` 등) 는 desktop/tablet 공통으로 두고, `.mobile-wrap` 안 콘텐츠 (`.mobile-menu-chips`, `.mobile-badge-bar` 등) 는 별도 element 로 두기. `@container` 로 display 토글:

```css
/* desktop / tablet 만 */
.menu-row, .badge-bar { /* base */ }
@container (max-width: 767px) {
  .menu-row, .badge-bar { display: none; }
}

/* mobile 만 */
.mobile-menu-chips, .mobile-badge-bar { display: none; }
@container (max-width: 767px) {
  .mobile-menu-chips, .mobile-badge-bar { display: block; }  /* 또는 grid · flex */
}
```

tablet 의 폰트/패딩 축소 등 BP polyphony 는 위 §4 의 clamp 식으로 자동 흡수. 별도 `@container (max-width: 1023px) and (min-width: 768px)` 블록 안 px override 는 **이미지 display 분기 외에는 가능한 한 사용 금지** — fluid 식이 양 끝점 (1440·768) 사이를 보간하므로 중간 (tablet) 도 자동으로 적정값.

### 5-1. 콘텐츠 좌측 패딩 — 외부 페이지 정렬

배너가 풀블리드 (좌우 패딩 없음) 로 노출되므로, 배너 내부 텍스트의 `left` / `padding-left` 를 **외부 페이지의 콘텐츠 패딩과 일치**시켜야 다른 섹션과 좌측 정렬이 맞음.

| viewport | 외부 페이지 콘텐츠 패딩 | 배너 내부 텍스트 left |
|---|---|---|
| `>= 1024px` (desktop) | `60px` | clamp 식의 max = `60px` |
| `768 ~ 1023px` (tablet) | `48px` | clamp 식의 min = `48px` (가로형 구간) |
| `< 768px` (mobile) | `24px` | 세로형 구간 clamp 식 max = `24px` |

clamp 식 예 (가로형):
```css
.left-block { padding-left: clamp(48px, 34.29px + 1.79cqw, 60px); }
/* slope = (60-48)/((1440-768)*0.01) = 12/6.72 = 1.79 */
/* intercept = 48 - 1.79 * 7.68 = 34.29 */
```

**주의**: 데모 HTML 에서 디자이너가 임의로 설정한 `padding-left: 44px` 등은 production 변환 시 위 표의 값으로 교체.

### 6. SVG symbols 보존

데모의 `<svg style="display:none">` 안 `<symbol>` 정의 (icon-leaf · icon-milk · icon-coconut · icon-heart 등) 는 그대로 production `<body>` 안에 inject. `<use href="#icon-...">` 참조도 그대로.

### 7. 폰트 시스템 — 사이트 디자인 토큰 정합 (S240 표준)

배너 안 모든 텍스트는 **사이트 디자인 토큰과 동일한 두 폰트 패밀리** 만 사용:

| 토큰 | 패밀리 | 용도 |
|------|--------|------|
| `--font-kr` | Pretendard | 한글 본문 · 한/영 혼용 · 한글 문자 포함 모든 텍스트 |
| `--font-en` | Inter | 순수 영문 (헤드라인 · 라벨 · 대문자 라벨 · 시리즈명) |

iframe 안 문서는 외부 사이트의 `next/font` CSS variable 을 inherit 하지 못함 → **iframe 자체에서 CDN/Google Fonts 로 별도 로드** + `:root` 안에서 `--font-en` / `--font-kr` 토큰 정의.

#### 7-1. `<head>` 폰트 로드 (production · responsive 동일)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300..900&display=swap" rel="stylesheet">
```

- Pretendard = **Variable** 빌드 (단일 파일 · weight 100~900 모두 커버)
- Inter = Google Fonts variable axis `300..900`
- 추가 패밀리 (Noto Sans KR · Outfit · Montserrat 등) **사용 금지** — 사이트 다른 페이지와 폰트 정합 깨짐

#### 7-2. `:root` 토큰 정의 — 사이트 토큰과 1:1 정합

```css
:root {
  --font-en: 'Inter', sans-serif;
  --font-kr: 'Pretendard Variable', 'Pretendard', sans-serif;
  /* …color tokens… */
}

body {
  font-family: var(--font-kr);  /* 기본 한글 fallback */
  background: transparent;
}
```

사이트 `next/src/app/globals.css` 의 `--font-en` · `--font-kr` 토큰과 동일 chain (단 `var(--font-inter)` / `var(--font-pretendard)` 는 Next.js `next/font` 가 주입하는 변수 → iframe 안에서 inherit 안 되므로 제외).

- `'Pretendard Variable'` = variable axis 빌드 (단일 파일 · weight 100~900 전부)
- `'Pretendard'` = variable 미지원 환경 fallback (static)
- 끝의 `sans-serif` = CDN 실패 시 브라우저 기본 sans-serif (한글은 브라우저가 자동 fallback)
- **iframe 외부 안전망 (`system-ui` 등) 추가 금지** — 사이트 토큰 정합 깨짐

#### 7-3. 클래스별 매핑 규칙

각 텍스트 요소 클래스에 `font-family` 를 **명시적으로** 지정 (body inherit 만 의존 금지). 매핑 룰:

- **한글 문자 포함 (한/영 혼용 포함)** → `font-family: var(--font-kr)`
  - 예: `.subheadline` ("자연이 준 보랏빛 달콤함, 굳띵즈 우베 시리즈"), `.menu-list-kr` ("우베밀크"), `.menu-list-desc` ("고소한 우유와 우베의 완벽한 밸런스")
- **순수 영문 (대문자 라벨 · 헤드라인 · 시리즈명 포함)** → `font-family: var(--font-en)`
  - 예: `.headline` ("Ube, But Better."), `.series-label` ("GOOD THINGS UBE SERIES"), `.menu-list-en` ("UBE MILK"), `.badge-logo` ("good things only.")

#### 7-4. font-weight 매핑

Pretendard Variable + Inter variable axis 모두 100~900 전 weight 지원 — responsive 의 `font-weight` 값 그대로 production 에 복사. 단:

- Pretendard 의 `font-weight: 900` 은 Inter 와 시각 굵기 비슷 (양쪽 정합)
- 한글 본문 weight 가 영문보다 굵게 보이는 경향 → 동일 weight 값이어도 시각 정합 OK (별도 보정 불필요)
- 700 이상은 ExtraBold/Black 영역 — 헤드라인에만 사용

#### 7-5. 금지 패턴

- ❌ `font-family: 'Noto Sans KR', sans-serif;` (사이트 어느 페이지에서도 사용 안 함)
- ❌ `font-family: 'Outfit', sans-serif;` · `'Montserrat'` 등 영문 전용 추가 패밀리
- ❌ 클래스에 `font-family` 명시 없이 body inherit 만 의존 (영문 라벨이 Pretendard 로 떨어짐 → 사이트 다른 영문 노출과 불일치)
- ❌ `font-family: 'Pretendard'` 하드코딩 (토큰 미경유 — 향후 토큰 교체 시 누락 위험)

### 8. 데모 메타 제거

- `<p class="label">🖥 Desktop — 1320px</p>` 같은 라벨 모두 제거
- `<div class="section">` wrapper (데모 stacked 용) 제거
- `<title>` 은 유지 또는 적합한 값으로 변경

---

## 검증 체크리스트

production HTML 작성 후 다음 모두 통과 확인:

### 구조
- [ ] `<body>` 안에 단일 `.banner-wrap` 만 (3 wrap stacked 아님)
- [ ] `<img class="bg bg-desktop">` `<img class="bg bg-tablet">` `<img class="bg bg-mobile">` 3개 존재
- [ ] src 가 모두 placeholder (`{{IMAGE_DESKTOP|TABLET|MOBILE}}`) · 절대 URL 아님
- [ ] alt 가 모두 `{{IMAGE_ALT}}`
- [ ] 각 `<img>` 에 `style="background-image:url('{{IMAGE_BLUR_*}}');background-size:cover;background-position:center"` 부착 (S246 LQIP)
- [ ] `<script>` 태그 없음 (sandbox 차단)
- [ ] SVG symbols + 외부 폰트 preconnect 유지
- [ ] 데모 메타 라벨 (`📱 Mobile — 390px` 등) 모두 제거
- [ ] `<meta name="viewport">` 없음 (production 불필요)

### container query (S239 핵심)
- [ ] `.banner-wrap { container-type: inline-size }` 명시
- [ ] 모든 분기가 `@container (max-width: ...)` (viewport `@media` 아님)
- [ ] BP 정확: `>= 1024` desktop · `768-1023` tablet · `< 768` mobile

### CSS reset · body
- [ ] `body { background: transparent }` 또는 background 명시 없음
- [ ] `html, body { width: 100%; height: 100%; overflow: hidden; }`

### 이미지 specificity
- [ ] `.banner-wrap` 에 border-radius / box-shadow 없음
- [ ] `.banner-wrap img.bg { display: ... }` 같은 base img display 정의 없음 (specificity 함정)
- [ ] `.banner-wrap img.bg-desktop` 등 BP selector 가 display 결정

### fluid clamp
- [ ] 모든 폰트 크기 = `clamp(min, intercept + slope·cqw, max)` (고정 px 잔존 X)
- [ ] 가로형 구간 (>= 768) 식 · 세로형 구간 (< 768) 식 분리
- [ ] slope · intercept 가 §4 공식대로 계산됨
- [ ] BP polyphony 별 px override 가 fluid 로 흡수됨 (이미지 display 외 px override 최소화)

### 콘텐츠 좌측 패딩
- [ ] desktop = 60px · tablet = 48px · mobile = 24px 정렬 (가로형은 clamp 식)

### responsive ↔ production 정합
- [ ] responsive 의 BP 별 aspect-ratio = admin 폼 실제 입력 비율과 일치
- [ ] responsive 의 desktop · tablet 폰트값 = production clamp 식의 max · min 양 끝점
- [ ] responsive 의 mobile 폰트값 = production 세로형 clamp 식의 max (또는 min)

### 폰트 시스템 (S240)
- [ ] `<head>` 에 Pretendard Variable CDN + Inter Google Fonts 로드
- [ ] `:root` 에 `--font-en` (Inter) · `--font-kr` (Pretendard) 정의
- [ ] body `font-family: var(--font-kr)` (또는 기본 한글 fallback)
- [ ] 한글 포함 클래스 = `var(--font-kr)` · 순수 영문 클래스 = `var(--font-en)`
- [ ] `'Noto Sans KR'` · `'Outfit'` · `'Montserrat'` 등 추가 패밀리 잔존 0
- [ ] 모든 텍스트 클래스에 `font-family` 명시 (body inherit 단독 의존 금지)

---

## 실 운영 흐름 (참고)

1. **디자이너 의뢰** — 운영자가 시즌 컨셉 + 운영자 admin 폼의 BP 별 aspect-ratio 를 디자이너에게 전달
2. **이미지 생성** — `aiPrompt.ts` (Stage 1) 으로 AI 가 배경 이미지 **2장** (가로형 = Desktop · 세로형 = Mobile) 생성. tablet 별도 생성 불필요 — 가로형 재사용
3. **responsive.html 작성** — 디자이너가 **4 BP 양 끝점** stacked 시각 데모 작성 (가로형 max 1440 + 가로형 min 768 + 세로형 max 767 + 세로형 min 360). 각 section 의 폰트/패딩값이 production clamp 식의 양 끝점이 되므로 양 끝점 시각 최적화 후 production 변환. aspect-ratio = §시스템 컨텍스트 SoT 와 일치 의무
4. **production.html 변환** — 별도 Claude Code 인스턴스가 본 가이드 따라 변환. responsive 의 가로형 max/min 값 → 가로형 clamp 식 양 끝점 / 세로형 max/min 값 → 세로형 clamp 식 양 끝점
5. **운영자 admin 등록** — `/admin/settings` (signature) 또는 `/admin/cafe-events` → **이미지 2장 업로드** (Desktop · Mobile · tablet 슬롯 비움 → desktop fallback) + production HTML 업로드 + 텍스트/SEO 메타 입력
6. **/preview 검증** — 4 BP (1440 · 1024 · 768 · 390) 모두 mismatch 0 확인
7. **enabled = true 활성화** — 메인 페이지 노출

---

## 변환 예시 (UBE 배너)

**입력**: `ube_banner_responsive.html` (~333 줄 · 3 BP stacked 데모)
**출력**: `ube_banner_production.html` (~342 줄 · 단일 banner-wrap · fluid clamp)

### 핵심 diff

| 항목 | responsive | production |
|------|-----------|-----------|
| viewport meta | 있음 | 제거 |
| body 레이아웃 | `padding: 40px 20px; gap: 48px; background: #f5f0ea; flex column` | `background: transparent; width: 100%; height: 100%; overflow: hidden` |
| 컨테이너 | 3 wrap stacked (`.desktop-wrap` · `.tablet-wrap` · `.mobile-wrap`) | 단일 `.banner-wrap { container-type: inline-size }` |
| img src | `src="ube_banner_desktop.png" alt="UBE 배너 데스크탑"` | `src="{{IMAGE_DESKTOP}}" alt="{{IMAGE_ALT}}"` |
| img LQIP | (없음) | `style="background-image:url('{{IMAGE_BLUR_DESKTOP}}');background-size:cover;background-position:center"` (S246) |
| 분기 | 별도 클래스 (`.tablet-wrap .headline { font-size: 48px }`) | `@container (max-width: 767px) { .headline { ... } }` |
| 폰트 | 고정 px · BP polyphony (`64 / 48 / 38`) | clamp fluid (`clamp(48px, 29.72px + 2.38cqw, 64px)` + mobile 별도 식) |
| 박스 | `border-radius: 12px; box-shadow: ...` | 제거 |
| object-fit | `cover` | `contain` |

### 핵심 변환 단계

1. `<head>` reset 정정 (viewport meta 제거 · body transparent + 100% size)
2. 3 `.section` → 단일 `.banner-wrap` + `container-type: inline-size`
3. `<img>` src → placeholder · class 에 `bg-desktop|bg-tablet|bg-mobile` 추가
4. `.tablet-wrap .headline { font-size: 48px }` 같은 BP override → §4 공식으로 clamp 단일 식
5. `.mobile-wrap` 안 콘텐츠 → `@container (max-width: 767px)` 블록 안 display 분기
6. 좌측 패딩 → §5-1 표 + clamp 식
7. `.banner-wrap { border-radius / box-shadow }` 제거
8. `.banner-wrap img.bg { display: block }` → BP selector 로 분리 (specificity 함정)
9. 메타 라벨 + section wrapper 제거

---

## 변경 이력

- **S237** — iframe srcDoc 모델 도입. signature + cafe-events 양쪽 채택.
- **S239** — BP mismatch (768 / 877 경계) 진단 → container query + cqw + clamp fluid 전환. 외부 wrapper container 등록. viewport meta 제거. 본 가이드는 S239 모델 기준.
- **S240** — 폰트 토큰 정합. Noto Sans KR · Outfit · Montserrat 폐기 → Pretendard Variable + Inter 두 패밀리로 통일. `:root --font-en` / `--font-kr` 토큰 + 한/영 자동 매핑 규칙 §7 신설. UBE · Dripbag production / responsive 4 파일 동시 적용. responsive 의 BP 구조를 **4 BP 양 끝점 모델** (가로형 max/min + 세로형 max/min) 로 전환 — fluid scaling 양 끝점이 production clamp 식 양 끝점과 1:1 정합. 이미지 참조는 가로형 + 세로형 2장 (max + min 각각 재사용).
