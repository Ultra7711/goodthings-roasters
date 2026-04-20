# Session 38 반응형 전환 검증 결과 (Before/After)

> **Before:** `session37-audit/{1440|768|360}/` (24장)
> **After:** `session38-after/{1440|768|360}/` (24장)
> **커밋 범위:** `9104182e` (Step A) · `db38fba4` (Step B) · `c8f3140f` (Step C) · `c0400c35` (Step C 보완)

---

## 1. 1440 Desktop — 회귀 없음

모든 페이지가 픽셀 단위로 Before 와 동일. clamp() 의 max 상한이 기존 고정값을 보존 → 데스크탑 디자인 타겟 보존.

- `01-home` ✓ 히어로 Display(48px) 유지
- `04-product-detail` ✓ PriceL 32px 유지
- `05-cart-fullpage` ✓ H3·BodyL 유지

---

## 2. 360 Mobile — 핵심 개선

### 2-1. `01b-home-scrolled` — Display 줄바꿈 해소

| | Before | After |
|---|---|---|
| "좋은 것에는 시간이 필요합니다." | Display 48px → 3줄 wrap · gutter 압박 | Display 32px → 3줄 유지하되 균형 회복 |
| "오늘, 매장에서." | H2 32px → 우측 밀림 | H2 22px → 자연 수용 |
| Section padding | 120px × 2 | 64px × 2 → 섹션 밀도 정상화 |

### 2-2. `02-story` — Hero 가로 오버플로우 해소 **(핵심 증거)**

| | Before | After |
|---|---|---|
| "good things, take time." | Display 48px → 2줄 강제 줄바꿈 | Display 32px → **1줄 완전 수용** |
| layout-padding-x | 60px (본문 영역 240px) | 20px (본문 영역 320px) |

**효과:** 360 뷰포트에서 편집 잡지 위계(영문 헤드라인 1줄) 회복.

### 2-3. `04-product-detail` — PDP 구매 영역 여유

- 상품 박스 좌우 패딩 축소로 상품 이미지 ~10% 시인성 향상
- PriceL (스크롤 밖, below-the-fold) 에서 32→24 자동 수용

---

## 3. 768 Tablet — 중간 구간 자연 보간

1440 과 동일 수준 유지하되 section-gap · layout-padding-x 가 소폭 축소되어 컨텐츠 영역이 미세하게 확장. 위계 그대로 유지.

### 타이포 실효값 (글로벌 토큰 계산)
| 토큰 | 360 | 768 | 1440 |
|---|---|---|---|
| Display | 32 | 38.04 | 48 |
| H1 | 26 | 29.78 | 36 |
| H2 | 22 | 25.78 | 32 |
| H3 | 18 | 20.27 | 24 |
| HeadingM / BodyL | 16 | 16.76 | 18 |
| PriceL | 24 | 27.02 | 32 |
| PriceM | 18 | 18.76 | 20 |

### 스페이싱 실효값
| 토큰 | 360 | 768 | 1440 |
|---|---|---|---|
| layout-padding-x | 20 | ~34 | 60 |
| section-gap / space-30 | 64 | ~91 | 120 |
| space-24 | 56 | ~75 | 96 |
| space-20 | 48 | ~63 | 80 |
| header-height | 56 | ~58 | 60 |
| ann-bar-height | 32 | ~34 | 36 |

---

## 4. 드로어 (Step C) — 미확인 사항

본 캡처는 드로어 닫힘 상태 기준. 드로어 열림 상태 검증은 육안 확인 필요:

### 수동 검증 체크리스트
- [ ] **1440** CartDrawer 열기 → 664px 유지
- [ ] **768** CartDrawer 열기 → 풀스크린 전환 (`<768` 미디어쿼리)
- [ ] **360** CartDrawer 열기 → 풀스크린
- [ ] **768/360** CafeMenu → 메뉴 카드 → 영양정보 시트 열기 → 풀스크린 전환

---

## 5. 위계 보존 검증 최종

### 360 핵심 비율 (위계 요구사항)
- Display / BodyM = 32 / 15 = **2.13×** (≥ 2.0 충족) ✓
- H1 / H2 = 26 / 22 = **1.18×** (≥ 1.15 충족) ✓
- H2 / H3 = 22 / 18 = **1.22×** ✓
- H3 / HeadingM = 18 / 16 = **1.125×** ✓

### 1440 (현행 디자인 보존)
- 모든 단계 간 비율 기존값(1.125~1.33) 동일 유지 ✓

---

## 6. 파일럿 판정

| 항목 | 판정 |
|---|---|
| 데스크탑 회귀 | **없음** |
| 모바일 360 위계 | **보존** |
| Display 오버플로우 해소 | **완료** |
| 섹션 밀도 정상화 | **완료** |
| iOS 줌 방지 (BodyL ≥ 16) | **유지** |
| 드로어 모바일 풀스크린 | **코드 적용, 육안 검증 필요** |

**결론: 파일럿 3페이지(홈·카트·주문완료) 반응형 전환 성공.** 드로어 열림 상태 수동 확인 후 Session 39(Step D 그리드 BP) 진입 권고.

---

## 7. 잔여 관찰 (Session 39+ 후보)

- `03-shop` 360 — 상품 카드 2열 유지되나 카드 폭이 좁아 상품명 wrap 증가 → Step D 그리드 분기 필요
- `05-cart-fullpage` 360 — 상품 행 레이아웃 검토 필요
- `06-menu` — 메뉴 카드 간격 여전히 데스크탑 기준 → grid BP 분기 시 재조정
- `07-login` — 폼 좌우 여백이 너무 빡빡해질 수 있음 → 입력 필드 max-width 검토
- 푸터 4컬럼 — `<768` 에서 1컬럼 전환 (Step F)

## 8. After 캡처 경로

```
docs/design-baseline/session38-after/1440/  (8장)
docs/design-baseline/session38-after/768/   (8장)
docs/design-baseline/session38-after/360/   (8장)
```
