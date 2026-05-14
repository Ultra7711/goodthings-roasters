# Admin Design Guide — Good Things Roasters

> **원칙**: shadcn/ui 기본값을 baseline으로, GTR 토큰(admin-theme.css)을 얹는다.
> Override는 이유가 있을 때만. 판단이 필요하면 구현 전에 먼저 물어본다.

이 문서는 어드민 모든 신규/수정 작업의 단일 reference이다.
새 파일을 만들거나 기존 파일을 수정할 때 — **여기 없는 패턴은 즉흥 판단 없이 사용자에게 먼저 묻는다.**

---

## 0. 현재 상태 인덱스 (2026-05-14 기준)

| 파일 | 상태 | 정리 방식 | 비고 |
|---|---|---|---|
| `(authed)/layout.tsx` | 🟡 부분 | inline 잔존 | shell layout (sidebar 240 + main flex-1) |
| `components/admin/AdminSidebar.tsx` | 🟡 부분 | inline 잔존 | S223에서 fontSize 14 통일됨 |
| `components/admin/AdminTopbar.tsx` | 🟡 부분 | inline 잔존 | S223에서 fontSize 20 통일됨 |
| `components/admin/AdminTopbarActions.tsx` | 🟢 완료 | portal 메커니즘 (스타일 없음) | |
| `components/admin/AdminSearchInput.tsx` | 🟢 완료 | Tailwind | S223 신규 공통 |
| `(authed)/page.tsx` (Dashboard) | 🟢 완료 | Tailwind | S223 Phase 2-b |
| `(authed)/orders/OrdersTableClient.tsx` | 🟢 완료 | Tailwind + TH/TD inline (carry) | S223 Phase 2-c |
| `(authed)/orders/[orderNumber]/OrderDetailClient.tsx` | 🟢 완료 | Tailwind | S224 Phase 1 |
| `(authed)/orders/[orderNumber]/ShippingDialog.tsx` | 🟢 완료 | Tailwind | S223 Phase 2-e |
| `(authed)/users/UsersTableClient.tsx` | 🟢 완료 | Tailwind + TH/TD inline (carry) | S223 Phase 2-e |
| `(authed)/users/[id]/UserDetailClient.tsx` | 🟢 완료 | Tailwind + TH/TD inline (carry) | S226 |
| `(authed)/products/ProductsTableClient.tsx` | 🟢 완료 | Tailwind + TH/TD inline (carry) | S223 Phase 2-e |
| `(authed)/products/new/page.tsx` | 📋 재기획 | AdminPlaceholder | S226 (mock UI ≠ 실 PDP 모델 — 재기획 carry-over) |
| `(authed)/products/[slug]/edit/ProductEditForm.tsx` | 🔴 미정리 | RHF + inline 잔존 | S225+ |
| `(authed)/subscriptions/SubscriptionsTableClient.tsx` | 🟡 부분 | 테이블 정리됨 · Dialog 내부 미정리 | S225+ |
| `(authed)/cafe-events/CafeEventsForm.tsx` | 🟢 완료 | Tailwind | S225 작업 중 |
| `(authed)/settings/SettingsForm.tsx` | 🟢 완료 | Tailwind | S224 |
| `(authed)/gooddays/AdminGoodDaysClient.tsx` | 🟢 완료 | Tailwind | S223 Phase 2-a |
| `(authed)/analytics/page.tsx` | 🟢 완료 | Tailwind | S226 |
| `(authed)/menu/page.tsx` | — | placeholder | |
| `admin/login/AdminLoginForm.tsx` | 🟢 완료 | Tailwind | S223 Phase 2-e |
| `admin/admin-theme.css` | 🟢 완료 | ADR-008 가이드 포함 | 변경 금지 |

**상태 기준:**
- 🟢 완료 — inline raw px/hex 없음, Tailwind className + GTR 토큰만 사용
- 🟡 부분 — 일부 정리, carry-over 잔존
- 🔴 미정리 — inline 위주, sweep 대상
- 📋 재기획 — 데이터 모델 / UX 기획부터 재작업 필요 (placeholder 노출)

---

## 1. 토큰 시스템 (source of truth)

모든 색상·크기는 `next/src/app/admin/admin-theme.css`의 CSS 변수만 사용.
`globals.css` 토큰은 어드민에서 사용하지 않는다.

### 1-1. 표면 / 텍스트 / 테두리

| 용도 | 토큰 | 값 |
|---|---|---|
| 페이지 배경 | `--background` | `#F8F8F7` |
| 카드/표면 | `--surface` | `#FFFFFF` |
| 행 hover / 테이블 헤더 | `--surface-muted` | `#F2F2F1` |
| 기본 텍스트 | `--foreground` | `#1A1A1A` |
| 보조 텍스트 | `--foreground-muted` | `#6B6B6B` |
| 희미한 텍스트 | `--foreground-subtle` | `#9A9A98` |
| 테두리 | `--border` | `#E5E5E3` |
| 강한 테두리 | `--border-strong` | `#D4D4D2` |
| Input 테두리 | `--input` | `#D4D4D2` |
| 포커스 링 | `--ring` | `rgba(201,100,66,0.35)` |

