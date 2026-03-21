# GOODTHINGS ROASTERS — Responsive System
**Version 1.0 · 2026**
*Based on Renewal Project v14 + Design System v1.2*

---

## 00 — Breakpoint 정의

| 토큰 | 범위 | 대표 기기 |
|---|---|---|
| **mobile** | ~ 767px | iPhone (390px 기준) |
| **tablet** | 768px ~ 1023px | iPad Mini / Air (768px 기준) |
| **laptop** | 1024px ~ 1439px | 소형 노트북 |
| **desktop** | 1440px ~ | 와이드 모니터 |

```css
/* Tailwind 커스텀 또는 CSS 미디어쿼리 기준 */
--bp-tablet:  768px;
--bp-laptop:  1024px;
--bp-desktop: 1440px;
```

> 기본 설계는 **Mobile First** — 모바일 기본값 기준으로 상위 breakpoint에서 재정의.

---

## 01 — Layout Grid (반응형)

| breakpoint | 컬럼 수 | 좌우 여백 (Padding) | Gutter | Max-width |
|---|---|---|---|---|
| mobile | 4 | 20px | 16px | 100% |
| tablet | 8 | 32px | 20px | 100% |
| laptop | 12 | 40px | 24px | 100% |
| desktop | 12 | auto (center) | 24px | 1440px |

---

## 02 — Typography Scale (반응형)

| 계층 | mobile | tablet | laptop | desktop |
|---|---|---|---|---|
| Display / Hero | 36px | 48px | 60px | 72px |
| H1 | 26px | 32px | 38px | 44px |
| H2 | 20px | 22px | 26px | 28px |
| H3 | 17px | 18px | 19px | 20px |
| Section Label | 10px | 11px | 11px | 11px |
| Body KR | 14px / LH 1.85 | 15px / LH 1.9 | 15px / LH 1.9 | 16px / LH 1.9 |
| Caption | 12px | 13px | 13px | 13px |

---

## 03 — Spacing Scale (반응형)

섹션 상하 여백(`section`)과 주요 내부 여백만 breakpoint별로 재정의.

| 토큰 | mobile | tablet | laptop | desktop |
|---|---|---|---|---|
| section | 72px | 96px | 108px | 120px |
| 3xl | 48px | 64px | 72px | 80px |
| 2xl | 36px | 44px | 48px | 56px |
| xl | 28px | 32px | 36px | 40px |

---

## 04 — 섹션별 반응형 스펙

### 4-1. Announcement Bar

| breakpoint | 변경 사항 |
|---|---|
| mobile | 폰트 9px, 패딩 8px 12px, 텍스트 단축 ("무료배송 · Specialty Coffee") |
| tablet~ | 원본 유지 |

---

### 4-2. Header / Navigation ★

데스크탑 레이아웃: `로고 + 인스타 | 네비 | 검색/계정/장바구니`

#### mobile / tablet (~ 1023px) — 햄버거 메뉴 전환

```
[ 로고 ]                    [ 검색 ] [ 장바구니 ] [ ☰ ]
```

- 햄버거 아이콘: `<span>` 태그, 3선 아이콘, 24×24px
- 메뉴 펼침: 풀스크린 오버레이 방식
  - 배경: `#000`, opacity 0.98
  - 메뉴 항목: DM Sans 500 · 32px (mobile) / 40px (tablet), 세로 정렬
  - 인스타그램 아이콘 하단 배치
  - 닫기 버튼: 우상단 `×`, `<span>` 태그
  - 진입 애니메이션: `translateX(100%) → 0`, 350ms easeOut (우측 슬라이드 인)
- 우측 아이콘: 검색 + 장바구니만 노출 (계정 아이콘 hidden)
- 인스타그램 아이콘: 헤더에서 hidden → 모바일 메뉴 내부로 이동

#### laptop / desktop (1024px~) — 기존 3단 레이아웃 유지

---

### 4-3. Hero ★

| 항목 | mobile | tablet | laptop | desktop |
|---|---|---|---|---|
| 높이 | 100svh | 100svh | 100vh | 100vh |
| 헤드카피 정렬 | 중앙 | 좌측 | 좌측 | 좌측 |
| 헤드카피 최대폭 | 100% | 560px | 680px | 760px |
| 서브 카피 | 표시 (13px) | 표시 (15px) | 표시 | 표시 |
| CTA 위치 | 하단, 여백 증가 | 좌측 | 좌측 | 좌측 |

> `100svh` 사용 이유: iOS Safari 주소창 높이 보정.

