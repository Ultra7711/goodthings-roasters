# Recipe Card Responsive — 재설계 명세

> 작성: 2026-04-20 | 브랜치: design-polish | CSS 적용: globals.css L4304~L4524

## 1. 선택 옵션 및 근거

**옵션 C (Container Queries, cqi 단위) + 옵션 D (Grid body) 결합**

### 왜 옵션 C가 필요한가

`pd-content`는 뷰포트 1024px 경계에서 2col↔1col로 전환된다.
이때 카드 폭이 뷰포트와 비선형적으로 변한다:

| 뷰포트 | pd-content | 카드 폭 |
|--------|------------|---------|
| 1023px | 1col | 932px |
| 1024px | 2col | 208px |

뷰포트 MQ만 사용하면 1023→1024px 경계에서 카드 폭이 932→208px로 점프한다.
Container Queries(cqi 단위)는 카드 폭 자체를 기준으로 illust 크기를 조정하므로,
어떤 레이아웃 전환이 일어나도 illust가 연속적으로 변한다.

단, 카드 폭만으로는 "스택 vs 사이드바이사이드" 방향을 구별할 수 없으므로
(208~312px 범위가 데스크탑/모바일에서 겹침),
레이아웃 방향 전환은 뷰포트 MQ(1024px)로 제어한다.

### 왜 옵션 D (Grid body)가 필요한가

기존 `flex: 1 1 0` 기반의 illust 배치는 남는 공간을 예측 불가능하게 분배한다.
`grid-template-columns: clamp(100px, 35cqi, 150px) minmax(0, 1fr)` 전환으로:

- illust 컬럼 폭이 cqi 단위로 정확히 결정됨 (떠 있는 현상 불가)
- text 컬럼이 남는 공간을 정확히 차지
- `minmax(0, 1fr)`의 min:0 덕분에 dd가 오버플로 없이 줄바꿈됨

### 브라우저 호환성

- Container Queries: Chrome 105+(2022.08), Safari 16+(2022.09), Firefox 110+(2023.02)
- `cqi` 단위: 동일
- 2026년 기준 지원율 ~96% — polyfill 불필요 (브리프 제약 충족)

---

## 2. BP 정의 (최소 2단계)

| 구간 | 조건 | 카드 그리드 | 카드 내부 레이아웃 |
|------|------|------------|------------------|
| 데스크탑 | vp ≥ 1024px | 2col | 스택 (illust 상단 200px · text 하단 중앙) |
| 모바일/태블릿 | vp < 1024px | 1col | 사이드바이사이드 (illust 좌 · text 우) |
| 드립백 좁음 | vp ≤ 480px | 1col 강제 | 드립백 3열 → 1열 |

**illust 크기**: `<1024px`에서 `clamp(100px, 35cqi, 150px)` — 카드 폭의 35%, 100~150px 사이

---

## 3. 각 BP에서 illust/text/card 폭 수치

### pd-recipe-cards 컨테이너 폭 계산

`--layout-padding-x = clamp(20px, 1.25rem + 2.5vw, 60px)`

| 뷰포트 | pd-content | lpx (각 측) | cards-container 폭 |
|--------|------------|------------|-------------------|
| 360px | 1col | 29px | 302px |
| 480px | 1col | 32px | 416px |
| 768px | 1col | 39px | 690px |
| 1023px | 1col | 46px | 932px |
| 1024px | 2col | — | 432px (vp/2 − 80px) |
| 1100px | 2col | — | 470px |
| 1440px | 2col | — | 640px |

> pd-info 데스크탑 padding: `0 60px 80px 20px` → cards-container = vp/2 − 80px

### Coffee Bean 카드 폭 (그리드 gap=16px 적용)

| 뷰포트 | cards-container | 카드 폭 | 카드 그리드 |
|--------|----------------|---------|-----------|
| 360px | 302px | 302px | 1col |
| 480px | 416px | 416px | 1col |
| 768px | 690px | 690px | 1col |
| 1023px | 932px | 932px | 1col |
| 1024px | 432px | 208px | 2col, (432−16)/2 |
| 1100px | 470px | 227px | 2col, (470−16)/2 |
| 1440px | 640px | 312px | 2col, (640−16)/2 |

---

## 4. 수학적 검증

### 사이드바이사이드 레이아웃 (vp < 1024px)

카드 padding: `24px 24px 26px` → usable = 카드폭 − 48px

illust 컬럼 = `clamp(100px, 35cqi, 150px)` — cqi는 #pd-recipe-cards 폭 기준

