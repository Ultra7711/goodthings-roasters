# GTR 프로젝트 마일스톤

> Good Things Roasters 웹사이트 프로젝트의 **잔여 작업** 을 추적한다.
> 완료 이력은 `docs/milestone-completed.md` 참조.
>
> **최종 업데이트:** 2026-05-04 · Session 145 — D-19 옵션 C **Typography·Grid 통합 sprint PR-7 (헤딩 line-height 정합 회귀 fix)**. `--lh-h3` 분기 토큰 신규 (`:root` 24px / `@media (min-width: 1024px)` 32px · h3 font-size 20→24 비례 8 정합) + 회귀 4건 line-height 적용: 🔴 `#pd-name` (h1 — 20px → `var(--lh-h1)` 40/44/52) · 🟡 `.blk-heading`/`.tci-h` (h3 — 20px → `var(--lh-h3)`) · **🔴 `.legal-title` audit 신규** (font-size 32 + lh 20 → **40px 직접** · 1.25 ratio 8 정합 · 약관 5페이지). PR-2 변환 패턴 (1.6/1.7→24 / 1.4/1.3→20 / 1.2/1.1→16) `font-size: var(--type-h*-size)` 셀렉터 + `line-height: 16/20px` 전수 grep audit. 본문 셀렉터 (`.pd-recipe-method` body-m + lh 16 / `.cd-item-name`/`.cp-item-name`/`.ocp-item-name` body-ui + lh 20 등) 한 줄 라벨/ellipsis 정상 판정 → PR-7 범위 외. 단계 격리 (헤딩만 fix). 458/458 vitest · tsc 0 · next build success · chunk 검증 `--lh-h3` 정의 2 (mobile 24 + desktop 32) + 사용 2. **D-19 sprint PR-1~PR-7 모두 완료**. 상세 `memory/project_session145_complete.md`.

> 2026-05-04 · Session 144 — D-19 옵션 C **Typography·Grid 통합 sprint PR-6 (13페이지 시각 회귀 검증)**. 옵션 B (high priority 6페이지) 채택 — sticky offset 정합 (`.chp-right`/`.mp-right`/`.legal-side`/`#bi-left`/`#pd-img-wrap`/`.st-location`) ✅. **PDP 라벨↔상품명 간격 회귀 1건 사용자 보고** → 진단 (PR-2 ratio→정수 일괄 변환 시 `1.3 → 20px` 박힘, font-size 무관) → audit 결과 **3건 회귀 확정**: 🔴 `#pd-name` (h1 32~40 인데 lh 20px) + 🟡 `.blk-heading`·`.tci-h` (h3 ratio 1.0~0.83). `--lh-h3` 토큰 누락 발견. 단계 격리 원칙 준수 (검증 vs fix) → PR-7 별도 sprint carry-over (S145). 1.4→20 · 1.2→16 추가 audit 도 PR-7 안에서. 후속 PR-7 (헤딩 line-height 회귀 fix sprint). 상세 `memory/project_session144_complete.md`.

> 2026-05-04 · Session 143 — D-19 옵션 C **Typography·Grid 통합 sprint PR-5 (sticky offset 토큰 lock)** (`ca80494f` + `6561c6f8`). `--ann-bar-height` 32→32/36 · `--header-height` 56→56/60 clamp → 정수 분기 + `--sticky-offset` 신규 토큰 = `calc(--header-height + --ann-bar-height)` (mobile 88 / tablet+ 96). 매직 넘버 6곳 토큰 교체 (`#pd-img-wrap` 가독성 · `.st-location` scroll-margin-top · `#bi-left` 116→sticky+20 · `.chp-right`/`.mp-right` 80px desktop +16 · `.legal-side` 96→sticky-offset). NEXT_SESSION 추정 5곳 → 실측 6곳 (`#bi-left` 누락 발견). R-1 sticky 도미노 회귀 차단. 458/458 vitest · tsc 0 · next build success · chunk 검증 정의 1 / 사용 6 / 매직 넘버 잔존 0. 상세 `memory/project_session143_complete.md`.

> 2026-05-04 · Session 142 — D-19 옵션 C **Typography·Grid 통합 sprint PR-3 (letter-spacing em→px + padding clamp→정수 분기)** (`9f21ae4a`). `--ls-*` 토큰 11개 px 사전 계산 (font-size base × em) + 헤딩 3토큰 (`--ls-display` -0.7/-1.1/-1.4 · `--ls-heading` -0.3/-0.4/-0.4 · `--ls-h1-editorial` -0.5/-0.7/-0.8 신규) 미디어쿼리 분기. globals.css 직접 em 사용 12곳 → 토큰 통일 (eyebrow caps `pd-drip-tip-label` 만 직접 1.8px). `--space-20/24/30` + `--layout-padding-x` + `--section-gap` clamp() → 정수 분기. `#sp-grid` + `#cm-grid` gap clamp → 12/16/20 정수 분기. border 0.5px 실측 0곳 → skip (S139 추정 2곳은 이미 정리됨). header/ann-bar clamp 는 PR-5 sticky lock 범위. 458/458 vitest · tsc 0 · next build success · chunk 토큰 28회 포함 검증. R-6 (em → px 비례 손실) 분기 토큰으로 차단. 상세 `memory/project_session142_complete.md`.

> 2026-05-04 · Session 141 — D-19 옵션 C **Typography·Grid 통합 sprint PR-2 (line-height 정수 px)** (`33e81bca`). 헤딩 line-height 분기 토큰 5종 신규 (`--lh-display` 40/64/80 · `--lh-h1` 40/44/52 · `--lh-h2` 32/40/40 · `--lh-h1-editorial` 40/52/64 · `--lh-h2-editorial` 32/44/52) — font-size 분기 토큰과 일관. ratio 토큰 4개 정수화 (`--lh-tight/snug/normal: 24px` · `--lh-relaxed` deprecate). line-height 1.x 64곳 변환 — 헤딩 셀렉터 15곳 분기 토큰 (.ed-h1/h2 · .st-hero-en · .page-title · .mp-page-title · .ocp-title · .lp-page-title · .bi-page-title · .season-h · .phil-h · .roastery-h · .st-col-heading · .st-promise-heading · .cd-title · .cp-title-text) + 본문 51곳 일괄 정수 px (1.6/1.7/1.5/1.55 → 24px · 1.8/1.9 → 28px · 1.4/1.3/1.35 → 20px · 1.2/1.1 → 16px). R-4 (line-clamp) 영향 없음. 458/458 vitest · tsc 0 · next build success. 후속 PR-3 (letter-spacing em → px 12곳 + border 0.5 → 1+alpha 2곳 + padding clamp 정수 3곳) / PR-5 (sticky offset 토큰 lock 5곳) / PR-6 (13페이지 시각 회귀 검증). 상세 `memory/project_session141_complete.md`.

