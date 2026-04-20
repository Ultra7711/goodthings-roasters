# 03. Consumer Map — 토큰 → 실제 소비처

> **이 문서의 목적 (Session 22 F1 실패 재발 방지):**
> Claude Design이 "토큰 값만 바꾸면 시각 변화가 일어날 것"으로 가정하는 실패를 막기 위해, 각 토큰이 **실제로 어느 셀렉터·속성에서 소비되는지** 기계적으로 매핑한다.
>
> **핵심 경고:** 사용량 0 · 1인 토큰은 토큰 값을 바꿔도 **시각 변화가 없거나 1곳만 바뀐다**. 토큰 변경 제안 시 반드시 **소비 룰을 쌍으로 제안**해야 적용 가능하다.

**측정 범위:** `next/src/**` (globals.css + 모든 .tsx/.ts의 `style={{}}` 인라인 포함)
**측정 일자:** 2026-04-19 (Session 33 프리페어)
**기준 브랜치:** `claude/palette-experiment-v1` HEAD `f0fcc8d9`

---

## 1. 사용량 요약 테이블 (팔레트 크리티컬 토큰만)

| 토큰 | 값 | 사용 수 | 상태 |
|---|---|---:|---|
| `--color-text-primary` | `#1C1B19` | 132 | 🟢 베드락 |
| `--color-text-secondary` | `#4A4843` | 71 | 🟢 베드락 |
| `--color-text-inverse` | `#FAFAF8` | 47 | 🟢 베드락 |
| `--color-background-secondary` | `#F5F3F0` | 27 | 🟢 활성 |
| `--color-border-secondary` | `rgba(28,27,25,.12)` | 26 | 🟢 활성 |
| `--color-accent-gold` | `#A47146` | 23 | 🟢 활성 (Session 29~32 확장 완료) |
| `--color-btn-primary-bg` | `#1C1B19` | 21 | 🟢 베드락 |
| `--color-text-tertiary` | `#6B6863` | 18 | 🟢 활성 |
| `--color-background-primary` | `#FAFAF8` | 18 | 🟢 활성 |
| `--color-error` | `#C4554E` | 13 | 🟢 활성 |
| `--color-border-surface` | `var(--color-border-surface)` | 9 | ⚠️ **순환 참조** (자기 자신 참조) |
| `--color-background-tertiary` | `#ECEAE6` | 7 | 🟡 부분 적용 |
| `--color-surface-stone` | `#4A4845` | 6 | 🟡 부분 적용 |
| `--color-surface-warm` | `#E8E2DA` | 5 | 🟡 부분 적용 |
| `--color-border-primary` | `rgba(28,27,25,.20)` | 5 | 🟢 활성 |
| `--color-success` | `#5C7A4B` | 4 | 🟡 |
| `--color-label-on-white` | `#A08B6D` | 4 | 🟡 |
| `--color-border-hairline` | `rgba(28,27,25,.06)` | 4 | 🟡 |
| `--color-background-inverse` | `#1C1B19` | 4 | 🟡 저사용 |
| `--color-label-on-warm` | `#857052` | 3 | 🟡 |
| `--color-input-box-bg` | `#FDFCFA` | 3 | 🟡 |
| `--color-input-box-border` | `#DEDEDD` | 3 | 🟡 |
| `--color-warning` | `#B8943F` | 2 | 🟡 |
| `--color-info` | `#4A6B8A` | 2 | 🟡 |
| `--color-accent-gold-on-dark` | `#D4A574` | 2 | 🟡 (Cafe Menu 다크 탭 전용) |
| `--color-status-new` | `#B8563A` | 1 | ⚠️ **거의 미소비** |
| `--color-status-live` | `var(--color-accent-gold)` | 1 | ⚠️ **거의 미소비** |
| `--color-status-done` | `#7A7068` | 1 | ⚠️ **거의 미소비** |
| `--color-label-on-dark` | `#C8BFB1` | 1 | ⚠️ |
| `--color-badge-sold-out` | `#8C8580` | 1 | ⚠️ |
| `--color-btn-primary-bg-hover` | `#2E2D2A` | **0** | 🔴 **UNUSED — Session 22 F1 지뢰** |
| `--color-btn-primary-bg-active` | `#0F0E0D` | **0** | 🔴 **UNUSED** |
| `--color-focus-ring` | `rgba(74,72,69,.40)` | **0** | 🔴 **UNUSED** |
| `--color-overlay-hover` | `rgba(28,27,25,.07)` | **0** | 🔴 **UNUSED** |
| `--color-overlay-press` | `rgba(28,27,25,.12)` | **0** | 🔴 **UNUSED** |
| `--color-border-input` | `#D9D6D2` | **0** | 🔴 **UNUSED** |

