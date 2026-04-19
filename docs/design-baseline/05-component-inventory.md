---
title: 실제 존재하는 컴포넌트 인벤토리 (F2 방지 — 가공 컴포넌트 참조 차단)
created: 2026-04-19
source: next/src/components/**
---

# 컴포넌트 인벤토리

> **목적:** Claude Design 이 존재하지 않는 컴포넌트 (예: Session 22 `LimitedBadge`) 를 전제로 제안하는 사고 방지.
>
> **규칙:** 이 리스트에 없는 컴포넌트명은 제안 금지. 신규 컴포넌트 필요 시 "신규 제안" 으로 명시.

## layout/

| 파일 | 역할 |
|------|------|
| SiteHeader.tsx | 글로벌 헤더 (글래스모피즘) |
| SiteFooter.tsx | 글로벌 푸터 |
| FooterBottom.tsx | 푸터 하단 법적 정보 |
| FooterWholesaleLink.tsx | 푸터 도매 문의 링크 |
| AnnouncementBar.tsx | 상단 공지 바 |
| ToastContainer.tsx | 토스트 알림 |
| SRInitializer.tsx | Scroll Reveal 초기화 |

## home/ (랜딩)

| 파일 | 역할 |
|------|------|
| HeroSection.tsx | 히어로 비디오 + good things 타이틀 |
| TwoColSection.tsx | 2컬럼 레이아웃 (히어로 하단) |
| PhilSection.tsx | 철학·브랜드 스토리 |
| BeansScrollSection.tsx | Featured Beans 가로 스크롤 |
| CafeMenuSection.tsx | 카페 메뉴 탭 |
| GoodDaysSection.tsx | Good Days 갤러리 미리보기 |
| RoasterySection.tsx | 로스터리 방문 CTA |

## story/

| 파일 | 역할 |
|------|------|
| StoryPage.tsx | /story 지그재그 편집 |

## shop/

| 파일 | 역할 |
|------|------|
| ShopCard.tsx | 상품 리스트 카드 |
| (외 상품 그리드 관련) | /shop · /search 공유 |

## product/ (PDP)

| 파일 | 역할 |
|------|------|
| ProductDetailPage.tsx | PDP 래퍼 |
| ProductDetailBody.tsx | PDP 본문 |
| ProductGallery.tsx | 상품 이미지 갤러리 |
| ProductRoastStage.tsx | **5단계 로스팅 게이지** (observer 애니메이션) |
| ProductFlavorNote.tsx | **flavor 레이더/바 차트** (observer 애니메이션) |
| ProductAccordions.tsx | 접이 정보 패널 (specs·스토리·배송) |
| ProductRecipeGuide.tsx | 추출 레시피 가이드 |
| PurchaseRow.tsx | 수량·볼륨·장바구니 버튼 행 |
| recipeIcons.tsx | 추출 도구 아이콘 |

## cart/

| 파일 | 역할 |
|------|------|
| CartDrawer.tsx | 우측 슬라이드인 드로어 |
| (그 외 /cart 풀페이지는 app 라우트) | Session 23 이식 완료 |

## checkout/ · auth/ · biz/ · cafe/ · gooddays/ · search/ · providers/ · ui/

해당 디렉터리도 존재. 필요 시 `ls next/src/components/<dir>` 로 재확인.

## 뱃지 관련 — 실제 사용 클래스

> Session 22 가 `LimitedBadge` 컴포넌트를 전제로 제안했으나 **존재하지 않음**. 실제로는 CSS 클래스로 처리:

| 클래스 | 용도 |
|--------|------|
| `.badge-pop` | POP 뱃지 |
| `.badge-ltd` | Limited 뱃지 |
| `.badge-temp` | 임시 뱃지 |
| `.badge-sold` | 품절 뱃지 (토큰: `--color-badge-sold-out`) |

뱃지 변경은 **CSS 클래스 스타일 수정**으로 처리. 컴포넌트 새로 만들지 말 것.

## 애니메이션 특수 처리 컴포넌트

- `ProductRoastStage` — IntersectionObserver + 850ms initial delay + 280ms 순차
- `ProductFlavorNote` — IntersectionObserver 기반 레이더 fill
- `SRInitializer` — 전역 scroll reveal (data-sr 속성)

→ 팔레트 변경 시 이 컴포넌트들의 **색상 토큰** 만 변경 가능. 애니메이션 로직은 건드리지 않음.