### 1-2. 강조 / 상태 (6-tone soft 매트릭스)

| tone | bg | fg | dot |
|---|---|---|---|
| primary | `--primary-soft` (#FBE9E2) | `--primary-soft-fg` (#8A3A1F) | `--primary` (#C96442) |
| success | `--success-soft` (#E3F1E8) | `--success` (#2F7D4F) | `--success` |
| warning | `--warning-soft` (#F8EFD7) | `--warning` (#B8860B) | `--warning` |
| danger | `--danger-soft` (#F8E0E0) | `--danger` (#B43D3D) | `--danger` |
| info | `--info-soft` (#E1ECF8) | `--info` (#3D6FB4) | `--info` |
| neutral | `--neutral-soft` (#ECECEA) | `--neutral-soft-fg` (#4A4A48) | `#888` |

### 1-3. 사이드바 (warm dark)

`--sidebar-bg #1A1A1A` / `--sidebar-bg-elevated #232220` / `--sidebar-fg #E8E6E2` /
`--sidebar-fg-muted #888581` / `--sidebar-fg-subtle #5C5A56` /
`--sidebar-border #2A2926` / `--sidebar-accent #C96442` /
`--sidebar-active-bg #2A2926` / `--sidebar-active-fg #FFFFFF`

### 1-4. 컨트롤

`--switch-off-bg #939291` — Switch OFF 색상 (disabled와 구분)

### 1-5. 형태 / 그림자

| 토큰 | 값 |
|---|---|
| `--radius` | 0.5rem (8px) |
| `--radius-sm` | 0.375rem (6px) |
| `--radius-lg` | 0.75rem (12px) |
| `--shadow-xs` | `0 1px 0 rgba(0,0,0,0.02)` |
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.04)` |
| `--shadow-popover` | `0 8px 24px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)` |

---

## 2. 타이포그래피

### 2-1. fontSize whitelist (7종 외 금지)

| 클래스 | 크기 | 용도 |
|---|---|---|
| `text-xs` | 12px | 보조 텍스트, TH 라벨, 작은 badge, hint |
| `text-sm` | 14px | **admin body default**, 카드 본문, 폼 라벨, 테이블 셀 |
| `text-base` | 16px | 카드 섹션 제목, 강조 본문 |
| `text-lg` | 18px | 소제목 |
| `text-xl` | 20px | Topbar 페이지 타이틀 |
| `text-2xl` | 24px | 페이지 h2 |
| `text-3xl` | 30px | 대형 숫자 (stat) |

**raw px 직접 사용 금지** — `text-[13px]`, `text-[11.5px]` 등 arbitrary 값 금지.

### 2-2. round 매핑 (마이그 시 사용)

```
11 / 11.5 / 12 / 12.5 → text-xs
13 / 13.5 / 14         → text-sm
15                     → text-base
17                     → text-lg
20 / 22                → text-xl
24 / 28                → text-2xl  (28도 작게 round)
30+                    → text-3xl
```

### 2-3. font-weight / letter-spacing

| 패턴 | 클래스 |
|---|---|
| h1 / h2 (페이지) | `font-medium tracking-tight` (또는 `tracking-[-0.02em]`) |
| h3 (카드 섹션) | `font-medium` |
| TH (테이블 헤더) | `font-medium` + `letter-spacing: 0.04em` + `uppercase` |
| 본문 | `font-normal` (기본) |
| 라벨 | `font-medium` |

---

## 3. Spacing whitelist

`gap-* / p-* / px-* / py-* / m-*` 허용 단계:

```
1(4) · 1.5(6) · 2(8) · 2.5(10) · 3(12) · 4(16) ·
5(20) · 6(24) · 8(32) · 10(40) · 12(48) · 16(64)
```

raw px 수치 / arbitrary `[14px]` 등 직접 사용 금지.

### 3-1. spacing round 매핑 (round DOWN — fontSize 정책 답습)

**규칙:** 입력 값을 whitelist에서 그 값 이하의 가장 가까운 값으로 round DOWN.
fontSize의 `28 → text-2xl (24) = 작게` 답습. 묻지 말고 기계적으로 적용.

| 입력 px | → | className |
|---|---|---|
| 4~5 | → | `gap-1` (4) |
| 6~7 | → | `gap-1.5` (6) |
| 8~9 | → | `gap-2` (8) |
| 10~11 | → | `gap-2.5` (10) |
| 12~15 | → | `gap-3` (12) |
| 16~19 | → | `gap-4` (16) |
| 20~23 | → | `gap-5` (20) |
| 24~31 | → | `gap-6` (24) |
| 32~39 | → | `gap-8` (32) |
| 40~47 | → | `gap-10` (40) |
| 48~63 | → | `gap-12` (48) |
| 64+ | → | `gap-16` (64) |

`p-*` / `px-*` / `py-*` / `m-*` 동일.

### 3-2. 예외 (DEC-2 §4 — h28 표준)
- `!h-7` (28px) — Topbar 액션 Button 표준 / 카드 인라인 Button

---

## 4. 레이아웃 쉘 (`(authed)/layout.tsx`)

```
sidebar 240px (고정) | flex-1 column { Topbar 56px sticky · main flex-1 overflow-auto p-7 px-8 }
```

- 배경: `var(--background)` (#F8F8F7)
- `.gtr-admin` 클래스 필수 (base style 활성화 + 전역 button color inherit 리셋)

**Topbar:**
- height 56px · `padding: 0 24px` · `border-b border-border` · `position: sticky top-0 z-10`
- 좌측: page title `h1 text-xl font-medium tracking-[-0.015em]`
- 우측: `AdminTopbarActions` slot anchor → page에서 portal 주입

**Sidebar:**
- 다크 테마 (warm dark)
- fontSize 14 통일 (S223)
- active item: 좌측 `width 2px` accent bar + `bg-sidebar-active-bg`

---

## 5. 컴포넌트 패턴 (실제 사용 코드)

### 5-1. 페이지 헤더

```tsx
<div className="mb-5 flex items-baseline justify-between">
  <div>
    <h2 className="m-0 text-2xl font-medium tracking-tight">페이지 제목</h2>
    <div className="mt-1 text-sm text-muted-foreground">
      서브텍스트 — 한 줄 설명
    </div>
  </div>
  {/* 우측 옵션: 상태 badge 또는 액션 (Topbar로 옮기는 게 표준) */}
</div>
```

**기준:**
- `mb-5` (Tables) 또는 `mb-6` (Settings) — 둘 다 허용
- subtitle: `text-sm text-muted-foreground`
- h2: `text-2xl font-medium tracking-tight`

### 5-2. 섹션 카드 (3가지 패턴)

**A. 헤더 + 본문 (Settings · CafeEvents 폼)**

```tsx
<div className="bg-[var(--surface)] border border-border rounded-[var(--radius)] overflow-hidden">
  <div className="px-6 py-4 border-b border-border flex items-center justify-between">
    <h3 className="m-0 text-sm font-medium">제목</h3>
  </div>
  <div className="p-5">
    {children}
  </div>
</div>
```

**B. 단순 카드 (Dashboard stats · 위젯)**

```tsx
<div className="bg-card border border-border rounded-lg p-5 relative overflow-hidden">
  {/* 상단 accent line (옵션) */}
  {accent && <div className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--primary)]" />}
  {/* 본문 */}
</div>
```

**C. 토글 헤더 카드 (SettingsCard — 활성/비활성 토글 내장)**

```tsx
// SettingsForm 로컬 컴포넌트 — 카드 헤더에 Switch 포함 + 본문 opacity 전환
<div className="bg-[var(--surface)] border border-border rounded-[var(--radius)]">
  <div className="px-6 py-4 border-b border-border flex items-center gap-3">
    <Switch checked={on} onCheckedChange={onToggle}
            className="data-[state=unchecked]:bg-[var(--switch-off-bg)]" />
    <div className="flex-1">
      <h3 className="m-0 text-sm font-medium">{title}</h3>
      <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>
    </div>
    <span className="text-xs text-muted-foreground">
      {on ? '활성' : '비활성'}
    </span>
  </div>
  <div className="p-6 transition-opacity duration-150" style={{ opacity: on ? 1 : 0.5 }}>
    {children}
  </div>
</div>
```

### 5-3. 테이블 (Orders / Users / Products / Subscriptions 공통)

**컨테이너:**
```tsx
<div className="bg-[var(--surface)] border border-border rounded-[var(--radius)] overflow-hidden">
  <table className="w-full border-collapse text-sm">
    <thead>
      <tr style={{ background: 'var(--surface-muted)', color: 'var(--foreground-muted)' }}>
        ...
      </tr>
    </thead>
    <tbody>...</tbody>
  </table>
  {/* 페이지네이션 */}
</div>
```

**TH/TD inline (shadcn Table 마이그는 carry-over):**

```ts
const TH_STYLE: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--foreground-muted)',
};

const TD_STYLE: React.CSSProperties = {
  padding: '12px 16px',
  verticalAlign: 'middle',
};
```

- 모든 테이블 통일: TH `12px 16px` / TD `12px 16px`
- TH fontSize 12 / fontWeight 500 / letter-spacing 0.04em / uppercase
- TD fontSize는 inline 미지정 → cell별 className으로 hierarchy 표현 (specificity 충돌 차단 — S223 회귀 fix)

**셀 색상 계층 (cell color hierarchy — S223 잠금):**

| 종류 | className |
|---|---|
| 주 이름 | `text-sm font-medium` |
| 주문번호 / 링크 | `text-xs text-[var(--primary)] font-medium gtr-mono no-underline` |
| 이메일 | `text-xs text-[var(--foreground-subtle)] mt-0.5` |
| 날짜 | `text-xs text-muted-foreground tabular-nums` |
| 보조 라벨 | `text-xs text-muted-foreground mt-0.5` |
| 금액 (right) | `text-sm tabular-nums font-medium text-right` |

**행 (tr):**
```tsx
<tr style={{
  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
  background: selected ? 'var(--primary-soft)' : 'transparent',
}}>
```

행 hover는 shadcn Table 마이그 후 적용 (현재 미적용 · carry-over).

**컬럼 정렬 (S223 잠금):**
- 금액 / 결제 / 상태 — 모두 `textAlign: right`
- 행 클릭 = 페이지 진입 (예외: Subscriptions Dialog 만 행 클릭 = Dialog open)

### 5-4. 탭 (Status / Category / Role)

```tsx
<div className="flex gap-1 border-b border-border mb-4">
  {TABS.map((t) => {
    const active = t.id === filters.status;
    return (
      <Link
        key={t.id}
        href={buildHref({ status: t.id, page: 1 })}
        replace
        className={cn(
          'px-3 py-2 bg-transparent cursor-pointer text-sm relative flex items-center gap-1.5 no-underline',
          active ? 'font-medium text-foreground' : 'font-normal text-muted-foreground',
        )}
      >
        {t.label}
        <span
          className={cn(
            'text-xs tabular-nums rounded-sm',
            active ? 'text-muted-foreground bg-muted' : 'text-[var(--foreground-subtle)] bg-transparent',
          )}
          style={{ padding: '1px 6px' }}
        >
          {count.toLocaleString()}
        </span>
        {active && (
          <div
            className="absolute left-0 right-0 h-0.5 bg-[var(--primary)]"
            style={{ bottom: -1 }}
          />
        )}
      </Link>
    );
  })}
</div>
```

URL state면 `<Link href replace>`, 로컬 state면 `<button onClick>` — 그 외 동일.

### 5-5. Badge (상태 표시 · DEC-2 §3)

**Tone matrix wrapper (페이지별 로컬 정의):**

```tsx
const TONES: Record<Tone, { bg: string; fg: string; dot: string }> = {
  primary: { bg: 'var(--primary-soft)', fg: 'var(--primary-soft-fg)', dot: 'var(--primary)' },
  success: { bg: 'var(--success-soft)', fg: 'var(--success)', dot: 'var(--success)' },
  warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)', dot: 'var(--warning)' },
  danger:  { bg: 'var(--danger-soft)',  fg: 'var(--danger)',  dot: 'var(--danger)' },
  info:    { bg: 'var(--info-soft)',    fg: 'var(--info)',    dot: 'var(--info)' },
  neutral: { bg: 'var(--neutral-soft)', fg: 'var(--neutral-soft-fg)', dot: '#888' },
};

