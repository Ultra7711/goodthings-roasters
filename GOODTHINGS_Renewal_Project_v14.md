# GOOD THINGS ROASTERS — 웹사이트 리뉴얼 설계안 v14

> 작성 기준: 2026년 3월  
> 현재 버전: v14  
> 브랜드: 굿띵스 로스터스 (goodthingsroasters.com)  
> 운영사: 주식회사 브이티이코프 · 사업자번호 510-81-30238

---

## 1. 브랜드 카피 시스템

### 헤드 카피 (확정)
```
Good Things, Simply Roasted.
Crafted for the quiet moments that make your day.
```

### 철학 섹션 카피 (확정)
```
Good Things, Take Time.

빠름보다 바름을 선택합니다.
정직한 로스팅, 일관된 품질, 그리고 진심.
굿띵스가 지켜온 단 하나의 기준입니다.
```

### 서브 카피 (Hero)
```
정성껏 로스팅한 원두로,
당신의 하루를 특별하게 만듭니다.
```

---

## 2. 메뉴 네이밍 (확정)

| 메뉴 | 내용 |
|---|---|
| **The Story** | 브랜드 철학, 로스터리, 카페 위치 안내 |
| **Shop** | 온라인 구매 가능 상품 (원두, 굿즈, 정기배송) |
| **Work with Us** | 원두 납품 등 B2B 비즈니스 |
| **Good Days** | 이미지 갤러리 (인스타그램 피드 스타일) |

---

## 3. 디자인 시스템 v1.2

### 3-1. Color Palette
UI 배경은 흑백 모노톤, 콘텐츠 이미지는 풀컬러 정책.

| 토큰 | 값 | 용도 |
|---|---|---|
| Black | #000000 | |
| — | #111111 | |
| — | #222222 | |
| — | #444444 | |
| Mid | #888888 | |
| — | #BBBBBB | |
| Border | #DDDDDD | |
| Surface | #F5F5F5 | |
| White | #FFFFFF | |

### 3-2. Typography

| 역할 | 폰트 | 굵기 | 크기 | Letter Spacing |
|---|---|---|---|---|
| Display/Hero | DM Sans | 600 | 64–80px | -0.03em |
| H1 | DM Sans | 500 | 36–44px | -0.02em |
| H2 | DM Sans | 500 | 24–28px | -0.01em |
| H3 | DM Sans | 500 | 18–20px | — |
| Section Label | DM Sans | 400 | 11px | 0.12em (Uppercase) |
| Body KR | Noto Sans KR | 300 | 15–16px | — (LH 1.9) |
| Caption | DM Sans | 400 | 13px | — |

- Serif 완전 배제
- 섹션 레이블: 영문 uppercase
- 헤드라인: 영문 DM Sans
- 본문: 한글 Noto Sans KR 300
- CTA/태그: 영문

### 3-3. Spacing Scale (4px 기준)

| 토큰 | 값 |
|---|---|
| xs | 4px |
| sm | 8px |
| md | 16px |
| lg | 24px |
| xl | 40px |
| 2xl | 56px |
| 3xl | 80px |
| section | 120px |

### 3-4. Layout Grid
- 12컬럼 / 좌우 1col 여백
- Max-width: 1280px
- Gutter: 24px
- 비대칭 허용

### 3-5. Motion
- Fade In: 600ms + Slide Up: 700ms easeOut
- Scroll Trigger: IntersectionObserver threshold 0.15, stagger 80ms
- Hover opacity: 200ms linear

### 3-6. Button 규칙
- Radius: 0 (텍스트/일반 버튼)
- Primary: #111 fill
- Secondary: 0.5px border
- Ghost: underline

---

## 4. 페이지 섹션 구조 (홈)

