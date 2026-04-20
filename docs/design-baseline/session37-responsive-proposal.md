# 반응형 토큰 전략 제안서 (Session 37)

> **목적:** 데스크탑(1440) 기준 고정 px 토큰을 1024/768/360 에서도 타이포 위계·스페이싱 리듬이 깨지지 않게 전환.
> **범위:** 타이포·스페이싱·레이아웃 토큰만. 컬러/팔레트 무변경.
> **실행:** 제안서 → 사용자 승인 → Session 38 구현.

---

## 1. 현황 진단

### 토큰 사용 분포 (design-polish 기준, email 템플릿 제외)

| 지표 | 카운트 | 해석 |
|---|---|---|
| `--type-*` 토큰 사용 | 217 | 타이포는 토큰화 우수 |
| `font-size: Npx` 리터럴 | 29 | 일부 컴포넌트 inline — 토큰화 필요 |
| `padding/margin/gap: Npx` 리터럴 | 122 | 상당수 하드코딩 — 반응형 대응 어려움 |
| `@media` 쿼리 | 11 (globals.css 10) | **반응형 분기 거의 없음** ← 핵심 갭 |
| `clamp()` 사용 | 2 | 현재 fluid scaling 미채택 |

### 현재 토큰 상태
- **타이포 13단계** 모두 px 고정 (Display 48 · H1 36 · … · Label 11)
- **스페이싱 13단계** `--space-1..30` px 고정
- **레이아웃 상수** `--layout-padding-x: 60px` · `--section-gap: 120px` · `--header-height: 60px` · `--drawer-width: 540px` 모두 고정
- 기존 `@media` 분기는 **샘플 수준** (shipping gauge width, pagination 등 3~4곳)

### 결론
> 값은 1440 용으로 잘 잡혀 있으나 **브레이크포인트 대응 구조 자체가 부재**. 360 에서 Display 48px 은 2줄 wrap, `--layout-padding-x: 60px` 은 본문 영역을 40% 이하로 축소.

---

## 2. 브레이크포인트 축 (CLAUDE.md 기준)

| 구간 | BP | 레퍼런스 기기 | 전략 |
|---|---|---|---|
| Desktop | ≥ 1440 | FHD 이상 | 현 고정값 그대로 (max 값) |
| Laptop | 1024–1439 | MBA 13", iPad Pro 12.9" | 선형 보간 (preferred) |
| Tablet | 768–1023 | iPad | H1 이상만 축소, Body 유지 |
| Mobile | 360–767 | Android min, iPhone SE | min 값 강제 · 스택 전환 |

**두 축 병행 전략:**
- **A축 (Fluid):** 연속값 — `clamp()` 로 타이포·스페이싱·레이아웃 padding
- **B축 (Breakpoint):** 구조 전환 — 그리드 컬럼 수·카드 스택·드로어 폭 전환

---

## 3. Fluid Type Scale (A축)

### 공식
```
clamp(MIN, PREFERRED, MAX)
PREFERRED = (MIN + (MAX − MIN) × ((100vw − 360px) / (1440 − 360)))
          ≈ calc(MIN + (MAX − MIN) × ((100vw − 360px) / 1080))
단순화: calc(A + B * 1vw) — Utopia 방식
```

### 토큰 diff (before → after)

| 토큰 | Before | After (제안) | 근거 |
|---|---|---|---|
| `--type-display-size` | `48px` | `clamp(32px, 2rem + 2.2vw, 48px)` | 360 → 32 (2줄 방지), 1440 → 48 |
| `--type-h1-size` | `36px` | `clamp(26px, 1.625rem + 1.2vw, 36px)` | 360 → 26 |
| `--type-h2-size` | `32px` | `clamp(22px, 1.375rem + 1.1vw, 32px)` | 360 → 22 |
| `--type-h3-size` | `24px` | `clamp(18px, 1.125rem + 0.7vw, 24px)` | 360 → 18 |
| `--type-heading-m-size` | `18px` | `clamp(16px, 1rem + 0.2vw, 18px)` | 360 → 16 |
| `--type-heading-s-size` | `16px` | **유지** | 이미 body 사이즈, 축소 불필요 |
| `--type-body-l-size` | `18px` | `clamp(16px, 1rem + 0.2vw, 18px)` | 모바일 16 고정 |
| `--type-body-m-size` | `15px` | **유지** | 본문 하한 — 축소 시 가독성 저하 |
| `--type-body-s-size` | `13px` | **유지** | 이미 하한 |
| `--type-label-size` | `11px` | **유지** | 이미 하한 |
| `--type-caption-size` | `12px` | **유지** | 이미 하한 |
| `--type-input-size` | `16px` | **유지** | iOS 줌 방지 하한 |
| `--type-price-l-size` | `32px` | `clamp(24px, 1.5rem + 0.8vw, 32px)` | 360 → 24 |
| `--type-price-m-size` | `20px` | `clamp(18px, 1.125rem + 0.2vw, 20px)` | 360 → 18 |