function Badge({ tone, children, dot }: { tone: Tone; children: React.ReactNode; dot?: boolean }) {
  const t = TONES[tone];
  return (
    <ShadcnBadge
      variant="outline"
      className="border-transparent gap-1.5"
      style={{ background: t.bg, color: t.fg }}
    >
      {dot && <span aria-hidden style={{ width: 5, height: 5, borderRadius: 999, background: t.dot }} />}
      {children}
    </ShadcnBadge>
  );
}
```

shadcn `Badge variant="outline"` + `border-transparent` + soft bg/fg style override가 표준.

### 5-6. Button (shadcn 기본값 + h28 override)

**기본 사용:**

```tsx
import { Button } from '@/components/admin/ui/button';

// shadcn 기본 size 매트릭스
// xs(h-6) / sm(h-8) / default(h-9) / lg(h-10) / icon(size-9)

// Admin Topbar / 카드 인라인 액션 — h28 표준
<Button size="sm" className="!h-7">저장</Button>
<Button variant="ghost" size="sm" className="!h-7">취소</Button>
<Button variant="outline" size="sm" className="!h-7">내보내기</Button>

// 위험 액션
<Button variant="ghost" size="sm"
        className="!h-7 !text-[var(--danger)] hover:!bg-[var(--danger-soft)]">
  삭제