### 상태 범례
- 🟢 베드락 = 20+ 소비, 값 변경 시 광범위 시각 영향 (신중)
- 🟢 활성 = 5+ 소비, 적용 충분
- 🟡 부분 적용 = 1~4 소비, 확장 가능성 있음
- ⚠️ 거의 미소비 = 1 소비, 사실상 정의만 존재
- 🔴 **UNUSED** = 토큰 값 변경해도 시각 변화 0건 → **반드시 소비 룰 쌍으로 제안**

---

## 2. 주요 토큰별 소비처 상세

### 2-1. `--color-accent-gold` (#A47146) — 23곳

**Session 29~32 확장 완료.** 주요 소비 패턴 3종:

**패턴 A — 배경색으로 직접 (6곳, 순수 fill):**
- `.price-gauge__fill` (카트 드로어 게이지)
- `:1668` `:1955` `:2058` `:2480` `:3146` `:3787` (셀렉터는 globals.css line 참조)

**패턴 B — 텍스트 링크 hover underline (8곳):**
- `.chp-link:hover { border-bottom-color: var(--color-accent-gold); }`
- `.chp-guest-link:hover` · `.lp-switch-link:hover` · `.lp-forgot span:hover`
- `.lp-guest-order-btn:hover` · `.mp-logout-link:hover` · `.mp-sub-unsubscribe:hover`
- `.cp-continue-link:hover { text-decoration-color: ...}`
- `.ocp-btn-secondary:hover { text-decoration-color: ...}`
- `#cart-drawer-panel .cd-shop-btn:hover { text-decoration-color: ...}`

**패턴 C — CTA inset box-shadow hover (2곳 + 1곳 on-dark):**
- `box-shadow: inset 0 -2px 0 var(--color-accent-gold)` — 라이트 bg CTA
- `inset 0 -3px 0 var(--color-accent-gold-on-dark)` — 다크 bg CTA
- `eyebrow-line` (Step 3-A-5) — 섹션 eyebrow 1px rule

### 2-2. `--color-btn-primary-bg` (#1C1B19) — 21곳

**Primary CTA 배경/border 모든 경로:**
- `.cta-btn-light-filled` · `.cta-btn-light-outline` border
- `.cp-order-btn` (체크아웃 페이지 CTA)
- `.mp-*-btn` 계열 (마이페이지)
- `.lp-*-btn` 계열 (로그인)
- `.ocp-*` (주문완료)
- `.chp-*` (회원가입)
- `#pd-cart-btn` (상품 상세 CTA)
- `.cart-page-footer` CTA

### 2-3. `--color-btn-primary-bg-hover` (#2E2D2A) — **0곳 🔴**