### 원칙
1. **Body 이하 고정** — 15/13/11/12 는 가독성 하한, clamp 미적용
2. **Heading 만 fluid** — Display/H1/H2/H3/HeadingM 은 360 에서 단계 간 비율 `1.125~1.2` 유지
3. **iOS 줌 방지** — `--type-input-size: 16px` 고정 (iOS Safari 16 미만 줌-인 방지)
4. **rem 기반** — px 절대값 대신 rem 으로 써서 브라우저 확대 호환

### 위계 보존 검증표 (예상)

| | 1440 | 768 | 360 |
|---|---|---|---|
| Display | 48 | 40 | 32 |
| H1 | 36 | 30 | 26 |
| H2 | 32 | 27 | 22 |
| H3 | 24 | 21 | 18 |
| Body M | 15 | 15 | 15 |
| **Display/Body 비율** | 3.2× | 2.67× | 2.13× |

Display→Body 대비가 360 에서도 **2× 이상 유지** — 편집 잡지 위계 보존.

---

## 4. Fluid Spacing Scale (A축)

### 토큰 diff

| 토큰 | Before | After | 비고 |
|---|---|---|---|
| `--space-1..5` (4~20px) | 고정 | **유지** | 컴포넌트 내부 마이크로 간격 |
| `--space-6` (24px) | 고정 | **유지** | |
| `--space-8` (32px) | 고정 | **유지** | |
| `--space-10` (40px) | 고정 | `clamp(32px, 2rem + 0.5vw, 40px)` | 카드 내부 큰 간격 |
| `--space-12` (48px) | 고정 | `clamp(32px, 2rem + 1vw, 48px)` | |
| `--space-14` (56px) | 고정 | `clamp(40px, 2.5rem + 1vw, 56px)` | |
| `--space-16` (64px) | 고정 | `clamp(40px, 2.5rem + 1.4vw, 64px)` | |
| `--space-20` (80px) | 고정 | `clamp(48px, 3rem + 2vw, 80px)` | 섹션 내부 gap |
| `--space-24` (96px) | 고정 | `clamp(56px, 3.5rem + 2.5vw, 96px)` | |
| `--space-30` (120px) | 고정 | `clamp(64px, 4rem + 3.5vw, 120px)` | **섹션 간 패딩 핵심** |

### 레이아웃 상수 diff

| 토큰 | Before | After |
|---|---|---|
| `--layout-padding-x` | `60px` | `clamp(20px, 1.25rem + 2.5vw, 60px)` |
| `--layout-max-width` | `1320px` | **유지** |
| `--section-gap` | `120px` | `clamp(64px, 4rem + 3.5vw, 120px)` (= `--space-30` 참조) |
| `--header-height` | `60px` | `clamp(56px, 3.5rem, 60px)` (모바일 56) |
| `--ann-bar-height` | `36px` | `clamp(32px, 2rem, 36px)` |
| `--drawer-width` | `540px` | `min(540px, 100vw)` — 모바일 풀스크린 |

### 원칙
1. **마이크로(≤32px) 고정** — 공백 보존
2. **매크로(≥40px) fluid** — 섹션·카드 단위
3. **layout-padding-x** 가 최우선 — 1항목으로 전체 좌우 여백 반응형 획득

---

## 5. 브레이크포인트 구조 전환 (B축)

### 5-1. 그리드 컬럼 수

| 구간 | Shop 그리드 | Home Featured Beans | Good Days | Story 지그재그 |
|---|---|---|---|---|
| ≥ 1440 | 4 | 3 | 3 | 2 |
| 1024 | 3 | 3 | 3 | 2 |
| 768 | 2 | 2 | 2 | 1 (스택) |
| 360 | 2 (좁은 카드) | 1 | 2 | 1 |

> `grid-template-columns: repeat(auto-fill, minmax(Npx, 1fr))` 로 유연 분기 또는 BP 별 명시 컬럼 수.

