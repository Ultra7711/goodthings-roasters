# ADR-007 — Admin UI shadcn/ui adoption (S218 decision drift 정정)

- **Status:** Accepted
- **Date:** 2026-05-14
- **Session:** S222 — admin shadcn 정정 마이그 (PR-1 ~ PR-5c)
- **Related:** ADR-006 (admin pages ↔ API 분리 · 호환 · 무영향)
- **Supersedes:** 없음 (`docs/admin-implementation-plan.md §1-1` 결정 보완)

## Context

`docs/admin-implementation-plan.md §1-1` 에 "UI 라이브러리 = shadcn/ui 도입 확정" 이 명문화되어 있었다 (2026-04-27 결정 · Group A 인프라). 그러나 S125 ~ S217 의 admin sprint 들이 시안 .jsx (Claude Design 핸드오프) inline style 100% 이식 결정 (S125) 을 답습하면서, shadcn/ui CLI 로 17 개 컴포넌트가 설치되어 있음에도 (`src/components/admin/ui/`) 실제 사용처는 3 파일 (Switch / Label / Dialog 일부) 에 그쳤다.

S218 에서 "shadcn 표준 디자인 토큰 + primitives 6 종 도입" 으로 진행할 때, 이 표현이 "자체 inline-style primitives 만들기" 로 해석되어 `src/components/admin/primitives/` 폴더에 6 종 (AdminButton/Badge/Input/Card/Toggle/Field) 을 inline style + admin-theme.css 토큰만 답습한 자체 구현으로 작성됐다. 결과:

| 레이어 | 위치 | 상태 |
|---|---|---|
| shadcn/ui (CLI 설치) | `src/components/admin/ui/` | 17 개 설치 — 3 파일 부분 사용 |
| S218 자체 primitives | `src/components/admin/primitives/` | 6 종 — **사용처 0 (dead code)** |
| inline style | 21 admin .tsx 파일 | 840+ `style={{}}` 인스턴스 |

이 3 겹 혼재가 S222 진입 시 발견됐다. `LANGUAGE.md` 의 "Two adapters = real seam" 원칙으로 평가:

- S218 primitives = **0 adapter** (hypothetical seam 도 아닌 dead code)
- inline style 표준 = **shallow seam** (callsite 마다 height/padding 직접 작성, 21 곳에 복제됨)
- shadcn/ui 17 개 = **deep module 후보** (작은 interface `variant`/`size`/`className` 뒤에 CVA + Radix a11y + keyboard + focus ring)

## Decision

S222 sprint 에서 다음 5 항을 잠금한다 (변경 금지).

### 1. shadcn/ui 전면 채택 + S218 primitives 폐기

- `src/components/admin/ui/*` (shadcn CLI 설치본) 을 admin UI 의 단일 source.
- `src/components/admin/primitives/` 폐기 (`git rm`).
- 향후 admin sprint 는 shadcn 컴포넌트 직접 사용 (wrapper 도입 금지).

### 2. 디자인 토큰 매핑 — 커스텀 컬러 유지

- `src/app/admin/admin-theme.css` 의 `@theme inline` 블록이 shadcn 토큰 (`bg-primary` / `border-input` / `bg-card` 등) → GTR admin 커스텀 컬러 (`--primary: #C96442` clay orange · `--switch-off-bg: #939291` 등) 매핑.
- shadcn 컴포넌트 사용 = 자동으로 GTR admin 컬러 적용 (추가 작업 없음).

### 3. 토큰 충돌 해결 = className override (옵션 b)

shadcn 기본과 admin 가이드의 4 충돌 지점은 callsite 의 className override 로 강제:

1. **Input h-sm** (검색·필터 전용) — admin 28 vs shadcn 32 → `className="!h-7"` override
2. **Switch OFF** — admin `#939291` vs shadcn `bg-input` → `className="data-[state=unchecked]:bg-[var(--switch-off-bg)]"` override
3. **Badge tone** (soft 매트릭스 6 종) — `variant="outline"` + `className="border-transparent"` + `style={{ background, color }}` override
4. **Button extra small (h28)** — `size="sm"` + `className="!h-7"` override

거부된 대안:
- (a) admin-theme.css 토큰을 shadcn 기본에 맞춤 → 1440 baseline 디자인 가이드 변경 + 회귀 광범위
- (c) wrapper 컴포넌트 (예: `AdminButton` 재도입) → 1 단계 우회 + S218 root cause 재발 위험

### 4. `.gtr-admin` reset rule — shadcn 컴포넌트 제외

`.gtr-admin button, .gtr-admin input, ... { color: inherit }` reset 이 shadcn 의 `text-primary-foreground` (specificity 0,1,0) 보다 specificity 높아 (0,1,1) 텍스트 색을 부모 검정으로 강제 inherit 시키는 버그 발견 (S222 PR-2.1).

해결: `:not([data-slot])` 으로 shadcn 컴포넌트 (Button/Input/Checkbox/Select/Textarea/Dialog/Switch 등 모두 `data-slot` 보유) 를 reset 대상에서 제외.

### 5. RHF 일괄 전환 (DEC-4) — carry-over

`ProductEditForm.tsx` 의 `register` / `Controller` 패턴 → shadcn `<Form>` / `<FormField>` render prop 일괄 전환은 S222 범위 밖. 현 sprint 는 inline element (button / input / switch) 만 shadcn 정정. RHF 구조 그대로 유지.

