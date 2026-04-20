# Claude Design 의뢰 제출 패키지 (Session 38)

> **용도:** 아래 "제출 프롬프트" 섹션을 Claude Design 에 **그대로 복사-붙여넣기** + 첨부 파일 업로드.
> **베이스 브리프:** `session38-claude-design-brief.md` (상세 논리)
> **본 문서:** 실제 제출용 압축 프롬프트 + 첨부 체크리스트.

---

## 1. 제출 체크리스트

### 1-1. 첨부 파일 (6장, 필수)

Before 스크린샷 — 360/768/1440 각 2장씩.

| 파일 | 경로 | 핵심 관찰점 |
|---|---|---|
| 1 | `docs/design-baseline/session37-audit/1440/01-home.png` | 1440 기준 위계 (타겟) |
| 2 | `docs/design-baseline/session37-audit/1440/04-product-detail.png` | PriceL 32 · H2 상품명 위계 |
| 3 | `docs/design-baseline/session37-audit/768/01b-home-scrolled.png` | 768 타블렛 중간 검증 |
| 4 | `docs/design-baseline/session37-audit/768/04-product-detail.png` | 768 PriceL · H2 압박 |
| 5 | `docs/design-baseline/session37-audit/360/01b-home-scrolled.png` | **Display 48px 3줄 wrap** 핵심 증거 |
| 6 | `docs/design-baseline/session37-audit/360/02-story.png` | Display 수준 좌우 오버플로우 |

추가 참고 (선택): `360/04-product-detail.png` — PriceL 32 + H2 간격 압박

### 1-2. 의뢰 모드

- **모드:** 분석/제안 (디자인 생성 아님)
- **출력 형식:** 표 고정 (아래 프롬프트에 명시)
- **허용 범위:** min/max ±2px, preferred 재조정 가능 · 위계 보존 요구 위반 금지

---

## 2. 제출 프롬프트 (복사 대상)

아래 `===` 사이 블록을 그대로 복사.