</Button>

// Link 합성
<Button asChild size="sm" className="!h-7">
  <Link href="/admin/products/new"><PlusIcon /> 신규 상품</Link>
</Button>
```

**variant 매트릭스:**
- `default` — primary 배경 (clay orange)
- `outline` — border + bg-background
- `ghost` — bg 없음, hover 시 accent
- `destructive` — danger (text-white 자동)
- `secondary` — neutral

**`!text-white` 규칙:**
primary 배경 + 흰 텍스트 조합은 반드시 `!text-white` (admin-theme.css 전역 button color inherit 리셋이 `text-white`를 덮어씀).

### 5-7. Input (shadcn 기본값 + AdminSearchInput 공통)

**shadcn Input 기본값:**
```
h-9 w-full border border-input rounded-md bg-transparent px-3 py-1 text-base
focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50
```

**공통 검색 (필수 사용):**

```tsx
import { AdminSearchInput } from '@/components/admin/AdminSearchInput';

<AdminSearchInput
  value={searchValue}
  onChange={setSearchValue}
  placeholder="검색…"
/>
```

돋보기 prefix + clear button + native search cancel button 숨김 — 이중 X 방지.

**Prefix/Suffix가 필요한 경우 (Settings · CafeEvents의 FormInput):**

```tsx
function FormInput({ prefix, suffix, ...rest }: Props) {
  return (
    <div className="flex items-center gap-2 px-2.5 h-[34px] border border-input rounded-md
                    has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50
                    has-[:focus-visible]:border-ring bg-[var(--surface)]">
      {prefix && <span className="text-muted-foreground text-sm">{prefix}</span>}
      <input
        {...rest}
        className="flex-1 min-w-0 border-none outline-none bg-transparent text-sm
                   text-[var(--foreground)] p-0 h-full shadow-none ring-0"
      />
      {suffix && <span className="text-muted-foreground text-xs">{suffix}</span>}
    </div>
  );
}
```

**h-[34px] 표준** — Settings/CafeEvents FormInput 한정 (shadcn Input h-9 = 36px 와 의도적 분리 · 폼 밀도용).

### 5-8. Textarea

```tsx
<textarea
  className="w-full min-h-16 resize-y px-3 py-2.5
             border border-[var(--input)] rounded-[6px]
             text-sm leading-[1.6] text-[var(--foreground)]
             outline-none bg-[var(--surface)] shadow-xs
             focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
  style={{ fontFamily: 'inherit' }}
