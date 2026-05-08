# globals.css 섹션 인벤토리

> **작성:** S179 (2026-05-07)
> **갱신:** S196 (2026-05-08) — Pilot 19 Cart Drawer 분리 + Pilot 20 Section 1 잔류 4종 분리 (-715 LOC)
> **목적:** 9985 LOC 단일 globals.css 분할 작업의 진단 베이스 + Pilot 검증.

## 현황

- 단일 파일 라인 수: 9985 → 9796 (S179 Pilot 1) → 9715 (S180 Pilot 2) → 9596 (S181 OrderItemCard) → 9408 (S182 Pilot 3) → 9176 (S183 Pilot 4) → 8810 (S184 Pilot 5) → 8436 (S185 Pilot 6) → 8155 (S186 Pilot 7) → 7594 (S187 Pilot 8) → 7346 (S189 Pilot 9) → 6778 (S191 Pilot 10) → 5167 (S191 Pilot 11) → 4957 (S192 Pilot 12) → 4025 (S193 Pilot 13) → 3980 (S194 Pilot 14) → 3178 (S195 Pilots 15-18) → 2646 (S196 Pilot 19 + dead code) → **2506 (S196 Pilot 20 Section 1 잔류 4종)**
- 메이저 섹션 마커 (`/* ══...═ */`) 21개
- Tailwind v4 + Lightning CSS + Turbopack HMR 환경 (lessons.md §6 backdrop-filter 누락 사례 보유 → 분할 시 production CSS chunk grep 검증 필수)

## 21 섹션 인벤토리

| # | 시작 라인 | 섹션 | LOC | 라우트 한정 | 위험도 | Pilot 적합도 |
|---|-----------|------|-----|------------|-------|---------------|
| 1 | 4 | Design Tokens + 글로벌 (헤더/푸터/검색/네비/CTA) | 1645 → ~591 (S195 Pilots 15-18 sub-section 분리) | 글로벌 | ❌ | Section 전체 분할 불가 (전역 의존). 단 내부 sub-section 4개 분리 완료: SiteFooter/AnnouncementBar/MobileNavDrawer/SiteHeader |
| 2 | 1649 | ~~홈 P-2~~ | ~~1000~~ → ~68 (sr-img/gtr-rise-*/pageEnter 잔류) | `/` | ⭐ | **S193 Pilot 13 완료** — components/home/HomePage.css |
| 3 | 2649 | 공통 페이지 타이틀 (Shop/Menu/GoodDays) | 340 | 공유 | ⭐⭐ | 공유 클래스 |
| 4 | 2696 | ~~SHOP PAGE (sp-*)~~ | ~~294~~ → ~80 (badge+pagination 잔류) | `/shop` | ⭐⭐ | **S192 Pilot 12 완료** — components/shop/ShopPage.css |
| 5 | 2989 | ~~CAFE MENU PAGE (RP-5)~~ | ~~1541~~ → ~570 (cm-*/cns-* 분리) | `/menu` | ⭐ | **S191 Pilot 10 완료** — components/cafe/CafeMenuPage.css |
| 6 | 4530 | ~~Purchase Options (RP-4c)~~ | ~~516~~ → ~2 (stub) | `/shop/[slug]` | ⭐ | **S191 Pilot 11 완료** — components/product/ProductDetailPage.css |
| 7 | 5046 | ~~로스팅/노트/레시피/아코디언~~ | ~~158~~ → ~2 (stub) | `/shop/[slug]` | ⭐⭐ | **S191 Pilot 11 완료** — components/product/ProductDetailPage.css |
| 8 | 5204 | ~~Container Queries (illust)~~ | ~~633~~ → ~2 (stub) | `/shop/[slug]` | ⭐ | **S191 Pilot 11 완료** — components/product/ProductDetailPage.css |
| 8 | 5837 | **STORY PAGE (RP-6a)** | 377 → ~5 (keyframes 잔류) | `/story` | ⭐⭐⭐ | **S184 Pilot 5 채택 → 옵션 A 분리 완료** |
| 9 | 5848 | **BIZ INQUIRY PAGE** | 383 → ~5 (cross-route 3종 잔류) | `/biz-inquiry` | ⭐⭐⭐ | **S185 Pilot 6 채택 → 옵션 A 분리 완료** |
| 10 | 6597 | GLOBAL TOAST | 31 | 글로벌 | ❌ | 작음, 글로벌 |
| 11 | 6628 | **GOOD DAYS PAGE** | 259 → ~19 (cross-route 잔류) | `/gooddays` | ⭐⭐⭐ | **S183 Pilot 4 채택 → 옵션 A 분리 완료** |
| 12 | 6887 | CHECKOUT PAGE (RP-7) | 558 | `/checkout` | ❌ | 결제 critical, 보류 |
| 13 | 7445 | ORDER COMPLETE PAGE | 130 → 0 (S180: 라우트 단독 ~100 분리 / S181: 공유 .ocp-item* 도 OrderItemCard 추출) | `/order-complete` + `/mypage` | ⭐⭐⭐ | **S180+S181 분리 완료** |
| 14 | 6478 | **LOGIN PAGE + auth-overlay** | 288 → ~5 (cross-route hover 정책 잔류) | `/login` | ⭐⭐⭐ | **S186 Pilot 7 채택 → 옵션 A 분리 완료** |
| 15 | 6606 | **MY PAGE** | 571 → ~7 (cross-route 4종 잔류) | `/mypage` | ⭐⭐⭐ | **S187 Pilot 8 채택 → 옵션 A 분리 완료** |
| 16 | 8431 | **Search Result Page** | 191 | `/search` | ⭐⭐⭐ | **S182 Pilot 3 채택 → 분리 완료** |
| 17 | 8823 | Cart Page | 674 | `/cart` | ❌ | 결제 critical, 보류 |
| 18 | 9497 | Mobile 좌우 패딩 일괄 정렬 | 27 | 글로벌 | ❌ | 글로벌 |
| 19 | 9524 | BUG-134 모바일 상단 여백 | 21 | 글로벌 | ❌ | 글로벌 |
| 20 | 9545 | **Legal Pages** (terms · privacy · business-info · shipping · returns) | 191 | `/legal/[slug]` | ⭐⭐⭐⭐ | **S179 Pilot 채택 → 분리 완료** |
| 21 | 9736 | Signature chapter (advisory-A) | ~250 | `/` 한정 | ⭐⭐ | 적합 |