| 순서 | 섹션명 | 설명 |
|---|---|---|
| 1 | Announcement Bar | "원두 구매 15,000원 이상 무료 배송 · Specialty Coffee for All" |
| 2 | Header | 로고 + 인스타 아이콘 + 네비게이션 + 검색/계정/장바구니 |
| 3 | Hero | 풀블리드 다크 비주얼 + 헤드카피 |
| 4 | Cafe Menu | 시즌 배너 + Coffee/Beverage/Dessert 카테고리 카드 |
| 5 | Philosophy | 텍스트 좌 + 이미지 우 (50:50) |
| 6 | Online Store | 원두 상품 4열 그리드 |
| 7 | Roastery | 다크 배경 풀블리드 배너 |
| 8 | Services | 원두 납품 / 정기배송 2열 |
| 9 | Good Days | 이미지 갤러리 마스너리 그리드 |
| 10 | Footer | 블랙 배경, 4열 링크, 법적 고지 |

---

## 5. 섹션별 상세 스펙

### 5-1. Header
- **좌측**: 로고 SVG + 구분선 없이 gap 14px + 인스타그램 아이콘
- **중앙**: The Story / Shop / Work with Us / Good Days
- **우측**: 검색 / 계정 / 장바구니 아이콘 (span 태그, 아웃라인 없음)
- 인스타그램 링크: https://www.instagram.com/goodthings_roasters/
- 아이콘 버튼: `<span>` 태그 사용 (button 태그 기본 스타일 회피)

