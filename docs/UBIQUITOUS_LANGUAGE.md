# Ubiquitous Language

> S160 (2026-05-06) 모바일 PDP "sticky" 대화 도메인 용어 정리. CSS spec 동작과 e-commerce 산업 용어 혼용으로 4 차 implement 실패 발생 → 어휘 통일.

## Position Behaviors (CSS · Scroll UX)

| Term | Definition | Aliases to avoid |
|------|------------|------------------|
| **CSS sticky** | W3C `position: sticky` 의 정확한 동작 — 자연 흐름 자기 자리 차지 + viewport edge inset 닿으면 stick + 컨테이닝 블록 끝까지만 stick | sticky (단독) |
| **Floating CTA** | scroll-triggered fixed — 자연 위치 도달 후 viewport bottom 영구 고정. 페이지 끝까지 stick 유지 | sticky CTA bar, sticky bottom bar, persistent bar |
| **Sticky Header** | CSS sticky 적용된 헤더 — `position: sticky; top: 0` (현재 GTR `#site-header`, `#pd-img-wrap` 사용) | floating header, fixed header |
| **Sentinel** | IntersectionObserver target 으로 사용되는 1px 빈 element. Floating CTA 의 발동 시점 감지 | trigger, marker |
| **Placeholder** | Floating CTA 가 fixed 로 빠질 때 자연 흐름 자리 채우는 빈 element (layout shift 차단) | spacer, ghost |
| **Containing block** | CSS spec 의 element 위치·크기 기준 부모. 가장 가까운 `position: absolute/relative/fixed/sticky` 또는 transform/filter/perspective/contain 부모 | parent, ancestor |

## Modal Surfaces (PDP / Cafe Menu)

| Term | Definition | Aliases to avoid |
|------|------------|------------------|
| **Bottom Sheet** | 모바일 viewport bottom 에서 슬라이드업하는 모달. 콘텐츠 height 또는 max-height 90vh + backdrop dim | drawer, modal, popup |
| **Drawer** | 데스크탑/태블릿 viewport 우측 (또는 좌측) 에서 슬라이드인하는 패널. 540 width 고정 (CafeNutritionSheet 패턴) | sheet, panel |
| **Drag handle** | Bottom Sheet 상단 swipe-down close 트리거 (36×4 rounded bar) | grab handle, handle bar |
| **Backdrop** | sheet/drawer 외부 dim 영역. tap close 트리거 | overlay, scrim, dim |

## PDP Purchase UI Components

| Term | Definition | Aliases to avoid |
|------|------------|------------------|
| **PurchaseRow** | PDP 우측 결제 영역. 옵션 chip + 정기배송 박스 + 수량 stepper + 담기 버튼 묶음 (현재 컴포넌트) | purchase block, buy area |
| **OptionChipGroup** | 옵션 (용량 등) chip 형태 단일 선택 그룹 컴포넌트. label + sublabel (가격) 표시 | chip group, option group |
| **Quantity stepper** | 수량 결정 UI — `[− N +]` 패턴 | counter, qty input |
| **Subscription box** | 정기배송 체크박스 + 주기 선택 묶음 컴포넌트 | recurring panel |
| **CTA** | Call-to-action — 주 결제 버튼 ("장바구니에 담기") | button (모호) |

## Advisory / Spec Domain

| Term | Definition | Aliases to avoid |
|------|------------|------------------|
| **V2 자문** | Claude Design 2026-05 자문 (`project_design_audit_v2.md`). 1763줄 raw HTML + 와이어프레임 | advisory, design audit |
| **Wireframe intent** | 자문 와이어 구조가 표현하는 의도 — 자연 흐름 안 어떤 element 가 있고 없는지, 컨테이너 관계 | design intent, layout intent |
| **Spec code** | 자문이 제공한 inline CSS/JSX 코드 (시각 표현 한 측면) | code, snippet |
| **User cognition signal** | 사용자가 보내는 본질 의문 신호. "X 단계 불편" / "X 동작 안 됨" / "근본 질문" / "이게 X 라고?" | feedback, comment |

## Design Tone Categories

| Term | Definition | Aliases to avoid |
|------|------------|------------------|
| **Specialty editorial** | GTR 디자인 톤. 정보 탐색 우선 + 자연 흐름 + 조용한 elegance. Drop Coffee · 프릳츠 · 커피리브레 · 블루보틀 산업 표준 | minimalist (모호), clean |
| **General e-commerce** | 네이버/쿠팡/29CM 톤. Floating CTA + sheet 단일 진입점 + 친숙 패턴 | conventional |
| **Warm-shifted B&W** | GTR 컬러 시스템. cream / sand / warm black 톤. 순수 white/black 배제 | mono, B&W |

## Relationships

- **Floating CTA** 는 **CSS sticky** 가 아닌 **scroll-triggered fixed** 패턴 — `IntersectionObserver` + `position: fixed` toggle 로 구현
- **Sentinel** 과 **Placeholder** 는 **Floating CTA** 구현의 필수 요소 (sentinel = 발동 트리거, placeholder = layout shift 차단)
- **Containing block** 이 **transform 부모** 일 때 자식의 `position: fixed` 컨테이닝 블록이 viewport 가 아닌 transform 부모로 swap (CSS spec)
- **Spec code** 와 **Wireframe intent** 충돌 시 **Wireframe intent** 우선 (S159 메타룰)
- **User cognition signal** 발생 시 즉시 spec 누적 결정 멈춤 + zero base 재검토 (S160 메타룰)
- **Bottom Sheet** 는 ≤479 (CafeNutritionSheet) 또는 ≤767 (PDP 가정 시) viewport · **Drawer** 는 480+ 또는 768+ 데스크탑

