# GTR Design Interaction Plan (Session 60+)

> 2026-04-22 기준. 기존 sr-txt/sr-img 시스템과 궁합을 고려한 **전체 페이지 디자인 인터랙션 개선** 종합 계획.
> 작성 근거: 3개 에이전트 병렬 조사 (인벤토리 + 아키텍처 + 스펙/호환성) 결과 수렴.

---

## 1. 개요

### 1.1 목표
GTR 사이트에 **모던·미니멀·절제된 우아·매거진 에디토리얼** 톤을 강화하는 5개 인터랙션 기법을 단계적으로 도입한다. 브랜드 서사("good things, take time")를 시각 언어로 번역.

### 1.2 대상 항목 (우선순위 순)

| # | 기법 | 티어 | sr 시스템 궁합 |
|---|------|------|----------------|
| **②** | Editorial Typography Scale (히어로·섹션 헤딩 대형화) | 🔥 TIER 1 | 🟢 시너지 (블러 해제 임팩트 증폭) |
| **⑧** | Animated Hairline Divider (섹션 진입 1px 좌→우 draw-in) | 🔥 TIER 1 | 🟢 시너지 (선 draw-in → sr-txt 순차) |
| **⑤** | Noise / Grain Texture (다크 섹션 필름 질감) | 🔥 TIER 1 | 🟡 독립 (배경 레이어) |
| **③** | Stagger Reveal 개선 (sr-txt duration·easing·거리 튜닝) | 🌱 TIER 2 | 🟢 본체 (시스템 튜닝) |
| **①** | Scroll-driven Variable Font Weight | 🌱 TIER 2 | 🟢 시너지 (이중 연출) |

### 1.3 제외 항목
- **⑥ Serif Accent** — 모던함 충돌 우려
- **⑦ Section Number Sticky** — 복잡도 우려
- **④ Lenis Smooth Scroll** — Next.js 16 호환·드로어 간섭 리스크
- **⑪ Brand Marquee** — 지속 모션이 sr 리듬과 충돌
- **⑫ CSS 3D translateZ Depth** — 카드 진입 시 sr-img 와 동시 발화 과부하

---

## 2. 제약 & 기존 자산

### 2.1 기존 sr 시스템 (보존 대상)
- `.sr-txt` / `.sr-img` / `.sr-txt--d1~d4` — `globals.css` L1260–1277
- `SRInitializer.tsx` — IntersectionObserver + MutationObserver (Session 58 근본 수정)
- `data-sr` / `data-sr-toggle` / `data-sr-story` — HTML 트리거

### 2.2 기존 토큰 (재활용)
```
--type-display-size (현재 max 48px — 교체 대상)
--type-h1-size / --type-h2-size / --type-h3-size
--color-line-light: #E8E6E1
--duration-slide: 700ms
--ease-spring
--color-background-inverse
```

### 2.3 폰트
- **Pretendard Variable** — weight 100~900 (한글, `--font-kr`)
- **Inter** (Google Fonts) — weight 100~900 (영문, `--font-en`)
- 두 폰트 모두 font-weight 애니메이션 가능

### 2.4 제약
- `globals.css` 단일 파일 (8000+ lines) — 기존 섹션 경계 내에 증분 추가
- `.blk { overflow: hidden }` — translateY/clip-path 주의
- 모바일 ≤767px 좌우 패딩 24px
- `prefers-reduced-motion: reduce` 대응 필수
- Next.js 16 Turbopack CSS HMR 주의 (lessons L6: `backdrop-filter` inline 이슈)

---

## 3. 페이지별 적용 매트릭스