### 5-2. Hero
- 높이: 풀 뷰포트
- 배경: 다크 그라디언트 (#000 ~ #2a2a2a)
- 스크롤 인디케이터: 없음 (제거 확정)
- CTA: `Shop Now →`

### 5-3. Cafe Menu
- **시즌 배너**: 시즌마다 배경 이미지 교체 가능 구조, 우하단 원형 아이콘 버튼
- **카테고리 카드 3열**: Coffee / Beverage / Dessert
  - 카테고리 레이블(01~03) 없음
  - 각 카드 우하단에 원형 아이콘 버튼
- **하단 CTA**: `Cafe Menu →` (중앙 정렬)

### 5-4. Philosophy
- 레이아웃: 텍스트 좌(50%) + 이미지 우(50%)
- 타이틀: `Good Things, Take Time.`
- CTA: `The Story →` (align-self: flex-start 적용)

### 5-5. Online Store
- 4열 그리드
- 카드 구성: 뱃지(좌상단) + 이미지 + 원산지/이름/향미/가격
- 뱃지 종류: New(#111), 인기 No.1(#c8a84b), 수량 한정(흰 배경)
- hover: scale(1.06) 줌인 + overlay 어둡게
- **하단 CTA**: `Shop →` (중앙 정렬, 구분선 투명)

### 5-6. Roastery
- 다크 배경 풀블리드
- CTA: `Cafe & Location →` (푸터 링크명과 통일)

### 5-7. Services (2열)
- Business: 원두 납품 & 비즈니스 → `Work with Us →`
- Subscription: 정기 배송 → `Shop →`

### 5-8. Good Days
- 마스너리 그리드: 2fr + 1fr + 1fr, 2행
- 첫 번째 카드: grid-row 1/3 (세로 2칸)
- hover: scale(1.06) 줌인 + overlay 어둡게
- **하단 CTA**: `Gallery →` (중앙 정렬, 구분선 투명)

---

## 6. 공통 인터랙션 규칙

### 6-1. Hover 시스템

| 요소 | 기본 opacity | hover opacity |
|---|---|---|
| 네비게이션 메뉴 | .55 | 1 |
| 인스타그램 아이콘 | .45 | 1 |
| 헤더 아이콘 버튼 | .5 | 1 |
| CTA 링크 | .6 | 1 |
| View All / 섹션 하단 CTA | .45 | 1 |
| 푸터 링크 | rgba(255,255,255,.28) | rgba(255,255,255,.7) |
| 푸터 법적 링크 | rgba(255,255,255,.22) | rgba(255,255,255,.7) |

### 6-2. 카드 Hover
- `::after` pseudo overlay: rgba(0,0,0,0) → rgba(0,0,0,.06)
- 이미지 줌인: scale(1.06), 400ms cubic-bezier(.25,.46,.45,.94)
- transition: background 200ms linear

### 6-3. 원형 아이콘 버튼 규칙 (신규 패턴)
카드 바로가기에 통일 적용.

| 컨텍스트 | 클래스 | 스타일 |
|---|---|---|
| 어두운/컬러 배경 | `.icon-btn-dark` | color: rgba(0,0,0,.55), border: rgba(0,0,0,.3) |
| 밝은 배경/카드 | `.icon-btn-light` | color: text-secondary, border: border-secondary |

- 버튼 크기: 36px × 36px
- border-radius: 50%
- border: .5px solid
- 아이콘: 14px × 14px 화살표 (→)

### 6-4. CTA 링크 스타일
- font-size: 10px
- letter-spacing: .08em
- text-transform: uppercase
- border-bottom: .5px solid (텍스트 길이만큼)
- **주의**: flex 컨테이너 내 사용 시 `align-self: flex-start` 필수

### 6-5. 섹션 하단 CTA 패턴
- padding: 18px 20px
- justify-content: center
- border-top: .5px solid (배경색과 동일 — 시각적으로 숨김)
- 적용 섹션: Online Store, Cafe Menu, Good Days

---

## 7. Popup (신규 원두 알림)

- **위치**: position: fixed; bottom: 24px; right: 24px (실제 구현 시)
- **카드 너비**: 200px
- **닫기 버튼**:
  - 클릭 영역: 34px (투명)
  - 보이는 원: 24px, 블랙(#111)
  - 위치: `transform: translate(calc(50% - 6px), calc(-50% + 6px))` — 카드 우상단 모서리 기준 안쪽
  - `<span>` 태그 사용 (button 태그 기본 스타일 회피)
- **CTA**: 카드 우하단 원형 아이콘 버튼 (icon-btn-light)
- **텍스트 CTA 없음** (Shop 레이블 삭제 확정)
- 세션 스토리지로 재노출 방지 권장 (구현 시 적용)

---

## 8. Footer

### 8-1. 브랜드 영역
- 로고 SVG (filter: invert(1))
- 인스타그램 아이콘 (구분선 없음, gap 14px)
- 태그라인: "Good Things, Simply Roasted."

### 8-2. 4열 링크 구조

| The Story | Shop | Work with Us | Good Days |
|---|---|---|---|
| Philosophy | 온라인 스토어 | 원두 납품 | Gallery |
| Roastery | 메뉴 | Wholesale | Q&A |
| Cafe & Location | 굿즈 | Contact | |

### 8-3. 하단 법적 고지 (2줄 레이아웃)

**윗줄**
- 좌: © 2026 주식회사 브이티이코프 · 사업자번호 510-81-30238 · Tel 010-9062-9910
- 우: 경북 구미시 인동21길 22-11

**아랫줄**
- 이용약관 / 개인정보처리방침
- 구분: .5px border-right rgba(255,255,255,.12)
- 모든 링크 동일 색상 (강조 없음)

### 8-4. 푸터 링크 Hover
- 기존 opacity 방식 (어두워짐) → `color: rgba(255,255,255,.7)` 방식 (밝아짐) 통일

---

## 9. 기술 스펙 (구현 방향)

- **프레임워크**: Next.js 14 + React + Tailwind CSS
- **폰트**: Google Fonts (DM Sans, Noto Sans KR)
- **로고**: SVG 인라인 또는 base64 인코딩
  - viewBox: `0 0 640 142`
  - fill: #010101 (라이트 모드) / invert(1) filter (다크 배경)
- **스크롤 애니메이션**: IntersectionObserver
- **팝업**: 세션 스토리지 재노출 방지
- **인스타그램**: @goodthings_roasters

---

## 10. 미결 사항 (Pending)

- [ ] 각 서브 페이지 상세 목업 (The Story, Shop, Work with Us, Good Days/Gallery)
- [ ] 실제 이미지 소스 적용 (Hero, Philosophy, Cafe Menu, Roastery, 상품 카드)
- [ ] 헤더 검색 클릭 시 입력란 열리는 인터랙션 구현
- [ ] Cafe Menu 시즌 배너 CMS 교체 구조 설계
- [ ] 정기 배송 구독 플로우
- [ ] 모바일 반응형 레이아웃 설계
- [ ] Cafe24 또는 자체 구축 여부 확정

---

*문서 버전: v14 / 최종 업데이트: 2026-03-21*