향후 sprint (carry-over) 에서 다음 조건 만족 시 진입:
- 5 탭 전체 (basic + detail + option + shipping + seo) RHF 폼 구현 완료
- shadcn Form + FormField 패턴이 admin 다른 RHF 사용처 확보 (현재는 ProductEditForm 단일)

## Consequences

### 긍정 (Locality + Leverage)

- **Locality** — shadcn 컴포넌트 1 곳 수정 → 21 페이지 자동 반영. inline style 840 인스턴스 → 17 컴포넌트로 응축.
- **Leverage** — callsite 학습 = `variant` / `size` / `className` 3 prop. inline height/padding/border-radius 학습 부담 제거.
- **dead code 제거** — S218 primitives 6 종 폐기 (0 adapter).
- **a11y / keyboard** — shadcn (Radix) 가 ARIA attributes / 키보드 화살표 / focus ring / data-state 자동 처리.
- **Deletion test** ✅ — shadcn 17 삭제 시 → 21 페이지에 inline 840+ 재출현. complexity reappears across N callers. 진짜 deep module 성립.

### 부정

- **className override 학습** — 4 패턴 (Input h-sm / Switch off / Badge tone / Button extra small) 을 callsite 가 알아야 함. `admin-theme.css` 상단 가이드 comment 로 reference 명문화.
- **Tailwind v4 `@theme inline` 매핑 의존** — 컬러 토큰이 자동 매핑되지 않으면 회귀. `feedback_css_modification_protocol.md` 답습 (computed style inspect).

### 적용 범위 (S222)

- PR-1 (`e66d1389`) — admin-theme.css 가이드 comment 등록
- PR-2 (`c03955ed`) — Login + Analytics + Dashboard Badge
- PR-2.1 (`0eb47362`) — `:not([data-slot])` reset fix
- PR-3 (`4d401f4c`) — Orders 3 파일 (Table + Detail + ShippingDialog)
- PR-4 (`b0da2873`) — Subscriptions + Products list
- PR-5a (`9b185c63`) — DashboardActions / image reorder / edit page / Users 2 종
- PR-5b (`00f991a4`) — GoodDays + CafeEvents (중형 2 종)
- PR-5c (이 ADR + primitives 폐기) — SettingsForm + ProductEditForm (RHF 구조 유지)

전체 누적 LOC 감소: -800 줄 이상 (inline style + 폐기 상수 정리).

### 제외 (carry-over)

다음은 S222 범위 밖. 별 sprint:
- `(authed)/page.tsx` 대시보드 본체 layout (Card grid · stat 카드)
- `analytics/page.tsx` empty state + chart layout
- `products/new/page.tsx` mock (S228+ 실저장 연결 시 RHF 재작성 예정)
- ProductEditForm RHF + shadcn Form 일괄 전환 (DEC-4 carry-over)
- native dropdown → shadcn Select (DEC-5)
- Table TH/TD 표준화 → shadcn Table (Orders / Subscriptions / Products / Users 4 파일)
- Custom SVG inline → lucide-react 통일

## Alternatives Considered

### (A) primitives/ 유지 + admin 전체에서 사용 강제

- 시안 .jsx 의 inline style 답습 보존.
- **거부 이유**: `admin-implementation-plan §1-1` "shadcn/ui 도입 확정" 위반. dead code (0 adapter) 누적. S218 작업 재합리화.

### (B) inline style 표준 정착 + shadcn 폐기

- shadcn 17 개 제거 + admin-theme.css 토큰만 유지.
- **거부 이유**: `admin-implementation-plan §1-1` 위반. shadcn 의 a11y / keyboard / focus ring 자동 처리 손실. CVA variant system 손실.

### (C) wrapper 컴포넌트 (`AdminButton` 등) 재도입 + shadcn 위 1 단계 추가

- S218 primitives 와 동일 구조 — 단 inline style 대신 shadcn 위 wrapping.
- **거부 이유**: 1 단계 우회 + Two-adapter 원칙 검증 어려움 (wrapper 가 1 곳에서만 쓰이면 hypothetical seam). callsite 학습 부담 증가.

## Implementation Notes

### shadcn 컴포넌트 + admin 토큰 매핑 검증 절차

새 admin 페이지 / 신규 sprint 에서 shadcn 컴포넌트 도입 시:

1. **컴포넌트 import** — `from '@/components/admin/ui/<component>'`
2. **variant / size 선택** — shadcn 기본 우선
3. **className override** — admin 가이드와 충돌하는 4 지점 (DEC-3 참조)
4. **computed style inspect** — `feedback_css_modification_protocol.md` 답습 (수치 일치 확인)
5. **1440 baseline 회귀** — `feedback_design_baseline_1440.md` 답습 (1440 → 1024 → 768 → 360)

### shadcn 컴포넌트 미설치 시

`npx shadcn add <component>` 로 추가. `components.json` (이미 설정 완료 · `style: new-york` / `aliases.ui: @/components/admin/ui`) 따라 자동 배치.

### .gtr-admin reset rule 회귀 차단

`admin-theme.css` 의 `.gtr-admin button:not([data-slot]) { color: inherit }` reset 은 shadcn 컴포넌트 (`data-slot` 보유) 를 제외한다. 신규 shadcn 컴포넌트가 `data-slot` 없으면 inherit 충돌 가능 — `data-slot` 보유 확인 필요 (shadcn 표준 — 자동 보유).