| 페이지 | 히어로 | 섹션 타이틀 | sr 사용 | ② Scale | ⑧ Divider | ⑤ Grain | ③ Stagger | ① VFW |
|--------|--------|------------|---------|--------|----------|--------|----------|-------|
| **홈** `/` | `#hero-blk .hero-slogan` | 6종 | ✓ 광범위 | ✓ | ✓ | ✓ | ✓ | ✓ |
| **스토리** `/story` | `.st-hero-en/.st-hero-kr` | 3종 | ✓ 전수 | ✓ | ✓ | ✓ | ✓ | ✓ |
| **쇼핑** `/shop` | ✗ | `.sp-header` 1개 | ✗ | ◯ | ◯ | ◯ | — | ✗ |
| **상품 상세** `/shop/[slug]` | ✗ | ✗ | ✗ | ✗ | ✗ | ◯ | — | ✗ |
| **카페 메뉴** `/menu` | ✗ (시즌 배너) | `.season-h`, `.cat-title` | ✓ | ◯ | ✓ | ✓ | ✓ | ◯ |
| **굳데이즈** `/gooddays` | ✗ | ✗ | ✓ (이미지) | ✗ | ✗ | ✓ | ✓ | ✗ |
| **비즈니스** `/biz-inquiry` | ✗ | `.bi-heading` | ✗ | ◯ | ◯ | ◯ | — | ✗ |
| **장바구니·체크아웃·로그인·마이·주문완료** | ✗ | ✗ | ✗ | ✗ | ✗ | ◯ (선택) | — | ✗ |
| **검색** `/search` | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | — | ✗ |

범례: `✓` 적극 적용 · `◯` 선택적 · `✗` 불가/불필요

### 3.1 핵심 적용 셀렉터 목록

```
HERO
#hero-blk .hero-slogan                    (홈 — Inter · display)
.st-hero-en / .st-hero-kr                 (스토리)

SECTION TITLES
.blk-heading                              (홈 6곳 · H3 기본)
.phil-h                                   (홈 Our Story · H2)
.roastery-h                               (홈 Visit · H2)
.season-h                                 (홈/카페메뉴 · H2)
.tci-h                                    (홈 Subscription/Business · H3)
.cat-title                                (카페메뉴 카드 영문)
.st-promise-heading                       (스토리 Promise)

LABELS
.blk-label / .phil-lbl / .roastery-lbl / .tci-lbl
```

---

## 4. 항목별 상세 스펙

### ② Editorial Typography Scale

**목표:** 히어로 슬로건을 매거진급 임팩트로. 섹션 헤딩 위계 강화.

**현상:** `--type-display-size` 는 max 48px — 에디토리얼 기준 과소.

**신규 토큰:**
```css
/* 히어로 전용 — display 대체 없이 병행 */
--type-hero-editorial-size: clamp(2.5rem, 1.5rem + 5.5vw, 7rem);
--type-hero-editorial-weight: 300;
--type-hero-editorial-tracking: -0.025em;
--type-hero-editorial-leading: 1.05;

/* 섹션 헤딩 에디토리얼 스케일 (기존 `--type-h1/h2` 에 옵트인) */
--type-h1-editorial-size: clamp(2rem, 1.5rem + 2.5vw, 3.25rem);
--type-h2-editorial-size: clamp(1.75rem, 1.25rem + 2vw, 2.75rem);
```

**계산 검증 (360~1440px):**
- 히어로: 360px → 2.5rem(40px) · 768px → 56px · 1440px → 7rem(112px)
- H2 에디토리얼: 360px → 1.75rem(28px) · 1440px → 2.75rem(44px)

**모바일 overflow 안전:** `.hero-slogan-br` 가 `<br>` 을 ≤480px 에서 활성 → "good things,\ntake time" 2줄 분할. 40px 기준 "take time" 폭 ≈ 140px < 312px(360−2×24) 여유.

**유틸 클래스:**
```css
.hero-slogan { font-size: var(--type-hero-editorial-size); ... }  /* 직접 교체 */
.ed-h1 / .ed-h2                                                    /* 섹션별 옵트인 */
```

**적용 위치:**
- **필수:** `.hero-slogan` (홈), `.st-hero-kr` (스토리)
- **추천:** `.phil-h`, `.roastery-h`, `.season-h` → `.ed-h2` 추가

**CLS 리스크:**
- Inter(Google Fonts) `display: swap` 사용 중 → 폰트 로드 중 FOUT. 대형 텍스트일수록 shift 체감 큼.
- **대응:** 히어로는 이미 `heroSloganIn` opacity 페이드인 (0.8s 딜레이) → FOUT 구간 숨겨짐. 추가 조치 불필요.

**기존 애니메이션 공존:** `heroSloganIn` (opacity/translateY) 은 유지. `font-size`·`font-weight` 만 교체. 타이밍 영향 없음.

**prefers-reduced-motion:** 해당 없음 (정적 size).

---

### ⑧ Animated Hairline Divider

**목표:** 섹션 진입 시 1px 가로선이 좌→우로 그려지며 "장이 열리는" 리듬. sr-txt 페이드인 직전에 배치.