> 2026-05-04 · Session 140 — D-19 옵션 C **Typography·Grid 통합 sprint PR-1 (토큰 재정의)** (`bab8a43a` + `6bef0edb` mobile Display fix). font-size 토큰 11개 `clamp()` → 정수 px + 미디어쿼리 분기 (mobile base / `@media (min-width: 768px)` / `@media (min-width: 1024px)`). 자문 §D-7 desktop Display 72 부합. 한글 본문 별도 토큰 신규 (`--lh-kr-body-13/15/17/20` · `--ls-kr-body -0.3px` · `--ls-kr-heading -0.5px` · `--ls-en-body 0` · `--ls-en-h1-32~40` · `--ls-en-h2-24~28` · `--ls-en-display-40~72`) — Q3 외부 표준 (Pretendard Apple system 호환 + W3C 한글 + 모바일 UI 권고). 단계 1 정의만, 사용은 PR-2 (line-height) / PR-3 (letter-spacing) 부터. 외부 표준 검증: `memory/research_typography_grid_external_standards.md` §8 (MD3 + Pretendard GOV + W3C 한글 + 0.5px hairline + Modular Scale + Aesop/Drop Coffee). 458/458 vitest · tsc 0 · next build success. 후속 PR-2 (line-height ratio → 정수 px 64곳) / PR-3 (letter-spacing em → px 12곳 + border 0.5 → 1+alpha 2곳 + padding clamp 정수 3곳) / PR-5 (sticky offset 토큰 lock 5곳) / PR-6 (13페이지 시각 회귀 검증). 상세 `memory/project_session140_complete.md`.

> 2026-05-04 · Session 139 — V2 자문 A-7 **Drawer 폭 토큰 통일** + D-22 폐기 (`47b2ca3e` + `3156dd0a`). CartDrawer `width: 664px` → `var(--drawer-width)` 540 (CafeNutritionSheet · MobileNavDrawer 와 동일 토큰). 모바일 풀스크린 룰 유지. 자문 §6.4/§6.9 "검색 패널 우측 480 Drawer 권고" → D-22 폐기 (검색 drop-down 유지 · 헤더 연속성 · 업계 표준 (Blue Bottle/Aesop/Drop Coffee) 부합 X). MobileNavDrawer 우측 슬라이드인 유지 (외부 8건 조사 결과 표준 없음). 카트 row 실측 (badge `display: none` 발견 후 정정) → 540 안전 확정. 추측 보고 위반 사례 → 진단 우선 메타룰 학습 (JSX + CSS 모두 확인 후 결론). **V2 Phase 2 (A-1~A-7) 모두 완료.** 458/458 vitest · tsc 0. 상세 `memory/project_session139_complete.md`.