## Example Dialogue

> **Dev:** "모바일 PDP 에 **Sticky CTA bar** 도입 어떨까요?"
>
> **Domain expert:** "그건 **CSS sticky** 가 아니라 **Floating CTA** 입니다. 자연 위치 도달 후 **viewport bottom** 에 영구 stick 패턴이라 **Sentinel** + **Placeholder** + `position: fixed` toggle 로 구현해야 합니다."
>
> **Dev:** "**V2 자문** §5.6 **Spec code** 가 `position: sticky` 인데요?"
>
> **Domain expert:** "**Spec code** 와 **Wireframe intent** 충돌 사례입니다. 와이어 구조 = 페이지 끝 자연 위치 + 진입부터 viewport bottom 영구 → **Floating CTA** 의도. spec 의 `position: sticky` 는 표면 표현."
>
> **Dev:** "**CSS sticky** 그대로 쓰면 어떻게 되나요?"
>
> **Domain expert:** "**Containing block** = `#pd-info` 한정 → ② Tasting 진입 시 stick 풀림. **User cognition signal** = '스티키라고 할 수도 없음' 즉시 발생. 또 `#pd-info` 의 transform 진입 anim 이 자식의 fixed 컨테이닝 블록을 swap 시켜 fixed 도 viewport 안 갇힘."
>
> **Dev:** "**Floating CTA** 도입하면 사용자 친화적인가요?"
>
> **Domain expert:** "GTR 톤 = **Specialty editorial**. 산업 표준 (Drop Coffee · 프릳츠 등) 모두 자연 흐름 패턴 — **Floating CTA** 없음. **General e-commerce** (네이버 · 쿠팡) 만 사용. 인터랙션 +1 단계 + 톤 부조화 → 사용자 친화 ❌. S160 = **Floating CTA** 도입 폐기 결정 (D-33)."

## Flagged Ambiguities

### 1. "sticky" — 가장 큰 혼용
- **CSS sticky** (W3C `position: sticky`) vs **Floating CTA** (scroll-triggered fixed)
- 같은 단어가 4 가지 분산 사용: 사용자 자연어("스티키 발동") · 자문 spec code(`position: sticky`) · 자문 의도(Floating CTA) · GTR 코드(Sticky Header)
- **권고**: "sticky" 단독 사용 금지. **CSS sticky** 또는 **Floating CTA** 명시. 사용자 자연어 "스티키" = default **Floating CTA** 해석.

### 2. "sheet"
- **Bottom Sheet** (모바일 풀폭 슬라이드업) vs **Drawer** (데스크탑 우측 슬라이드인)
- CafeNutritionSheet 의 컴포넌트 이름이 "Sheet" 지만 desktop 모드는 Drawer · mobile 모드는 Bottom Sheet
- **권고**: 표현 형태 명시 (Bottom Sheet vs Drawer). "Sheet" 단독 사용 시 컨텍스트 명확화.

### 3. "sticky CTA bar"
- 자문 §5.6 표현 = **Floating CTA** 의미 (CSS sticky 아님)
- spec code 와 의도 다름
- **권고**: GTR 프로젝트 안에서 **Floating CTA** 로 통일. 자문 인용 시 "(자문 §5.6 Floating CTA)" 명시.

## S160 Decision (D-33)

**자문 §5.6 Floating CTA 도입 폐기**.

근거:
- 산업 표준 = **Specialty editorial** 카테고리는 **Floating CTA** 미사용 (Drop Coffee · 프릳츠 · 커피리브레 · 블루보틀 모두 자연 흐름)
- **General e-commerce** 패턴 (네이버 · 쿠팡 · 29CM) 만 **Floating CTA** 사용
- GTR **Warm-shifted B&W** + **Specialty editorial** 톤 부조화
- 인터랙션 +1 단계 (PDP 진입 → sticky tap → sheet → 결정) — **User cognition signal**: "2단계 불편 가중"

대안: 자연 흐름 **PurchaseRow** 유지. 모바일 좁은 viewport 회귀 (BUG-360 등) 발견 시 **PurchaseRow** 단순화 (chip 가격 sublabel 폐기 / 라벨 단축 / **Quantity stepper** 컴팩트화) 로 minimal 보완.

## 향후 사용 규칙

1. **자문 / 대화에서 "sticky" 단독 사용 시 즉시 확인** — CSS sticky? Floating CTA?
2. **Spec code ≠ Wireframe intent** — 자문 코드만 보지 말고 와이어 구조 함께 읽기
3. **사용자 자연어 "스티키" = default Floating CTA 해석** — CSS spec 동작은 일반 사용자 mental model 외
4. **GTR 프로젝트 = Specialty editorial 톤** — General e-commerce 패턴 도입 전 톤 부합 검증