**신규 토큰:**
```css
--hairline-thickness: 1px;
--hairline-color: var(--color-line-light);     /* light 섹션 */
--hairline-color-dark: rgba(250,250,248,.2);   /* dark 섹션 */
--hairline-duration: 600ms;
--hairline-easing: cubic-bezier(0.22, 1, 0.36, 1);  /* out-expo */
```

**유틸 클래스:**
```css
.hairline {
  height: var(--hairline-thickness);
  background: var(--hairline-color);
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform var(--hairline-duration) var(--hairline-easing);
}
.sr--visible .hairline,
.hairline.sr--visible { transform: scaleX(1); }

/* 다크 섹션 오버라이드 */
[data-header-theme="dark"] .hairline { background: var(--hairline-color-dark); }
```

**적용 방식:** 기존 `sr--visible` 클래스 승계. sr-txt 와 같은 트리거로 동작 → SRInitializer 수정 불필요. 단, 자체 transition-delay 0ms 로 **sr-txt d1 보다 먼저 완료**.

**배치 위치:**
- 섹션 헤더 상단 (블록 라벨 위 12~16px)
- `.blk-header` 내부 첫 자식으로 삽입 권장
- 푸터 경계 (옵션)

**적용 셀렉터 대상:**
- 홈: `.blk-header` (CafeMenu, Beans, TwoCol), `.phil`, `.roastery-c`, Good Days 섹션 헤더
- 스토리: Promise / Location / 각 TwoCol 섹션 헤더
- 카페메뉴: `.season-banner` 상단

**수치 근거:**
- duration 600ms: 기존 sr-txt 700ms 보다 살짝 짧게 → 선 먼저 완료 → 텍스트 등장이 "선 밑에서 나타나는" 서사
- out-expo easing: 초반 빠르고 끝에 감속 → "그어지는" 감각

**prefers-reduced-motion:**
```css
@media (prefers-reduced-motion: reduce) {
  .hairline { transform: scaleX(1); transition: none; }
}
```

**리스크:** 없음 (CSS transform — 모든 브라우저 완벽 지원).

---

### ⑤ Noise / Grain Texture

**목표:** 다크 섹션(히어로·Visit·푸터)에 필름 그레인 질감. 브랜드 "아날로그·손맛·craft" 강화.

**신규 토큰:**
```css
--grain-opacity-light: 0.04;
--grain-opacity-dark: 0.08;
--grain-size: 200px;                            /* 배경 타일 크기 */
--grain-blend-light: multiply;
--grain-blend-dark: screen;
```

**SVG feTurbulence 스펙 (인라인 data URI):**
```
baseFrequency: 0.65
numOctaves: 2
stitchTiles: stitch          (시임라인 제거)
```
용량 ≈ 150 bytes base64. PNG 대비 1/60.

**유틸 클래스:**
```css
.grain-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml;...");
  background-size: var(--grain-size);
  opacity: var(--grain-opacity-light);
  mix-blend-mode: var(--grain-blend-light);
  z-index: 0;
}
[data-header-theme="dark"] .grain-overlay {
  opacity: var(--grain-opacity-dark);
  mix-blend-mode: var(--grain-blend-dark);
}
```

**적용 위치:**
- **1순위:** `#hero-blk` `.hero` — 비디오 포스터 위 필름 질감 (`.hero-bg-overlay` 상위)
- **2순위:** `.roastery` (Visit 다크 섹션)
- **3순위:** 페이지 전역 `body::after` 형태 (매우 연하게, opacity 0.02~0.03)

**성능:**
- SVG 인라인 → 네트워크 비용 0
- 정적 grain (애니메이션 금지) — iOS Safari rAF 제약 회피
- GPU 비용: overlay blend 는 합성 비용 있음. 히어로 스크롤 페이즈 외 섹션은 paint 1회만.

**Safari 16.4+ 미만:** feTurbulence 일부 제약. **현재 2026-04 기준 Safari 18+ 우세** → 실질 영향 없음. 최악 케이스 fallback: 투명 (그레인 미표시).

**prefers-reduced-motion:** 해당 없음 (정적).

---

### ③ Stagger Reveal 개선

**목표:** sr-txt 진입 동작을 더 우아하게 튜닝. 기존 시스템 유지, **병렬 강화 옵션** 제공.

