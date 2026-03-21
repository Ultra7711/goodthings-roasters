# GOOD THINGS — Design System
**Version 1.3 · 2026 · Cafe GOOD THINGS, Gumi**

---

## Index

1. [Color Palette](#01--color-palette)
2. [Typography](#02--typography)
3. [Spacing Scale](#03--spacing-scale)
4. [Components](#04--components)
5. [Language & Content Policy](#05--language--content-policy)
6. [Layout Grid](#06--layout-grid)
7. [Motion & Animation](#07--motion--animation)
8. [Voice & Tone](#08--voice--tone)

---

## 01 — Color Palette

전체 UI는 흑백 모노톤 그레이스케일 시스템을 기반으로 합니다.
컬러는 이미지와 제품 콘텐츠를 통해서만 표현됩니다.

| Token | Hex | 용도 |
|---|---|---|
| Black | `#000000` | 최상위 강조, 로고 |
| Dark 1 | `#111111` | 주요 텍스트, 버튼 fill |
| Dark 2 | `#222222` | 서브 타이틀, 본문 강조 |
| Dark 3 | `#444444` | 보조 텍스트 |
| Mid | `#888888` | 캡션, 플레이스홀더 |
| Light | `#BBBBBB` | 비활성 텍스트 |
| Border | `#DDDDDD` | 구분선, 아웃라인 |
| Surface | `#F5F5F5` | 카드 배경, 섹션 배경 |
| White | `#FFFFFF` | 페이지 기본 배경 |

### 이미지 컬러 정책

> UI 배경은 흑백 모노톤을 유지하고, 제품·공간·순간을 담은 이미지는 풍부한 컬러로 시각적 생동감을 더합니다.
> 이미지가 페이지의 유일한 색채 포인트가 됩니다.

| 영역 | 처리 방식 |
|---|---|
| UI 배경 / 구조 요소 | 흑백 (Grayscale) 처리 |
| 제품 / 콘텐츠 이미지 | 풀 컬러 (Full Color) |

---

## 02 — Typography

### 폰트 페어링

| 역할 | 폰트 | 비고 |
|---|---|---|
| Title (EN) | **DM Sans** | Weight 500 / 600, Letter-spacing ↑ |
| Body (KR) | **Noto Sans KR** | Weight 300 / 400, 가독성 최우선 |

> **Serif 계열 완전 배제** — 순수 산세리프 시스템
> **최소 폰트 크기: 11px** (UI 보조) / **13px** (기본 캡션)

---

### Type Scale — v14 기준

> v13 이하 대비 소형 텍스트 전반 상향 조정.
> 섹션 레이블 9px → 13px, 상품명 13px → 15px 등 24개 항목 업데이트.

| 계층 | 폰트 | 크기 | Weight | Letter-spacing | 용도 |
|---|---|---|---|---|---|
| Display / Hero | DM Sans | 64–80px | **600** | −0.03em | Hero 헤드라인 |
| Heading H1 | DM Sans | 36–44px | **500** | −0.02em | 섹션 배너 타이틀 |
| Heading H2 | DM Sans | 24–28px | **500** | −0.01em | 섹션 타이틀 |
| Heading H3 | DM Sans | 18–20px | **500** | 0 | 서브섹션 제목 |
| Section Label | DM Sans | **13px** | 400 | 0.14em / Uppercase | 섹션 구분 레이블 |
| Nav 메뉴 | DM Sans | **15px** | 400 | 0.03em | 헤더 내비게이션 |
| Body KR (L) | Noto Sans KR | 15–16px | 300 | — | 주요 한글 본문 · LH 1.9~2.1 |
| Body KR (M) | Noto Sans KR | **14px** | 300 | — | Roastery 본문 · 카드 설명 |
| Body KR (S) | Noto Sans KR | **13px** | 300 | — | Services 카드 본문 |
| 상품명 | DM Sans | **15px** | 500 | — | 카드 핵심 정보 |
| 가격 | DM Sans | **15px** | 500 | — | 상품 가격 표시 |
| 향미 설명 | DM Sans | **13px** | 400 | — | 원두 플레이버 노트 |
| CTA 버튼 | DM Sans | **13px** | 400–500 | 0.06~0.10em | Uppercase · 모든 CTA 공통 |
| 어나운스 바 | DM Sans | **13px** | 400 | 0.06em | 최상단 공지 바 |
| 카테고리 타이틀 | DM Sans | **15px** | 500 | — | Coffee / Beverage / Dessert |
| 원산지 레이블 | DM Sans | **13px** | 400 | 0.06em / Uppercase | ETHIOPIA 등 |
| Caption / Label | DM Sans | **13px** | 400 | 0.06em | 최소 기준 · 일반 캡션 |
| 푸터 태그라인 | Noto Sans KR | **13px** | 300 | — | Good Things, Simply Roasted. |
| 푸터 카테고리 타이틀 | DM Sans | **12px** | 500 | 0.08em / Uppercase | — |
| 푸터 링크 | Noto Sans KR | **12px** | 300 | — | LH 1 · padding 5px 0 |
| 푸터 회사정보 | DM Sans | **12px** | 400 | 0.01em | 사업자 정보 · 법적고지 |
| 배지 | DM Sans | **11px** | 500 | 0.05em / Uppercase | NEW · 수량 한정 |
| 팝업 레이블 | DM Sans | **11px** | 500 | 0.08~0.10em / Uppercase | Popup 내 보조 정보 |

---

### 적용 예시

```
Display    →  Good Things, Simply Roasted.
              DM Sans 600 / 72px / LS −0.03em

Section Label →  OUR PHILOSOPHY
                 DM Sans 400 / 13px / LS 0.14em / Uppercase

Body KR    →  직접 로스팅한 원두는 깊고 풍부한 풍미를 담고 있습니다.
              Noto Sans KR 300 / 15px / LH 1.9

Caption    →  Ethiopia · Natural Process · 2025 Harvest
              DM Sans 400 / 13px / LS 0.06em
```

---

### Line-Height 규칙

| 적용 대상 | 값 | 비고 |
|---|---|---|
| Hero 타이틀 | 1.05 | letter-spacing −0.03em |
| 섹션 타이틀 (H1) | 1.15–1.2 | — |
| Philosophy 본문 | 2.1 | 여백감 강조 |
| 일반 본문 (KR) | 1.9 | Noto Sans KR 기준 |
| Roastery 본문 | 1.9 | — |
| 카드 설명 | 1.7 | Cafe Menu cat-desc |
| Services 본문 | 1.9 | — |
| 푸터 링크 | 1 | padding: 5px 0으로 간격 확보 |

---

### 레터 스페이싱 규칙

| 적용 대상 | 값 | 예시 |
|---|---|---|
| 섹션 레이블 (Uppercase) | 0.14em | Our Philosophy, 2026 Spring |
| 원산지 레이블 | 0.06em | Ethiopia, Kenya |
| CTA 버튼 | 0.06~0.10em | Shop Now, Cafe Menu |
| 배지 | 0.05em | NEW, 수량 한정 |
| 어나운스 바 | 0.06em | 원두 구매 15,000원 이상… |
| Nav 메뉴 | 0.03em | The Story, Shop |

---

## 03 — Spacing Scale

4px를 기본 단위로 하는 일관된 간격 체계를 사용합니다.

| Token | Value | 주요 사용처 |
|---|---|---|
| xs | 4px | 아이콘 내부 간격 |
| sm | 8px | 인라인 요소 간격 |
| — | 12px | 소형 컴포넌트 내부 |
| md | 16px | 카드 내부 패딩 |
| lg | 24px | 컴포넌트 간 여백 |
| — | 32px | 그룹 간 간격 |
| xl | 40px | 섹션 내부 요소 |
| 2xl | 56px | 소섹션 상하 여백 |
| 3xl | 80px | 대섹션 내부 |
| section | **120px** | 섹션 상하 최소 여백 |

> 섹션 상하 여백 최소 **120px** · 컴포넌트 내부 패딩 24–40px · 여백을 충분히 활용해 호흡감 확보

---

## 04 — Components

### Navigation

```
[ LOGO ]   The Story   Shop   Work with Us   Good Days   [ 🔍 ] [ 👤 ] [ 🛒 ]
←— 좌측 고정 —→ ←—————————————— 중앙 정렬 ——————————————→ ←—— 우측 고정 ——→
```

| 요소 | 스펙 |
|---|---|
| 로고 | SVG 이미지 · height **30px** · 좌측 고정 |
| 메뉴 | The Story / Shop / Work with Us / Good Days · 중앙 정렬 |
| 우측 아이콘 | 검색 / 로그인 / 장바구니 · **30×30px** · stroke 1.2px |
| 배경 | `rgba(255,255,255,.72)` + `backdrop-filter: blur(16px)` · 글래스 sticky |
| 메뉴 폰트 | DM Sans 400 · **15px** · LS 0.03em |
| 헤더 패딩 | 24px 40px |

---

### Buttons

| 타입 | 스타일 | 용도 |
|---|---|---|
| Primary | Background `#111111` · Color `#FFFFFF` · height `52px` · hover `opacity .8` | 핵심 CTA — 장바구니 담기, 로그인, 계정 만들기 등 페이지당 1개 원칙 |
| Secondary | Border `0.5px #111` · Background transparent · height `48px` · hover fill `#111` | 보조 액션 — Primary와 함께 쓰일 때 |
| Ghost / Link | Underline only · `#111 × opacity .45` · 13px uppercase | 섹션 이동 CTA — Cafe Menu →, Shop → 등 |
| Ghost / Link (다크 배경) | Underline only · `rgba(255,255,255,.9) × opacity .6` · 13px uppercase | 다크 배경 섹션 CTA — Roastery 등 |

```
Primary 공통 속성
  Font      : DM Sans 500 · 13px · UPPERCASE
  LS        : 0.08em
  Radius    : 0  ← 모든 버튼 radius 없음
  Border    : none
  Hover     : opacity 0.8
  Height    : 52px
  Width     : 100% (full-width 기본)

Secondary 공통 속성
  Font      : DM Sans 400–500 · 13px
  LS        : 0.04–0.06em
  Border    : 0.5px solid #111
  Height    : 48px
  Hover     : background #111, color #fff

Ghost / Link 공통 속성 (흰 배경)
  Color     : #111111
  Opacity   : 0.45 (기본) → 1.0 (hover)
  Font      : DM Sans 400 · 13px · UPPERCASE
  LS        : 0.06–0.10em
  Border    : border-bottom 0.5px solid #111111
  실제 표시 명도 : #111 × 0.45 ≈ #8c8c8c

Ghost / Link 공통 속성 (다크 배경)
  Color     : rgba(255,255,255,.9)
  Opacity   : 0.6 (기본) → 1.0 (hover)
  Border    : border-bottom 0.5px solid rgba(255,255,255,.5)
```

> **Primary 버튼 사용 원칙**
> 동일 위계의 CTA는 반드시 동일한 스타일을 사용한다.
> 장바구니 담기 / 로그인 / 계정 만들기 / 정기 배송 신청 모두 Primary.
> 한 화면에 Primary 버튼은 1개를 원칙으로 한다.

> **Ghost / Link 버튼 컬러 원칙**
> 흰 배경과 다크 배경 모두 `color × opacity` 조합으로 동일한 시각적 무게감을 유지한다.
> 기준색으로 `opacity`만 조정하며, `color-text-secondary / tertiary`를 혼용하지 않는다.

---

### Tags / Badges

| 타입 | 스타일 |
|---|---|
| Outline | Border `0.5px #BBBBBB` · Color `#888888` |
| Filled | Background `#111111` · Color `#FFFFFF` |
| Gold | Background `#C8A84B` · Color `#FFFFFF` · 인기 강조 |

```
공통 속성
  Font     : DM Sans 500 · 11px · UPPERCASE
  Padding  : 4px 8px
  Radius   : 0  ← radius 없음
  LS       : 0.05em
```

---

### Hero Section

```
[ Section Label ]      ← DM Sans 400 / 13px / LS 0.14em / Uppercase / #888
[ Display Headline ]   ← DM Sans 600 / 64–80px / LS −0.03em
[ KR Body Copy ]       ← Noto Sans KR 300 / 15px / LH 1.9
[ CTA Link → ]         ← DM Sans 400 / 13px / LS 0.10em / Underline
```

- 배경 Black(`#111111`) 기본
- 컬러풀한 제품 이미지와 함께 배치 시 White 배경 권장

---

## 05 — Language & Content Policy

### 언어 혼합 원칙

> 타이틀은 영문(DM Sans), 콘텐츠·설명은 한글(Noto Sans KR)로 혼합 구성합니다.

| 요소 | 언어 | 폰트 | 비고 |
|---|---|---|---|
| 섹션 레이블 | 영문 uppercase | DM Sans 400 · 13px | `OUR PHILOSOPHY` |
| 헤드라인 (타이틀) | 영문 | DM Sans 600–500 | `Good Things Take Time.` |
| 본문 설명 | **한글** | Noto Sans KR 300 | 감성 메시지, 브랜드 스토리 |
| CTA 버튼 | 영문 | DM Sans 400–500 · 13px | `Shop Now` / `Explore →` |
| 태그 / 배지 | 영문 uppercase | DM Sans 500 · 11px | `Single Origin` / `New` |
| 캡션 | 영문 또는 한/영 병기 | DM Sans 400 · 13px | `Ethiopia · 에티오피아` |

### 혼합 사용 예시 — Section

```
OUR PHILOSOPHY                          ← Section Label (EN)

Good Things Take Time.                  ← Headline (EN / DM Sans 600)

저희는 빠름보다 바름을 선택합니다.          ← Body (KR / Noto Sans KR 300)
한 잔의 커피가 완성되기까지,
서두르지 않고 원두 본연의 가능성을 끌어냅니다.
```

---

## 06 — Layout Grid

```
┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐
│  │██│██│██│██│██│██│██│██│██│██│  │
│  │  ·  ·  ·  콘텐츠 영역  ·  ·  │  │
└──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘
  ↑                                 ↑
  1col 여백                      1col 여백
```

| 항목 | 값 |
|---|---|
| 컬럼 수 | 12 columns |
| 좌우 여백 | 각 1 column |
| Max-width | 1280px |
| Gutter | 24px |
| Mobile | 4 columns |
| 레이아웃 | 비대칭 허용 (5+7, 4+8, 3+9 등) |

### 권장 레이아웃 패턴

```
텍스트 + 이미지 (비대칭)
  [ 5 cols — 텍스트 ] [ 7 cols — 이미지 ]

제품 그리드
  [ 4 cols ] [ 4 cols ] [ 4 cols ]

히어로 (풀블리드)
  [ 12 cols — 전체 폭 ]

About / Story (여백 강조)
  [ 2 cols 여백 ] [ 8 cols 콘텐츠 ] [ 2 cols 여백 ]
```

---

## 07 — Motion & Animation

### 기본 원칙

> 무겁거나 화려한 애니메이션 지양 · 진입 시 Fade In + Slide Up 기본 조합
> Hover는 Opacity 변화만으로 절제된 인터랙션 구현

### 애니메이션 스펙

| 타입 | 속성 | Duration | Easing | 비고 |
|---|---|---|---|---|
| Fade In | `opacity: 0 → 1` | 600ms | easeOut | — |
| Slide Up | `translateY: 20px → 0` | 700ms | easeOut | — |
| Scroll Trigger | IntersectionObserver | — | — | threshold: 0.15 · stagger: 80ms |
| Hover | `opacity: 0.6 → 1` | 200ms | linear | — |
| Image Zoom | `scale: 1.002 → 1.06` | 400ms | cubic-bezier(.25,.46,.45,.94) | hover 진입 시 |

### 코드 예시

```css
/* Fade In + Slide Up (기본 진입 애니메이션) */
@keyframes fadeSlideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-in {
  animation: fadeSlideUp 700ms ease-out forwards;
}

/* Stagger (다중 요소) */
.animate-in:nth-child(1) { animation-delay: 0ms; }
.animate-in:nth-child(2) { animation-delay: 80ms; }
.animate-in:nth-child(3) { animation-delay: 160ms; }

/* Image Hover Zoom */
.img-inner {
  transform: scale(1.002);
  transition: transform 400ms cubic-bezier(.25,.46,.45,.94);
}
.card:hover .img-inner {
  transform: scale(1.06);
}

/* Hover (Opacity only) */
.hover-item {
  opacity: 1;
  transition: opacity 200ms linear;
}
.hover-item:hover {
  opacity: 0.6;
}
```

```javascript
// Scroll Trigger (IntersectionObserver)
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
      }
    });
  },
  { threshold: 0.15 }
);

document.querySelectorAll('[data-animate]').forEach((el) => {
  observer.observe(el);
});
```

---

## 08 — Voice & Tone

### 언어별 어조 가이드

#### Title — 영문 (DM Sans)

- 간결하고 시적인 어조
- 동사 기반 짧은 문장 선호
- 마침표로 여운 남기기
- 불필요한 형용사 배제

**예시**
```
Good Things, Simply Roasted.
Origin in Every Roast.
Roasted with Intention.
Good Things Take Time.
A Good Day Starts Here.
```

#### Body — 국문 (Noto Sans KR)

- 따뜻하지만 담백한 어조
- 설명보다 감성 중심
- 긴 문장 지양, 호흡 있는 문단
- 일상의 소소한 행복을 담는 언어

**예시**
```
직접 로스팅한 원두는 깊고 풍부한 풍미를 담고 있습니다.
커피 한 잔이 선물하는 소소하지만 확실한 행복.

저희는 빠름보다 바름을 선택합니다.
한 잔의 커피가 완성되기까지, 서두르지 않고
원두 본연의 가능성을 끌어냅니다.
```

### DO / DON'T

| DO ✓ | DON'T ✗ |
|---|---|
| 짧고 임팩트 있는 영문 타이틀 | 긴 영문 본문 |
| 감성적인 한글 설명 | 딱딱한 기능 설명 위주 한글 |
| 마침표로 마무리 | 느낌표 과용 |
| 여백을 활용한 호흡 | 정보를 가득 채우는 레이아웃 |
| 컬러풀한 이미지로 포인트 | UI 자체에 컬러 추가 |

---

## Changelog

| 버전 | 날짜 | 변경 내용 |
|---|---|---|
| v1.3 | 2026.03 | Type Scale 전면 v14 기준 업데이트 (24개 항목) · Section Label 9px → 13px · 상품명 13px → 15px · 배지 9px → 11px · Nav 15px / 로고 30px · Image Zoom 모션 추가 · Line-Height / Letter-spacing 규칙 표 추가 · **Buttons Primary 정의 강화** — 장바구니·로그인·계정 만들기 모두 `#111 fill` 통일, 용도별 위계 규칙 추가 · **Ghost / Link 버튼 컬러 기준 정립** — 흰 배경 `#111 × opacity .45`, 다크 배경 `rgba(255,255,255,.9) × opacity .6` 통일, secondary/tertiary 컬러 혼용 금지 |
| v1.2 | 2026 | 초기 배포 |

---

*GOOD THINGS Design System v1.3 · 2026 · Cafe GOOD THINGS, Gumi*
