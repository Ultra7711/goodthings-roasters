# UI Fix Backlog

> palette-experiment-v1 Step 3-A 진행 중 수집되는 UI 이슈 버킷. Step 4 종료 후 정리 세션에서 일괄 처리.
>
> 기록 규칙: 발견 즉시 추가, 수정은 미룸. 재현 경로 + 관찰 내용 + (있다면) 가설만 기록.

## 상태 범례

- 🔴 P0: 시각적으로 즉시 거슬림 / 프로덕션 블로커
- 🟡 P1: 인지되지만 핵심 기능 저해 X
- 🟢 P2: 디테일 폴리시

---

## 오픈 이슈

### UI-004 — 🟡 전체 버튼 hover 동작 규칙 전수 조사 · 정립 · 일괄 적용
- **배경:** Step 3-A-4 에서 CTA 11종만 hover 규칙 통일. 아이콘/텍스트 버튼 등 나머지는 제각각.
- **조사 범위 (유형별 분류):**
  - CTA 버튼 (primary conversion) — Step 3-A-4 로 opacity .85 + 2px gold 인셋 선 완료
  - 아이콘 버튼 (hdr-icon-btn · mp-icon-btn · mp-addr-icon-btn · close-btn · arrow-btn 등)
  - 텍스트 버튼 (lp-guest-order-btn · cd-shop-btn · f-biz-toggle · f-biz-lookup 등)
  - 탭/필터 버튼 (sp-filter-tab · cm-filter-tab · sp-pg-btn 등)
  - 아코디언 헤더 (pd-accordion-hd · mp-section-header 등)
  - 수량 스텝퍼 (cd-qty-btn · cp-qty-btn)
  - 서브 액션 (mp-save-btn · mp-cancel-btn · ocp-copy-btn · mp-order-copy-btn 등)
- **진행 순서:**
  1. grep 으로 `:hover` 전수 수집 → 유형 매핑 테이블 작성
  2. 유형별 표준 동작 규칙 정립 (darken 강도 · gold 허용 여부 · transform 허용 여부)
  3. 승인 후 일괄 적용 + computed value 검증
- **원칙 시드:**
  - gold = state signal (active/open) 전용, hover 에는 darken 만
  - Exception: CTA 는 hover 에 gold 인셋 선 허용
- **발견:** 2026-04-19 Session 29
- **상태:** 미수정

---

## 완료 이슈

### UI-006 — 🟡 카트 드로어 우측 스크롤바 영역 잘림 재발
- **재현:** 헤더 카트 아이콘 클릭 → 드로어 오픈 → 우측 ~15px 흰 띠, `.cd-remove` X 버튼·프로모 배경·배송비 헤어라인이 스크롤바 gutter 안쪽에서 끝남
- **원인:** `html { scrollbar-gutter: stable }` 상태에서 `position: fixed` 요소의 **페인트가 ICB(=viewport − 15px) 에서 클리핑**됨. `right: 0` 이나 `width: 100vw`, 음수 `right` 확장 모두 bounding box 는 1087 까지 가지만 실제 렌더는 1072 에서 잘림 (CSS 만으로는 ICB 경계를 벗어난 페인트 불가).
- **해결 (Session 35):** `useDrawer` 에서 드로어 오픈 동안
  1. `html.scrollbarGutter = 'auto'` → ICB 가 1087 로 확장 → 페인트 1087 까지
  2. probe (`position:fixed;width:100vw`) 로 실제 gutter 측정 (clientWidth 가 innerWidth 와 동일 보고되는 케이스 대응)
  3. `body.paddingRight = <measured>` → body content-box 1072 유지 → sticky 헤더·페이지 레이아웃 시프트 없음 (UI-005 회귀 방지)
  4. `body.overflow = 'hidden'` → 페이지 스크롤 잠금
- **검증:** `panel.right = bg.right = 1087` · `bodyPadR = 15px` · 헤더 로고 시프트 없음
- **발견:** 2026-04-19 Session 34 (UI-005 해결 이후 재발)
- **완료:** 2026-04-19 Session 35

### UI-005 — 🟡 카트 드로어 호출 시 배경 페이지 우측 밀림 (scrollbar gutter)
- **재현:** 헤더 카트 아이콘 클릭 → 드로어 오픈 순간 헤더 로고 우측 시프트
- **원인:** `useDrawer` 가 `html.scrollbarGutter = 'auto'` 로 해제 → ICB 가 viewport 전체로 확장 → fixed 헤더 좌표 15px 우측 이동
- **해결:** Session 34 — gutter 해제 로직 제거. `html { scrollbar-gutter: stable }` 유지 → ICB 폭 불변, 헤더 시프트 없음. 드로어 우측 15px gutter 는 backdrop 이 덮음.
- **발견:** 2026-04-19 Session 29
- **완료:** 2026-04-19 Session 34

### UI-002 — 🟡 Shop 상품 카드: "매진" → "품절" 문구 변경
- **재현:** Shop 페이지 · 품절 상품 카드 오버레이
- **증상:** 현재 "매진" 으로 표기 → "품절" 로 일관화 (쇼핑몰 표준 용어)
- **해결:** 커밋 `9b60f204` (Session 34) — ProductStatus enum 치환 + 데이터/분기/UI/주석 25건 전수 치환
- **발견:** 2026-04-19 Session 29
- **완료:** 2026-04-19 Session 34

### UI-003 — 🟡 페이지 배경 통일
- **원안:** Shop 배경(secondary warm) 을 전 페이지에 전파
- **실제 해결 경로:** Session 33 Claude Design round-2 팔레트 도입 과정에서 "Shop 차별화 정책 폐기" 결정 → Shop `.sp-page-bg` 를 bg1 로 변경 (`1299ca99`). 전 페이지 bg1 통일로 수렴.
- **결과:** 원안(secondary 통일) 과 반대 방향이지만 "페이지 간 배경 톤 통일" 목적 달성.
- **관련:** `memory/project_palette_shop_detail_tone.md` (원안 미채택 기록)
- **발견:** 2026-04-19 Session 29
- **완료:** 2026-04-19 Session 33 (대안 경로)

### UI-001 — 🔴 Shop 페이지 하단: 푸터와 본문 경계 사이 흰색 ~10px 라인
- **재현:** Shop 페이지 스크롤 최하단
- **증상:** 본문 마지막 섹션(배경 secondary warm)과 푸터(다크) 사이에 흰색 가느다란 가로 라인 ~10px 정도 노출
- **원인:** `.footer { margin-top: 20px }` 선언으로 body 배경(warm-white)이 푸터 위로 노출
- **해결:** 커밋 `1299ca99` (Session 33 round-2 후속 UI 보정) — `.footer` 의 `margin-top: 20px` 제거
- **발견:** 2026-04-19 Session 29
- **완료:** 2026-04-19 Session 33