**현재 값:**
```
duration: 700ms (--duration-slide)
stagger: 150ms
translateY: 20px
blur: 12px (sr-img 전용)
easing: ease-out
```

**권장 값 (신규 enhancedtune 프로파일):**
```css
--sr-duration-txt: 800ms;        /* 700→800 · 더 느리게 */
--sr-stagger-base: 120ms;        /* 150→120 · 간격 살짝 좁혀 리듬감 */
--sr-translate-txt: 28px;        /* 20→28 · 거리 확장 */
--sr-blur-img: 16px;             /* 12→16 · 더 깊은 해제감 */
--sr-easing: cubic-bezier(0.22, 1, 0.36, 1);  /* out-expo */
```

**구현 방식:** 기존 `.sr-txt` / `.sr-img` **본체 값 교체** (A안) vs 신규 `.sr-txt--ed` 병렬 클래스 (B안).

**권장: A안 (본체 교체).** 이유:
- 전역 일관성 유지 (스토리·카페메뉴·쇼핑 모두 개선 적용)
- B안은 `sr-txt sr-txt--ed` 이중 선언 유지보수 부담
- 현재 sr-txt 쓰는 곳은 모두 "에디토리얼" 대상

**적용 범위:** `globals.css` L1260–1277 직접 수정.

**CLS 리스크:**
- translateY 28px: `.blk { overflow: hidden }` 로 클리핑 → 외부로 누출 없음
- 동시 렌더 10개+ 섹션은 없음 (최대 d1~d4)

**prefers-reduced-motion:**
```css
@media (prefers-reduced-motion: reduce) {
  .sr-txt, .sr-img {
    opacity: 1 !important; transform: none !important; filter: none !important;
    transition: none !important;
  }
}
```
(기존 처리 유지 또는 추가 확인)

**리스크:** 전역 적용이므로 **시각 회귀 가능**. 스토리 페이지의 `.st-hero-en/.st-hero-kr` 는 별도 transition 으로 영향 미치지 않음 확인 필요.

---

### ① Scroll-driven Variable Font Weight

**목표:** 히어로 슬로건·섹션 타이틀 font-weight 가 스크롤에 따라 얇음→무거움 이동. "시간이 걸린다" 서사 시각화.

**⚠️ 핵심 호환성 이슈 (2026-04 기준):**

| 브라우저 | animation-timeline 지원 | 점유율 |
|---------|----------------------|--------|
| Chrome 120+ | ✅ 지원 | ~55% |
| Edge | ✅ 지원 | ~5% |
| Firefox 133+ | ⚠️ flag off (기본 disabled) | ~3% |
| Safari 18+ | ❌ 미지원 | ~25% |

**결론:** 전체 사용자 ~60% 에서만 동작. **필수 기능 불가** · **점진적 향상(progressive enhancement) 전략**.

**신규 토큰:**
```css
--vfw-weight-min: 300;         /* 영문 Inter · 한글 Pretendard */
--vfw-weight-max: 600;
--vfw-range: entry 10% cover 60%;
```

**유틸 클래스:**
```css
.vfw {
  font-weight: var(--vfw-weight-min);  /* Safari fallback */
}

@supports (animation-timeline: view()) {
  .vfw {
    animation: vfw-swell linear both;
    animation-timeline: view();
    animation-range: var(--vfw-range);
  }
  @keyframes vfw-swell {
    from { font-weight: var(--vfw-weight-min); }
    to   { font-weight: var(--vfw-weight-max); }
  }
}

/* 히어로 전용 scroll() 타임라인 */
.hero-slogan.vfw-hero {
  font-weight: var(--vfw-weight-min);
}
@supports (animation-timeline: scroll()) {
  .hero-slogan.vfw-hero {
    animation: vfw-swell linear both;
    animation-timeline: scroll(root block);
    animation-range: 0% 50%;
  }
}
```

**적용 셀렉터:**
- `.hero-slogan` ← `.vfw-hero` (scroll root)
- `.phil-h`, `.roastery-h`, `.season-h`, `.blk-heading` ← `.vfw` (view)
- 스토리 `.st-hero-kr` ← `.vfw` (옵션)

**폴백 전략:**
- Safari: 정적 `--vfw-weight-min` (300) 로 표시. 에디토리얼 scale(②) 만으로도 임팩트 충분.
- Firefox: flag 필요 → 폴백 경로 적용
- 모션 민감: `@media (prefers-reduced-motion: reduce) { .vfw { animation: none; font-weight: 400; } }`

