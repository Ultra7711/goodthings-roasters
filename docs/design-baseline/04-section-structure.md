---
title: 섹션 구조 측정 (F3/F4 방지 — 레이아웃 오해/gap 미인식 차단)
created: 2026-04-19
viewport: 1440px desktop
---

# 섹션 구조 측정

> **목적:** Session 22 실패 F3 (섹션이 `margin-top:120px` + 내부 padding 없음 구조인데 padding 기준으로 제안) · F4 (L-gap 1.5% 차이를 인지 못하고 "동일해 보임" 제안) 방지.
>
> **규칙:** 섹션 배경·스페이싱 변경 시 반드시 본 문서의 실측 값을 베이스라인으로 사용.

## 1. 전역 섹션 리듬

### Desktop (1440px 기준)

- **섹션 간 수직 여백:** 주로 `margin-top`·`margin-bottom` 으로 제어 (내부 padding 아님)
- 표준 수치: `120px` (섹션 경계) · `80px` (중간 분리) · `60px` (서브 섹션)
- CLAUDE.md 기준: `섹션 패딩 Desktop 120px / Mobile 80px` — 실제 구현은 margin 위주

### Mobile (360~768px)

- 섹션 수직 여백: `80px` → `60px` (축소)
- 히어로 높이: `100svh` (주소창 대응)

## 2. 좌우 L-gap (수평 여백)

**Session 22 F4 교훈:** 섹션 배경 색상이 살짝 다르더라도 L-gap 값 자체는 **1.5% 단위** 로 구별 불가.

### 실측 클래스

| 클래스 | 역할 |
|--------|------|
| `.blk-header` | 글로벌 좌우 블록 |
| `.cat-grid` | 카테고리 그리드 |
| `.phil` | 철학 섹션 |
| `.hero-c` | 히어로 컨테이너 |

→ 좌우 패딩 0 (`#27` 완료) 적용 섹션이 존재. **섹션별로 L-gap 이 다르다** — 단일 값 가정 금지.

### 검증 방법

```bash
# 특정 섹션 실측 요구 시
grep -n "padding-left\|padding-right\|margin-left\|margin-right" next/src/app/globals.css | head -50
```

## 3. 섹션 배경 3단 로테이션 (Session 27 완료)

Home 페이지 섹션 배경이 다음 순서로 로테이션:

```
primary (#FAFAF8)
  ↓
secondary (#F5F3F0)
  ↓
tertiary (#ECEAE6)
  ↓ (반복)
```

⚠️ **재제안 금지** — 이미 적용됨 (`08-changes-since-session22.md` Session 27 참조).

## 4. 주요 섹션 구조 요약

### Home (/)

```
AnnouncementBar (36px)
SiteHeader (64px, sticky, glassmorphism)
├ HeroSection (100vh, 전폭, 비디오 bg)
├ TwoColSection (bg: secondary)
├ PhilSection (bg: tertiary)
├ BeansScrollSection (bg: primary, 가로 스크롤)
├ CafeMenuSection (bg: secondary, 탭 카드)
├ GoodDaysSection (bg: primary, 2x2 갤러리)
└ RoasterySection (bg: dark inverse · warm black)
SiteFooter (dark inverse)
```

### /story

- 지그재그 레이아웃 (좌-우-좌 반복)
- 세로 중앙 정렬 (Phase 2 #22 완료)

### /shop · /search

- 상품 그리드 (ShopCard 기반)

### /shop/[slug] (PDP)

```
ProductGallery (좌)  |  ProductDetailBody (우)
                     |   - 가격
                     |   - PurchaseRow
                     |   - ProductRoastStage (observer 애니)
                     |   - ProductFlavorNote (observer 애니)
ProductAccordions (하단 전폭)
ProductRecipeGuide
```

### /cart (Session 23 이식)

- 좌: 상품 리스트 테이블
- 우: 주문 요약 (sticky)

### /mypage

- 좌 사이드 카테고리 · 우 콘텐츠

## 5. 측정 소스

- 스크린샷: `01-screenshots-session33/*.png` (1440x900, retina 2x)
- 토큰: `02-tokens.css`
- 원본 CSS: `next/src/app/globals.css`

## 6. 팔레트 변경 시 필수 체크

- [ ] 3단 로테이션 현행 유지 확인
- [ ] 다크 bg 섹션(RoasterySection·Footer) 대비비 WCAG AA ≥ 4.5:1 유지
- [ ] PDP gauge/radar 색상 변경 시 ProductRoastStage·ProductFlavorNote 애니메이션 프레임과 호환성 확인
- [ ] CTA hover gold inset (Session 29/32 표준) 색 유지
