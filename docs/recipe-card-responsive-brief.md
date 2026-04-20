# Recipe Card Responsive Design Brief

## 목적

상품 상세 페이지의 **레시피 가이드 카드**(Coffee Bean) 반응형 레이아웃을 재설계한다. 3시간 이상 BP별 스팟 픽스를 반복했으나 근본 구조가 불안정하여 전면 재설계 필요.

## 파일 위치

- CSS: `next/src/app/globals.css` — 현재 이식 경로는 `.claude/worktrees/design-polish/next/src/app/globals.css`
- 컴포넌트: `next/src/components/product/ProductRecipeGuide.tsx`
- 데이터: `next/src/lib/products.ts`

## 데이터 제약 (고정)

**메서드명** (4종):
- 에어로프레스 · 에스프레소 · 모카포트 · 브루잉

**표 라벨 (dt, 고정 4행)**:
- 원두량 · 추출시간 · 온도 · 물량

**가장 긴 dd 값 (브루잉 추출시간)**:
- `2분 이내(뜸 30초)` — 14px 기준 자연 폭 ~168px

**일러스트**: `/images/icons/recipe_{slug}_large.svg` — 200×200 viewBox SVG

## DOM 구조 (변경 가능)

```tsx
<div className="pd-recipe-card pd-recipe-card--split">
  <div className="pd-recipe-body">
    <div className="pd-recipe-illust">
      <img src={...} width={196} height={196} />
    </div>
    <div className="pd-recipe-text">
      <div className="pd-recipe-method">{method}</div>
      <div className="pd-recipe-table">
        <span className="pd-recipe-dt"><span>원두량</span></span>
        <span className="pd-recipe-dd">{dose}</span>
        ...
      </div>
    </div>
  </div>
</div>
```

## 부모 레이아웃 (수정 불가)

- `#pd-content`: `grid-template-columns: 1fr 1fr` @ ≥1024px, `1fr` @ ≤1023px
- `#pd-info` 내부 padding: `48px var(--layout-padding-x) 80px`
- `--layout-padding-x`: `clamp(20px, 1.25rem + 2.5vw, 60px)` (20~60px)
- `#pd-recipe-cards`: 레시피 카드 그리드 컨테이너 (개수 조정 가능)

**pd-info 유효 inner 폭 요약**:

| 뷰포트 | pd-content | pd-info inner (대략) |
|--------|------------|---------------------|
| 1440px | 2-col | ~640px × 2 |
| 1100px | 2-col | ~470px × 2 |
| 1024px | 2-col | ~432px × 2 |
| 1023px | 1-col | ~910px |
| 768px | 1-col | ~690px |
| 480px | 1-col | ~400px |
| 360px | 1-col | ~280px |

## 디자인 요구사항

### 필수

1. **일관성**: 뷰포트 축소 시 카드·이미지·텍스트가 **연속적으로** 축소되어야 함. BP 경계에서 시각적 점프 금지.
2. **이미지**: 항상 텍스트 영역과 시각적으로 균형. 빈 공간에서 이미지가 "떠 있는" 현상 금지.
3. **텍스트 오버플로 금지**: "2분 이내(뜸 30초)" 와 같은 긴 dd 값이 카드 밖으로 나가지 않아야 함.
4. **카드 개수**: 데스크탑(≥1025px) 2열, 모바일(≤480px) 1열. 중간 구간은 설계 자유.
5. **최소 뷰포트 360px 지원**: Android 최소 기준.

### 이상적 모바일(360px) 레퍼런스

- 카드 1열, 좌측 이미지(~150px) + 우측 텍스트(메서드명 + 4행 표)
- 이미지가 텍스트보다 살짝 크거나 동등한 시각 무게
- 텍스트 표는 `dt 라벨 | dd 값` 2열 그리드

### 이상적 데스크탑(≥1025px) 레퍼런스

- 카드 2열, 각 카드는 이미지 상단(200px) + 텍스트 하단(200px 중앙정렬) 스택
- 메서드명 중앙정렬

## 실패 이력 (반복하지 말 것)

1. **`transform: scale(1.5)` 로 이미지 확대**
   - ≤480px에서 108px → scale 1.5로 시각 162px
   - 481↔480 경계에서 +42px 시각 점프 발생
   - 레이아웃 공간과 시각 크기 분리가 근본 원인