**sr 시스템 궁합:**
- `.vfw` 는 font-weight 만 제어 → `.sr-txt` 의 opacity/transform 과 독립
- sr-txt 페이드인 동안 weight 가 동시에 무거워지는 이중 연출

**흔한 실수:**
- `animation-duration` 생략 시 Firefox 무반응 (1ms 이상 필수 — 단 scroll-timeline 는 duration 무시되는 스펙이지만 일부 구현 호환성 위해 명시 권장)
- `animation-range` 단위 오타 (`entry`/`cover`/`contain`/`exit` 만 유효)

**리스크:** 미지원 브라우저에서 "보이지도 않는 효과" → 과투자 금지. **② + ⑧ 로 이미 에디토리얼 기반이 확보된 상태에서만 착수.**

---

## 5. 구현 로드맵

### Phase 1 — TIER 1 (사용자 체감 핵심)

| Step | 항목 | 파일 | 예상 커밋 수 |
|------|------|------|------------|
| **1.1** | ② 히어로 슬로건 대형화 | `globals.css` L1369–1383, `--type-hero-editorial-*` 토큰 | 1 |
| **1.2** | ② 섹션 헤딩 ed 프로파일 (`.ed-h1`, `.ed-h2`) | `globals.css` `@theme` + 새 섹션 | 1 |
| **1.3** | ② 각 섹션 컴포넌트에 `.ed-h2` 적용 (PhilSection, RoasterySection, 등) | 컴포넌트 5~7개 | 1 |
| **1.4** | ⑧ `.hairline` 유틸 + 토큰 | `globals.css` 새 섹션 | 1 |
| **1.5** | ⑧ `.blk-header` 에 hairline 삽입 (홈 5개 섹션) | 컴포넌트 5개 | 1 |
| **1.6** | ⑧ 스토리·카페메뉴 hairline 삽입 | 해당 페이지 | 1 |
| **1.7** | ⑤ `.grain-overlay` 유틸 + 토큰 | `globals.css` 새 섹션 | 1 |
| **1.8** | ⑤ 히어로·Visit 다크 섹션 grain 추가 | HeroSection, RoasterySection | 1 |

**Phase 1 체크포인트:** Vercel production 배포 후 육안 확인. CLS 측정.

### Phase 2 — TIER 2 (튜닝·강화)

| Step | 항목 | 파일 | 비고 |
|------|------|------|------|
| **2.1** | ③ sr-txt 본체 값 튜닝 | `globals.css` L1260–1277 | 전역 영향 — 스토리·쇼핑 등 회귀 확인 |
| **2.2** | ③ 반응형 reduce-motion 재검 | `globals.css` | 필요 시 확인 |
| **2.3** | ① `.vfw` 유틸 + `@supports` 가드 | `globals.css` 새 섹션 | — |
| **2.4** | ① 히어로·홈 섹션 헤딩에 `.vfw` 적용 | 컴포넌트 | Chrome 에서만 확인, Safari fallback 검증 |

**Phase 2 체크포인트:** Chrome·Firefox·Safari 3종 검증. 미지원 브라우저 정적 상태 자연스러움 확인.

---

## 6. sr-txt 시스템 궁합 타이밍 매트릭스

동일 섹션 `sr--visible` 발화 시 각 요소 발동 순서:

| 시점 (ms) | 동작 |
|----------|------|
| 0 | `.hairline` scaleX 0→1 시작 (duration 600ms, out-expo) |
| 0 | `.sr-txt--d1` opacity/translateY 시작 |
| 0 | `.sr-img` opacity/blur 시작 (duration 900ms) |
| 120 | `.sr-txt--d2` 발동 |
| 240 | `.sr-txt--d3` 발동 |
| 360 | `.sr-txt--d4` 발동 |
| 600 | `.hairline` 완료 |
| 800 | `.sr-txt--d1` 완료 |
| 920 | `.sr-txt--d2` 완료 |
| 900 | `.sr-img` 완료 |
| ... | `.vfw` 는 스크롤 위치와 연동 (독립 타임라인) |

**핵심:** 선이 먼저 완료되고 텍스트가 뒤따라 채워지는 "매거진 페이지 넘김" 리듬.

---

## 7. 리스크 매트릭스