## 분할 패턴 (Pilot 결과)

### 채택: 컴포넌트 colocate + page-scoped import

```
components/legal/
├── LegalPage.tsx       — import './LegalPage.css'
└── LegalPage.css       — 분리된 CSS (191 LOC)
```

### 검토 후 기각

- **CSS Modules** (`legal.module.css`) — Next.js v16 docs 권장 패턴. 단 클래스 prefix `.legal-*` 로 충돌 risk ≈ 0 + 컴포넌트 코드의 `className` 일괄 변경 비용이 큼 → 후속 세션 검토 항목.
- **`@import "../styles/pages/legal.css"`** — globals.css 안에서 import 시 모든 라우트 로드, 라우트별 chunk split 효과 사라짐.
- **`legal/layout.tsx` 신규 생성** — page.tsx 한 개만 있는 라우트라 layout 추가는 boundary 비용 ↑.

### Next.js v16 CSS 동작 주의

> "Global styles are imported into any layout, page, or component, but **navigation does not unmount stylesheets** → conflicts possible across routes."
> — `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`

→ 라우트 한정 클래스 prefix (`.legal-*` / `.mp-*` / `.lp-*` 등) 가 잘 정해져 있는 GTR 의 경우, prefix 충돌 risk 가 매우 낮아 글로벌 import 패턴 유지 안전.

## Pilot 검증 절차 (S179 Legal)

1. ✅ 의존성 grep — 외부 의존 = 토큰 변수 + `.pd-accordion-body` 1개 (globals.css 5671 에 정의 유지)
2. ✅ `tsc --noEmit` — 0 errors
3. ✅ `vitest run` — 642/642 green
4. ✅ `next build` — exit 0, `/legal/[slug]` 5종 약관 SSG 정상
5. ✅ production CSS chunk grep — 7개 selector (legal-page / legal-shell / legal-side-link / legal-def-row / legal-accordion-list / pd-accordion-body / legal-section-heading) 모두 정상 포함. Lightning CSS 누락 없음

## Pilot 2 추가 발견 — "라우트 단독" 가정 검증 필요 (S180)

ORDER COMPLETE 섹션 130 LOC 중 ~30 LOC 가 마이페이지 OrderHistory.tsx 차용 사용 (`.ocp-item*` 7종). CSS 마커 (`/* ══...═ */`) 만 보고 "라우트 단독" 가정 진입 위험. **의존성 grep 단계에서 셀렉터 단위 차용 여부 반드시 확인.**

대응 패턴 — **옵션 A 채택:**
- 라우트 단독 셀렉터만 분리 (~100 LOC)
- 공유 셀렉터는 globals.css 잔류 (후속 carry-over: 공통 컴포넌트 추출 / rename)
- cross-route 글로벌 정책 (`@media (hover: none)` hover 차단 / 모바일 패딩 일괄) 도 globals 잔류 의도

## Pilot 19 학습 (S196) — orphaned @media 룰 + Turbopack stale chunk