> 이전: Session 138 — V2 자문 A-6 **Accordion 통합** + 약관 5페이지 신규 + BUG-179/Kakao closure (`68e025ff` + `8acc6a79` + `bd59d841`). Session 137 — V2 자문 A-5 **카드 통합 단일 PR** + Quick Add 폐기 + ShopPage `?item=` highlight + D-21 보류 (`6eebd3ef` + `6bfbe802`). Session 136 — V2 자문 A-4 **DripBagSteps 컴포넌트 분리** + 레시피 카드 typography·여백·TIP·아코디언 간격 정리 (`633297d3` + `a745513a`). 자문 §6.12 권고대로 `DripBagSteps.tsx` 신규 (드립백 PDP 전용) · `ProductRecipeGuide` Coffee Bean 전용 · `ProductDetailPage` category 분기. 카드 typography 정수화 (제목 17.7→15 / 본문 16 Inter→13 Pretendard 신규 정의 / TIP 본문 16→13 / TIP 라벨 11px gold caps eyebrow 토큰화) · padding/gap/illust 비례 축소 (24/14/196 → 20/10/160 · 모바일 16/-/- · Drip Bag illust 반응형 오버플로우 fix) · TIP 영역 (분할선 제거 / align baseline / justify-self center 명시 / 비대칭 padding 12 20 0 / gap 12 / 라벨 width auto) · 아코디언 간격 (#pd-accordions margin-top 48→0 통일 · 모바일 #pd-info padding-bottom 0→60/40 복원 · 모바일 last accordion hairline 제거 · :has 우회 룰 폐기) · BUG-134 모바일 #pd-inner padding 누락 추가 (다른 페이지와 56px 통일). 458/458 vitest · tsc 0. 상세 `memory/project_session136_complete.md`.

> 2026-05-03 · Session 135 — PDP 갤러리 yarl Inline+Thumbnails 정상화 (`e6bca0b1`). **V2 자문 적용 A-3 Phase 3 완료** (D-20). S134 의 4회 추측 CSS 트릭 누적 회귀 → S135 진단 우선 (yarl source + 공식 docs Context7) → 공식 권고 패턴 (`inline.style` 에 size 직접 부여 + container query `100cqw`) 1회 fix. 1장 = aspect-ratio 1/1, 2장+ = `calc(100cqw + 96px)` (메인 1:1 + 썸네일 96px). 부모 `.pd-yarl-wrap` 에 `container-type: inline-size`. 굿데이즈 라이트박스 동일 화살표 (48×48 SVG · strokeWidth 1.25 · white 80%/100% hover · top:50% 전체 중앙 · hover-only · 모바일 swipe). 신규 메모리 — `feedback_official_docs_after_2_failures.md` (1~2회 실패 시 공식 docs 강제 trigger). tsc 0 · 시각 검증 OK · master `e6bca0b1` ✅ pushed (squash merge feat/pdp-gallery-yarl). 상세 `memory/project_session135_complete.md`.
>
> 2026-05-02 · Session 130 — 어드민 통계 대시보드 + 매출 통계 풀 구현 (`cbab53ab`). **Group I 완료** (I-3 menu_likes 컬럼은 Group F 의존 보류). 마이그레이션 033 — `admin_dashboard_overview()` + `admin_sales_aggregate(start, end)` RPC 2종 (admin 가드 + Asia/Seoul 타임존 + 1 round-trip JSONB). `/admin` 대시보드 — 시안 inline UI 유지, mock 배열 → RPC 결과 매핑 (4 stat cards: 오늘 주문/이번 주 매출/활성 정기배송/대기 주문 + 최근 주문 5건 status badge + 오늘 할 일 4 task counts + 이번 주 베스트셀러 4종 progress bar). `/admin/analytics` — readiness 분기 (50건 OR 14일): 미달 시 시안 empty state + 실제 cur 값 progress · 충족 시 period switcher (7d/30d/90d/all) + 4 stat cards (총 매출·주문·평균객단가·재구매율) + 상품별 테이블 (판매량·주문수·매출 revenue desc). 라이브러리 패턴 — `lib/admin/dashboard.ts` (client-safe: types · `formatKrw` · `mapOverview` · `bestsellerPercents`) + `dashboardServer.ts` (server-only: RPC fetch + fallback) · `lib/admin/analytics.ts` (Zod schema · `periodToRange` · `evaluateReadiness` · `mapAnalytics`) + `analyticsServer.ts`. 458/458 vitest · tsc 0 · next build success (◐ /admin · ◐ /admin/analytics PPR). 상세 `memory/project_session130_complete.md`.
>
> 2026-05-02 · Session 129 — 어드민 사이트 설정 풀 구현 + B2C 동기화 (`f797cc33`). **Group H 완료** + B-2 carry-over (admin_notes 편집) + 후속 UX 개선. 마이그레이션 032 (`site_settings(key, value JSONB)` + RLS public read · admin write + seed 3 row + updated_at 트리거). `'use cache'` + `cacheTag('site-settings')` 패턴 + `revalidateTag(_, 'max')` (Next.js 16 mandatory). `lib/siteSettings.ts` (Zod schema 3종 · DEFAULTS · `composeNoticeText` · `countDirtyAreas`) + `siteSettingsServer.ts` + `settings/actions.ts` (admin 가드 · 변경 영역만 upsert) + `uploadSeasonBanner.ts` (Storage upload + 5MB/MIME). 어드민 UI — server `page.tsx` + client `SettingsForm.tsx` (dirty 추적 · 자동 모드 토글 · 시즌 배너 진행률 업로드 · sonner toast). AdminTopbar sticky (전체 어드민 공통). B2C 풀 반영 — `SiteSettingsProvider` (root layout) + `useSiteSettings` hook · AnnouncementBar SSR (notice 동기화 · 색상 테마 · 중간점 버그 fix · text 비어있을 때 dot 숨김) · CafeMenuSection 시즌 배너 SSR · `useCart`/`MyPagePage`/`orderService` shipping 동적 · ProductAccordions 무료배송 안내 자동 합성 (stale 15,000원 자동 정정). 후속 UX — 어드민 전체 ₩→원 통일 (orders/products/settings) · 날짜 입력 type=date + Zod regex · 빈 미리보기 안내 + placeholder · 도메인 표기 goodthings.kr → goodthingsroasters.com. `next.config.ts` images.remotePatterns Supabase Storage 허용 · `vitest.config.ts` server-only stub alias (3 suite 복구) · `admin-theme.css` 업로드 진행률 keyframe. 458/458 vitest · tsc 0 · next build success. 상세 `memory/project_session129_complete.md`.
>
> 2026-05-02 · Session 128 — 어드민 주문 풀 구현 (`bb04f856`). **Group B 완료** (B-0 RLS · B-1 목록 · B-2 상세 · B-3 발송 다이얼로그 · B-4 환불 안내). 마이그레이션 030 (orders/order_items admin SELECT + `admin_orders_status_counts` RPC) + 031 (payment_transactions admin SELECT). 시안 inline style 100% 이식 — 5탭 카운트 RPC + URL state(status·period·payment·q·page) + 검색 debounced router.replace + 페이지네이션 윈도우(첫·끝+current±1). 상세 페이지 2-col 그리드 (좌 상품·결제·배송 + 우 고객·환불·메모·타임라인) — order + items + profile + 누적 주문 + payment_transactions 병렬 fetch. 송장 다이얼로그 — 택배사 드롭다운(직접입력 분기) + mono input + ESC/외부클릭 + autofocus + spinner. `dispatchOrderAction` server action (결정 3 B안) — `getAdminClaims` 가드 + `dispatch_order` RPC + `revalidatePath`. 실기 검증 완료 — 한진택배 1213123213123 발송 처리 → paid → shipping 전환 + 송장 표시 + 타임라인 진행. Next.js 16 cacheComponents 호환 — root layout `NextTopLoader`/`OverscrollColor`/`TouchHoverGuard`/`CartDrawer` 각각 `<Suspense fallback={null}>` 격리 (동적 [param] 라우트 prerender 시 dynamic-data 클라 컴포넌트 catch). 458/458 vitest (41 신규) · tsc 0 · next build success. 상세 `memory/project_session128_complete.md`.
> 이전: Session 127 — 어드민 시각 폴리싱 (`e0789aa9`, 폰트 Pretendard 통일 + 워드마크 SVG). Session 126 — 어드민 시안 5종 풀 이식 (`1c9151c0`). Session 125 — 어드민 시안 inline style 100% 이식 (`adcd39e0`).

---

## 범례

| 기호 | 의미 |
|------|------|
| ✅ | 완료 |
| 🔄 | 진행 중 |
| ⬜ | 미착수 |
| ➖ | 해당 없음 / 스킵 |

---

## 전체 요약

| Phase | 완료 | 진행 중 | 미착수 | 진행률 |
|-------|------|---------|--------|--------|
| Phase 1 — Design | 5 | 0 | 0 | 100% |
| Phase 2 — Frontend | 7 | 1 | 0 | ~95% |
| Phase 3 — Backend | 3 | 1 | 0 | ~75% |
| Phase 4 — Infrastructure | 4 | 1 | 0 | ~85% |
| Phase 5 — QA | 0 | 0 | 3 | 0% |
| 어드민 풀 구축 (출시 전 신규 영역) | 1 (A·시안 이식·B) | 0 | 8 | ~25% |
| User AI | 0 | 0 | 1 | 0% |

**현재 위치 (S125 종료, 2026-05-02):**

- Sessions 18~49 디자인 폴리시·반응형 4BP 완료. Sessions 51~60 Phase 4 인프라(Vercel·Supabase·Sentry) + Phase 1 인터랙션 ②⑤⑧.
- BUG-006 Tier 3 Stage C+D ✅ Session 66 (`9f954e90`) — Activity preserve + route-change event. 후속 묶음 A~E (S73~S77) 모두 closure.
- BUG-100~178 polishing 대거 closure (Sessions 70~98). 결제 사고 BUG-172 closure (S91, public_token 컬럼 + virtualAccount 분기). **BUG-179 closure (S138, `8acc6a79` — useAddCartItem.onSuccess client→server uuid 교체로 race 무력화). BUG-Kakao 모바일 팝업 closure (S138 자연 해소).**
- 정기배송 백엔드 Group B+C ✅ Session 111. 카페 메뉴 좋아요 기능 ✅ Sessions 100·101. likes 외부 store 격리 ✅ Session 116.
- 이미지 최적화 Phase 1 ✅ Session 121 (next/image · LQIP). yet-another-react-lightbox 라이브러리 컨버전 ✅ S121 + 잔존 1·2 closure ✅ S122·S123.
- 코드 리뷰 R-SEC(S104·109) · R-FE1(S105~107) · R-FE3(S108) · R-FE2(S113) · R-S113/S114(S116) 진행. R-SEC 잔여 M-6/M-7/M-8/L-2/L-4.
- **다음 큰 영역:** 어드민 풀 구축 (`docs/admin-implementation-plan.md` · `project_admin_subscription_plan.md`) — 출시 전 확정. 정기배송 풀 구현은 어드민 후속.

---

## 진행 중 · 잔여 작업

### Phase 2 — Frontend 🔄

#### 6. Frontend Development

| 항목 | 상태 | 비고 |
|------|------|------|
| 2-F 콘텐츠 채우기 | ✅ | GoodDays(42장 + 라이트박스) · Story(실콘텐츠 + 진입 연출) · MyPage(ManageSection 완성) 모두 완결 (2026-04-16 시점 확인) · 그 이후 S99 마이페이지 아코디언 · S100 카페 메뉴 좋아요 · S111 정기배송 · S113 마이페이지 폴리싱 등으로 더 풍부해짐. 검색 시스템(엔진+오버레이+SRP) 도 RP-10 으로 완료 |
| 2-F2 상태관리 단일화 (ADR-004) | ✅ | Step A~D 완료 (S14~17) · Zustand 제거 · TanStack Query + useSupabaseSession 단일 소스. S116 카페 메뉴 likes 도 외부 store 패턴으로 일관성 확보 |
| 2-G1 디자인 폴리시 (Phase 1~3) | ✅ | Sessions 18~36 — 카트 풀페이지 · 게이지/레이더 통일 · 팔레트(gold accent) · CTA hover gold |
| 2-G2 반응형 4BP | ✅ | Sessions 37~49 — clamp 토큰화 · container queries · 햄버거 드로어 · tap-area sweep · 360/768/1024/1440 전 페이지 QA |
| 2-G3 프로덕션 마감 | 🔄 | H3 ✅ · H4 ✅ · H5 ✅ · H6 🟡 (S120 보류, RUM 재평가) · M7 ✅ · M8 ✅ (S120 23개 셀렉터 audit) · 번들 감사 + 최종 R-7 리뷰 잔여 |
| 2-H BUG-006 Tier 3 (instant navigation) | ✅ | Stage A·B·C·D 완료 (S66, `9f954e90`) — Activity preserve + `gtr:route-change` event + effectivePath 패턴. 후속 묶음 A~E (S73~S77) 모두 closure (BUG-130/131/132/133/134/135/138/139/140/144~147) |
| 2-I 결제·체크아웃 정상화 | ✅ | S62~S63 — PGRST202 (Turbopack 스코프) 해소 · CSP Toss wildcard · 공용 데모 키 교체 · 비회원 주문 silent return 수정 · loadFailed CTA · Toss "이전" bfcache 복원 · 모바일 축약. **S86~87 BUG-115 옵션 Z** (마이그레이션 023/024 + paymentService 9종 provider 매핑). **S91 BUG-172 결제 사고 복구** (`34f351be`, public_token 컬럼 + virtualAccount 분기 정합화) |
| 2-J 카페 메뉴 좋아요 + 진입 연출 | ✅ | S100/S101 좋아요 기능 + 하트 버튼 리디자인. **S116 likes 외부 store 격리 (옵션 B)** — `menuLikesStore` (useSyncExternalStore) + sort/뱃지 분리 + ShopPage 패턴 회귀 |

#### 7. Content & Asset

| 항목 | 상태 | 비고 |
|------|------|------|
| 이미지 최적화 (WebP/AVIF) | 🔄 | **Phase 1 ✅ Session 121** — next/image 마이그레이션 + LQIP (50장 굿데이즈 갤러리 blur placeholder) + 라이트박스 라이브러리 컨버전 (yet-another-react-lightbox). Phase 2 (Supabase Storage 업로드) 어드민 Group A-6/E/F 묶음 · **Storage Transform (Pro $25/월) 은 서비스 출시 후 RUM 기반 재평가** · Phase 3/4 출시 후. 4-Phase 계획: `memory/project_image_optimization_plan.md` |
| 콘텐츠 매핑 (DB↔UI) | ⬜ | 어드민 Group E (상품) · F (카페 메뉴) 와 함께 처리 — `lib/products.ts` · `lib/cafeMenu.ts` 하드코딩 → DB 이전 |

#### 프로덕션 전 필수 처리

> 단일 진입점: `memory/project_pre_production_checklist.md`

| ID | 이슈 | 상태 |
|----|------|------|
| A1 | ADR-004 Zustand 제거 이행 완료 확인 | ✅ S17 (2026-04-18, `bc6e2258`) |
| H3 | 사업자 정보 → 환경변수/DB 이관 | ✅ S51 — `NEXT_PUBLIC_BUSINESS_*` 5종 + `.env.example` |
| H4 | Pretendard CDN → `next/font/local` 전환 (SRI) | ✅ 적용 확인 (S120) — `layout.tsx` `localFont` + `PretendardVariable.woff2` |
| H5 | Footer `'use client'` → BizInfoToggle 분리 | ✅ 분리 확인 (S120) — `SiteFooter` server + `FooterBottom`/`FooterWholesaleLink` client |
| H6 | Header Server/Client 경계 재설계 | 🟡 S120 보류 — wrapper 가 useHeaderTheme/headerRef 의존으로 client 필수, SSR 효용 미미 (LCP 후보 아님). 출시 후 RUM 데이터로 재평가. 근거 상세: `memory/project_pre_production_checklist.md` H6 보류 근거 섹션 |
| M7 | CSP 등 보안 응답 헤더 점검 | ✅ S51 — `proxy.ts` nonce CSP + HSTS/COOP/CORP/Permissions |
| M8 | globals.css font-family 감사 (27개 후보 클래스) | ✅ S120 — 23개 수정 (한글 22 / 숫자 1) · dead CSS 2건 별건 노트 |

#### 코드 리뷰 잔여

| 순서 | 대상 | 상태 | 비고 |
|------|------|------|------|
| R-5 | 2-E 플로우 복구 + `/biz-inquiry` | ⬜ | 필요 시 |
| Session 50 | 반응형 1차 리뷰 (S37~49) | ✅ | `memory/review_session37_49_responsive.md` (HIGH 4·MED 5·LOW 3) |
| R-7 | 2-G3 프로덕션 마감 (CSP·env·빌드 최종) | ⬜ | Vercel 배포 후 번들 감사 포함 |
| R-SEC | API Routes + 인증 + 결제 보안 리뷰 | 🟡 | S104 1차 + S109 2차 — M-2/M-5/L-1/L-3 closure · M-9 verified · **잔여 M-6/M-7/M-8/L-2/L-4** (Phase 3) · `memory/review_rsec_20260429.md` |
| R-FE1 | Cart + Checkout UI 도메인 리뷰 | ✅ | S105~107 — CRITICAL 0·HIGH 4·MEDIUM 15·LOW 8 전체 closure · `memory/review_fe1_20260429.md` |
| R-FE2 | 정기배송 백엔드 리뷰 | ✅ | S113 — HIGH 5·MEDIUM 6·LOW 4 정리 · `memory/review_fe2_20260430.md` |
| R-FE3 | MyPage · Cafe · Shop 도메인 리뷰 | ✅ | S108 — HIGH 2·MEDIUM 3·LOW 5 closure · `memory/review_fe3_20260429.md` |
| R-S113/S114 | 카트·좋아요·메뉴소팅·샵탭 변경분 | ✅ | S116 — CRITICAL 0·HIGH 0·MEDIUM 1 (toggle deps) 승인 · `memory/review_s113s114_20260430.md` |
| R-ADMIN | 어드민 풀 구축 후 보안·UI 리뷰 | ⬜ | 어드민 Group A~G 완료 후 |

---

### Phase 3 — Backend 🔄

> 계획 문서: `docs/backend-architecture-plan.md` · `docs/payments-flow.md` · `docs/payments-security-hardening.md`

#### 세션 로드맵

| 세션 | 범위 | 상태 |
|------|------|------|
| Sessions 3~8 | P2-B 결제 (B-1 ~ B-5) + 보안 하드닝 #1~#4 + 통합 테스트 | ✅ |
| Session 11 | P2-D Resend 이메일 + 보안 #3-4b (prod `?orderNumber=` 차단) | ✅ |
| Sessions 12~13.5 | P2-F 카트 DB + RBAC (ADR-003) + 리뷰 하드닝 | ✅ |
| Sessions 14~17 | ADR-004 Step A~D — TanStack Query · `useSupabaseSession` · zustand 제거 | ✅ |
| Session 86~87 | BUG-115 옵션 Z 결제수단 백엔드/프런트 — 마이그레이션 023/024 + paymentService 9종 provider 매핑 | ✅ |
| Session 91 | BUG-172 결제 사고 복구 — public_token 컬럼 누락 + virtualAccount 분기 코드/CHECK 제약 정합화 | ✅ |
| Session 111 | P2-C 정기배송 백엔드 Group B+C — subscriptionRepo + 7개 Route Handler + MyPagePage real API 연동 | ✅ |

> 세부 세션별 범위는 `memory/project_backend_p2_session_plan.md` 참조.

#### Auth & Security 잔여

| 항목 | 상태 | 비고 |
|------|------|------|
| P2-2 Supabase RLS 정책 (앱 레벨) | 🟡 | P0 6 테이블 + S12 cart_items + S13 admin/audit + S111 subscription_changes/holidays 정책 적용 · 어드민 Group A 진입 시 풀 점검 |
| RBAC / 인가 정책 | ✅ | S13 — `profiles.role` enum + `is_admin()` + `requireAdmin` 가드 (ADR-003) |
| 최종 보안 감사 | ⬜ | P2-2 + 어드민 완료 후 security-reviewer 전면 감사 + R-SEC 잔여(M-6/M-7/M-8/L-2/L-4) 처리 |

#### Payment & Order

| 항목 | 상태 | 비고 |
|------|------|------|
| 토스페이먼츠 결제 + 웹훅 + 정산 | ✅ | S3~S8 완료 + S11 이메일 통합 + S86~91 옵션 Z + 결제 사고 복구 |
| 정기배송 구독 엔진 (조회·일시정지·해지) | ✅ | S111 — 7개 Route Handler |
| **정기배송 자동 결제 집행 (cron/schedule)** | ⬜ | Phase 3 후속 — `project_adr005_subscription_cycles_queue.md` (ADR-005 예정) |

#### 어드민 풀 구축에 따른 백엔드 잔여

> 진입점: `project_admin_subscription_plan.md` · 작업 리스트: `docs/admin-implementation-plan.md` · `docs/subscription-full-implementation-plan.md`

| 영역 | 상태 | 비고 |
|------|------|------|
| 상품 도메인 DB 마이그레이션 | ⬜ | `next/src/lib/products.ts` (295줄) 하드코딩 → DB. 어드민 Group E 가장 큰 작업 (20~29h) |
| 카페 메뉴 도메인 DB 마이그레이션 | ⬜ | `next/src/lib/cafeMenu.ts` 하드코딩 → DB. 어드민 Group F (12~17h) |
| Supabase Storage 버킷 | ⬜ | `product-images` · `menu-images` · `is_admin()` RLS 재사용 |
| Production Supabase 마이그레이션 005·019~024 적용 | ⬜ | S91 사고 재발 방지용 — 어드민 Group A 진입 전 검증 필수 |

---

### Phase 4 — Infrastructure 🔄

| 항목 | 상태 | 비고 |
|------|------|------|
| Vercel 프로젝트 설정 | ✅ | S52 — 환경변수 18종 Import + CSP nonce 동적 렌더링 |
| 외부 서비스 콜백 등록 | ✅ | S52 — Supabase Auth · Kakao Maps · Kakao OAuth · Naver OAuth (Toss 라이브 전환 시 추가) |
| Supabase 프로젝트 설정 | 🔄 | dev(`ceqewbbjuhtnarzgkzmx`) ✅ · staging/prod 분리 잔여 |
| CI/CD 파이프라인 | ✅ | GitHub → Vercel (master push 시 prod) |
| 모니터링 / 에러 트래킹 | ✅ | S53 — Vercel Analytics + Speed Insights · Sentry SDK + tunnelRoute |
| **Toss 라이브 키 교체** | ⬜ | 출시 직전 — `project_production_toss_key_migration.md` (S91 사고이력 반영, 위젯 키 vs 개별 연동 키 호환성 매트릭스) |

---

### 어드민 풀 구축 (출시 전 신규 영역) ⬜

> **단일 진입점:** `memory/project_admin_subscription_plan.md` (S92 정책 변경 — 풀 어드민 출시 전 확정)
>
> **작업 리스트:**
> - `docs/admin-implementation-plan.md` — 풀 어드민 (Group A~G, 56~80h, 9단계)
> - `docs/subscription-full-implementation-plan.md` — 정기배송 풀 (어드민 후속, 14~19h)

| Group | 영역 | 상태 |
|-------|------|------|
| A | Foundation (`/admin/login` + 인증·RLS 점검) | ✅ S124 (Foundation) + S125~S127 (시안 inline style 풀 이식 + 시각 폴리싱) |
| B | Orders (주문 관리) | ✅ S128 — 목록·상세·발송 다이얼로그·환불 안내 풀 구현 (마이그레이션 030/031) |
| C | Users (사용자 관리) | ⬜ |
| D | Subscriptions (정기배송 관리) | ⬜ |
| E | Products (상품 도메인 DB + 어드민 UI) | ⬜ 가장 큰 작업 (20~29h) |
| F | Cafe Menu (카페 메뉴 도메인 DB + 어드민 UI) | ⬜ 12~17h |
| H | Site Settings (공지·시즌배너·배송정책) | ✅ S129 — DB + 어드민 UI + B2C 풀 반영 (마이그레이션 032 · 'use cache'/cacheTag 패턴 · 자동 모드 토글) |
| I | Analytics (대시보드 · 통계) | ✅ S130 — 마이그레이션 033 (admin_dashboard_overview + admin_sales_aggregate RPC 2종) + 대시보드 실 데이터 매핑 + 매출 통계 readiness 분기. I-3 menu_likes 컬럼은 Group F 진입 시 처리 |
| J | GoodDays Gallery (이미지 어드민) | ⬜ 6~8h (S124 신규) |
| G | Operations (SOP 문서 + E2E) | ⬜ |
| 후속 | 정기배송 풀 구현 (자동 결제 집행 · 휴일 큐 등) | ⬜ 14~19h |

**클라이언트 의사결정 대기:** admin 계정 정책 · 상품 카테고리 확장 · 재고 정밀도 · 정기배송 출시 시점/할인율 · 주기 옵션 · 자동 결제 SLA · 해지 정책. 자세한 항목 `project_admin_subscription_plan.md §클라이언트 의사결정`.

---

### V2 디자인 자문 적용 (Claude Design 자문 1) — 진행 중

| Phase | 항목 | 상태 |
|-------|------|------|
| **1** | 토큰 정착 — `--brand-sand` 격상 + warning 분리 + focus ring 정리 | ✅ S131 (`0e97375d`) |
| 1 | surface 6→4단 축약 (D-6) · 타이포 8단 재정렬 (D-7) · 섹션 패딩 160 (D-1) · 모션 (D-2) · 영문 부제 (D-3) · eyebrow (D-4) · Hero 80vh (D-5) · warning 시각 검증 (D-8) · Hero 한글 보조카피 (D-9) · Hero 60-40 분할 (D-11) | ⏸️ 보류 (체감 차이 vs 회귀 위험 평가 후 재고려) |
| **2 (A-1)** | HeroVideo 가드 의무화 (`preload="metadata"` 추가) | ✅ S132 (`878cbdff`) |
| **2 (A-2)** | SpecTable 신규 — PDP 식약처 표 컴포넌트 분리 + 네이버 ground truth 데이터 + footer 좌우 분할 (notices + cert 마크) | ✅ S132 (`a0f521b5`) |
| **2 (A-3)** | OptionChipGroup 신규 + 정기배송 탭 → 체크박스 격하 + 시각 일관성 정비 (B2C UI 만 — 할인 계산 D-15 carry-over) | ✅ S132 Phase 1 (`492b8e0d`) |
| **2 (A-3 Phase 2)** | PDP 레이아웃 대개편 — 가격 chip 통합 / status 좌상단 floating / 스텝퍼+CTA 한 줄 / 좌측 이미지 sticky / 아코디언 우측 최하단 / sub-pixel 누적 차단 | ✅ S133 (`eb3cfb52`) |
| **2 (A-3 Phase 3)** | PDP 갤러리 yarl Inline+Thumbnails 도입 (D-20) — 공식 docs 패턴 (`inline.style` direct sizing + container query 100cqw) + 화살표 white 통일 (굿데이즈 동일 SVG) | ✅ S135 (`e6bca0b1`) |
| **2 (A-4)** | DripBagSteps 분리 — 드립백 PDP 전용 (RecipeGuide 와 분리) + 레시피 카드 typography 정수화 (15/13/13/11) + padding/gap/illust 비례 축소 + TIP 영역 정리 + 아코디언 간격 통일 (96→48) + 모바일 #pd-inner padding 누락 추가 | ✅ S136 (`633297d3` + `a745513a`) |
| **2 (A-5)** | Card 통합 — `GenericCard` base 추출 (ShopCard · CafeMenuCard wrap) + Quick Add (sp-qa-bar) 폐기 + ShopPage `?item=` highlight 이식 + SearchResultCard product → `/shop?item=` shortcut + 좌상단 뱃지 위치 12/12 통일 + flash 0.6s delay (D-21 카드 뱃지 색상 시스템 보류) | ✅ S137 |
| **2 (A-6)** | Accordion 통합 — 공통 `Accordion.tsx` (controlled/uncontrolled · pd-accordion CSS 재사용) + ProductAccordions 리팩터 + `mp-accordion → mp-form-reveal` rename (CSS 24룰 + JSX 9곳) + `/legal/[slug]` 5페이지 SSG (terms/privacy/business-info/shipping/returns · canonical · openGraph · 시행일 통일 · 좌측 사이드 골드 active · shipping/returns useAccordion=true) + 골드 라인 상하 2px 인셋 (인접 분리) + Footer/MobileNavDrawer 약관 링크 + 토스 결제 일원화 텍스트 정합 | ✅ S138 (`68e025ff`) |
| **2 (A-7)** | Drawer 폭 토큰 통일 — CartDrawer `width: 664px` → `var(--drawer-width)` 540 (CafeNutritionSheet · MobileNavDrawer 와 동일 토큰). 자문 §6.4/§6.9 검색 패널 우측 480 Drawer 권고는 D-22 폐기 (검색 drop-down 유지) | ✅ S139 |
| 2 보류 | D-12 SpecTable 12 키 폐기 · D-13 SpecTable 기본 펼침 · D-14 분쇄도 옵션 · D-15 정기배송 할인 계산 흐름 통합 (Phase 2) · D-16 어드민 Group E 정기배송 할인율 입력 (Phase 3) · D-21 카드 뱃지 색상 시스템 통합 (자문 §6.2 sand 통일 vs emergency 신호 의미 충돌 — 별도 검토 필요) · **D-22 자문 §6.4/§6.9 검색 패널 우측 Drawer 권고 폐기 (drop-down 유지 · 운영 현실 + 업계 표준 부합)** | ⏸️ |
| 3 (§2.2) | 메인 시그니처 chapter PR-1a — advisory-A pixel spec implement (Hero 직후 sand 단독 카드 + 5fr/7fr split + `--ink-on-sand` 토큰 + `SignatureChapter.tsx` server component + 마이그레이션 034 + 시즌 배너 폐기) + 디자인 수정 1차 (eyebrow `.blk-label` 통일 + sand 위 gold scoped / chip 13px `--type-body-s-size` / CTA PDP 패턴 답습 height 48 "상세 보기 →" / 사진 `<Link>` wrap + hover scale 1.02 / subtitle I 안) | ✅ S146 (`ad0c0627`) |
| 3 (§2.2) | 메인 시그니처 chapter PR-1b — 화살표 제거 + active translateY → bg darken (Blue Bottle 패턴) | ⬜ S147 |
| 3 (§2.2) | 시그니처 chapter PR-1c — 전 사이트 CTA 12+종 hover/active 통일 (Gold Fill ::after 일괄 폐기 + 단순 hover lighten/active darken) | ⬜ S147 (별도 sprint 분량) |
| 3 (§2.2) | 시그니처 chapter PR-2 — advisory §6 어드민 워크플로 (입력 UI · 4 brk 미리보기 · 안전 영역 가이드 · 분기 캘린더) | ⬜ S148+ |
| 3 (남은) | 메인 §2.3 라인업 그리드 / §2.5 카페 메뉴 split / §2.6 스토리·굿데이즈 / §2.7 Footer · 샵 / PDP / 마이페이지 / 카트·체크아웃 / 나머지 | ⬜ |

**자문 응답:** `memory/project_design_audit_v2.md` (보충본 통합 · 1763줄 raw)
**우선순위:** `memory/project_design_audit_priorities.md` (39+ 항목)
**정정 사항 3건:** Hero 카피 1—1 / SKU 6종 제약 → 시그니처 라벨 / PDP 썸네일 4컷 보류 (이미지 자산 부족)

---

#### D-19 옵션 C — Typography·Grid 통합 sprint 🔄

> sub-pixel 누적 차단 + 8px line-height 정합 + 모바일 비례 손실 미디어쿼리 분기. 외부 표준 검증: `memory/research_typography_grid_external_standards.md` (MD3 + W3C 한글 + Pretendard GOV + Modular Scale + Aesop/Drop Coffee). 시각 회귀 위험 R-1~R-8 정량화: `memory/project_typography_subpixel_8px_grid.md`.

| PR | 단계 | 상태 |
|----|------|------|
| **PR-1** | font-size 토큰 11개 `clamp()` → 정수 px + 미디어쿼리 분기 (mobile/tablet/desktop) + 한글 본문 별도 토큰 + 영문 헤딩 letter-spacing px 사전 계산 + mobile Display 40 → 36 (스토리 hero 꽉참 완화) | ✅ S140 (`bab8a43a` + `6bef0edb`) |
| **PR-2** | line-height ratio (1.x) → 정수 px (64곳 · 8 정합) — 헤딩 line-height 분기 토큰 5종 신규 (`--lh-display/h1/h2/h1-editorial/h2-editorial`) + ratio 토큰 정수화 (`--lh-tight/snug/normal: 24px` · `--lh-relaxed` deprecate) + 헤딩 셀렉터 15곳 토큰 변환 + 본문 51곳 정수 px 일괄 (24/28/20/16) | ✅ S141 (`33e81bca`) |
| **PR-3** | letter-spacing em → px (직접 12곳 + 토큰 11개) + 헤딩 3토큰 분기 (`--ls-display/heading/h1-editorial` 신규) + border 0.5px **실측 0곳 skip** + padding clamp 7곳 정수 분기 (`--space-20/24/30` + `--layout-padding-x` + `--section-gap` + sp/cm-grid gap) | ✅ S142 (`9f21ae4a`) |
| **PR-5** | sticky offset 토큰 lock — `--ann-bar-height`/`--header-height` clamp → 정수 분기 (mobile 88 / tablet+ 96) + `--sticky-offset` 신규 + 매직 넘버 6곳 토큰 교체 (`#pd-img-wrap`/`#bi-left`/`.chp-right`/`.mp-right`/`.legal-side`/`.st-location` scroll-margin) | ✅ S143 |
| **PR-6** | 13페이지 시각 회귀 검증 (옵션 B · high priority 6페이지) — sticky offset 정합 ✅ / **PDP 라벨↔상품명 간격 회귀 1건 발견 → PR-7 carry-over** (`#pd-name` line-height 20px · h1 토큰 적용 누락) + audit 결과 동일 패턴 2건 추가 (`.blk-heading`/`.tci-h`) | ✅ S144 |
| **PR-7** | 헤딩 line-height 정합 회귀 fix — `--lh-h3` 분기 토큰 신규 (mobile 24 / desktop 32 · h3 font-size 20→24 비례) + 회귀 4건 line-height 적용: `#pd-name` (h1 🔴 → `var(--lh-h1)` 40/44/52) · `.blk-heading`·`.tci-h` (h3 🟡 → `var(--lh-h3)`) · **`.legal-title` audit 신규 🔴** (font-size 32 + lh 20 → 40 1.25 ratio · 8 정합). PR-2 변환 패턴 (1.6/1.7→24 / 1.4/1.3→20 / 1.2/1.1→16) 전수 grep audit 후 헤딩만 fix. 본문 `.pd-recipe-method` 등 라벨류 lh 16 정상 판정 (PR-7 범위 외). chunk 검증 정의 2 (mobile 24 + desktop 32) / 사용 2 (`.blk-heading`·`.tci-h`) | ✅ S145 |

**결정 지점 (S140 진입 승인 완료):**
- Q1 line-height 정수 px ✅ — MD3 + 한글 본문 1.5~1.55x ↔ 8 정합
- Q2 4px spacing 유지 + 8px line-height 정합 hybrid ✅ — MD3 권고
- Q3 한글 본문 별도 토큰 ✅ — Pretendard Apple system 호환 + W3C + 모바일 UI

---

### Phase 5 — Quality Assurance ⬜

> 개발 완료 후 일괄 실시.

| 그룹 | 항목 | 비고 |
|------|------|------|
| 12. Accessibility | WCAG 2.1 AA 자동 검수 + 수정 | — |
| 13. Performance & SEO | Core Web Vitals · 번들 최적화 · 메타·구조화데이터 | 배포 후 측정 |
| 14. Testing & QA | 크로스 브라우저 + 시각 회귀 + E2E(Playwright) | — |

---

### User AI ⬜

| 항목 | 상태 | 비고 |
|------|------|------|
| AI 페르소나 시뮬레이션 | ⬜ | 리서치 페르소나 기반 대화 검증 |
| 유저 클론 검증 | ➖ | 실제 유저 데이터 필요 (서비스 출시 후) |

---

## 참고 문서

| 문서 | 용도 |
|------|------|
| `docs/milestone-completed.md` | 완료 이력 아카이브 |
| `docs/admin-implementation-plan.md` | **[출시 전 작업]** 풀 어드민 작업 리스트 (Group A~G, 56~80h) |
| `docs/subscription-full-implementation-plan.md` | **[어드민 후속]** 정기배송 풀 구현 작업 리스트 (14~19h) |
| `docs/backend-architecture-plan.md` | 14주 백엔드 로드맵 |
| `docs/payments-flow.md` | 결제 플로우 스펙 (v1.0.7) |
| `docs/payments-security-hardening.md` | S8 보안 #1~#4 스펙 + 4b 이행 |
| `docs/email-infrastructure.md` | Resend 인프라 + 템플릿 설계 |
| `docs/settlement-report.md` | S7 정산 RPC 스펙 |
| `docs/bug-and-polishing.md` | Phase 4 이후 버그 + 폴리싱 추적 (BUG-100 이후) |
| `docs/bug006-reproduction-protocol.md` | BUG-006 12섹션 재현 프로토콜 |
| `docs/adr/ADR-001-oauth-account-merge-policy.md` | OAuth 계정 병합 정책 |
| `docs/adr/ADR-002-payment-webhook-verification.md` | 결제 웹훅 하이브리드 인증 |
| `docs/adr/ADR-003-rbac-role-separation.md` | RBAC 역할 분리 정책 |
| `docs/adr/ADR-004-state-management-simplification.md` | Zustand 제거 · TanStack Query 이행 |
| `docs/security-research-2026-04-16.md` | S6 폴리시 — 업계 표준 리서치 근거 |
| `memory/project_admin_subscription_plan.md` | **[진입점]** 어드민 + 정기배송 풀 구현 |
| `memory/project_pre_production_checklist.md` | 프로덕션 전 필수 처리 체크리스트 |
| `memory/project_backend_p2_session_plan.md` | 세션별 모델·에이전트 계획 |
| `memory/project_production_toss_key_migration.md` | Toss 라이브 키 교체 (S91 사고이력 포함) |
| `memory/project_bug006_north_star.md` | **[불변]** BUG-006 목표·성공 조건·금지 |
| `memory/project_bug006_decisions_log.md` | BUG-006 의사결정 D-001~D-026 |
| `memory/project_bug006_deferred_bugs.md` | BUG-006 deferred 카탈로그 (BUG-136~139 승격) |
| `memory/project_flash_debugging_failure_catalog.md` | Flash 디버깅 금지 패턴 X1~X10 |
| `memory/feedback_research_before_proposal.md` | **🚨 [절대 규칙]** 외부 표준 리서치 의무 |
| `memory/feedback_animation_timing_speculative_patches.md` | **🚨 [절대 규칙 · S116]** 진입 연출 추측 patch 금지 |
