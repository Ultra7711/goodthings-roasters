# globals.css 섹션 인벤토리

> **작성:** S179 (2026-05-07)
> **갱신:** S194 (2026-05-08) — PageTitle Pilot 14 분리 (-45 LOC)
> **목적:** 9985 LOC 단일 globals.css 분할 작업의 진단 베이스 + Pilot 검증.

## 현황

- 단일 파일 라인 수: 9985 → 9796 (S179 Pilot 1) → 9715 (S180 Pilot 2) → 9596 (S181 OrderItemCard) → 9408 (S182 Pilot 3) → 9176 (S183 Pilot 4) → 8810 (S184 Pilot 5) → 8436 (S185 Pilot 6) → 8155 (S186 Pilot 7) → 7594 (S187 Pilot 8) → 7346 (S189 Pilot 9) → 6778 (S191 Pilot 10) → 5167 (S191 Pilot 11) → 4957 (S192 Pilot 12) → 4025 (S193 Pilot 13) → **3980 (S194 Pilot 14)**
- 메이저 섹션 마커 (`/* ══...═ */`) 21개
- Tailwind v4 + Lightning CSS + Turbopack HMR 환경 (lessons.md §6 backdrop-filter 누락 사례 보유 → 분할 시 production CSS chunk grep 검증 필수)

## 21 섹션 인벤토리

| # | 시작 라인 | 섹션 | LOC | 라우트 한정 | 위험도 | Pilot 적합도 |
|---|-----------|------|-----|------------|-------|---------------|
| 1 | 4 | Design Tokens + 글로벌 (헤더/푸터/검색/네비/CTA) | 1645 | 글로벌 | ❌ | 분할 불가 (전역 의존) |
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

### 차기 후보 (Pilot 14~)

- **공통 페이지 타이틀** (~68 LOC, 섹션 3) — Shop/Menu/GoodDays 공유. 공유 클래스라 분리 비용 높음

### 보류 항목

- **CHECKOUT** (558) / **Cart** (674) — 결제 critical 영역. Phase 3-B 안정화 후 분리.
- **Section 1** (Design Tokens + 글로벌) — 분할 자체 불가. 단 내부 sub-section 정리는 별도 작업으로 검토 가능 (header / footer / search 등).
- **공유 섹션** (3 / 7 / 18 / 19) — 라우트 한정 X. 분할 비용 대비 효과 낮음.

## 참고

- `next/node_modules/next/dist/docs/01-app/01-getting-started/11-css.md` — v16 CSS 가이드
- `~/.claude/rules/web/lessons.md` §5, §6 — Tailwind v4 + Lightning CSS + Turbopack HMR 사례
- `next/src/app/globals.css` — single source (분할 진행 중)
- `next/src/components/legal/LegalPage.css` — Pilot 결과물