/>
```

또는 shadcn `<Textarea>` 컴포넌트 (CafeEventsForm 사용).

### 5-9. FormField (라벨 + 본문 + hint 패턴)

```tsx
function FormField({ label, hint, required, children }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[var(--foreground)] tracking-[-0.005em]
                        flex items-center gap-1">
        {label}
        {required && <span className="text-[var(--primary)]">*</span>}
      </label>
      {children}
      {hint && (
        <div className="pl-2.5 text-xs text-muted-foreground">
          {hint}
        </div>
      )}
    </div>
  );
}
```

**hint 들여쓰기 `pl-2.5`** — 인풋 placeholder 왼쪽 끝 정렬 (S224 잠금).

### 5-10. Switch

```tsx
import { Switch } from '@/components/admin/ui/switch';

<Switch
  checked={value}
  onCheckedChange={onChange}
  className="data-[state=unchecked]:bg-[var(--switch-off-bg)]"
/>
```

OFF 색상 override는 필수 — disabled와 시각적으로 구분.

### 5-11. Checkbox

```tsx
import { Checkbox } from '@/components/admin/ui/checkbox';

// 단독 체크
<Checkbox checked={value} onCheckedChange={(v) => setValue(v === true)} />

// 라벨 묶음
<label className="flex gap-2 items-center cursor-pointer">
  <Checkbox checked={value} onCheckedChange={(v) => setValue(v === true)} />
  <span className="text-xs font-medium">라벨</span>
</label>

// 테이블 헤더 indeterminate (Orders 패턴)
<Checkbox
  checked={indeterminate ? 'indeterminate' : checked}
  onCheckedChange={() => onChange?.()}
  className="translate-y-[2px]"
/>
```

native `<input type="checkbox">` 사용 금지 — Radix Checkbox 통일.

### 5-12. Dialog

```tsx
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/admin/ui/dialog';

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-w-[480px] p-0 gap-0">
    <DialogHeader className="px-6 pt-5 pb-0">
      <DialogTitle className="text-base font-medium">제목</DialogTitle>
      <DialogDescription className="text-xs mt-1">설명</DialogDescription>
    </DialogHeader>
    <div className="px-6 py-5">
      {children}
    </div>
    <DialogFooter className="px-6 pb-5 gap-2">
      <Button variant="ghost" size="sm" className="!h-7" onClick={onCancel}>취소</Button>
      <Button size="sm" className="!h-7" onClick={onSave}>저장</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**기준:**
- `max-w-[480px]` (Confirm/Edit 모두 통일)
- `p-0 gap-0`으로 padding 직접 제어
- DialogTitle: `text-base font-medium` (shadcn 기본 `text-lg` override)

### 5-13. DropdownFilter (Orders/Subscriptions 검색 바)

shadcn `DropdownMenu` 또는 페이지별 로컬 wrapper. 활성 필터(기본값 외) 표시:

```tsx
<Button
  variant="outline"
  size="sm"
  className="!h-7"
  style={
    isDefault
      ? undefined
      : {
          borderColor: 'var(--primary)',
          color: 'var(--primary-soft-fg)',
          background: 'var(--primary-soft)',
        }
  }
>
  {activeOpt.label}
</Button>
```

### 5-14. Pagination (PageNav)

```ts
const PAGE_BUTTON_BASE: React.CSSProperties = {
  minWidth: 26,
  height: 26,
  padding: '0 6px',
  borderRadius: 5,
  fontSize: 12,
  fontVariantNumeric: 'tabular-nums',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
};
```

