# globals.css 섹션 인벤토리

> **작성:** S179 (2026-05-07)
> **목적:** 9985 LOC 단일 globals.css 분할 작업의 진단 베이스 + Pilot 검증.

## 현황

- 단일 파일 라인 수: 9985 → 9796 (Pilot 1 섹션 분리 후)
- 메이저 섹션 마커 (`/* ══...═ */`) 21개
- Tailwind v4 + Lightning CSS + Turbopack HMR 환경 (lessons.md §6 backdrop-filter 누락 사례 보유 → 분할 시 production CSS chunk grep 검증 필수)

## 21 섹션 인벤토리

| # | 시작 라인 | 섹션 | LOC | 라우트 한정 | 위험도 | Pilot 적합도 |
|---|-----------|------|-----|------------|-------|---------------|
| 1 | 4 | Design Tokens + 글로벌 (헤더/푸터/검색/네비/CTA) | 1645 | 글로벌 | ❌ | 분할 불가 (전역 의존) |
| 2 | 1649 | 홈 P-2 | 1000 | `/` | ⭐ | 큼 |
| 3 | 2649 | 공통 페이지 타이틀 (Shop/Menu/GoodDays) | 340 | 공유 | ⭐⭐ | 공유 클래스 |
| 4 | 2989 | CAFE MENU PAGE (RP-5) | 1541 | `/menu` | ⭐ | 큼, 후순위 |
| 5 | 4530 | Purchase Options (RP-4c) | 516 | `/shop/[slug]` | ⭐ | PDP 의존 |
| 6 | 5046 | 로스팅/노트/레시피/아코디언 | 158 | `/shop/[slug]` | ⭐⭐ | PDP 의존 |
| 7 | 5204 | Container Queries (illust) | 633 | 공유 | ⭐ | 공유 |
| 8 | 5837 | STORY PAGE (RP-6a) | 377 | `/story` | ⭐⭐⭐ | 적합 |
| 9 | 6214 | BIZ INQUIRY PAGE | 383 | `/biz-inquiry` | ⭐⭐ | 적합 |
| 10 | 6597 | GLOBAL TOAST | 31 | 글로벌 | ❌ | 작음, 글로벌 |
| 11 | 6628 | GOOD DAYS PAGE | 259 | `/gooddays` | ⭐⭐⭐ | 적합 |
| 12 | 6887 | CHECKOUT PAGE (RP-7) | 558 | `/checkout` | ❌ | 결제 critical, 보류 |
| 13 | 7445 | ORDER COMPLETE PAGE | 130 | `/order-complete` | ⭐⭐⭐ | 적합 |
| 14 | 7575 | LOGIN PAGE | 409 | `/login` | ⭐⭐ | 적합 |
| 15 | 7984 | MY PAGE | 647 | `/mypage` | ⭐⭐ | 적합, 다소 큼 |
| 16 | 8631 | Search Result Page | 192 | `/search` | ⭐⭐⭐ | 적합 |
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

## 후속 분리 권장 순서 (carry-over)

다음 세션 진입 시 위험도 ⭐⭐⭐⭐~⭐⭐⭐ 우선:

1. **ORDER COMPLETE** (130 LOC, line 7445) — 라우트 단독, 작음
2. **Search Result** (192 LOC, line 8631) — 라우트 단독
3. **GOOD DAYS** (259 LOC, line 6628) — 라우트 단독
4. **STORY** (377 LOC, line 5837) — 라우트 단독
5. **BIZ INQUIRY** (383 LOC, line 6214) — 라우트 단독
6. **LOGIN** (409 LOC, line 7575) — 라우트 단독, auth 영역 일반 검증
7. **MY PAGE** (647 LOC, line 7984) — 라우트 단독, 다소 큼

### 보류 항목

- **CHECKOUT** (558) / **Cart** (674) — 결제 critical 영역. Phase 3-B 안정화 후 분리.
- **Section 1** (Design Tokens + 글로벌) — 분할 자체 불가. 단 내부 sub-section 정리는 별도 작업으로 검토 가능 (header / footer / search 등).
- **공유 섹션** (3 / 7 / 18 / 19) — 라우트 한정 X. 분할 비용 대비 효과 낮음.

## 참고

- `next/node_modules/next/dist/docs/01-app/01-getting-started/11-css.md` — v16 CSS 가이드
- `~/.claude/rules/web/lessons.md` §5, §6 — Tailwind v4 + Lightning CSS + Turbopack HMR 사례
- `next/src/app/globals.css` — single source (분할 진행 중)
- `next/src/components/legal/LegalPage.css` — Pilot 결과물