Cart Drawer 분리 시 발견·수정된 3가지 케이스:

### A. orphaned @media 룰 누락 (cross-section)
섹션 마커(`/* ══...═ */`) 단위로 분리하면, 해당 셀렉터의 @media 오버라이드가 **다른 섹션 안에** 있을 때 누락된다. Cart Drawer 본문은 `/* ══ CART DRAWER ══ */` 섹션에 있었으나, `@media (max-width: 1024px/767px/480px)` 안의 cart-drawer 룰은 Cart Page 섹션 내부에 같이 묶여 있어 1차 추출 시 빠짐.

**대응:** 분리 대상 셀렉터(`#cart-drawer-panel`, `.cd-*` 등)를 globals.css 전체에서 grep → @media 안 모든 occurrence 확인 후 일괄 이전.

### B. Turbopack stale CSS chunk (lessons.md §5 케이스)
globals.css에서 룰을 삭제하고 새 파일에 옮겼을 때, dev 서버 chunk가 **삭제된 옛 룰을 그대로 보유**하고 새 룰을 뒤에 추가만 함. 결과: 동일 셀렉터에 두 룰이 동시 존재 → 뒤에 선언된 옛 룰이 이김.

**진단:** `Invoke-WebRequest` 로 `/_next/static/chunks/[root-of-the-server]__*.css` 직접 다운로드 → 분리 대상 셀렉터 grep. 동일 셀렉터 룰이 2회 이상 나오면 stale 확정.

**복구:** dev 서버 stop → `.next/` 디렉터리 통째 삭제 → restart (lessons.md §5 강도 3).

### C. 데드 코드 잔존
`.close-btn`/`.arrow-btn` 클래스는 globals.css에 정의되어 있었으나 어떤 컴포넌트도 사용하지 않음 (`gd-close-btn` 같은 GoodDays 변종만 사용). Pilot 11 (PDP) 분리 시 "cross-route GdCloseButton 용" 으로 잘못 보존된 사례.

**대응:** 분리 단계에서 후보 셀렉터를 `*.tsx`/`*.css` 전체 grep → 0건이면 삭제. 주석 내 references 만 있는 케이스 주의.

## Pilot 13 학습 (S193) — 섹션 내 cross-route keyframe 잔류 패턴

홈 P-2 섹션(1000 LOC) 분리 시 섹션 내 cross-route 항목 발견:
- `@keyframes gtr-rise-*` — CafeMenuPage.css / GoodDaysPage.css / ShopPage.css / StoryPage.css 사용 → globals 잔류
- `@keyframes pageEnter` + `#st-body/#bi-body/#gd-page` — StoryPage/BizInquiry/GoodDays cross-route → globals 잔류
- `.sr-img`, `.sr-txt`, `.sr--visible` — SiteFooter, StoryPage 전체 적용 → globals 잔류

홈 페이지 import 방식: 컴포넌트가 여러 파일로 분산되어 있어 `app/(main)/page.tsx`에서 직접 import.

## 후속 분리 권장 순서 (carry-over)

다음 세션 진입 시 위험도 ⭐⭐⭐⭐~⭐⭐⭐ 우선:

1. ✅ **ORDER COMPLETE** (S180 라우트 단독 + S181 공유 OrderItemCard 추출 완료)
2. ✅ **Search Result** (S182 Pilot 3 분리 완료 — 191 LOC)
3. ✅ **GOOD DAYS** (S183 Pilot 4 분리 완료 — 옵션 A: 라우트 단독 ~240 + cross-route ~19 잔류)
4. ✅ **STORY** (S184 Pilot 5 분리 완료 — 옵션 A: 라우트 단독 ~372 + keyframes stFadeIn ~5 잔류)
5. ✅ **BIZ INQUIRY** (S185 Pilot 6 분리 완료 — 옵션 A: 라우트 단독 ~378 + cross-route 3종 ~5 잔류)
6. ✅ **LOGIN + auth-overlay** (S186 Pilot 7 분리 완료 — 옵션 A: 라우트 단독 ~283 (lp-256 + auth-32) + cross-route hover 정책 ~5 잔류)
7. ✅ **MY PAGE** (S187 Pilot 8 분리 완료 — 옵션 A: 라우트 단독 ~571 + cross-route 4종 잔류 — chp-input 결합 / hover 정책 2 / 모바일 패딩 그룹)
8. ✅ **Signature chapter** (S189 Pilot 9 분리 완료 — .sig-* + .cta-btn-secondary ~248 LOC)
9. ✅ **Cafe Menu Page** (S191 Pilot 10 분리 완료 — cm-*/cns-* ~570 LOC → components/cafe/CafeMenuPage.css. Cart Drawer/PDP는 globals 잔류)
10. ✅ **Product Detail Page** (S191 Pilot 11 분리 완료 — pd-*/yarl-*/option-chip/spec-table 등 1611 LOC → components/product/ProductDetailPage.css. 잔류: .close-btn/.arrow-btn cross-route / .pd-accordion* cross-route)
11. ✅ **Shop Page** (S192 Pilot 12 분리 완료 — sp-page-bg/sp-body/sp-rows/sp-card*/sp-grid* 등 210 LOC → components/shop/ShopPage.css. 잔류: .sp-card-badge/.badge-* cafe 공유 / .sp-pg-* 페이지네이션 3페이지 공유)
12. ✅ **홈 P-2** (S193 Pilot 13 분리 완료 — grain-overlay/hero*/blk-*/season-*/cat-*/cafe-menu-*/ev-banner*/story-*/newsletter*/lineup* 932 LOC → components/home/HomePage.css. 잔류: sr-img/sr-txt/gtr-rise-* cross-route + pageEnter/#st-body/#bi-body/#gd-page cross-route)

13. ✅ **공통 페이지 타이틀** (S194 Pilot 14 완료 — 45 LOC → components/layout/PageTitle.css)
14. ✅ **SiteFooter** (S195 Pilot 15 완료 — 193 LOC → components/layout/SiteFooter.css)
15. ✅ **AnnouncementBar** (S195 Pilot 16 완료 — ~22 LOC → components/layout/AnnouncementBar.css)
16. ✅ **MobileNavDrawer** (S195 Pilot 17 완료 — ~336 LOC → components/layout/MobileNavDrawer.css. 잔류: cross-route `.nav-link, .hdr-icon-btn` compound / `.hdr-icon-btn`/`.hi`/`.cart-badge` / focus-visible)
17. ✅ **SiteHeader** (S195 Pilot 18 완료 — ~254 LOC → components/layout/SiteHeader.css. 잔류: `.nav-link, .hdr-icon-btn` compound / `.hdr-icon-btn`/`.hi`/`.cart-badge` — MiniHeader checkout 공유)
18. ✅ **Cart Drawer** (S196 Pilot 19 완료 — `#cart-drawer*`/`cd-*` 본문 + @media 1024/767/480 cart-drawer 전용 룰 ~474 LOC → components/cart/CartDrawer.css. 잔류: `.shipping-gauge`/`.shipping-gauge-fill` cross-route (CartClient 공유))
19. ✅ **Dead code 제거** (S196 — `.close-btn`/`.arrow-btn` 미사용 ~81 LOC 삭제)
20. ✅ **pd-dropdown 베이스 복원** (S196 — Pilot 11 분리 시 누락된 cross-route 룰 +43 LOC 복원, MyPage CycleDropdown 영향 수정)
21. ✅ **Section 1 잔류 4종** (S196 Pilot 20 완료 — -140 LOC):
    - (a) MyPage autofill `.mp-section-body` ~17 LOC → MyPagePage.css
    - (b) Header icon utilities `.nav-link, .hdr-icon-btn / .hi / .cart-badge / focus-visible` ~58 LOC → components/layout/HeaderIcons.css (cross-route, layout.tsx import)
    - (c) CTA 버튼 `.cta-btn / .cta-btn-light-filled / .cta-btn-light-outline` ~42 LOC → CartDrawer.css (단일 사용처, 신규 파일 불필요). 잔류: `@media (hover: none)` hover 차단 정책 (cross-route 정책 그룹)
    - (d) 일반 input/textarea autofill `:-webkit-autofill` ~28 LOC → styles/forms.css (cross-route, layout.tsx import)

### 차기 후보

- **공통 페이지 타이틀** → ✅ S194 Pilot 14 완료

### 보류 항목

- **CHECKOUT** (558) / **Cart Page** (674) — 결제 critical 영역. Phase 3-B 안정화 후 분리. (Cart Drawer는 S196 분리 완료)
- **Section 1** (Design Tokens + 글로벌) — 잔여 ~450 LOC 본질적으로 글로벌 (design tokens / html·body base / .root / .blk / 콘텐츠 max-width / 접근성). 추가 분할은 over-fragmentation 위험.
- **공유 섹션** (3 / 7 / 18 / 19) — 라우트 한정 X. 분할 비용 대비 효과 낮음.

## 참고

- `next/node_modules/next/dist/docs/01-app/01-getting-started/11-css.md` — v16 CSS 가이드
- `~/.claude/rules/web/lessons.md` §5, §6 — Tailwind v4 + Lightning CSS + Turbopack HMR 사례
- `next/src/app/globals.css` — single source (분할 진행 중)
- `next/src/components/legal/LegalPage.css` — Pilot 결과물