### 5-2. 카트 드로어
- ≥ 1024: 540px 고정 (현행)
- 768–1023: 480px
- < 768: 100vw 풀스크린 (기존 `project_session36` 예고 반영)

### 5-3. 상품 상세
- ≥ 1024: 좌 이미지 + 우 구매 옵션 (현행)
- < 1024: 상 이미지 + 하 구매 옵션 (스택)

### 5-4. 체크아웃
- ≥ 1024: 2컬럼 (좌 폼 + 우 요약)
- < 1024: 1컬럼, 요약 카드 상단 sticky

### 5-5. 푸터
- ≥ 768: 4컬럼
- < 768: 1컬럼 아코디언 또는 스택

---

## 6. 구현 우선순위

| Step | 범위 | 리스크 | 파일 수 | 검증 방법 |
|---|---|---|---|---|
| **Step A** | `--layout-padding-x` + `--section-gap` + `--space-20/24/30` clamp 전환 | 🟢 낮음 | globals.css 1 | BP 3개 스크린샷 대조 |
| **Step B** | 타이포 토큰 clamp 전환 (Display/H1/H2/H3/Body L/Price L/M) | 🟡 중간 | globals.css 1 | BP 3개 타이포 위계 스크린샷 |
| **Step C** | `--drawer-width` min() + 카트 드로어 모바일 풀스크린 | 🟡 중간 | globals.css + CartDrawer | 카트 열기 테스트 |
| **Step D** | Shop/Featured/Good Days 그리드 BP 분기 | 🟡 중간 | 3~4 컴포넌트 CSS | 그리드 컬럼 전환 |
| **Step E** | 상품 상세 · 체크아웃 스택 전환 | 🔴 높음 | 2 페이지 구조 변경 | 전 페이지 리그레션 |
| **Step F** | 푸터 · 기타 컴포넌트 폴리시 | 🟢 낮음 | 다수 소규모 | 시각 확인 |

### 파일럿 범위 (Session 38 제안)
**A → B → C → D 순으로 홈·카트·주문완료 페이지만 파일럿.**
E/F 는 Session 39 이후 분리.

---

## 7. 예상 영향 범위

### 영향 많음
- `globals.css` — 토큰 ~25개 수정
- `SiteHeader` — header-height clamp 반영
- `CartDrawer` — drawer-width min() + BP 풀스크린
- `ShopPage` · `HomePage` Featured Beans · `GoodDaysGallery` — 그리드 컬럼 BP

### 영향 적음
- 푸터 · 로그인 · 마이페이지 — layout-padding-x clamp 자동 수혜
- 체크아웃 · 상품 상세 — Step E 에서만 구조 변경

### 리그레션 포인트
1. **Turbopack CSS HMR** (rules/web/lessons.md #5·6) — clamp() 적용 후 `.next/` 전체 삭제 강제
2. **iOS 줌 방지** — `--type-input-size` 16 유지 재확인
3. **backdrop-filter inline style** (lessons.md #6) — 헤더 bg1 color-mix 조합 유지
4. **서브 페이지 `position:fixed`** — clamp padding 적용 후 스크롤 영역 검증 (Session 35 UI-006 재발 방지)

---

## 8. 오픈 결정 사항

1. **Fluid 공식 선택** — Utopia(px·vw 혼합) vs 순수 clamp rem. 현 제안은 **rem + vw 혼합**
2. **브레이크포인트 수** — 3-tier(1024/768/360) vs 4-tier(+480). 카트 게이지는 이미 480 사용 → **4-tier 권고**
3. **rem 기반 전환 여부** — 현 globals.css 는 px base. rem 전환은 **별도 세션(Session 39+) 권고**
4. **모바일 풀스크린 드로어** — Session 36 예고된 방향. 구현 시 기존 dim 패턴 재검토 필요

---

## 9. 다음 단계

- [x] 제안서 작성 (Session 37)
- [ ] 사용자 검토 · 결정 사항 8 확정
- [ ] Session 38 — Step A + B + C 파일럿 (globals.css + CartDrawer + 홈/카트/주문완료)
- [ ] Session 39 — Step D (그리드 분기)
- [ ] Session 40 — Step E (페이지 구조 전환)

---

## 10. 롤백 경로

- 각 Step 단일 커밋 → `git revert <hash>`
- globals.css 토큰만 건드리는 Step A/B 는 단 1커밋으로 전체 복구 가능
- 구조 변경 Step E 는 브랜치 분리(`claude/responsive-structure-v1`) 권고