| 항목 | 브라우저 지원 | 성능 | sr 충돌 | 모바일 | 종합 |
|------|--------------|------|---------|--------|------|
| ② Editorial Scale | 🟢 100% | 🟢 저 | 🟢 없음 | 🟡 overflow 확인 | **🟢 낮음** |
| ⑧ Hairline Divider | 🟢 100% | 🟢 저 | 🟢 순차 보강 | 🟢 OK | **🟢 낮음** |
| ⑤ Grain Overlay | 🟢 ~96% | 🟡 blend 비용 | 🟢 독립 | 🟡 GPU 체크 | **🟢 낮음** |
| ③ Stagger 튜닝 | 🟢 100% | 🟢 저 | 🟡 본체 수정(회귀) | 🟢 OK | **🟡 중간** |
| ① VFW | 🟡 ~60% | 🟢 저 | 🟢 독립 | 🔴 작은 화면 체감↓ | **🟡 중간** |

---

## 8. 검증 체크리스트

### Phase 1 완료 시점
- [ ] Lighthouse CLS < 0.05 (모바일·데스크탑)
- [ ] Lighthouse Performance > 85
- [ ] 히어로 슬로건 360px 오버플로우 없음 (`<br>` 분할 정상)
- [ ] 각 섹션 hairline 육안 draw-in 확인
- [ ] 다크 섹션 grain 과하지 않음 (opacity 0.08 기준)
- [ ] Chrome / Safari 18 / iOS Safari 18 시각 동일
- [ ] `prefers-reduced-motion: reduce` 시 모든 모션 즉시 final state

### Phase 2 완료 시점
- [ ] sr-txt 튜닝 후 스토리·쇼핑·카페메뉴 회귀 없음
- [ ] VFW Chrome 에서 weight 변화 육안 확인
- [ ] VFW Safari 에서 정적 300 자연스러움
- [ ] Next.js 16 Turbopack dev HMR 정상 (lessons L5 참조)

---

## 9. 파일 영향도 요약

| 파일 | 변경 | 라인 규모 |
|------|------|-----------|
| `src/app/globals.css` | 토큰 추가 + 유틸 클래스 추가 + sr 튜닝 | +250~300 |
| `src/components/home/HeroSection.tsx` | `.ed-*`, `.vfw-hero`, grain overlay 삽입 | +5 |
| `src/components/home/PhilSection.tsx` | `.ed-h2`, `.vfw`, `.hairline` 삽입 | +3 |
| `src/components/home/RoasterySection.tsx` | 동일 + grain | +5 |
| `src/components/home/CafeMenuSection.tsx` | 헤더 hairline | +2 |
| `src/components/home/BeansScrollSection.tsx` | 헤더 hairline | +2 |
| `src/components/home/TwoColSection.tsx` | hairline | +2 |
| `src/components/home/GoodDaysSection.tsx` | hairline (옵션) | +2 |
| `src/components/story/StoryPage.tsx` | `.ed-*`, hairline | +5 |
| `src/components/menu/*` | hairline, grain (옵션) | +3 |

**신규 React 컴포넌트:** 불필요. 기존 섹션 컴포넌트에 클래스·요소 직접 추가.

---

## 10. 참고

- 에이전트 1 인벤토리 (파일 경로·셀렉터 매핑)
- 에이전트 2 아키텍처 (토큰·유틸·의존관계)
- 에이전트 3 스펙·호환성 (수치·브라우저 지원)
- `docs/gtr-design-guide.md` — 디자인 가이드 기준점
- `C:\Users\ideal\.claude\rules\web\lessons.md` — L5 (Turbopack HMR), L6 (backdrop-filter)
- `memory/project_design_interaction_plan.md` — 원래 계획 메모

---

## 11. 오픈 이슈 / 후속 판단

1. **⑨ Zine Grid + Hairline Frame** — 별도 스케치 후 Good Days / Featured Beans 에 한정 실험
2. **⑩ Directional Link Underline** — TIER 3, 전체 완료 후 CTA 한정 추가
3. ① VFW 에서 `font-weight` 애니메이션이 Variable Font 와 weight variant 폰트 간 충돌하지 않는지 로컬 Inter/Pretendard 둘 다 검증 필요 (font-variation-settings 누락 시 계단 현상)
4. ⑤ Grain — 라이트 섹션에도 연한 grain 적용 여부는 Phase 1.8 완료 후 재판단