```
====================================================================
[GTR — 반응형 타이포 토큰 clamp 값 확정 요청]

## 컨텍스트
Good Things Roasters (스페셜티 커피 브랜드 이커머스) Next.js 사이트의
1440 고정 디자인을 360~1440 반응형으로 전환 중입니다.
컬러·웨이트·letter-spacing·폰트는 **불변**이며, 이번 의뢰는 오로지
**타이포 8개 토큰의 clamp() 최종값**만 확정하는 범위입니다.

## 요청
아래 8개 토큰의 `clamp(min, preferred, max)` 값을 확정해주세요.

1. --type-display-size
2. --type-h1-size
3. --type-h2-size
4. --type-h3-size
5. --type-heading-m-size
6. --type-body-l-size
7. --type-price-l-size
8. --type-price-m-size

(제외 — 이미 하한값이라 고정 유지: body-m/s · label · caption · input · heading-s)

## 현재 토큰 (Before)
--type-display-size: 48px;     (weight 400)
--type-h1-size: 36px;          (weight 300)
--type-h2-size: 32px;          (weight 300)
--type-h3-size: 24px;          (weight 400)
--type-heading-m-size: 18px;   (weight 500)
--type-body-l-size: 18px;      (weight 500)
--type-price-l-size: 32px;     (weight 500)
--type-price-m-size: 20px;     (weight 600)

## 결정 가이드라인 (필수 준수)
- 공식: `clamp(REMmin, REMpref + VWpref, REMmax)` — rem + vw 혼합
- 예: `clamp(2rem, 1.5rem + 1.5vw, 3rem)` (= 32~48px 가변)
- 브레이크포인트 축: 360 / 768 / 1440 (1440 이상 max 고정, 360 이하 min 고정)
- 1rem = 16px 기준
- iOS 줌 방지: BodyL min ≥ 16px (1rem)

## 위계 보존 요구사항
- 360 에서 Display / BodyM(15px 고정) 비율 ≥ **2.0×**
- 360 에서 H1 / H2 비율 ≥ **1.15×** (단계 구분 가독)
- 1440 에서 단계 간 비율 현재 값(1.125~1.33) 유지

## 내부 후보값 (참고, 확정 전)
| 토큰         | max(1440) | min(360) | preferred 후보     |
|--------------|-----------|----------|--------------------|
| Display      | 48px      | 32px     | 2rem + 2.2vw       |
| H1           | 36px      | 26px     | 1.625rem + 1.2vw   |
| H2           | 32px      | 22px     | 1.375rem + 1.1vw   |
| H3           | 24px      | 18px     | 1.125rem + 0.7vw   |
| HeadingM     | 18px      | 16px     | 1rem + 0.2vw       |
| BodyL        | 18px      | 16px     | 1rem + 0.2vw       |
| PriceL       | 32px      | 24px     | 1.5rem + 0.8vw     |
| PriceM       | 20px      | 18px     | 1.125rem + 0.2vw   |

허용 범위: min/max ±2px, preferred 재조정 가능. 위계 보존 위반 금지.

## Before 스크린샷 (첨부 참조)
- 1440 01-home / 04-product-detail — 현 위계 기준 (타겟)
- 768 01b-home-scrolled / 04-product-detail — 중간 압박
- 360 01b-home-scrolled — "좋은 것에는 시간이 필요합니다." Display 3줄 wrap (핵심 증거)
- 360 02-story — Display 수준 좌우 오버플로우

## 기대 출력 형식 (정확히 이 표로 반환)

| 토큰                  | clamp() 최종값                          | 근거 (1줄)           |
|-----------------------|-----------------------------------------|----------------------|
| --type-display-size   | clamp(XXrem, XXrem + XXvw, XXrem)       | ...                  |
| --type-h1-size        | clamp(XXrem, XXrem + XXvw, XXrem)       | ...                  |
| --type-h2-size        | clamp(XXrem, XXrem + XXvw, XXrem)       | ...                  |
| --type-h3-size        | clamp(XXrem, XXrem + XXvw, XXrem)       | ...                  |
| --type-heading-m-size | clamp(XXrem, XXrem + XXvw, XXrem)       | ...                  |
| --type-body-l-size    | clamp(XXrem, XXrem + XXvw, XXrem)       | ...                  |
| --type-price-l-size   | clamp(XXrem, XXrem + XXvw, XXrem)       | ...                  |
| --type-price-m-size   | clamp(XXrem, XXrem + XXvw, XXrem)       | ...                  |

**추가 출력 (선택):**
- 위계 보존 검증표: 1440 / 768 / 360 각 토큰의 실효 px 환산값
- 내부 후보값과 다를 경우 이유 (1~2줄)

## 범위 외 (응답 시 무시됨)
- 토큰 이름 변경·신규 토큰·웨이트·letter-spacing·스페이싱·그리드·팔레트·BP 수 변경 제안

====================================================================
```

---

## 3. 응답 수령 후 처리 흐름

1. 응답 표를 저에게 원문 그대로 붙여넣기
2. 제가 검증:
   - rem → px 환산 (1440/768/360)
   - 위계 보존 요구 충족 여부
   - iOS 줌 방지 (BodyL min ≥ 16px)
3. 통과 시 `globals.css` 에 Step B 로 반영
4. Step A (이미 완료 or 병행) + Step C 와 함께 단일 커밋
5. 캡처 재실행 → After 대조 문서 작성

## 4. 응답 이상 시 대응

- 위계 요구 위반 → 재요청 또는 내부 후보값 투입
- 범위 외 제안 포함 → 해당 부분 무시, 표 값만 채택
- 표 형식 불일치 → 수작업 정리 후 검증

---

## 5. 병행 가능 작업 (응답 대기 중)

Step A 는 Claude Design 응답과 무관하게 선행 가능:
- `--layout-padding-x: 60px` → `clamp(20px, 1.25rem + 2.5vw, 60px)`
- `--section-gap: 120px` → `clamp(64px, 4rem + 3.5vw, 120px)`
- `--space-20/24/30` clamp 전환
- `--header-height` · `--ann-bar-height` clamp

Step C 도 선행 가능:
- `--drawer-width: 540px` → `min(540px, 100vw)`
- CartDrawer <768 풀스크린 BP 분기