> 주의: `cqi`는 cards-container(#pd-recipe-cards) 기준이지 card 기준이 아님.
> 하지만 카드가 컨테이너와 동일 폭이므로 (1col 그리드) cqi ≈ 카드 폭 기준과 동일.

| 뷰포트 | 카드폭 | usable | 35cqi | illust | text 폭 | dd 가용폭* | dd 줄바꿈 |
|--------|--------|--------|-------|--------|---------|-----------|----------|
| 360px | 302px | 254px | 106px | 106px | 134px | 84px | O (허용) |
| 480px | 416px | 368px | 146px | 146px | 208px | 158px | O (허용) |
| 768px | 690px | 642px | 242px | 150px | 478px | 428px | X |
| 1023px | 932px | 884px | 326px | 150px | 720px | 670px | X |

> *dd 가용폭 = text폭 − dt폭(~42px) − column-gap(12px)
> 줄바꿈 O = 허용 (오버플로 없음), X = 줄바꿈 불필요

### 스택 레이아웃 (vp ≥ 1024px)

카드 padding: `24px 24px 26px` → text 유효폭 = 카드폭 − 48px

| 뷰포트 | 카드폭 | illust | text 유효폭 | dd 가용폭* | dd 줄바꿈 |
|--------|--------|--------|------------|-----------|----------|
| 1024px | 208px | min(200px,100%) = 160px | 160px | 106px | O (허용) |
| 1100px | 227px | 179px | 179px | 125px | O (허용) |
| 1440px | 312px | 264px | 264px | 210px | X |

> *dd 가용폭 = text유효폭 − dt폭(~42px) − column-gap(12px)

### "2분 이내(뜸 30초)" 오버플로 증명

`grid-template-columns: max-content minmax(0, 1fr)` 적용 시:

- dd 컬럼 = `minmax(0, 1fr)` → 남은 폭을 정확히 차지, 최솟값 0
- CSS 그리드의 `min: 0` 설정으로 dd가 1fr 폭을 초과하려 해도 **절대 오버플로하지 않음**
- 폭이 부족하면 `word-break: keep-all; overflow-wrap: break-word`로 줄바꿈
- 기존 `max-content max-content` → dd가 자연 폭(168px) 그대로 → 좁은 카드에서 오버플로
- 신규 `max-content minmax(0, 1fr)` → dd가 남은 폭 내에서 줄바꿈 → **오버플로 없음 ✓**

---

## 5. CSS 설계 결정 사항

### 캐스케이드 순서 (실패 이력 #2, #3 방지)

```
1. 베이스: #pd-recipe-cards, .pd-recipe-card, .pd-recipe-card--split
2. 베이스 MQ: @media max-width 1023px (1열 전환)
3. split body 베이스 (사이드바이사이드, 기본값)
4. 데스크탑 MQ: @media min-width 1024px (스택 전환) — 베이스 뒤에 선언
5. 공통 공유 룰: .pd-recipe-illust, .pd-recipe-method, .pd-recipe-table
```

MQ는 항상 베이스 규칙 뒤에 선언.

### illust 크기 결정 방식

- `<1024px`: `clamp(100px, 35cqi, 150px)` — grid 컬럼 크기로 illust 컨테이너 결정, img는 `width: 100%; aspect-ratio: 1`
- `>=1024px`: `min(200px, 100%)` — 스택에서 카드 풀폭 내 최대 200px

`transform: scale()` 금지 (실패 이력 #1).

### pd-recipe-table

모든 컨텍스트: `max-content minmax(0, 1fr)` — split 카드에서 `width: 100%` 추가로 컨테이너 풀폭 차지.

---

## 6. 파일 변경 목록

| 파일 | 변경 내용 |
|------|---------|
| `next/src/app/globals.css` | L4304~L4524 전면 교체 (기존 256줄 → 신규 221줄) |
| `next/src/components/product/ProductRecipeGuide.tsx` | 변경 없음 (DOM 구조 호환) |
| `docs/recipe-card-responsive-spec.md` | 신규 작성 |

---

## 7. 검증 체크리스트

### BP별 레이아웃 확인

- [ ] **360px**: 카드 1열, 사이드바이사이드, illust ~106px (clamp 하한), 줄바꿈 있어도 오버플로 없음
- [ ] **480px**: 카드 1열, 사이드바이사이드, illust ~146px, 표 정상 표시
- [ ] **768px**: 카드 1열, 사이드바이사이드, illust 150px (clamp 상한), 표 정상
- [ ] **1023px**: 카드 1열, 사이드바이사이드, illust 150px
- [ ] **1024px**: 카드 2열, 스택, illust 160px, 표 줄바꿈 있어도 오버플로 없음
- [ ] **1100px**: 카드 2열, 스택, illust 179px
- [ ] **1440px**: 카드 2열, 스택, illust 200px (최대), 표 정상

### BP 경계 시각 점프 없음 확인

- [ ] **1023→1024px**: 레이아웃 방향 전환(사이드바이사이드→스택)은 의도된 변화. illust가 갑자기 커지는 점프 없이 부드럽게 전환되는지 확인.
- [ ] **479→480px**: illust가 146px로 연속 전환 (clamp 연속). 급격한 크기 변화 없음.
- [ ] cqi 하한(100px) 도달: 302px 컨테이너에서 35cqi=106px → 하한 미도달. 289px 이하에서만 하한 적용. 현재 최소 카드폭 302px이므로 하한 도달 없음.
- [ ] cqi 상한(150px) 도달: 429px 컨테이너에서 35cqi=150px. 480vp(416px 카드)에서 상한 직전. 이 경계 전후 illust 크기 연속 확인.

### "2분 이내(뜸 30초)" 오버플로 확인

- [ ] **360px**: DevTools에서 `.pd-recipe-dd`가 카드 경계 내에 있는지 확인
- [ ] **1024px**: DevTools에서 `.pd-recipe-dd`가 카드 경계 내에 있는지 확인
- [ ] 모든 BP에서 `.pd-recipe-card--split` 컨텐츠가 카드 `border-radius` 박스 내부에 있는지 확인

### 이미지 시각 균형 확인

- [ ] 데스크탑(1024-1440px): illust가 카드 상단 중앙에 위치, 텍스트와 시각 구분 명확
- [ ] 모바일(360-1023px): illust가 텍스트 좌측에 고정, 빈 공간에 "떠 있는" 현상 없음
- [ ] illust 컨테이너가 grid 컬럼으로 고정되어 항상 텍스트와 맞붙어 있는지 확인

### 드립백 레시피 영향 없음 확인

- [ ] 드립백 카드(`.pd-recipe-card`, `.is-drip`)가 `--split` 클래스 없이 기존 스택 형태 유지
- [ ] 768px 이상에서 드립백 3열 그리드 정상 표시
- [ ] 480px 이하에서 드립백 1열로 전환됨
