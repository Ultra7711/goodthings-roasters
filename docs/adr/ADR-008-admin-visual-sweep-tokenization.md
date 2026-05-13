# ADR-008 — Admin visual sweep: S125 시안 inline 답습 정책 폐기 + 전면 토큰화

- **Status:** Accepted
- **Date:** 2026-05-14
- **Session:** S223 — admin visual sweep
- **Supersedes:** S125 "시안 inline 100% 이식" 결정 (ADR 없이 sprint 결정으로 누적된 정책)
- **Related:** ADR-007 (Admin UI shadcn/ui adoption — 컴포넌트 layer)
- **Implementation:** S223 Phase 0~4

## Context

`docs/admin-implementation-plan.md §1-1` (2026-04-27) 가 **"UI 라이브러리 = shadcn/ui 도입 확정"** 을 명문화했고, 그 도입 목적은:

1. **커스텀 디자인 시간 0** — admin UI 마다 새 컴포넌트 작성 X
2. **토큰화** — fontSize / spacing / color 가 design token reference 만 사용
3. **일관성** — 모든 admin 페이지가 동일 토큰 / 컴포넌트 시스템

그러나 S125 (2026-05-06) 에서 시안 (Claude Design 핸드오프 · `dashboard.jsx` 등 .jsx 파일) 의 inline style 100% 이식 결정이 sprint 메모로만 누적되며 ADR 없이 admin 전체에 답습됐다. 결과:

### S125 결정의 self-defeating 성격

- **시안 자체는 shadcn 기반 디자인 시스템**으로 만들어진 UI 였다 (Claude Design 가 shadcn primitive 위에서 디자인).
- 그것을 **inline style 로 복제**하면 = shadcn 가치 (토큰화 / 시간 절약 / 일관성) 의 정반대.
- "시안 답습 = 충실" 처럼 보이지만 실은 **shadcn 도입 결정의 부정**.

### S126 ~ S217 (30+ sprint) 의 누적 결과

| 카테고리 | admin 17 파일 inline 인스턴스 |
|---|---:|
| `fontSize:` | 291 |
| `padding:` (raw 수치) | ~200 |
| `color: 'var(--foreground-muted)'` 등 직접 reference | ~150 |
| `gap:` `margin*:` raw 수치 | ~200 |
| `letterSpacing:` `lineHeight:` `fontWeight:` | ~100 |
| `border*:` `background:` raw 수치 | ~150 |
| **합계** | **~1,000+** |

fontSize 변종 11종 (11 / 11.5 / 12 / 12.5 / 13 / 13.5 / 14 / 15 / 17 / 20 / 22 / 24 / 28) 이 페이지마다 혼재 → admin 일관성 부재 / 가독성 손상 (작은 값 nested 누적 시 "점점 작아짐").

### Decision drift 사이클

```
S125 단추 0 (시안 inline 답습 결정)
   ↓
S126~S217 답습 누적 (바이블화)
   ↓
바이블조차 못 지킴 (페이지마다 inline 수치 제각각)
   ↓
사용자 "이상함" 감지
   ↓
정정 요청
   ↓
[저 + agent 들] 단추 1 (컴포넌트 layer) 만 정정 — S218 자체 primitives / S222 shadcn import 교체
   ↓
변화 체감 없음 (단추 0 그대로)
   ↓
다시 frustration
```

S222 의 PR-1 ~ PR-5c 가 8 commit 진행됐으나, **단추 0 (S125 결정) 이 그대로 살아 있어** 사용자가 본 시각적 변화는 거의 없음. "마이그 작업했음에도 폰트 크기 거의 변경 없음 / 페이지마다 텍스트 크기 중구난방 / 컴포넌트 정렬 정합 X / 굿데이즈 변환 체감 제로" 가 결과.

## Decision

### 1. S125 시안 inline 답습 정책 폐기

향후 admin 페이지 (신규 + 정정) 작성 시 **inline raw 수치 사용 금지**. shadcn 컴포넌트 + Tailwind className + admin-theme.css 토큰 reference 만 허용.