> **Session 22 F1 실패의 핵심 토큰.**
>
> **현상:** Claude Design이 `--color-btn-primary-bg-hover` 값을 번트오렌지로 바꾸면 CTA hover가 번트로 보일 것으로 가정 → 실제 변화 0건.
>
> **원인:** 현재 CTA hover는 아래 2가지 패턴으로만 구현됨:
> 1. **Opacity 페이드:** `.cta-btn:active { opacity: .7 }` 등
> 2. **Inset gold shadow:** Session 32 확장된 `box-shadow: inset 0 -2px 0 var(--color-accent-gold)`
>
> **적용하려면:** 이 토큰을 소비하는 룰을 **신규 작성**해야 함. 예:
> ```css
> .cta-btn-light-filled:hover { background: var(--color-btn-primary-bg-hover); }
> .cp-order-btn:hover { background: var(--color-btn-primary-bg-hover); }
> .mp-submit-btn:hover { background: var(--color-btn-primary-bg-hover); }
> /* ...etc, Primary CTA 21곳 전수 */
> ```
> **단, Session 32에서 gold inset 패턴을 표준화한 상태라 이 토큰은 사실상 deprecated 후보.**

### 2-4. `--color-background-primary/secondary/tertiary` (18 / 27 / 7)

**primary (#FAFAF8):** body 기본 배경. 섹션 명시적 배경 지정이 없는 모든 곳.

**secondary (#F5F3F0):** Shop 카드 · Featured Beans · MyPage 섹션 등. Session 27 Step 1에서 로테이션 확장.

**tertiary (#ECEAE6):** Good Days 갤러리 갭 · 일부 2차 섹션. **사용처 7곳뿐으로 로테이션 유효성 미흡.**

> **Session 22 F3/F4 경고:**
> - primary↔secondary L값 차이 ~1.5%로 **육안 구분 미약**. 로테이션 제안 시 L 간격 4 이상 확보 필요.
> - 섹션에 `padding-block: 0` + `margin-top: 120px` 패턴이 지배적이라 **wrapper bg가 카드 밑선에서 칼같이 끊김**. 자세한 건 `04-section-structure.md` 참조.

### 2-5. `--color-status-live / done / new` — 각 1곳 ⚠️

**현재 소비:**
- `--color-status-live` → globals.css 75번 줄 *정의만* (`var(--color-accent-gold)`), 실제 컴포넌트 소비 0
- `--color-status-done` → 1곳
- `--color-status-new` → 1곳

> **신규 토큰으로 정의만 되어 있고 컴포넌트 적용이 안 된 상태.** 이 토큰을 팔레트 제안에 포함하려면 **주문 상태 뱃지 · NEW 뱃지 소비 룰을 쌍으로 신규 작성** 필요.
>
> 현재 뱃지 계열은 `.badge-new` · `.badge-sold` · `.cd-item-sub-badge` · `.cp-item-badge` 등이 하드코딩/별도 토큰으로 구현됨. 이 셀렉터들을 status 토큰으로 재배선해야 적용됨.

### 2-6. `--color-surface-warm` (#E8E2DA) — 5곳, `--color-surface-stone` (#4A4845) — 6곳

Session 27 Step 1에서 Shop 썸네일·Product 이미지·Featured Beans·MyPage 폼·Story 교차 섹션에 일부 확장. **아직 확장 여지 있음.**

### 2-7. `--color-border-surface` — ⚠️ 순환 참조 버그

```css
--color-border-surface: var(--color-border-surface);  /* line 186 */
```
**자기 자신을 참조하는 순환.** 브라우저 fallback으로 `initial` 처리되어 `currentColor` 로 해석됨 추정. **리팩터 대상 (Step 4 범위).**

### 2-8. `--color-accent-gold-on-dark` (#D4A574) — 2곳

- `inset 0 -3px 0 var(--color-accent-gold-on-dark)` — 다크 bg CTA hover
- Cafe Menu 다크 탭 (Session 32 Step 3-B)

---

## 3. Hover 패턴 통계

`globals.css` 내 전체 `:hover` 룰 **114개** 중 팔레트 영향 분류:

| 패턴 | 룰 수 | 특징 |
|---|---:|---|
| Opacity 페이드 (`opacity: .7~.9`) | 19 | 토큰 무관. 값 변경 영향 받지 않음. |
| Gold 텍스트링크 (`border-bottom-color` · `text-decoration-color`) | 11 | `--color-accent-gold` 값 변경 시 일괄 반영 |
| Gold inset box-shadow | 2+ (확장 완료) | `--color-accent-gold` 값 변경 시 반영 |
| 배경/색상 전환 (토큰 직접 소비) | ~80 | 토큰 값 변경 시 반영 |

> **Claude Design 프롬프트에 반드시 명시:**
> "현재 hover의 17%는 opacity 기반이며 토큰과 무관하게 동작함. Hover 색 변경을 제안하려면 해당 셀렉터를 opacity 패턴에서 토큰 소비 패턴으로 **재작성 규칙을 포함**해야 한다."

---

## 4. UNUSED 토큰 6종 처리 원칙

`--color-btn-primary-bg-hover` · `-active` · `--color-focus-ring` · `--color-overlay-hover` · `--color-overlay-press` · `--color-border-input`

**Claude Design 지침:**
1. 이 6개 토큰은 **현재 코드에서 소비되지 않음** — 값 제안만으로는 시각 변화 0건
2. 이 토큰을 활용하려면 반드시 **소비 셀렉터 리스트를 함께 제안**할 것
3. 또는 이 토큰들을 **deprecated로 명시**하고 현재 패턴(opacity/gold-inset)을 유지할 것

---

## 5. 컴포넌트별 스타일 인라인 사용 (tsx `style={{}}`)

**`var(--color-*)` 인라인 소비처 (globals.css 외):**
- `next/src/components/cafe/CafeNutritionSheet.tsx` (1건)
- `next/src/components/home/BeansScrollSection.tsx` (2건)
- `next/src/components/search/SearchResultCard.tsx` (2건)

**전체 56 중 globals.css 51 + 컴포넌트 5건** — 거의 모두 globals.css에 집중됨. 컴포넌트 전수 조사 필요 시 위 3개 파일 우선 확인.

---

## 6. 제안 작성 가이드 (Claude Design 용)

### 허용되는 제안 포맷
```
[Change] CTA hover 색을 번트로 전환

대상 토큰: --color-btn-primary-bg-hover
현재 사용 수: 0건 ⚠️
Before: #2E2D2A
After:  #C56B3A

소비 룰 (신규 작성 필수):
  .cta-btn-light-filled:hover { background: var(--color-btn-primary-bg-hover); }
  .cp-order-btn:hover { background: var(--color-btn-primary-bg-hover); }
  ... (Primary CTA 21곳 전수, 03-consumer-map 섹션 2-2 참조)

기존 패턴 충돌:
  - Session 32에서 gold inset hover를 표준화함.
    이 제안은 gold inset 규칙과 병존할지 대체할지 결정 필요.

예상 시각 효과:
  Primary CTA 21곳 hover가 검정 → 번트오렌지로 전환.

리스크: HIGH
  - gold inset 패턴과 시각 충돌 가능
  - border-bottom gold 텍스트링크와 아이덴티티 분열
```

### 금지되는 제안 포맷
```
❌ "--color-btn-primary-bg-hover를 번트로 변경"
   → 소비처 0건이라 시각 변화 없음. 소비 룰 미포함.

❌ "LimitedBadge 컴포넌트 색을 ..."
   → LimitedBadge 미존재. 05-component-inventory.md 참조.

❌ "--color-accent-gold를 divider에 추가"
   → 현재 divider에 gold 적용 0건. 특정 셀렉터 명시 없음.
```

---

## 7. 업데이트 절차

**이 문서는 코드 변경 시 stale됨.** 재수집 명령:
```bash
cd next/src
for t in color-background-primary color-background-secondary ... ; do
  c=$(grep -r "var(--$t[),]" --include="*.css" --include="*.tsx" --include="*.ts" | wc -l)
  echo "$c $t"
done | sort -rn
```

**재수집 권장 시점:**
- Step 4 시작 전
- Claude Design 결과 수령 후 (적용 전 재측정)
- 대규모 CSS 리팩터 후