---

### 4-4. Cafe Menu

#### 시즌 배너

| breakpoint | 변경 사항 |
|---|---|
| mobile | 높이 240px, 텍스트 좌상단 정렬 |
| tablet | 높이 320px |
| laptop~ | 원본 유지 |

#### 카테고리 카드 (Coffee / Beverage / Dessert)

| breakpoint | 레이아웃 |
|---|---|
| mobile | 1열 세로 스택, 카드 높이 200px |
| tablet~ | 3열 (원본과 동일) |

---

### 4-5. Philosophy

| breakpoint | 레이아웃 |
|---|---|
| mobile | 이미지 상단 (100% width, 260px 고정) → 텍스트 하단 |
| tablet | 이미지 상단 (100% width, 340px) → 텍스트 하단 |
| laptop~ | 텍스트 좌(50%) + 이미지 우(50%) 원본 유지 |

---

### 4-6. Online Store ★

| breakpoint | 그리드 | 카드 per row |
|---|---|---|
| mobile | 2열 | 2개 |
| tablet | 2열 | 2개 |
| laptop | 4열 | 4개 |
| desktop | 4열 | 4개 |

#### mobile 카드 조정

- 원산지 / 이름 / 향미 유지
- 가격: 폰트 13px
- 뱃지: 좌상단 유지, 9px
- hover 효과: 터치 환경이므로 비활성 (`@media (hover: hover)`로 조건부 적용)

---

### 4-7. Roastery

| breakpoint | 변경 사항 |
|---|---|
| mobile | 텍스트 중앙 정렬, 패딩 60px 20px |
| tablet | 패딩 80px 32px |
| laptop~ | 원본 유지 |

---

### 4-8. Services (2열)

| breakpoint | 레이아웃 |
|---|---|
| mobile | 1열 세로 스택 |
| tablet~ | 2열 (원본과 동일) |

---

### 4-9. Good Days ★

데스크탑: `2fr + 1fr + 1fr` 마스너리 그리드

| breakpoint | 레이아웃 |
|---|---|
| mobile | 1열 세로 스택 (첫 번째 카드 grid-row 해제, 모두 동일 높이 240px) |
| tablet | 2열 균등 그리드 (`1fr 1fr`), 카드 높이 280px |
| laptop~ | 원본 `2fr + 1fr + 1fr` 마스너리 유지 |

---

### 4-10. Footer ★

**데스크탑**: 브랜드 영역 좌 + 4열 링크 우

| breakpoint | 레이아웃 |
|---|---|
| mobile | 브랜드 영역 → 링크 4열을 2×2 접기 → 법적 고지 |
| tablet | 브랜드 영역 상단 → 링크 4열 한 줄 (폰트 축소) → 법적 고지 |
| laptop~ | 원본 레이아웃 유지 |

#### mobile 법적 고지 변경

```
윗줄 (좌우 분리 → 세로 2줄로 변경):
  © 2026 주식회사 브이티이코프 · 510-81-30238
  Tel 010-9062-9910 · 경북 구미시 인동21길 22-11

아랫줄: 이용약관 / 개인정보처리방침 (유지)
```

---

### 4-11. Popup

| 항목 | mobile | tablet~ |
|---|---|---|
| 위치 | bottom: 16px, right: 16px | bottom: 24px, right: 24px (원본) |
| 카드 너비 | 180px | 200px (원본) |

---

## 05 — 터치 인터랙션 규칙

hover 기반 인터랙션은 터치 환경에서 조건부 적용.

```css
/* hover 효과는 포인팅 기기에서만 */
@media (hover: hover) and (pointer: fine) {
  .card:hover img { transform: scale(1.06); }
  .card:hover::after { background: rgba(0,0,0,.06); }
}
```

- 카드 탭 피드백: `active` 상태에서 `opacity: 0.85`, 100ms
- CTA 링크 탭: `active` 상태 opacity 0.5

---

## 06 — 미결 사항 (Responsive)

- [ ] 모바일 햄버거 메뉴 열림 시 스크롤 lock (`body: overflow: hidden`) 처리
- [ ] 모바일 Cafe Menu 카드 — 스와이프 캐러셀 전환 검토 (현재: 세로 스택)
- [ ] tablet 세로/가로 모드 분기 처리 여부
- [ ] 실제 기기 테스트 기준 기기 목록 확정 (iPhone 15 / Galaxy S24 / iPad Air 등)

---

*GOODTHINGS Responsive System v1.0 · 2026-03-21*