### 2. fontSize whitelist (7종 — admin-theme.css 토큰)

| className | px | admin token |
|---|---|---|
| `text-xs` | 12 | `--text-xs` |
| `text-sm` | 14 | `--text-sm` |
| `text-base` | 16 | `--text-base` |
| `text-lg` | 18 | `--text-lg` |
| `text-xl` | 20 | `--text-xl` |
| `text-2xl` | 24 | `--text-2xl` |
| `text-3xl` | 30 | `--text-3xl` |

**폐기 (admin 에서 사용 금지)**: fontSize 11 / 11.5 / 12.5 / 13 / 13.5 / 15 / 17 / 22 / 28.

### 3. fontSize round 정책 (S223 sweep 진입 시)

| inline | round 결과 |
|---|---|
| 11 / 11.5 | `text-xs` (12) |
| 12 / 12.5 | `text-xs` (12) |
| 13 / 13.5 | `text-sm` (14) |
| 14 | `text-sm` (14) — 변화 없음 |
| 15 | `text-base` (16) |
| 17 | `text-lg` (18) |
| 20 | `text-xl` (20) — 변화 없음 |
| 22 | `text-xl` (20) |
| 24 | `text-2xl` (24) — 변화 없음 |
| 28 | `text-2xl` (24) — 작게 round (정책 일관성 · 2026-05-14 정정) |
| 30+ | `text-3xl` (30) |

### 4. spacing whitelist (10종 — Tailwind spacing scale)

`gap-1` (4) · `gap-1.5` (6) · `gap-2` (8) · `gap-2.5` (10) · `gap-3` (12) · `gap-4` (16) · `gap-5` (20) · `gap-6` (24) · `gap-8` (32) · `gap-10` (40) · `gap-12` (48) · `gap-16` (64).

padding / margin 동일 (`p-*` / `px-*` / `m-*` / `mx-*`).

**폐기**: 11 / 13 / 14 / 18 / 22 / 26 / 28 / 36 (raw px 수치).

### 5. color 정책

| 사용 | 허용 |
|---|---|
| `text-foreground` / `text-muted-foreground` / `text-foreground-subtle` (Tailwind utility) | ✅ |
| `bg-card` / `bg-muted` / `border-input` / `border-border` 등 shadcn 매핑 토큰 | ✅ |
| `style={{ color: 'var(--primary)' }}` (custom 토큰 직접 reference) | ⚠️ admin 특화 색만 (`--primary-soft` / `--switch-off-bg` 등) |
| inline raw hex (`color: '#888'`) | ❌ |

### 6. 컴포넌트 일관성

- 모든 토글 = shadcn `<Switch>` + `className="data-[state=unchecked]:bg-[var(--switch-off-bg)]"`
- 모든 button = shadcn `<Button>` + variant/size prop
- 모든 input = shadcn `<Input>`
- 모든 dialog = shadcn `<Dialog>` + DialogContent + DialogHeader + DialogFooter
- 자체 inline button / toggle / input / modal 작성 금지

## Consequences

### 긍정 (shadcn 도입 본래 가치 회복)

- **시간 절약** — 신규 admin 페이지 작성 시 className 만 작성. 시안 inline 답습 X.
- **토큰화** — 모든 admin UI 가 admin-theme.css 토큰 reference. 디자인 변경 시 토큰 1곳 수정 → 17 페이지 자동 반영.
- **일관성** — fontSize 변종 11종 → 7종. spacing raw 수치 → 10종 표준.
- **가독성 회복** — nested 작은 값 누적 (11.5 안 11) 사라짐.
- **컴포넌트 일관성** — 동일 UX 요소 (토글 등) 가 페이지마다 동일.

### 부정

- **시각 변화 발생** — 페이지마다 1~3px 사이즈 변동. 1440 baseline 회귀 검증 필수.
- **시안 디자이너 의도 일부 손상** — fontSize 11.5 / 13 같이 의도된 비표준이 있을 수 있음. 그러나 일관성 > 시안 충실도 (S125 root cause 도 시안 충실도였음 — 결과는 일관성 부재).
- **분량** — admin 17 파일 1,000+ 인스턴스 정정. 추정 9~13h (2~3 세션).