- 활성: `bg-primary` + `color #fff` + `border-primary`
- 비활성: `bg-surface` + `border-border` + `color foreground`
- disabled: `opacity 0.6` + `pointer-events none`

페이지 윈도우: 7페이지 이하 전부, 그 외 `1 ... current-1 current current+1 ... last`.

26×26 매우 특수 사이즈 → shadcn Button size 변종에 없음. inline 유지가 명료.

### 5-15. 선택 상태 (Selected outline)

**카드 / 항목 선택 (CafeEvents ListRow · ProductImageReorder · Settings color swatch):**

```tsx
className={cn(
  selected
    ? 'bg-[var(--surface-muted)] border border-[var(--primary)]'
    : 'bg-[var(--surface)] border border-border hover:bg-[var(--surface-muted)]'
)}
```

색상 swatch 같은 작은 항목은 `border: 2px solid` 강조 가능 (SettingsForm 컬러 테마).

**테이블 행 선택:**

```tsx
style={{ background: selected ? 'var(--primary-soft)' : 'transparent' }}
```

**상태 라벨 색상:**

```tsx
const statusClass = isNew ? 'text-[var(--info)]'
  : status === 'active' ? 'text-[var(--success)]'
  : status === 'coming' ? 'text-[var(--info)]'
  : status === 'past' ? 'text-[var(--foreground-muted)]'
  : 'text-[var(--foreground-subtle)]';
```

inline `style={{ color: '...' }}`로 색상 부여 금지 — Tailwind arbitrary로.

**B2C PDP의 `box-shadow: inset 0 0 0 2px` 패턴은 어드민에서 사용 금지.**
어드민 일관성: 1px primary border (SettingsForm·ProductImageReorder·ShippingDialog·CafeEventsForm 검증).
PDP 패턴은 B2C 전용. 어드민 내부 통일이 우선.

### 5-16. Master-Detail 카드 패턴 (CafeEventsForm ListRow)

항목 카드(선택 가능) + 카드 안 본체 클릭 버튼 + 별 액션 버튼이 공존하는 패턴.

```tsx
function ItemCard({ selected, isNew, onClick, onDelete }: Props) {
  return (
    // 외부 wrapper = div (button 중첩 회피)
    <div
      className={cn(
        'flex flex-col w-[180px] flex-shrink-0 rounded-md border overflow-hidden',
        selected
          ? 'bg-[var(--surface-muted)] border-[var(--primary)]'
          : 'bg-[var(--surface)] border-border',
      )}
    >
      {/* 본체 클릭 = 선택 */}
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex flex-col gap-1 px-3 py-2.5 text-left cursor-pointer font-[inherit] border-none bg-transparent w-full',
          !selected && 'hover:bg-[var(--surface-muted)]',
        )}
      >
        {/* 카드 본체 콘텐츠 */}
      </button>
      {/* 액션 영역 — 선택된 카드만, isNew 제외 */}
      {onDelete && !isNew && (
        <div className="px-3 py-2 border-t border-border">
          {/* §5-21 삭제 버튼 패턴 */}
        </div>
      )}
    </div>
  );
}
```

**규칙:**
- 외부 wrapper는 `<div>` (button 안에 button 중첩 금지)
- 본체 클릭 영역은 내부 `<button>` (focus visible 자동 적용)
- 액션 버튼은 본체 button과 sibling (또 다른 button)
- 선택된 카드에서는 hover 효과 제거 (`!selected && 'hover:...'`)
- 선택된 카드만 액션 노출 (or 항상 노출 — 항목 특성에 따라)

### 5-17. Type/Status Pill (선택 가능)

```tsx
<button
  type="button"
  onClick={() => onSelect(t)}
  aria-pressed={selected}
  className={cn(
    'px-3 py-[5px] text-xs font-medium rounded-full border cursor-pointer',
    selected
      ? 'bg-[var(--primary)] !text-white border-[var(--primary)]'
      : 'bg-[var(--surface)] text-[var(--foreground-muted)] border-border',
  )}
>
  {label}
</button>
```

primary 배경 위 흰 텍스트 → `!text-white` 필수.

### 5-18. 미리보기 패널 (iframe + breakpoint selector)

```tsx
<div className="bg-[var(--surface)] border border-border rounded-[var(--radius)] overflow-hidden">
  <div className="px-[18px] py-[14px] border-b border-border flex items-center gap-3 flex-wrap">
    <div className="flex-1 min-w-[200px]">
      <h3 className="m-0 text-sm font-medium">미리보기</h3>
      <div className="text-xs text-muted-foreground mt-0.5">설명</div>
    </div>
    <div className="flex gap-1">
      {/* breakpoint 버튼 (desktop/laptop/tablet/mobile) */}
    </div>
  </div>
  {isDirty && (
    <div className="px-[18px] py-1.5 bg-[var(--warning-soft)] text-[var(--warning)]
                    text-xs border-b border-border">
      저장되지 않은 변경 — 미리보기는 즉시 반영
    </div>
  )}
  <div className="p-4 bg-[var(--surface-muted)] overflow-x-auto flex justify-start">
    <iframe ... style={{ width: brkWidth, height: previewHeight, ... flexShrink: 0 }} />
  </div>
</div>
```

