# Session 39 반응형 감사 결과 — Step D 그리드 BP 분기

**기준:** `claude/palette-experiment-v1` · 2026-04-20
**Before:** `session38-after/` (Step A+B+C 완료 시점)
**After:** `session39-after/` (Step D 적용 후)

---

## 1. 수정 요약

| 대상 | 파일:라인 | 전환 |
|---|---|---|
| Shop 상품 그리드 | `globals.css:1732` | `≤1023: 3→2컬럼` |
| Good Days 홈 모자이크 | `globals.css:1624~` | `<768: 모자이크→1컬럼 스택 + aspect-ratio 해제` |
| Story 2컬럼 섹션 | `globals.css:4075~` | `<768: 1fr 1fr → 1fr + RTL direction 해제 + height auto` |

## 2. BP별 컬럼 수 (최종)

| 구간 | Shop | Good Days 홈 | Story 2컬럼 |
|---|---|---|---|
| ≥ 1440 | 3 | 모자이크 (2fr 1fr 1fr) | 2 |
| 1024~1439 | 3 | 모자이크 | 2 |
| 768~1023 | 2 | 모자이크 | 2 |
| < 768 | 2 | 1 스택 | 1 스택 |

## 3. 캡처 검증 (핵심 관찰)

### Shop
- 1440 3컬럼 · 768 2컬럼 전환 · 360 2컬럼 유지 — 카드 폭 충분히 확보
- `clamp(12px, 1.4vw, 20px)` gap 토큰은 BP별 자연 축소

### Story 2컬럼 (`.st-two-col`)
- 홈 `01b-home-scrolled` 360 캡처에서 "OUR STORY" 섹션이 1컬럼 스택으로 전환됨을 확인
- RTL reverse 패턴은 1컬럼에서 `direction: ltr` 강제 복귀 — 텍스트 방향 정상

### Good Days 홈 모자이크 (`.moments-grid`)
- 캡처 범위 밖 (01b scrollY=900). CSS 수정으로 명시적 대응:
  - `<768`: `grid-template-columns: 1fr` + 첫 카드 `grid-row: auto` + `aspect-ratio: 3/2` (카드 개별 적용)
- Session 40+ 전체 페이지 캡처 시 수동 확인 권장

## 4. Step D 범위 외 (분리 처리)

| 컴포넌트 | 사유 | 처리 세션 |
|---|---|---|
| Home Featured Beans (`.beans-scroll`) | 수평 스크롤 flex — grid 분기 부적합 | Session 40+ 수평 스크롤 튜닝 |
| Cafe Menu `#cm-grid` | 제안서 외 | Session 40+ |
| Good Days Page `.gd-row--a~e` | 제안서 외 (홈 모자이크와 별개) | Session 40+ |
| Shop 데스크탑 4컬럼 | 제안서 권장이나 카드 면적 과소 리스크 | 디자인 결정 대기 |

## 5. 잔여 린트 에러 (기존, Session 39 무관)
- `cart/page.tsx:44` react-hooks/set-state-in-effect
- `useHeaderTheme.ts:71` Unused eslint-disable

## 6. 빌드
- `npm run build` 통과 (CSS 문법 에러 없음)

## 7. 다음 (Session 40)
- Step E — 상품상세 · 체크아웃 2컬럼→1컬럼 스택 전환
- Step F — 푸터 · 기타 컴포넌트
- Featured Beans 수평 스크롤 튜닝 (카드 width BP · dot 스냅)