2. **MQ를 베이스 룰 앞에 배치**
   - `@media` 가 베이스 룰보다 앞에 있으면 CSS 캐스케이드에서 베이스가 덮어씀
   - MQ는 반드시 베이스 룰 **뒤** 에 선언

3. **`.pd-recipe-card` 와 `.pd-recipe-card--split` 간 특이성 충돌**
   - `.pd-recipe-card { padding: ... }` (L4812, ≤767px) 이 뒤에 있어 `.pd-recipe-card--split` 를 덮음
   - 해결: `.pd-recipe-card.pd-recipe-card--split` 이중 클래스로 특이성 상승

4. **`grid-template-columns: max-content max-content`**
   - `.pd-recipe-table` 기본 값
   - 긴 dd 값이 줄바꿈 없이 카드 밖으로 오버플로
   - 좁은 카드에서 `max-content 1fr` 로 전환 필요

5. **BP 경계에서 값 점프**
   - illust 컨테이너: 160px(≤893) → 138px(clamp 767) → 110px(≤767 고정)
   - 각 경계에서 시각적 불연속
   - 해결: `clamp()` 또는 베이스 사이즈 통일

6. **illust `flex: 1 1 0` + `max-width: 160px`**
   - 남은 공간 전체를 먹다가 160px 에서 캡
   - 이미지(160px) 가 160px 컨테이너에 꽉 차면 문제 없으나, 이미지가 작은 경우 빈 공간에 떠 있음
   - 남는 공간은 body `justify-content` 로 처리되지 않으면 시각 이상

## 제안하는 접근 방향

(에이전트가 자율적으로 판단하되, 다음 옵션들을 고려)

### 옵션 A: 완전 유동 (clamp-only)

모든 크기를 `clamp()` 로 정의, BP 없이 연속 축소. 단점: `pd-recipe-table` 의 dt/dd 너비가 복잡.

### 옵션 B: 3단 BP + 내부는 유동

- ≥1025px: 스택 (현재 유지)
- 481-1024px: 사이드바이사이드, illust 고정 160px, text flex:1
- ≤480px: 사이드바이사이드, illust·text 모두 clamp

### 옵션 C: Container Queries

`#pd-recipe-cards` 에 `container-type: inline-size` 선언 후 카드 내부를 컨테이너 쿼리로 제어. 뷰포트가 아닌 **카드 폭 기준** 으로 레이아웃 전환. (pd-content 2col↔1col 전환과 무관하게 카드 폭만으로 판단 가능)

### 옵션 D: 카드 내부 CSS Grid

`.pd-recipe-body` 를 flex 대신 grid 로 전환. 고정 illust 컬럼 + minmax text 컬럼으로 오버플로 원천 차단.

## 산출물

1. **재설계 명세** (`docs/recipe-card-responsive-spec.md`)
   - BP 정의 (최소 개수)
   - 각 BP에서 illust/text/card 폭 수치
   - 수학적 검증 (360px, 480px, 768px, 1024px, 1440px 에서 실제 계산)

2. **CSS 패치** (`next/src/app/globals.css` 해당 블록만)
   - 기존 `#pd-recipe-cards` ~ `.pd-recipe-dd` 영역 (현재 L4305~L4495) 교체

3. **검증 체크리스트**
   - 360/480/768/1024/1440 각 뷰포트 스크린샷
   - 긴 dd 값("2분 이내(뜸 30초)") 오버플로 없음 확인
   - BP 경계(±1px) 에서 시각 점프 없음 확인

## 제약

- **프로토타입 CSS 를 ground truth 로 간주하지 말 것**. 위 실패 이력이 증거.
- **새 CSS 변수 추가 가능**. 단 `--color-*`, `--type-*` 등 디자인 토큰은 기존 것 우선 사용.
- **컴포넌트 구조 변경 가능**. 단 데이터 모델(`Product.recipe[]`)은 불변.
- **의존성 추가 금지** (container query polyfill 등).

## 현재 코드 참조

`globals.css` L4305~L4495 영역. Git worktree `design-polish` 브랜치 최신 커밋 기준.