iframe 으로부터 postMessage 로 height 수신 → 동적 height 설정 (Settings · CafeEvents 공통 패턴).

### 5-19. 업로드 진행 표시

```tsx
{uploadState.status === 'uploading' && (
  <div className="mt-2">
    <div className="h-1 rounded-sm bg-[var(--surface-muted)] overflow-hidden relative">
      <div className="gtr-admin-progress-indet" />  {/* indeterminate keyframes */}
    </div>
    <div className="mt-2 text-xs text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
      {uploadState.fileName}
    </div>
  </div>
)}

{uploadState.status === 'error' && (
  <div className="mt-2 px-2.5 py-2 rounded-[6px]
                  bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)]
                  text-xs">
    {uploadState.message}
  </div>
)}
```

### 5-20. 경고/안내 배너

```tsx
// warning
<div className="px-[14px] py-2.5 rounded-md
                bg-[var(--warning-soft)] text-[var(--warning)] border border-[var(--warning)]
                text-xs">
  ⚠ 경고 메시지
</div>

// info (참고 박스 패턴 — SettingsForm)
<div className="p-3 rounded-[6px] bg-[var(--info-soft)] border border-[#C5DCF1]
                flex gap-3 items-start text-xs text-[var(--info)]">
  <InfoIcon className="shrink-0 mt-[1px]" />
  <div>
    <div className="font-medium">참고</div>
    <div className="mt-0.5">설명</div>
  </div>
</div>
```

### 5-21. 삭제 버튼 (굿데이즈 패턴 — `AdminGoodDaysClient.tsx:379-389`)

```tsx
import { Trash2 } from 'lucide-react';

<Button
  type="button"
  variant="ghost"
  size="sm"
  className="!h-7 self-start !text-[var(--danger)] hover:!bg-[var(--danger-soft)]"
  disabled={disabled}
  onClick={() => {
    if (!confirm('이 항목을 삭제하시겠습니까? 되돌릴 수 없습니다.')) return;
    handleDelete();
  }}
>
  <Trash2 size={14} />
  삭제
</Button>
```

**규칙:**
- 위치: 항목의 컨텍스트 안 (카드 그리드면 카드 안 컨트롤 영역, master-detail이면 detail 폼 첫 카드 안 메타 영역)
- **AdminTopbarActions에 배치 금지** — Topbar는 페이지/폼 전체 액션. 삭제는 항목별이라 컨텍스트 안에 둠
- 위험 영역 별 카드 분리 X — 굿데이즈는 같은 카드 안에 활성 토글과 함께 둠. 답습.
- 스타일: `variant="ghost"` + `!h-7` + `!text-[var(--danger)]` + `hover:!bg-[var(--danger-soft)]` + `self-start`
- 아이콘: `<Trash2 size={14} />` (lucide-react)
- confirm 절차 필수

### 5-22. Empty State (테이블 / 카드 빈 상태)

**테이블 빈 상태:**
```tsx
<tr>
  <td colSpan={N} className="px-4 py-12 text-center text-sm text-muted-foreground">
    표시할 항목이 없습니다.
  </td>
</tr>
```

**카드 빈 상태:**
```tsx
<div className="bg-[var(--surface)] border border-border rounded-[var(--radius)]
                py-[60px] px-10 text-center text-sm text-muted-foreground">
  안내 문구
</div>
```

---

## 6. 상태 라벨 한국어 사전

| 영어 | 한국어 |
|---|---|
| Active | 진행중 (또는 활성) |
| Inactive / Disabled | 비활성 |
| Coming / Upcoming | 예정 |
| Past / Ended / Expired | 종료 |
| New | 신규 |
| Pending | 대기 |
| Processing | 처리중 |
| Completed | 완료 |
| Cancelled | 취소 |
| Refunded | 환불 |
| Paused | 일시정지 |
| Draft | 초안 |
| Hidden | 비공개 |
| Published | 게시됨 |

영문 상태 라벨 노출 금지. UI 텍스트는 한국어.

---

## 7. 금지 사항 (ADR-008)

### 7-1. 인라인 raw 수치 금지

❌ `style={{ fontSize: 13, padding: 14, color: '#C96442' }}`
✅ `className="text-sm p-3.5 text-[var(--primary)]"` (단, `p-3.5`는 whitelist 외 → `p-3` 또는 `p-4`로 round)

### 7-2. Arbitrary px 값 금지

❌ `text-[13px]`, `text-[11.5px]`, `gap-[14px]`, `py-[10px]`
✅ whitelist 7종 fontSize · whitelist 12단계 spacing 으로 round

**예외 (허용):**
- `h-[34px]` — FormInput 표준 (Settings/CafeEvents 한정)
- `w-[180px]`, `w-[240px]` 등 의도적 고정 width
- `text-[var(--token)]` — CSS 변수 arbitrary는 허용
- `bg-[var(--token)]` — 동일