### 적용 범위 (S223)

- Phase 0: 본 ADR 등록
- Phase 1: admin-theme.css 상단 whitelist + 매핑 표 reference 등록
- Phase 2: 17 파일 fontSize → text-* className 매핑 sweep
- Phase 3: spacing / color / 컴포넌트 일관성 정정
- Phase 4: 시각 회귀 검증 (1440 → 1024 → 768 → 360)

### Lint / Hook 안전장치 (별 sprint · carry-over)

- ESLint custom rule — admin 파일에서 `style={{ fontSize: ... }}` / `padding: '<raw px>'` 등 detection → 경고 또는 error
- pre-commit hook — 위 rule 위반 시 commit 차단
- 신규 admin 페이지 PR 진입 조건 = lint 통과

## Alternatives Considered

### (A) S125 결정 유지 + 부분 정정만

- 시안 inline 답습 = admin 전통. 컴포넌트만 shadcn 도입.
- **거부 이유**: S218 / S222 의 헛작업 사이클 반복. shadcn 도입 본래 가치 (시간/토큰/일관성) 영원히 부재.

### (B) shadcn 폐기 + admin 자체 디자인 시스템 구축

- admin-theme.css 의 토큰만 사용하고 shadcn 컴포넌트 폐기.
- **거부 이유**: `admin-implementation-plan §1-1` 위반. shadcn 의 a11y / keyboard / focus ring / variant 손실. 시간 비용 매우 큼.

### (C) 출시 후 정정

- S223 = Toss prod 키 + 결제 검증 우선. admin sweep 은 출시 후 별 sprint.
- **거부 이유 (사용자 결정)**: 사용자가 "모든 페이지의 UI 일관성 원함" + "shadcn 도입 가치 = 시간 절약. 현재는 커스텀보다 비용 더 듬" 명시. 시각 일관성 부재 = admin 운영 비용 직접 영향 + 사용자 frustration 누적.

## Implementation Notes

### Phase 2 자동 매핑 패턴

```
inline → Tailwind utility
fontSize: 13                  → text-sm
fontSize: 11.5                → text-xs
fontSize: 12.5                → text-xs
fontSize: 15                  → text-base
fontSize: 24                  → text-2xl
fontWeight: 500               → font-medium
fontWeight: 600               → font-semibold
padding: '10px 14px'          → px-3.5 py-2.5
padding: 14                   → p-3.5  (또는 p-4 로 round)
gap: 6                        → gap-1.5
gap: 8                        → gap-2
marginBottom: 22              → mb-5  (또는 mb-6 = 24)
color: 'var(--foreground-muted)' → text-muted-foreground
color: 'var(--primary)'       → text-primary (admin 매핑)
borderRadius: 6               → rounded-md
borderRadius: 4               → rounded
borderRadius: 8               → rounded-lg
```

### 페이지별 진입 순서 (S223 sweep)

1. **AdminGoodDaysClient** — 사용자가 "체감 제로" 라고 직접 언급. 가장 visual mass 큰 페이지. 정정 후 즉시 확인 가능.
2. **(authed)/page.tsx (Dashboard)** — 진입 시 첫 화면. stat card / recent orders / 사이드 위젯.
3. **OrdersTableClient + OrderDetailClient** — 운영 빈도 최고.
4. **SubscriptionsTableClient + ProductsTableClient + UsersTableClient** — 테이블 3종 통일.
5. **SettingsForm + CafeEventsForm** — 폼 거점.
6. **나머지 (Analytics / Login / ProductEditForm / new mock)** — visual mass 작음.

### 회귀 차단

각 페이지 정정 후:
- 1440 → 1024 → 768 → 360 visual 확인
- 컴포넌트 정렬 정합 (Button text + 옆 label 의 baseline 일치)
- 페이지 안 typography scale (heading → body → meta 의 자연스러운 size 단계)
- 컴포넌트 사용 일관성 (모든 토글 = shadcn Switch + 동일 className)
