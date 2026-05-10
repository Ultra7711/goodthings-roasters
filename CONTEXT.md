# Good Things Roasters — Domain Context

GTR 은 커피 로스터리 + 카페 + 정기배송 e-commerce. 1인 + AI 페어 개발, master 직 push, Next.js 16 + Supabase + Toss 스택.

## Language

GTR 특화 도메인 용어. 모든 코드 / 메모리 / 커밋 메시지에서 일관 사용.

### 카탈로그 / 상품

**Product**:
카탈로그 상품 (커피 원두, 굿즈). PRODUCTS lib + Supabase products 테이블.
_Avoid_: Item (Cart Item 과 혼동), Goods.

**Cycle**:
정기배송 주기. enum SUBSCRIPTION_CYCLES = 2W / 4W / 6W / 8W.
_Avoid_: Period (시계열 일반 용어와 혼동), Interval, Frequency.

**Subscription**:
Product + Cycle 결합. 반복 결제 + 정해진 주기 배송.
_Avoid_: Recurring order, Auto-renewal.

### 카트 / 주문

**Cart Item**:
장바구니 항목. type 필드 = `normal` | `subscription`. 슬러그·용량·주기·수량 식별.
_Avoid_: Line item, Cart entry.

**Cart**:
장바구니. **Guest Cart** (localStorage `gtr-guest-cart`) 와 **Server Cart** (Supabase `cart_items`) 두 모드. 로그인 시 guest → server merge.
_Avoid_: Basket, Bag.

**Order**:
주문. state = `pending` (결제 미확정) | `paid` | `shipped` | `delivered` | `abandoned` (TTL 만료).
_Avoid_: Purchase, Transaction.

**Pending Order**:
결제 미확정 주문. 매출 정합성 정책 + abandoned TTL 처리 (S171 hot fix).

### 카페

**Cafe Menu**:
카페 메뉴 (별도 도메인, Product 와 분리). 음료/디저트/사이드.

**Menu Like**:
카페 메뉴 좋아요. 사용자별 좋아요 상태 + 인기 순위 집계.

### 마케팅 / 콘텐츠

**Good Days**:
사진 갤러리 (`/gooddays`). lightbox + 카드 grid + Featured/Mobile zone.

**Newsletter**:
뉴스레터 구독.

**Site Settings**:
admin 동적 설정. `site_settings` 테이블 (notice 바, shipping 정책, theme idx). `'use cache'` + `cacheTag`.

### UI 패턴

**Drawer**:
우측 슬라이드인 패턴. Cart Drawer / Mobile Nav Drawer / Search Panel 공통.
_Avoid_: Sidebar, Panel.

**Sheet**:
모바일 바텀시트. Cafe Nutrition Sheet (모바일은 100dvh 풀스크린, 데스크탑은 우측 540 드로어).
_Avoid_: Modal, Bottom modal.

**Loading Shell**:
page transition fallback. `(main)/loading.tsx` 의 `<div className="page-loading-shell" />`. **transparent 가 default** (S203 fix) — `.root data-dest-dark` 따라 자동 색.
_Avoid_: Skeleton, Placeholder.

**Hero**:
페이지 첫 섹션 (`#hero-blk` 등). `data-header-theme` 으로 헤더 다크/라이트 결정.

**Chapter**:
페이지의 큰 섹션 단위 (Signature Chapter / Story Chapter / Cafe Menu Section).
_Avoid_: Block (이미 `.blk` class 로 사용 중, 더 작은 단위).

**Editorial**:
자문 D / V2 자문 의 대형 typography 스타일. `.ed-h1`, `.ed-h2`.

### 라우팅 / 테마

**Dark Route**:
`/`, `/story` (다크 bg 페이지). `.root[data-dest-dark="true"]` + 헤더 `hdr-dark`.
_Avoid_: Inverse route.

**Light Route**:
그 외 모든 (main) 라우트.

**Secondary Route**:
`/shop` (light 라우트지만 cream/sand 배경). 헤더 `hdr-on-secondary`.

### 작업 단위

**Phase**:
백엔드 sprint (Phase 3-A 빌링 통합 / Phase 3-B mixed cart / Phase 3-D 어드민 SOP 등).

**Pilot**:
globals.css 분할 sprint. Pilot 1~20 (S180~S196, -7494 LOC).

**Carry-over**:
memory 의 active 후속 작업 항목. 다음 세션이 이어 받음.

### 기술 외 메타

**ADR**:
Architecture Decision Record. `docs/adr/ADR-NNN-*.md`.

**BUG-###**:
버그 추적 번호 (BUG-001 ~ BUG-180+).

**Memory**:
`~/.claude/projects/C--Git-goodthings-roasters/memory/` 의 운영 메모. `feedback_*.md` (규칙) / `project_session*_complete.md` (세션 스냅샷) / `project_*_plan.md` (carry-over).

**Session**:
작업 세션 단위 (S001 ~ S203 진행 중). 세션 종료 시 `project_sessionN_complete.md` 작성 + `NEXT_SESSION.md` 덮어쓰기.

## Relationships