### 7-3. hex 직접 사용 금지

❌ `#FFFFFF`, `#C96442`, `#FBF8F3`
✅ CSS 변수 사용. 토큰 없으면 admin-theme.css에 먼저 추가.

**잔존 위반 (정리 carry-over):**
- `#FAFAF9` (Products thead bg) → `var(--surface-muted)`로 정리 필요
- `#FBF8F3` (Settings/CafeEvents iframe bg) → 토큰 신설 필요
- `#fee2e2` (Subscriptions destructive-soft fallback) → `var(--danger-soft)`
- `#888` (Badge dot neutral) → `var(--foreground-muted)` 권장
- `#fff` (Pagination active text) → `var(--primary-foreground)` (or `!text-white`)
- `#C5DCF1` (Info 박스 border) → 토큰 신설 권장
- `#3a352f` (Sidebar avatar bg) → 토큰 신설 권장

### 7-4. primary 배경 + 흰 텍스트

❌ `text-white` 단독
✅ `!text-white` — admin-theme.css 전역 button color inherit 리셋 우회

해당: chip/pill/toggle/brk 선택 버튼 · Badge default · Sidebar accent badge 등.

### 7-5. native checkbox/select 사용 금지 (carry-over 예외)

- `<input type="checkbox">` → shadcn `Checkbox` (Radix)
- `<select>` → 일부 잔존 (DEC-5: Radix Select 변환은 후속)

---

## 8. DEC-2 shadcn override 4패턴 (변경 금지)

1. **Input h-sm (검색/필터 전용)**
   ```tsx
   <Input className="!h-7" placeholder="검색" />
   ```

2. **Switch OFF 색상**
   ```tsx
   <Switch className="data-[state=unchecked]:bg-[var(--switch-off-bg)]" />
   ```

3. **Badge tone (soft 매트릭스 6종)**
   ```tsx
   <Badge variant="outline" className="border-transparent"
          style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
   ```

4. **Button extra small (h28 — Topbar/카드 인라인)**
   ```tsx
   <Button size="sm" className="!h-7">저장</Button>
   ```

기본 form input (h36) / 일반 Button (h32/36/40) / Badge default / Card padding은 override 불필요.

---

## 9. 판단이 필요한 경우 — 먼저 묻는다

다음 상황은 즉흥 판단 없이 사용자에게 먼저 질문:

1. **새 컴포넌트가 필요해 보일 때** — 기존 패턴으로 표현 가능한지 먼저 확인
2. **whitelist에 없는 크기/색상이 필요해 보일 때** — 토큰을 추가할지 round할지
3. **레이아웃이 기존 페이지와 다르게 보일 때** — 그 차이가 의도된 것인지
4. **상태 라벨이 §6 표에 없을 때** — 어떤 한국어로 할지
5. **shadcn 컴포넌트를 override 해야 할 것 같을 때** — DEC-2 4패턴 외에는 묻는다
6. **inline style을 쓰고 싶을 때** — 위 §7 예외에 해당하는지

---

## 10. 토큰화 sweep 작업 규칙 (S225+)

토큰화 sweep은 **기계적 치환**이다. 디자인 변경 아님.

| 허용 | 금지 |
|---|---|
| `fontSize: 13` → `text-sm` | 새 UI 패턴 도입 |
| `color: '#C96442'` → `text-[var(--primary)]` | 라벨/문구 변경 |
| `style={{ padding: 14 }}` → `className="p-3.5"` (또는 round) | 레이아웃 변경 |
| inline hex → CSS 변수 | 컴포넌트 구조 재설계 |
| `border: 1px solid var(--border)` → `border border-border` | 새 컴포넌트 추가 |

디자인 변경이 필요하면 **별 commit**으로 분리하고 사용자에게 먼저 확인.

---

## 11. 폴더 / Import 규칙

```
src/app/admin/(authed)/...           — 페이지
src/app/admin/admin-theme.css        — 토큰 정의 (이 파일 외 토큰 정의 금지)
src/app/admin/layout.tsx             — root layout (.gtr-admin 클래스 활성화)
src/components/admin/...             — admin 공통 컴포넌트
  AdminSidebar / AdminTopbar / AdminTopbarActions
  AdminSearchInput / BrandMark / StatCard / AdminPlaceholder
  ui/                                — shadcn 컴포넌트 (변경 시 사용자 확인)
```

**Import:**
```tsx
import { Button } from '@/components/admin/ui/button';
import { Badge as ShadcnBadge } from '@/components/admin/ui/badge';
import { AdminSearchInput } from '@/components/admin/AdminSearchInput';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import { cn } from '@/lib/utils';
```

B2C용 컴포넌트(`@/components/...` 어드민 외)는 admin에서 사용 금지.

---

## 12. 변경 이력

- **2026-05-14**: 최초 작성 — S223~S225 sweep 결과를 박아 넣음. 이후 모든 어드민 작업은 이 문서를 reference로.
