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

### UI-001 — 🔴 Shop 페이지 하단: 푸터와 본문 경계 사이 흰색 ~10px 라인
- **재현:** Shop 페이지 스크롤 최하단
- **증상:** 본문 마지막 섹션(배경 secondary warm)과 푸터(다크) 사이에 흰색 가느다란 가로 라인 ~10px 정도 노출
- **가설:** Shop 본문 래퍼 `margin-bottom` 또는 `padding-bottom` 잔존 · 혹은 `main` 과 `footer` 사이 body 배경(warm-white) 노출
- **발견:** 2026-04-19 Session 29
- **상태:** 미수정

### UI-002 — 🟡 Shop 상품 카드: "매진" → "품절" 문구 변경
- **재현:** Shop 페이지 · 품절 상품 카드 오버레이
- **증상:** 현재 "매진" 으로 표기 → "품절" 로 일관화 (쇼핑몰 표준 용어)
- **대상:** ShopPage / ProductCard 내 SOLD_OUT 레이블 문자열
- **발견:** 2026-04-19 Session 29
- **상태:** 미수정

### UI-003 — 🟡 페이지 배경 통일: Shop 배경(secondary warm) 전파
- **대상 페이지:** Menu · Good Days · MyPage · Login · Checkout (Step 1 · Step 2 양쪽)
- **증상:** 현재 페이지별 배경이 제각각(웜화이트/secondary 혼재). Shop 과 동일한 secondary warm 배경으로 통일.
- **원칙:** 기본 배경 = Shop 배경(secondary). 웜화이트는 이후 **선택적 강조용**으로만 사용.
- **웜화이트 사용처 (예시):** 드롭다운 메뉴 배경, 팝오버, 카드 강조 레이어, 모달 패널 등 — secondary 배경 위에 얹히는 상위 서페이스
- **관련:** `memory/project_palette_shop_detail_tone.md` (쇼핑 동선 tone 통일 메모)
- **발견:** 2026-04-19 Session 29
- **상태:** 미수정

---

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

### UI-005 — 🟡 카트 드로어 호출 시 배경 페이지 우측 밀림 (scrollbar gutter)
- **재현:** 헤더 카트 아이콘 클릭 → 드로어 오픈 순간
- **증상:** body `overflow:hidden` 적용되며 세로 스크롤바 사라짐 → 그 폭(≈15px)만큼 배경 UI 가 순간 우측으로 점프
- **가설:** drawer open 시 body lock 패턴에서 `scrollbar-gutter: stable` 미적용. html/body 에 `scrollbar-gutter: stable` 선언 또는 lock 시점에 `padding-right: var(--scrollbar-width)` 보정 필요
- **관련:** useDrawer 훅 · 다른 모달/오버레이 오픈 시에도 동일 이슈 확인 필요
- **발견:** 2026-04-19 Session 29
- **상태:** 미수정

---

## 완료 이슈

(없음)