- **Product** 는 `normal` 또는 `subscription` 타입 **Cart Item** 으로 카트에 추가됨
- **Subscription** = **Product** + **Cycle** 조합. 결제 시 Toss billing recurring 으로 처리
- **Order** 는 결제 완료(`paid`) 후 생성. 그 전 상태는 **Pending Order** (TTL 후 abandoned)
- **Cart** 는 **Guest** (비로그인) ↔ **Server** (로그인) 두 모드. 로그인 이벤트 시 merge
- **Dark Route** 진입 시 NVG 가 `data-dest-dark` 영구 set (다음 비다크 라우트까지)
- **Loading Shell** 은 transparent → `.root` 색 따라 자동 (다크 라우트 다크 / 라이트 라우트 라이트)
- **Drawer / Sheet** 는 모두 `useDrawer` 훅 + body scroll lock 패턴 공유

## Module Map

```
C:\Git\goodthings-roasters\
├── CLAUDE.md                — root agent instructions (디자인 가이드, 검증 규칙)
├── CONTEXT.md               — 본 파일
├── docs/
│   ├── adr/                 — ADR-001 ~ ADR-008
│   ├── agents/              — agent skill 설정 (issue tracker / domain)
│   ├── gtr-design-guide.md  — 디자인 시스템 7파트
│   ├── milestone.md         — 프로젝트 진행 추적
│   └── ...
└── next/                    — Next.js 16 app (실제 코드)
    ├── CLAUDE.md            — Next.js 16 주의사항
    ├── AGENTS.md            — Next.js 16 breaking changes
    ├── src/
    │   ├── app/
    │   │   ├── (main)/      — light/dark 라우트 (홈, 샵, 스토리, 카트 등)
    │   │   ├── admin/       — 어드민 (별도 layout)
    │   │   └── api/         — Route Handlers
    │   ├── components/
    │   │   ├── home/        — Hero / Chapter 섹션
    │   │   ├── cart/        — Cart Drawer / Cart Page
    │   │   ├── checkout/    — Checkout / Order Complete
    │   │   ├── product/     — PDP (Product Detail Page)
    │   │   ├── cafe/        — Cafe Menu / Nutrition Sheet
    │   │   ├── story/       — Story Page
    │   │   ├── gooddays/    — Good Days 갤러리
    │   │   ├── auth/        — Login / MyPage
    │   │   ├── layout/      — SiteHeader / Footer / NVG / SRInitializer
    │   │   └── ui/          — Icons / 공통 primitives
    │   ├── lib/             — Supabase clients / billing / cart / utils
    │   ├── hooks/           — useCart / useDrawer / useSupabaseSession
    │   └── types/
    └── supabase/migrations/ — DB 마이그레이션 (000~045+)
```

## Routing

| Route | Theme | Wrapper bg |
|---|---|---|
| `/` (Home) | **Dark** | hero `inverse`, sections cream |
| `/story` | **Dark** | inverse |
| `/shop`, `/shop/[slug]` | Light (Secondary) | cream/sand |
| `/cafe` | Light | cream |
| `/gooddays` | Light | warm |
| `/cart`, `/checkout`, `/order-complete` | Light | primary |
| `/mypage`, `/login`, `/biz-inquiry`, `/search` | Light | primary |
| `/legal/[slug]` | Light | primary |
| `/admin/*` | 별도 (light) | admin theme |

## Tech Stack

- **Frontend**: Next.js 16 (App Router, cacheComponents on, Turbopack), React 19
- **Styling**: CSS Custom Properties (디자인 토큰), Lightning CSS
- **State**: Zustand + TanStack Query (server state)
- **Auth**: Supabase Auth (Google / Kakao / Naver OAuth + 이메일)
- **DB**: Supabase PostgreSQL + RLS
- **Payment**: Toss Payments (single + billing recurring)
- **Email**: Resend
- **Deploy**: Vercel
- **Monitoring**: Sentry + Vercel Analytics

## Flagged Ambiguities

- **"item"** — Cart Item 외 다른 곳에서 사용하지 말 것. Product 는 product, Order line 은 order line.
- **"period" vs "cycle"** — 정기배송 주기는 항상 **Cycle**. period 는 시계열 일반 용어로만.
- **"transition"** — page transition (Next.js routing) vs CSS transition. 모호 시 "page transition" 또는 "css transition" 명시.
- **"theme"** — Dark Route / Light Route 구분과 별개로 사이트의 디자인 theme 자체는 단일. NoticeColorTheme 의 theme_idx 는 ann-bar 색만.

## Example Dialogue

> **Dev:** "**Cart** 에 **Subscription** 추가하면 **Order** 가 어떻게 처리되나?"
> **Domain:** "**Cart Item** type=`subscription` 으로 추가. 결제 시 Toss billing 으로 첫 결제 + recurring 등록. **Order** 는 첫 결제 완료 후 생성, 후속 **Cycle** 도래마다 새 **Order** auto-create. 결제 미확정은 **Pending Order** 로 TTL 처리."

> **Dev:** "**Dark Route** 에서 흰 plash 가 보이는데?"
> **Domain:** "**Loading Shell** 의 default bg 가 light 였던 것이 source (S203). transparent 로 fix → `.root data-dest-dark` 따라 자동. 향후 **Dark Route** 추가 시 동일 패턴 자동 적용."

## Related Docs

- `CLAUDE.md` (root) — 작업 원칙 + 검증 규칙
- `next/CLAUDE.md` + `next/AGENTS.md` — Next.js 16 주의사항
- `docs/adr/ADR-*.md` — 아키텍처 결정 (auth merge / payment webhook / RBAC / state mgmt / admin / billing)
- `docs/gtr-design-guide.md` — 디자인 시스템 7파트
- `docs/milestone.md` — 프로젝트 진행 추적
- `~/.claude/projects/C--Git-goodthings-roasters/memory/MEMORY.md` — 운영 메모 인덱스
