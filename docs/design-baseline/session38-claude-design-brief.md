# Claude Design 의뢰 브리프 — Session 38 Step B (타이포 clamp 값)

> **범위 최소화 원칙:** 이 의뢰는 **타이포 8개 토큰의 `clamp()` 최종값 확정** 에만 사용한다.
> 스페이싱·브레이크포인트 구조·그리드·컴포넌트 레이아웃은 의뢰 범위 **외** — 이미 내부 제안서(`session37-responsive-proposal.md`) 에서 수치 논리로 확정됨.
>
> **버려지지 않게:** 응답 결과는 Session 38 구현에서 그대로 `globals.css` 토큰에 투입한다. 재작업·재해석 없음.

---

## 요청 사항

**GTR 반응형 전환(Session 38) 에서 아래 8개 타이포 토큰의 `clamp(min, preferred, max)` 값을 확정해주세요.**

1. `--type-display-size`
2. `--type-h1-size`
3. `--type-h2-size`
4. `--type-h3-size`
5. `--type-heading-m-size`
6. `--type-body-l-size`
7. `--type-price-l-size`
8. `--type-price-m-size`

**제외:** `body-m/s` · `label` · `caption` · `input` · `heading-s` — 이미 하한 크기(11~16px)라 고정값 유지.

---

## 결정 가이드라인 (반드시 준수)

- **공식:** `clamp(REMmin, REM_preferred + VWpreferred, REMmax)` — rem + vw 혼합
- **단위:** min/max 는 rem, preferred 는 rem + vw 혼합
- **예시:** `clamp(2rem, 1.5rem + 1.5vw, 3rem)` (= 32~48px 가변)
- **브레이크포인트 축:** 360 / 768 / 1440 (4-tier 중 3-tier 기준으로 fluid 계산)
- **1440 이상:** max 값 고정 (clamp 의 상한으로 자연 처리)
- **360 이하:** min 값 고정 (clamp 의 하한으로 자연 처리)

### 위계 보존 요구사항

| 비교 | 최소 유지 비율 |
|---|---|
| 360 에서 Display / BodyM (15px 고정) | **2.0× 이상** |
| 360 에서 H1 / H2 | **1.15× 이상** (단계 구분 가독) |
| 1440 에서 각 단계 간 비율 | 현재 값(1.125~1.33) 유지 |

### iOS 줌 방지
- `--type-input-size` 는 본 의뢰 범위 외지만, Body/Heading 이 input 근처 사용 시 **16px 미만으로 내려가지 않도록** clamp min 설정 — BodyL 은 360 에서도 16 이상 유지.

---

## 입력 자료

### 1. 현재 토큰 (design-polish/next/src/app/globals.css)

```css
--type-display-size: 48px;       --type-display-weight: 400;
--type-h1-size: 36px;            --type-h1-weight: 300;
--type-h2-size: 32px;            --type-h2-weight: 300;
--type-h3-size: 24px;            --type-h3-weight: 400;
--type-heading-m-size: 18px;     --type-heading-m-weight: 500;
--type-heading-s-size: 16px;     --type-heading-s-weight: 500;
--type-body-l-size: 18px;        --type-body-l-weight: 500;
--type-body-m-size: 15px;        --type-body-m-weight: 400;
--type-body-s-size: 13px;        --type-body-s-weight: 400;
--type-label-size: 11px;         --type-label-weight: 600;
--type-caption-size: 12px;
--type-input-size: 16px;         --type-input-weight: 400;
--type-price-l-size: 32px;       --type-price-l-weight: 500;
--type-price-m-size: 20px;       --type-price-m-weight: 600;
```

### 2. 내부 제안 후보값 (참고, 확정 전)

| 토큰 | 1440 (max) | 360 (min) | 내부 후보 preferred |
|---|---|---|---|
| Display | 48px | 32px | `2rem + 2.2vw` |
| H1 | 36px | 26px | `1.625rem + 1.2vw` |
| H2 | 32px | 22px | `1.375rem + 1.1vw` |
| H3 | 24px | 18px | `1.125rem + 0.7vw` |
| HeadingM | 18px | 16px | `1rem + 0.2vw` |
| BodyL | 18px | 16px | `1rem + 0.2vw` |
| PriceL | 32px | 24px | `1.5rem + 0.8vw` |
| PriceM | 20px | 18px | `1.125rem + 0.2vw` |

**허용 범위:** min/max 는 ±2px, preferred 는 디자인 판단으로 재조정 가능. 단 위계 보존 요구사항 위반 금지.

### 3. Before 스크린샷 (반응형 깨짐 증거)

- `docs/design-baseline/session37-audit/1440/` — 현 Desktop 렌더 (8장)
- `docs/design-baseline/session37-audit/768/` — Tablet 오버플로우 확인
- `docs/design-baseline/session37-audit/360/` — Mobile 극한 깨짐

**주목 샷:**
- `360/01b-home-scrolled.png` — "좋은 것에는 시간이 필요합니다." 가 3줄 wrap · "오늘, 매장에서." H2 좁은 gutter
- `360/02-story.png` — Display 수준 타이포 좌우 오버플로우
- `360/04-product-detail.png` — 가격(PriceL 32px) · H2 상품명 간격 압박
- `1440/01-home.png` — 현 위계 기준 (편집 잡지 감각 보존 타겟)

### 4. 디자인 방향 불변 제약

- **팔레트 불변** — 이번 라운드 컬러 변경 없음
- **웨이트 불변** — Display 400 / H1 300 / H2 300 / H3 400 등 현행 유지
- **letter-spacing 불변** — 본 의뢰 범위 외
- **폰트 페어링 불변** — Pretendard 기본, Inter 보조 유지

---

## 기대 출력 형식

아래 표를 **정확히 그대로** 채워서 반환:

```
| 토큰                        | clamp() 최종값                                     | 근거 (1줄) |
|-----------------------------|---------------------------------------------------|-----------|
| --type-display-size         | clamp(XXrem, XXrem + XXvw, XXrem)                 | ...       |
| --type-h1-size              | clamp(XXrem, XXrem + XXvw, XXrem)                 | ...       |
| --type-h2-size              | clamp(XXrem, XXrem + XXvw, XXrem)                 | ...       |
| --type-h3-size              | clamp(XXrem, XXrem + XXvw, XXrem)                 | ...       |
| --type-heading-m-size       | clamp(XXrem, XXrem + XXvw, XXrem)                 | ...       |
| --type-body-l-size          | clamp(XXrem, XXrem + XXvw, XXrem)                 | ...       |
| --type-price-l-size         | clamp(XXrem, XXrem + XXvw, XXrem)                 | ...       |
| --type-price-m-size         | clamp(XXrem, XXrem + XXvw, XXrem)                 | ...       |
```

**추가 출력 (선택):**
- 위계 보존 검증표 (1440 / 768 / 360 각 토큰 실효 px 환산)
- 내부 후보값과 다른 경우 그 이유 (1~2줄)

---

## 의뢰 외 금지 사항

- ❌ 토큰 이름 변경 제안
- ❌ 신규 토큰 추가 제안
- ❌ 웨이트·letter-spacing 변경 제안
- ❌ 스페이싱·레이아웃·그리드 제안
- ❌ 팔레트·컬러 제안
- ❌ 브레이크포인트 수 변경 제안

위 중 하나라도 응답에 포함되면 **해당 부분은 무시**되고 Session 38 에서 내부 제안서 기준으로 진행됨.
