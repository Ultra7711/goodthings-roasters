# GTR BUG & POLISHING

> 프로덕션 배포(`goodthings-roasters.vercel.app`) 이후 발견된 버그·UX·폴리싱 이슈를 누적 기록. 일정 개수 누적 시 일괄 해결 세션 진행.
>
> **최종 업데이트:** 2026-04-26 · Session 83 (BUG-149 UX 정제 + useNavigation 훅 신규)

---

## 진행률

> **52 / 56 closure (92.9%)** · 2026-04-27 S85 기준 (BUG-125 ✅ · BUG-120 ✅ · BUG-161 ✅ · 로그인 비회원 박스 제거 · isFormRevealed 재진입 reset · login auto-fill race 수정)
>
> 카운트 명령:
> ```bash
> grep -oE "^### BUG-[0-9]+" docs/bug-and-polishing.md | sort -u | wc -l        # total unique
> grep -oE "^### BUG-[0-9]+ — ✅" docs/bug-and-polishing.md | sort -u | wc -l   # closed (inline ✅)
> ```
>
> **세션별 closure 누적:**
> - S53 (legacy `해결됨` 섹션 · BUG-104/105/108) · S70 (BUG-127) · S71 (BUG-109/110) · S72 (BUG-128) · S73 (BUG-130/131/132/135) · S74 (BUG-121/122/123/133/138) · S75 (BUG-134/139) · S76 (BUG-144/145/146) · S77 (BUG-140/147) · S78 (BUG-102/106/107/111/113/114/116/117/118/119/126/141/151/152) · S80 (BUG-154/155/156/157) · S81 (BUG-143) · S82 (BUG-103) · S83 (신규 closure 없음 · BUG-149 UX 정제 · useNavigation 훅)
>
> **데이터 정합 노트:**
> - BUG-104/108/105 는 하단 `해결됨` 섹션에도 중복 기재 (legacy · 참조용)

---

## 범례

| 기호 | 의미 |
|------|------|
| 🔴 | Critical — 결제/인증/데이터 손상 |
| 🟠 | High — 핵심 기능 오동작 |
| 🟡 | Medium — UX 저하·시각 결함 |
| 🟢 | Low — 코스메틱·엣지 케이스 |
| ✅ | 해결 완료 |

---

## 열린 버그

### BUG-101 — 첫 진입 시 버튼 호버 연출이 전 버튼에서 발동 🟡 ⏸️ 이슈 추적 중

- **발견:** 2026-04-21 / prod
- **재현 경로:** 메인 진입 → 스크롤로 섹션 인터랙션 트리거
- **실제:** 첫 입장 때 페이지 내 모든 버튼의 호버 연출이 순간 발동. 이후엔 정상 (호버 시에만 발동)
- **추정 범위:** CSS transition 초기값 · `transition: all` 또는 hover 상태가 mount 시 한번 적용되는 케이스. `:hover` 가 아닌 `.is-hovering` 클래스 또는 `will-change` 초기 페인트 이슈 가능성.
- **S80 분석:** 모바일 드래그 케이스는 BUG-144(`@media (hover: none)`) 로 커버됨. 데스크탑 초기 페인트 flash 케이스는 별도 대응 필요(`body.no-transition` 패턴). 증상 재발 시 데스크탑 재현 확인 후 검토.

### BUG-102 — 상품 안내 아코디언 내용이 우측으로 오버플로우·잘림ㅤ✅

- **발견:** 2026-04-21
- **재현 경로:** 상품상세 페이지 → 아코디언 섹션 확장
- **실제:** 내용이 컨테이너 우측 화면 바깥으로 넘침 · 잘림
- **추정 범위:** `ProductDetail` 아코디언 — `overflow-x` · `width: 100%` 누락 또는 `white-space: nowrap` 잔존. Session 47~48 레시피 카드 반응형 이후 회귀 가능성.
- **해결 (S78):** `.pd-product-info-body { overflow-x: auto }` 추가. `.pd-accordion-body`의 `overflow: hidden`이 수직 애니메이션용이지만 수평도 함께 클리핑하던 구조 — 제품 안내 전용 클래스에서 `overflow-x`만 `auto`로 오버라이드.

### BUG-103 — ✅ 인풋필드 헤어라인이 iOS 모바일에서 안 보임 🟡

- **발견:** 2026-04-21 / iOS Safari·Chrome
- **실제:** PC 정상 · iOS 모바일에서 헤어라인 불가시
- **원인:** `border: 1px solid` 가 iOS 고DPR 에서 sub-pixel rendering 으로 소실.
- **해결 (S54):** `box-shadow: inset 0 0 0 1px` 패턴으로 전환 — 물리 픽셀 기준 렌더링 보장. 1차: 인풋 필드 (`f74cae9e`), 2차: 전체 구분선 40곳 전수 적용 (`253ea44e`). CSS 토큰 3종 `.5px → 1px` 통일.

### BUG-104 — ✅ 카페 메뉴 바텀시트 하단 세이프티 에리어 iOS 잘림 (흰색)

- **발견:** 2026-04-21 / iOS
- **재현 경로:** 카페 메뉴 → 상품 탭 → 바텀시트 오픈
- **실제:** 하단 safe-area inset 영역이 바텀시트 배경으로 채워지지 않고 화이트 노출
- **추정 범위:** 바텀시트 컨테이너 `padding-bottom: env(safe-area-inset-bottom)` 가 배경 밖에 적용. `padding` 대신 `min-height` + 내부 `padding` 또는 배경 확장 필요.

### BUG-105 — ✅ 모바일 Chrome 하단 네비 영역이 히어로와 충돌 🟠

- **발견:** 2026-04-21 / Android·iOS Chrome
- **해결 (S53):** `HeroSection` height `100vh` → `100svh` 전환. 오버스크롤 배경색 시스템(OverscrollColor + OverscrollTop) 도입. 커밋 `944a1c91` + `de5c8b62`. (해결됨 섹션 중복 기재 — cleanup)

### BUG-106 — ✅ iOS/Android Chrome 자동완성 푸른색 배경 노출 🟢

- **발견:** 2026-04-21 / iOS Chrome
- **해결 (S78):** `globals.css` `-webkit-autofill` 계열 오버라이드 + `-webkit-box-shadow: 0 0 0 1000px #FBF8F3 inset !important` + `transition: background-color 99999s step-end` 적용.
- **회귀 (S78):** autofill `box-shadow !important` 가 하단 라인 소실 → BUG-152 로 등록·해결.
- **회귀 (S84):** 모바일 Chrome compositor 레이어에서 파란색이 inset shadow 위로 노출. `chp-input` `background: transparent` → `background: #FBF8F3` 으로 교체 — 불투명 배경으로 근본 차단. 커밋 `3464e2fc`. 실기기 통과 확인 2026-04-26.

### BUG-152 — ✅ 자동완성 적용 후 인풋 하단 라인 소실 🟡

- **발견:** 2026-04-25 / S78
- **재현 경로:** 결제 폼 → 브라우저 자동완성 수락 → 인풋 하단 구분선 사라짐
- **원인:** `input:-webkit-autofill` 의 `box-shadow: 0 0 0 1000px inset !important` 가 `.chp-input { box-shadow: inset 0 -1px 0 0 ... }` (하단 라인) 전체를 덮어씀.
- **해결 (S78):** autofill box-shadow에 하단 라인 shadow를 두 번째 값으로 추가. 기본/hover/active = 1px `rgba(28,27,25,.12)`, focus = 2px `#1C1B19`. `:focus` 는 별도 선택자로 분리.

### BUG-107 — ✅ 모바일 굿데이즈 라이트박스 좌우 버튼 크기·컬러 보정 🟢

- **발견:** 2026-04-21 / 모바일
- **재현 경로:** 굿데이즈 → 이미지 클릭 → 라이트박스
- **실제:** 좌우 스크롤 버튼이 계속 보이고, 기본 회색이 탁함. 크기도 모바일에선 크거나 어색
- **해결:** 이전 세션. `globals.css` 모바일 `.gd-lb-arrow` 오버라이드 — `opacity: 0.45`, 44px 터치 영역, `stroke-width: 0.82` 적용 완료. 확인 2026-04-25 / S78.

### BUG-108 — ✅ 카페 메뉴 바텀시트 터치 이벤트 통과 (배경 스크롤)

- **발견:** 2026-04-21 / 모바일
- **재현 경로:** 카페 메뉴 → 상품 탭 → 바텀시트 오픈 → 바텀시트 영역 터치/스크롤
- **실제:** 바텀시트가 터치를 소비하지 못하고 하단 리스트가 대신 스크롤됨. 핸들러(드래그) 도 미동작.
- **추정 범위:** `pointer-events` 누락 또는 `touch-action` 미설정. 오버레이/바디 스크롤 락 (`overflow:hidden` on body) 미적용 가능성. `useDrawer` 패턴과 일관성 검토 필요.

### BUG-109 — ✅ 카페 메뉴 하이라이트 모바일 페이지 오계산 🟠

- **발견:** 2026-04-22 / 모바일
- **재현 경로:** 검색 결과 → 카페 메뉴 아이템 클릭 → `/menu?item=<id>` 이동
- **실제:** 모바일에서 인덱스 10+ 아이템이 2페이지에 있어야 하는데 1페이지로 잘못 계산 → scrollIntoView 실패
- **원인:** `useMediaQuery` 초기값 `false` → 첫 렌더 "adjusting state during render" 블록에서 `perPage = CM_PER_PAGE(20)`으로 페이지 계산. 실제 모바일 `perPage = 10`이어야 하나 useEffect 이후에야 갱신됨.
- **해결:** 2026-04-22 / `window.matchMedia` 직접 호출로 실제 뷰포트 기준 `perPage` 산출 / `46ac920d`

### BUG-110 — ✅ 모바일 메뉴 드로어 아이콘·로고 컬러 헤더 불일치 🟡

- **발견:** 2026-04-22 / 모바일
- **실제:** 드로어 로고가 쿨 블랙(`#010101`), 헤더 로고는 웜 블랙(`#1C1B19`). 드로어 카트 아이콘 `opacity:.85` vs 헤더 햄버거 `.7` 불일치.
- **원인:** 드로어 로고를 `<img>` 태그로 로드 → SVG 내 `fill="#010101"` 하드코딩, CSS `color` 무시됨.
- **해결:** 2026-04-22 / 인라인 SVG + `fill:currentColor` 전환, `.mn-cart opacity:.85→.7` / `468041ae`

---

## 결제 플로우 — 추가 리포트 (S67, 2026-04-24)

### BUG-111 — ✅ 결제 페이지 서브타이틀 위 분할선 전수조사·제거 🟡

- **발견:** 2026-04-24
- **재현 경로:**
  1. 결제 2단계 — "연락처" 타이틀 상단 분할선
  2. 결제 최종 단계(토스 UI 직전) — "결제" 타이틀 상단 분할선
  3. 비회원 주문번호 조회 — 상단 분할선
- **기대:** 서브타이틀 위 분할선은 일괄 제거 (통일성)
- **해결:** 2026-04-25 / S78 — `globals.css` `.chp-section`의 `box-shadow: inset 0 1px 0 0 var(--color-border-tertiary)` 제거. `--no-border`·`:first-child` 규칙의 사실상 no-op이던 `border-top: none` 정리. 체크아웃 전 섹션(연락처·배송지·결제수단·비회원 조회·결제) 일괄 적용.

### BUG-112 — ✅ 비회원 결제에서 "로그인하고 주문하기" 클릭 후 비회원 주문 UI 재노출 🟡

- **발견:** 2026-04-24
- **재현 경로:** 비회원 주문 → 결제 1단계 → "로그인하고 주문하기" 클릭 → 로그인 복귀
- **실제:** 복귀한 결제 페이지에 "비회원으로 주문하기" 아웃라인 박스가 여전히 노출됨
- **해결:** 2026-04-26 / S84 — `CheckoutPage` 비회원 UI 조건에 `!isLoggedIn && !sessionLoading` 추가. 커밋 `22868956`.

### BUG-113 — 비회원 주문 비밀번호 헬퍼·에러 메시지 자수 기준 불일치ㅤ✅

- **발견:** 2026-04-24
- **재현 경로:** 비회원 결제 폼 → 비밀번호 인풋 focus / 잘못된 값 blur
- **실제:** 헬퍼 "4자 이상 입력" 안내 → 에러는 "6자 이상" 경고
- **기대:** 동일 기준 (정책 확정 후 양쪽 통일)
- **추정 범위:** `GuestPasswordField` 헬퍼 상수와 Zod schema `.min()` 불일치
- **해결 (S78):** `GUEST_PASSWORD_MIN_LENGTH = 6 → 4` (서버 `GUEST_PIN_MIN = 4` 와 통일). 헬퍼 텍스트·`showPw2` 조건 모두 상수 참조로 교체.

### BUG-114 — 브라우저 자동완성 → 우편번호가 Postcode 검색 없이 미리 채워짐ㅤ✅

- **발견:** 2026-04-24
- **재현 경로:** 결제 폼 자동완성 수락
- **실제:** Daum Postcode 검색 없이 우편번호(zipcode) 필드에 값 주입
- **기대:** 우편번호는 Postcode 검색 결과로만 채워져야 함 (주소 일관성 보장)
- **추정 범위:** `autocomplete="off"` 또는 hidden · read-only · postcode 필드 별도 이름 사용 등
- **해결 (S78):** 우편번호 + 주소 검색 TextField 양쪽에 `autoComplete="off"` 추가. Daum Postcode 검색 외 브라우저 주입 차단.

### BUG-115 — 토스 UI 내 퀵 계좌이체 허용 vs 우리 "계좌이체/무통장입금" 중복 검토 🟢

- **발견:** 2026-04-24
- **재현 경로:** 결제 수단 "체크/신용카드" 탭 선택 → 토스 결제창 → 퀵 계좌이체 옵션 노출
- **실제:** 우리 결제 UI 에 "계좌이체/무통장입금" 탭이 있는데, 토스 UI 자체에서도 퀵 계좌이체 허용
- **기대:** 정책 결정 — 우리 탭과 겹치므로 토스 UI 에서 해당 수단 숨길지, 별도 채널로 유지할지 검토
- **작업 방향:** `payments-flow.md` 참조 후 결제수단 허용 리스트 재정의 (토스 결제창 `easyPay` / `accountTransfer` 옵션 검토)

### BUG-116 — ✅ 희망 납품 주기 드롭다운 순서·명칭 정리 🟢

- **발견:** 2026-04-24
- **해결:** `f24c66c7` — 격주 제거, 월1회↔월2회 순서 교정, 미정(상담 희망) 추가. 최종: 주 1회 → 월 1회 → 월 2회 → 미정. 주 2회는 월 1회와 사실상 동일 범주로 판단해 미포함.

### BUG-117 — ✅ 주문요약 "결제예정금액"·"부가세 포함" 폰트 크기 점검 🟡 — S78 closure

- **발견:** 2026-04-24 / 특히 모바일
- **해결:** 2026-04-25 / S78 — 정책 결정: 썸네일 크기에 맞춰 현행 폰트 크기 유지. 추가 수정 없음.

### BUG-118 — ✅ 결제 페이지 "결제하기" 버튼 하단 밑줄 버튼 5종 가독성 🟡

- **발견:** 2026-04-24 / 모바일 (데스크탑 공통 여부 확인 필요)
- **해결:** 2026-04-25 / S78 — `.chp-legal-link` 텍스트 색 `--color-text-caption` → `--color-text-secondary`, 밑줄 색 `--color-border-primary`(20%) → `--color-border-secondary`(12%). 텍스트가 진해진 만큼 밑줄은 차분하게.

### BUG-119 — ✅ 결제 2단계 주문요약 아이템 스타일 뱃지 제거 + 수량 텍스트 교체 🟢 — S78 closure

- **발견:** 2026-04-24
- **해결:** 2026-04-25 / S78 — 스크린샷 확인 결과 이미 "200g · 3개" 형태 plain text 로 표시 중. 뱃지 스타일 미적용 상태 확인. 추가 수정 없음.

### BUG-120 — ✅ 토스 결제창 상품 이름 (한글+영문) 영문 잘림 🟡

- **발견:** 2026-04-24
- **재현 경로:** 결제 진행 → 토스 결제창
- **실제:** 상품명 중 영문 부분이 잘려서 표시됨
- **해결:** 2026-04-27 (S85) — `CheckoutPage.tsx` `orderName` useMemo 수정. 영문 suffix(`/\s+[A-Za-z][A-Za-z\s]*$/`)를 제거하고 20자 초과 시 `…` 처리. 토스 UI 하드클립(~25자) 전에 미리 자름.

---

## 장바구니 드로어 — 추가 리포트 (S67, 2026-04-24)

### BUG-121 — ✅ 드로어 하단 가격 표시 + CTA 영역이 브라우저 네비바에 가려짐 🟠

- **발견:** 2026-04-24 / 모바일
- **재현 경로:** 모바일 장바구니 드로어 진입
- **실제:** 하단 가격 · CTA 버튼 푸터가 브라우저 네비바에 가려짐
- **해결:** 2026-04-24 / `060b3e70` (Stage E) — `/cart` 를 server component + CartClient island 로 분리한 부수 효과로 드로어 layout 계산 타이밍이 개선되어 해소. 근본 원인은 미확정이나 실측상 재현 안 됨.

### BUG-122 — ✅ 드로어 CTA 버튼이 1:1 비율 아님 🟢

- **발견:** 2026-04-24
- **실제:** 장바구니 드로어 하단 CTA 버튼 2개의 가로 비율 불일치
- **기대:** 1:1
- **근본 원인:** `.cta-btn` 의 `white-space: nowrap` + flex item 기본 `min-width: auto` 조합으로 인해, 텍스트가 긴 버튼의 min-content 가 더 커서 `flex: 1` 에도 불구하고 공간 배분이 불균등.
- **해결:** 2026-04-24 S70 / `b1654c18` — `.cd-cta-secondary`·`.cd-cta-primary` 에 `min-width: 0` 추가 → flex 배분이 min-content 무시하고 1:1 수렴.

### BUG-123 — ✅ 모바일 드로어 하단 결제금액 푸터 좌우 패딩 본체와 다름 🟡

- **발견:** 2026-04-24 / 모바일
- **실제:** 장바구니 드로어 본체와 하단 푸터(결제금액 + CTA) 좌우 패딩이 불일치
- **기대:** 동일 좌우 간격 (CTA 버튼 포함)
- **근본 원인:** 모바일 media query (≤767px) 에서 `.cd-items` 는 `padding: 0 20px` 로 조정되었으나, 푸터 절대좌표 요소들 (`.cd-subtotal-label`·`.cd-subtotal-price`·`.cd-note`·`.cd-cta-row`) 의 `left/right` 는 기본값 28px 잔존.
- **해결:** 2026-04-24 S70 / `977e68b9` — 모바일 media query 에서 푸터 요소들 `left: 20px; right: 20px` 오버라이드. `--drawer-padding-x` 토큰 기반 완전 통일은 별도 리팩토링 세션으로 이월.

---

## 네비·드로어 — 추가 리포트 (S67, 2026-04-24)

### BUG-124 — 로그인 직후 메인 진입 시 어나운스바 사라진 상태 → **BUG-006 DB-01 로 병합** 🟡

- **발견:** 2026-04-24
- **재현 경로:** 로그인 성공 → 메인 페이지 복귀
- **실제:** 어나운스바가 viewport 위로 올라가 있는 상태
- **병합 사유:** BUG-006 의 DB-01 (route 전환 시 sticky/fixed skip 으로 인한 `ann-bar-height` 오프셋) 과 동일 증상으로 확정. post-auth redirect 경로는 DB-01 케이스의 추가 발생 경로로 기록.
- **추적 위치:** `memory/project_bug006_deferred_bugs.md` § DB-01
- **현재 상태:** 1차 수정 완료 (S66 `e37a6555` `scroll-padding-top`) — 재발 모니터링 중. 재발 시 DB-01 섹션에 경로 추가 후 2차 수정 검토.

### BUG-125 — ✅ 마이페이지 드롭다운 outside 터치 시 하단 아코디언 동작 🟡

- **발견:** 2026-04-24
- **재현 경로:** 마이페이지 드롭다운 오픈 → 드롭다운을 닫으려고 다른 영역 터치
- **실제:** 드롭다운이 닫히면서 터치한 위치의 아코디언이 함께 열림/닫힘
- **기대:** outside tap 은 드롭다운 닫기만 수행, 하단 터치 소비 차단
- **원인:** `document.mousedown` 리스너로 닫았으나 후속 `click` 이벤트가 아코디언까지 전파.
- **해결 (S85):** `mousedown` → capture-phase `click` + `e.stopPropagation()` 으로 교체. BUG-158과 동일 패턴.

### BUG-126 — ✅ 로그인 상태 메뉴 드로어에 로그아웃 버튼 추가 🟡 — 이전 세션 closure

- **발견:** 2026-04-24
- **해결:** 이전 버그 픽스 세션에서 `MobileNavDrawer` 로그아웃 버튼 추가 완료. 확인 2026-04-25 / S78.

---

## 디자인 시스템 — 추가 리포트 (S67, 2026-04-24)

### BUG-127 — ✅ CTA Secondary 호버 밑줄 위치가 아웃라인에 안 붙음 🟢

- **발견:** 2026-04-24
- **실제:** Secondary 버튼 호버 시 밑줄 2px 라인이 1px 위로 올라감
- **기대:** 아웃라인이 있는 버튼이므로 시각적으로 아웃라인에 붙어야 Primary 와 동일해 보임
- **근본 원인:** 모든 CTA 변종의 `::after` 가 `bottom: 1px` 공통값 → outline 변종에선 outline (1px 두께) 위로 1px 떠보임. Primary (filled) 는 background 연속이라 문제 없음.
- **해결:** 2026-04-24 S70 / `c0d891e9` — outline 변종 (`.cta-btn-dark-outline`·`.cta-btn-light-outline`·`.mp-cancel-btn`·`.mp-modal-cancel`·`.st-map-overlay-btn`) 한정 `bottom: 0` 오버라이드 → padding-box 하단에서 outline 과 시각적 연결.

---

## 추가 리포트 (S72, 2026-04-24)

### BUG-131 — ✅ 메인 페이지 화살표 stroke 1.5px 로 두껍게

- **발견:** 2026-04-24 / S72
- **해결:** 2026-04-24 / S73 / `1d6c8d97`
- **수정:** TwoColSection `.tci-arrow` ×2 + CafeMenuSection `.cat-arrow` ×1 의 `strokeWidth="1"` → `"1.5"`. viewBox 48 / 렌더 48px 이라 시각 1.5px 정확 일치.

### BUG-132 — ✅ 검색 패널 왼쪽 1px 빈 영역

- **발견:** 2026-04-24 / S72
- **해결:** 2026-04-24 / S73 / `1d6c8d97`
- **근본 원인:** BUG-103 iOS 고DPR hairline 전수 적용 (`253ea44e`, S-?) 에서 `#site-hdr-wrap` 에 `box-shadow: inset ±1px 0 0 0 rgba(255,255,255,.4)` 좌우 hairline 추가. 헤더가 다크 테마일 때 좌우 1px 흰색 반투명 overlay 가 "왼쪽 1px 빈 영역" 으로 노출.
- **수정:** 해당 box-shadow 줄 삭제. 헤더 좌우는 viewport 가장자리와 인접하여 hairline 불필요 · 상/하 구분선은 별도 유지.

### BUG-133 — ✅ 장바구니 드로어 브라우저 back 버튼 처리 누락

- **발견:** 2026-04-24 / S72
- **해결:** 2026-04-24 / S74 / `691860e3`
- **수정:** `CartDrawerContext` 에 `open/close/closeForNavigation` 3콜백 + `pushState({ gtrCartDrawer: true })` marker + `popstate` listener 추가. `close` 는 marker 있으면 `history.back()`, 없으면 `setIsOpen(false)`. `closeForNavigation` (router.push 동반) 은 history 조작 없이 state 만 false. `MobileNavDrawer.handleCartClick` 은 nav marker 를 `replaceState(null)` 로 조용히 제거 후 cart open (race 회피).

### BUG-128 — ✅ drawer aria-hidden + focus 접근성

- **발견:** 2026-04-24 / S72 (가칭)
- **해결:** 2026-04-24 / S74 / `691860e3`·`920165cb`
- **증상:** drawer close 시 focus 가 drawer 내부 요소에 남을 수 있음 + CartDrawer panel 에 aria-modal 누락.
- **수정:** `useDrawer` 훅에 `restoreFocus?: boolean` (default true) 옵션 + open 시점 activeElement (interactive 요소 한정 — BUTTON/A/INPUT/SELECT/TEXTAREA/[tabindex]) 저장 → cleanup 에서 `.focus()` 복원. body/기타 비-interactive 요소면 skip (Tab 시퀀스 자연 유지). CartDrawer panel 에 `aria-modal="true"` 추가.

### BUG-134 — ✅ menu / shop / gooddays 타이틀 이하 콘텐츠 30px 위로 (모바일 전용) — S75 closure (`47ecab23`)

- **발견:** 2026-04-24 / S72
- **해결:** 2026-04-25 / S75 / `47ecab23`
- **재현 경로:** 모바일 (iPhone 16 Pro 393px 기준) · /menu · /shop · /gooddays 진입
- **의도 명확화 (S75):** title-area margin-bottom 축소가 아닌, **body 전체의 padding-top 축소** — 타이틀+서브타이틀+필터+아이템 모두 30px 위로 이동
- **수정:** `@media (max-width: 767px) { #sp-body, #cm-body, #gd-inner { padding-top: 70px } }` (데스크탑 100px 유지)
- **QA:** 사용자 preview 배포 모바일 검증 통과 (2026-04-25)

### BUG-135 — ✅ 굿데이즈 라이트박스 X 버튼 위치 우상단 재배치

- **발견:** 2026-04-24 / S72
- **해결:** 2026-04-24 / S73 / `1d6c8d97` · 모바일 추가 조정 S74 / `3ffd0faf`
- **수정:** `.gd-lb-close` 의 `top: 24px; right: 24px;` → `top: 32px; right: 32px;` (globals.css L6063-6064). 모바일(`max-width: 767px`) 에서는 `top: 12px; right: 12px;` 오버라이드 (S74 추가).

### BUG-136 — 어나운스 바 사라짐 (`scroll-padding-top` 모니터링) 🟡

- **발견:** 2026-04-24 / S66 · S67 (BUG-006 DB-01 승격)
- **재현 경로:** 페이지 간 네비게이션 후 간헐 · 특히 로그인 직후 메인 진입 (BUG-124 병합)
- **실제:** viewport scrollTop 이 `--ann-bar-height` (≈36px) 만큼 오프셋되어 어나운스 바가 viewport 위로 올라감
- **근본 원인:** Next.js 16 Link 의 `scrollIntoView` 가 sticky/fixed 요소 skip → main scroll target 에 걸림 → header-bottom 기준 정렬 (공식 문서 근거)
- **1차 수정 (S66 `e37a6555`):** `html { scroll-padding-top: calc(var(--ann-bar-height) + var(--header-height)) }`. 모니터링 중 — 재발 시 post-auth redirect 경로 분석 필요
- **상세:** `memory/project_bug006_deferred_bugs.md` DB-01 (원본 기록 유지)

### BUG-137 — Hero video 간헐 정지 🟡

- **발견:** 2026-04-24 / S66 (BUG-006 DB-02 승격)
- **재현 경로:** 홈으로 복귀 시 `<video>` 가 멈춘 상태로 잔존 (재현 스텝 불명)
- **가설:** `play()` Promise rejection 후 재시도 없음 · HTML5 video play/pause race · iOS Safari 페이지 복귀 시 inline video unload
- **코드 위치:** `src/components/home/HeroSection.tsx`
- **진행 원칙:** 재현 조건 확보 우선 (North Star #1 "측정 없는 재설계 금지")
- **상세:** `memory/project_bug006_deferred_bugs.md` DB-02

### BUG-138 — ✅ 검색 패널 outside tap close + iOS background scroll 관통

- **발견:** 2026-04-24 / S66 (BUG-006 DB-03 승격)
- **해결:** 2026-04-24 / S74 / `a58db3e2` (1단계) · `07551bf5` (2단계)
- **증상:** iOS Safari 에서 검색 패널 열린 상태에서 배경 scroll 관통 + 인풋 외 영역 탭 시 close 안 됨
- **수정 (1단계):** SiteHeader 검색을 `useDrawer({ open: isSearchOpen, onClose: closeSearch, restoreFocus: false })` 로 통일 · scrollbar-gutter + paddingRight 조합 + ESC/cleanup 중복 제거. `restoreFocus=false` 는 openSearch 가 input 에 동기 focus 이동하는 iOS 가상 키보드 요건과 충돌 방지.
- **수정 (2단계):** `#search-dim` 에 `touch-action: none` + `--dim-top` 을 `headerBottom + SEARCH_PANEL_HEIGHT` → `headerBottom` 으로 변경. 딤이 헤더 아래 viewport 전체 덮음 · 검색 패널 z-index(--z-modal=300) > 딤(40) 이라 패널 위 유지. outside tap close 부가 해결.
- **상세:** `memory/project_bug006_deferred_bugs.md` DB-03

### BUG-139 — ✅ 공통 `.page-title` / `.page-subtitle` / `.page-title-area` / `.page-filter-wrap` 리팩토링 — S75/S76 closure (`49885c4a` · D-025)

- **발견:** 2026-04-24 / S69 (BUG-006 DB-08 승격)
- **해결 (1차):** 2026-04-25 / S75 / `49885c4a` (Shop/Menu/GoodDays)
- **closure (2차):** 2026-04-25 / S76 / D-025 (외부 3페이지 공통화 포기 — prefix 격리 유지)
- **배경:** /shop · /menu · /gooddays 3 페이지에 동일한 font/color/opacity/transform 속성이 ID selector 별로 중복 선언. 현재 값은 통일됐으나 구조적 드리프트 리스크 상시.
- **1차 수정 (3페이지):**
  - `globals.css` 에 공통 `.page-title-area` / `.page-title` / `.page-subtitle` / `.page-filter-wrap` 4 클래스 신설 (line-height: `var(--lh-tight)`)
  - Shop/Menu/GoodDays ID selector 에서 font/color/margin/opacity/transform 중복 제거 → 애니메이션 keyframes 만 잔존
  - `#cm-title-area` 의 flex column 제거 → block 통일
  - GoodDaysPage JSX 에 `<div className="page-title-area">` wrapper 추가 → `#gd-page .page-subtitle { margin-bottom: 48px }` override 제거 (wrapper 의 48px 통합)
  - `+58 / -110` 라인 · 6 files
- **2차 결정 (D-025 · 옵션 A 채택):** Login/MyPage/BizInquiry 는 `lp-*` / `mp-*` / `#bi-*` prefix 격리 유지. 스타일 차이 (letter-spacing `--ls-heading` vs `--ls-display` · line-height 1.3 vs 1.2 · Login H2 · MyPage 모바일 H2 다운 · entry animation 유무) 는 drift 가 아닌 **페이지 성격 차이** (폼 UI vs 콘텐츠 갤러리). subtitle/wrapper 구조도 완전 이질적 (switch-wrap · welcome-wrap · page-desc+note) → title 만 공통화 효과 제한적. CLAUDE.md "파일 격리 원칙" 부합. `globals.css` 공통 클래스 주석에 "Shop/Menu/GoodDays 전용" 명시.
- **상세:** `memory/project_bug006_deferred_bugs.md` DB-08 · `memory/project_bug139_phase2_plan.md` · `memory/project_bug006_decisions_log.md` D-025

## 추가 리포트 (S76, 2026-04-25)

### BUG-140 — ✅ 햄버거 메뉴 드로어 로그인 토글 → "로그아웃 · 마이페이지" 분리

- **발견:** 2026-04-25 / S76
- **현재:** 모바일 햄버거 드로어에서 단일 슬롯 토글. 비로그인 시 "로그인", 로그인 후 같은 슬롯이 "로그아웃" 으로 전환.
- **제안:** 로그인 상태에서 **"로그아웃 · 마이페이지"** 두 링크를 별도로 노출, 각각 분리된 액션 연결.
- **근거:** 단일 슬롯 토글은 로그인 후 마이페이지 진입에 별도 경로 필요. 분리 시 1탭으로 양쪽 모두 접근 가능 + 로그인 상태 인지가 명확.
- **고려:** 시각 노이즈 미미 / 가독성 우려는 구분자 (`·` 또는 두 행 분리) 디자인으로 해결 가능.
- **관련:** BUG-126 (로그인 상태 메뉴 드로어 로그아웃 버튼 추가) 의 구체화 안으로 통합 검토 필요. BUG-126 → BUG-140 으로 흡수 또는 묶음 처리 후보.
- **묶음:** BUG-147 (옵션 NEW · 풀 헤더 복원) 과 S77 묶음 E 동시 처리. 풀 헤더 복원 후 로그인 페이지에서도 햄버거 → "로그아웃 · 마이페이지" 분리 활용 가능 → 시너지.
- **추정 범위:** `MobileNavDrawer` `isLoggedIn` 분기에서 단일 토글 → 두 슬롯 분리 · 라우팅 분기.
- **상세 디자인:** `memory/project_bug140_147_design.md`
- **closure (S77 · 2026-04-25):** MobileNavDrawer 3그룹 구조 구현 — 그룹1: 로그인 후 welcome 카드 (OOO님, 환영합니다. 16px) + 마이페이지|로그아웃 인라인 행 (골드 세로선 구분자, 화살표 width 0→24px 펼쳐짐), 로그인 전 로그인 링크. 그룹2: NAV 4개. 그룹3: Wholesale. 그룹간 32px 분리. master `bf400691`.

### BUG-147 — ✅ 로그인 페이지 4종 풀 헤더 복원 (옵션 NEW · escape route)

- **발견:** 2026-04-25 / S76
- **배경:** 데스크탑에서 폼 입력 중 페이지 이탈 방지 의도로 로그인 페이지 4 모드 (login · register · reset · guest-lookup) 헤더에 로고만 노출. 모바일은 부작용으로 escape route 부재 → "갇힘" 체감.
- **결정 (옵션 NEW · 2026-04-25 S76):** 데스크탑·모바일 모두 **풀 헤더 복원**. 별도 X 닫기 불필요 — 헤더 로고/네비/햄버거로 어디든 escape 가능.
- **근거 (Specialty coffee 5/5 사이트 리서치):** La Cabra · Allpress · Stumptown · Intelligentsia · Onyx Coffee Lab — **모두 풀 헤더 노출**. 카테고리 (브라우징 중심 + guest checkout 가능 + login 선택적) 가 일반 SaaS 와 다름.
- **이전 옵션 (S76 1차 권장 · 폐기):**
  - 옵션 D: 모바일 한정 좌상단 X 닫기 버튼 + dirty state 확인 모달 → specialty coffee 카테고리 표준과 불일치로 폐기
  - 옵션 A (햄버거 추가) · 옵션 B/C (X+햄버거 혼합) → 옵션 NEW 가 더 단순하고 카테고리 부합
- **적용 대상:**
  1. `/login` mode='login' (로그인)
  2. `/login` mode='register' (회원가입)
  3. `/login` mode='reset' (비밀번호 재설정)
  4. `/login` mode='guest-lookup' (비회원 주문 조회)
- **제외:** `/biz-inquiry` (이미 풀 헤더) · `/mypage` (별도 검토 시 추가)
- **묶음:** BUG-140 과 S77 묶음 E 동시 처리. 풀 헤더 복원 후 햄버거 → "로그아웃 · 마이페이지" 분리가 자연스럽게 활용됨.
- **롤백 경로:** `feature/bug-140-147-full-header` 브랜치 보존. 사용자 테스트 후 이탈률 ↑ 관찰 시 옵션 D (모바일 X 닫기 + 헤더 hide 복원) 로 회귀 가능. 상세: `memory/project_bug140_147_design.md`
- **closure (S77 · 2026-04-25):** `/login` → `src/app/(main)/login/` (git mv, (main) 라우트 그룹 편입). `login/layout.tsx` 삭제. `LoginPage.tsx` 미니헤더 JSX 제거. `headerThemeConfig` `/login → 'light'` 이미 등록되어 자동 복원. master `bf400691`.

### BUG-141 — ✅ 비즈니스 인콰이어리 "관심 제품" 모두 선택 시 페이지 좌우 가로 스크롤 🟠

- **발견:** 2026-04-25 / S76
- **재현 경로:** /biz-inquiry → "관심 제품" 체크박스 모두 선택 → 선택된 라벨 합산 폭이 인풋 필드를 초과하면서 페이지 가로 스크롤 발생
- **실제:** 관심 제품 인풋필드가 자체 폭을 넘어 가로 확장 → 같은 행/폼 내 다른 인풋필드까지 같이 끌려가서 오버플로우. 페이지가 좌우 스크롤됨.
- **해결:** 2026-04-25 / S78 — `.bi-dropdown-value`에 `min-width: 0` 추가. flex item의 기본 `min-width: auto`가 content 크기 고정으로 `overflow: hidden`이 작동하지 않던 것이 원인. ellipsis 처리로 필드 폭 내에서 텍스트 잘림.

### BUG-142 — 라벨 eyebrow 애니메이션 스크롤 위치 반응 (중앙 진입/이탈 역재생) 🟢

- **발견:** 2026-04-25 / S76
- **현재:** eyebrow 라벨 (예: 섹션 상단 "01 — Story" 등) 등장 애니메이션이 1회 진입 시점 기준으로만 재생. 스크롤로 화면 중앙에서 멀어진 후 다시 돌아와도 정적 상태 유지.
- **기대:** 라벨이 **화면 중앙 근처에 진입하면 재생 · 중앙에서 멀어지면 역재생** (양방향). 스크롤 위치를 progress 로 환산하여 애니메이션 timeline 연동.
- **추정 범위:** `IntersectionObserver` threshold 다단 + `scroll-timeline` (CSS) 또는 IO progress → CSS variable bind. 모바일 성능 고려 (rAF throttle).
- **참조:** Phase 2 "Scroll Variable Font" 트랙 (`project_design_interaction_plan.md`) 과 묶음 후보.

### BUG-143 — ✅ 모바일 버튼 탭 시 호버 연출 재생 후 액션 실행 (UX 호흡) 🟡 — S81 closure

- **발견:** 2026-04-25 / S76
- **해결:** 2026-04-26 / S81
- **구현:** `[data-gtr-tap]` opt-in 어트리뷰트 + `TouchHoverGuard.tsx` capture-phase 전역 위임 핸들러. 탭 시 `.is-tapping` 클래스 추가 → CSS `[data-gtr-tap].is-tapping::after { transform: scaleX(1); transition: none }` 즉시 snap → `--duration-tap` (350ms) 후 클래스 제거 + `target.click()` 재발화 (WeakSet bypass). 데스크탑 `:hover` 연출 그대로 유지.
- **타이밍 토큰:** `--duration-tap: 350ms` 단일 소스 (JS·CSS 동기). Chrome 정규화로 `.35s` 로 노출되므로 TouchHoverGuard 가 `s` / `ms` 양쪽 파싱.
- **핵심 디버깅 (디버그 길었던 이유):**
  - **NavigationVisibilityGate (BUG-007/H8 prev-DOM 잔상 차단) 와 capture-phase click 핸들러 충돌**. 동일 `document` 노드에 등록된 두 capture listener 가 함께 발화 → NavVisGate 가 `<main>` 에 `data-transitioning="true"` 부여 → CSS `visibility: hidden` 으로 페이지 본문 통째 가림 → 350ms 동안 골드 라인 보이지 않음. 사용자 체감: "탭 직후 웜화이트 배경만 덮이고 라인 안 보임".
  - **수정:** `e.stopPropagation()` → `e.stopImmediatePropagation()`. 탭 딜레이 도중 NavVisGate 발화 차단. 재발화된 click(bypassed)은 early return 으로 통과 → NavVisGate 정상 실행 → 잔상 차단 본래 의도대로 navigation 시점에만 적용.
- **적용 범위:** `season-cta` · `roastery-cta-btn` · `cta-btn-*` 전체 + `lp-submit-btn` · `lp-guest-buy-btn` · `chp-submit-btn` · `chp-login-primary-btn` · `chp-empty-cta` · `ocp-btn-primary` · `cp-order-btn` · `bi-submit-btn` · `pd-cart-btn` · `mp-save-btn` · `mp-cancel-btn` · `mp-modal-confirm` · `mp-modal-cancel` · `st-map-overlay-btn[--primary]` · `tci` · `cat-card`. JSX 에 `data-gtr-tap` 추가만 하면 자동 적용.

### BUG-144 — ✅ 모바일 버튼 드래그 시 호버 애니메이션 발화 차단 🟡 — S76 closure

- **발견:** 2026-04-25 / S76
- **해결:** 2026-04-25 / S76
- **현재:** 모바일에서 페이지 스크롤을 위해 손가락이 버튼 위를 지나가면 호버 애니메이션이 잠깐 재생됨 → 의도하지 않은 활성화 피드백.
- **기대:** **드래그/스크롤 제스처 도중에는 호버 애니메이션 차단**. 명확한 탭만 호버 발화.
- **수정:** `globals.css` 에 `@media (hover: none)` 블록 추가 — 모든 CTA 변종 (`cta-btn-*` · `lp-*` · `chp-*` · `ocp-*` · `cp-*` · `bi-*` · `mp-*` · `pd-cart-btn` · `st-map-overlay-btn` · `season-cta` · `roastery-cta-btn`) 의 `:hover::after` gold rule 을 touch 디바이스에서 `transform: scaleX(0)` 으로 강제 → tap 시에도 발화하지 않음. 데스크탑 hover 동작은 유지.
- **잔여 (BUG-143):** ✅ S81 에서 closure (`data-gtr-tap` opt-in + `TouchHoverGuard.tsx` 전역 위임).

### BUG-145 — ✅ 카카오맵 마커 팝업 "카카오맵 상세" → "상세보기" 명칭 변경 🟢 — S76 closure

- **발견:** 2026-04-25 / S76
- **해결:** 2026-04-25 / S76
- **수정:** `KakaoMap.tsx` L147 `detailLink.textContent` 교체 + 파일 헤더 주석 (L9, L99) 명칭 정리.

### BUG-146 — ✅ 카카오맵 마커 크기 확대 🟢 — S76 closure

- **발견:** 2026-04-25 / S76
- **해결:** 2026-04-25 / S76
- **수정:** `KakaoMap.tsx` `MarkerImage` Size 28×36 → **40×52** (1.42×) · offset Point(14, 36) → (20, 52) 비례 갱신. 바닥 중앙 앵커 유지. 시인성 향상 + 모바일 가독성 보강.

### BUG-148 — ✅ 상품 상세 페이지 푸터부터 렌더링되는 현상 (회귀) 🟠 — S82 closure

- **발견:** 2026-04-25
- **해결:** 2026-04-26 / S82
- **재현 경로:** 상품 상세 페이지 (`/shop/[slug]`) 진입
- **기대:** 페이지 콘텐츠가 상단부터 순차 렌더링
- **실제:** 푸터 영역이 먼저 노출된 뒤 본문이 채워짐.
- **근본 원인:** `.root { min-height: 100dvh }` (not `height`) + `<main style={{ flex:1 }}>` 조합에서 iOS Safari 는 부모에 `height` 없을 때 `flex-grow:1` 을 무시함 → main 높이 0 → footer 상단 노출.
- **수정:** `globals.css` 에 `#main-content { min-height: calc(100svh - var(--ann-bar-height) - var(--header-height)) }` 추가 (`dvh` → `svh` — iOS Safari 스크롤 중 dvh 재계산으로 인한 레이아웃 점프 방지). 외부 layout(`/checkout`, `/mypage` 등) 은 `#main-content` 없어 무영향.

### BUG-149 — ✅ 장바구니 드로어 → 풀페이지 전환 시 상품 상세 페이지 잠깐 노출 🟡 — S82 closure

- **발견:** 2026-04-25
- **해결:** 2026-04-26 / S82
- **재현 경로:** 상품 상세 페이지에서 장바구니 드로어 열기 → 드로어 내 "장바구니 보기" 클릭 → `/cart` 이동
- **기대:** 드로어 닫힘 → 장바구니 풀페이지로 부드럽게 전환
- **실제:** `/cart` 로 이동하는 순간 상품 상세 페이지 콘텐츠가 짧게 노출됨
- **근본 원인:** 드로어가 `router.push` 직후 닫히면 새 페이지 로드 전 하단 페이지가 노출됨.
- **수정 (S83 최종):**
  - `useNavigation` 훅 신규 (`hooks/useNavigation.ts`) — `router.push` 래퍼, `navigatingTo: string|null` 상태, 10s 타임아웃 시 에러 토스트.
  - `CartDrawer` `drawerPendingRef` + `useEffect([pathname])` 조합 — 새 페이지 렌더 완료(pathname 변경) 시 `closeWithoutAnimation(closeForNavigation)` 호출.
  - `closeWithoutAnimation` 헬퍼 — `transition:none` → close → rAF×2 후 복원 (슬라이드 아웃 전면 제거).
  - 버튼 피드백: 클릭한 버튼만 `disabled` + "이동 중..." 텍스트, 나머지 버튼 원문 유지. opacity dim 없음.

### BUG-150 — ✅ 장바구니 드로어 → 풀페이지 전환 시 로딩 지연 🟠 — S82 closure

- **발견:** 2026-04-25
- **해결:** 2026-04-26 / S82
- **재현 경로:** 장바구니 드로어 → "장바구니 보기" 클릭 → `/cart` 로드
- **기대:** 빠른 페이지 전환
- **실제:** `/cart` 진입 후 로딩이 체감상 오래 걸림
- **근본 원인:** `useCartQuery` 는 `staleTime: 30_000` 으로 캐시 히트이나, `.cp-root` 진입 애니메이션이 `var(--duration-slide): 700ms` 로 너무 길어 체감 지연 발생.
- **수정:** `globals.css` `.cp-root` transition duration 을 `var(--duration-slide)` (700ms) → `var(--duration-drawer)` (350ms) 로 단축.

### BUG-151 — 비회원 결제 진입 시 비밀번호 필드 자동완성 선채움ㅤ✅

- **발견:** 2026-04-25 / S78
- **재현 경로:** 비회원으로 결제 페이지(`/checkout`) 진입 → 비밀번호·비밀번호 확인 필드에 값이 이미 입력된 상태
- **실제:** 사용자가 아무것도 입력하지 않았는데 필드에 값이 채워져 있음
- **기대:** 결제 페이지 최초 진입 시 빈 필드
- **추정 범위:** 브라우저 autofill — `autocomplete` 속성 미설정 또는 부적절한 값(예: `"current-password"`) 으로 인해 저장된 자격증명이 주입. `CheckoutPage.tsx` `guestPw` / `guestPw2` TextField에 `autoComplete="new-password"` (또는 `"off"`) 추가 필요. BUG-114 브라우저 자동완성 계열 이슈.
- **해결 (S78):** `guestPw` · `guestPw2` TextField 에 `autoComplete="new-password"` 추가. 브라우저가 저장된 자격증명을 주입하지 않도록 힌트 제공.

### BUG-154 — 빠른 추가 버튼 활성화 시 배경 탭이 아래 상품을 관통 🟡 ✅

- **발견:** 2026-04-25 / S78
- **재현 경로:** 상품 카드 빠른 추가 버튼 활성화 → 버튼 외 배경 영역 탭
- **실제:** 배경 탭이 먼저 빠른 추가를 닫지 않고 아래 상품 카드 클릭 이벤트까지 전파됨
- **기대:** 배경 탭 시 빠른 추가 닫힘 동작만 실행 (이벤트 전파 차단)
- **추정 범위:** 빠른 추가 오버레이에 `pointer-events` 또는 outside-click 핸들러 누락. 오버레이 레이어가 없거나 `stopPropagation` / `preventDefault` 미처리.
- **해결 (S80):** `ShopCard.tsx` outside-click 핸들러를 버블 페이즈 → capture 페이즈(`true`)로 전환. 다른 카드 `.sp-qa-bar` 클릭은 예외 처리(pass through). BUG-158과 동일 capture 패턴 적용.

### BUG-155 — `/checkout` 직접 진입 시 빈 장바구니 문구 스타일 미통일 🟡 ✅

- **발견:** 2026-04-25 / S78
- **재현 경로:** 장바구니 비운 상태에서 도메인 + `/checkout` URL 직접 입력 진입
- **실제:** "장바구니가 비어 있습니다." 텍스트만 표시 — 장바구니 드로어의 빈 상태 UI(아이콘 + 문구 + 밑줄 버튼)와 스타일 불일치
- **기대:** 드로어 빈 상태와 동일한 구성 — 아이콘 + 문구 + "쇼핑 계속하기" 밑줄 버튼
- **추정 범위:** `CheckoutPage` 빈 장바구니 분기 렌더 — `CartDrawer` 의 empty state UI 컴포넌트 또는 동일 마크업 재사용 필요.
- **해결 (S80):** `CheckoutPage.tsx` 빈 상태 렌더를 `cd-empty` 패턴 동일 구조(아이콘+문구+CTA)로 교체. `chp-empty` / `chp-empty-icon` / `chp-empty-msg` / `chp-empty-cta` 전용 CSS 작성. CTA는 `cta-btn` 시스템 의존 대신 독립 스타일(height 48px · padding `--cta-btn-padding-x` · gold 밑줄 호버 연출) 직접 구현. `@media (hover: none)` 블록에 hover::after 차단 추가.

### BUG-158 — 비즈니스 폼 드롭다운 열린 상태에서 외부 버튼 클릭 관통 🟡 ✅

- **발견:** 2026-04-25 / S79
- **재현 경로:** 비즈니스 문의 폼 → 드롭다운 열기 → 드롭다운 외부 버튼 클릭
- **실제:** 드롭다운이 닫히면서 외부 버튼 클릭 이벤트도 동시에 발화 (관통)
- **기대:** 외부 클릭 시 드롭다운 닫힘만 발생, 버튼 이벤트는 소비
- **원인:** `document.mousedown` 리스너로 드롭다운을 닫았으나 이후 `click` 이벤트는 그대로 전파
- **해결 (S79):** `document.mousedown` 리스너 제거 → 드롭다운 open 시 `bi-dropdown-backdrop`(fixed 투명 레이어, z-index `--z-float - 1`) 렌더. backdrop `mousedown`에 `preventDefault()` 호출로 후속 click 소비.

### BUG-157 — 모바일 드로어 장바구니 버튼 뱃지 크기·폰트가 헤더 뱃지와 불일치 🟡 ✅

- **발견:** 2026-04-25 / S79
- **재현 경로:** 모바일 → 장바구니 아이템 추가 → 햄버거 메뉴 드로어 열기 → 장바구니 버튼 뱃지 확인
- **실제:** 드로어 내 장바구니 뱃지(`mn-cart .cart-badge`) — 16×16px, font-size 10px, weight 500
- **기대:** 헤더 공통 뱃지(`cart-badge`)와 동일 — 20×20px, font-size `var(--type-caption-size)`, weight 600
- **원인:** `globals.css` `.mn-cart .cart-badge` 셀렉터가 공통 `.cart-badge` 스타일을 다른 수치로 오버라이드
- **해결 (S80):** `.mn-cart .cart-badge` 오버라이드에서 크기·폰트·레이아웃 속성 제거 → 공통 `.cart-badge` (20px / caption-size / 600) 상속. 드로어 전용 위치(`top:6px right:6px`)·색상만 유지. `2f60b682`

### BUG-156 — 명시적 로그인 없이 장바구니 드로어 열면 자동 로그인 + 이전 카트 복원 🟡 ✅

- **발견:** 2026-04-25 / S79
- **재현 경로:** 이전 세션에서 로그아웃 없이 브라우저 종료 → 재방문 → 장바구니 드로어 열기
- **실제:** 로그인 플로우 없이 이전 계정으로 자동 로그인되면서 DB 카트 아이템이 드로어에 나타남
- **기대:** 재방문 시 "로그인됨" 상태가 헤더에 올바르게 반영되어야 함. 또는 세션이 만료·로그아웃된 경우 게스트 카트를 표시.
- **근본 원인 (2레이어):**
  - **1차 — Supabase 설계:** `createBrowserClient(@supabase/ssr)` 는 세션을 쿠키에 영속 저장. 명시적 `signOut()` 없이 브라우저를 닫으면 다음 방문 시 `INITIAL_SESSION` 이벤트로 세션 자동 복원 → `AuthSyncProvider` 가 서버 카트 fetch 트리거.
  - **2차 — 헤더 `isLoading` 미처리:** `SiteHeader` 가 `isLoggedIn`만 읽고 `isLoading` 을 무시. `INITIAL_SESSION` 발화 전 `isLoading: true` 구간에서 `isLoggedIn = false` → 헤더가 "비로그인" 아이콘 표시 → 사용자가 비로그인 상태라고 착각하는 UX 플리커 발생.
- **픽스 방향:**
  - `SiteHeader` 에 `isLoading` 구간 동안 로그인/비로그인 아이콘 전환 보류 (스켈레톤 또는 중립 상태)
  - `isLoading → false` 전환 시점에 헤더 아이콘 확정 — 사용자가 자신의 로그인 상태를 명확히 인지
  - (선택) 세션 자동 복원 시 "다시 오셨군요" 토스트 피드백
- **추정 범위:** `SiteHeader.tsx` `isLoggedIn` 참조 구간 (`mounted && isLoggedIn`) + `useSupabaseSession` `isLoading` 반환값 활용
- **해결 (S80):** `useSupabaseSession`에서 `isLoading`(`sessionLoading`)도 구조분해. 유저 아이콘 Link에 `visibility: mounted && sessionLoading ? 'hidden' : 'visible'` 추가 → 세션 확정 전 아이콘 완전 숨김(레이아웃 유지). `href` / `aria-label` / `MobileNavDrawer isLoggedIn` prop도 `!sessionLoading` 조건 추가.

### BUG-159 — 모바일 페이지 전환 로딩 스켈레톤 도입 🟢 ⏸️ 데이터 측정 대기

- **발견:** 2026-04-26 / S81 (BUG-143 closure 후 사용자 인지)
- **현재:** 모바일 탭 → 350ms 골드 라인 흐름 (BUG-143 lane fill) → `target.click()` → NavigationVisibilityGate 가 `<main>` `visibility:hidden` → React 새 트리 commit + paint. Wi-Fi/5G/빠른 4G 환경에선 prefetch 흡수로 자연스럽게 화면 전환되나, 3G/약전계 또는 prefetch 미완료 케이스에서는 라인 도달 후 warm-white (`.root` 배경 + 헤더/푸터만) 빈 화면이 수백ms~수초 보일 가능성.
- **개선안:** `navigator.connection.effectiveType` (`slow-2g` · `2g`) 감지 또는 `<main>` hidden 지속 시간 임계치 초과 시 페이지별 skeleton UI 표시. NavigationVisibilityGate 의 `data-transitioning` 분기 확장 또는 별도 `data-slow-network` 어트리뷰트 신설. 페이지 골격(헤더 영역 외) 의 placeholder 컴포넌트는 페이지 단위로 작성 필요.
- **선제 조건 (트리거):** Vercel Speed Insights INP/LCP 데이터 4~8주 누적 → 실제 모바일 사용자 분포 확인 (3G/약전계 비율 + 평균 빈 화면 시간). 임계치 (예: P75 빈 화면 > 500ms) 초과 시 진행. 데이터 없이 미리 최적화 ❌ (YAGNI).
- **참조:** S81 BUG-143 closure 토론 (`memory/project_session81_complete.md`).

### BUG-160 — ✅ 메인 페이지 진입 시 히어로 동영상 일시정지 + 플레이 버튼 노출 🟠

- **발견:** 2026-04-26 / S84 (iOS 저전력 모드에서만 재현)
- **원인:** iOS 저전력 모드에서 `muted + playsInline + autoPlay` 조합도 차단됨.
- **해결:** 2026-04-26 / S84 — `video.play()` 실패 시 `touchstart`/`click` 첫 감지 후 재시도. 스크롤도 `touchstart` 로 감지되어 사용자가 스크롤만 해도 즉시 재생. 커밋 `699e18aa`.

### BUG-161 — ✅ 로그인 후 /checkout 복귀 시 이메일 미채움 + 폼 미공개 🟠 (회귀)

- **발견:** 2026-04-27 / S85
- **재현 경로:** `/checkout` (비로그인) → "로그인하고 주문하기" → `/login` → 로그인 → `/checkout` 복귀
- **실제 (버그):** 이메일 입력필드 비어있음. 하단 주소·전화·약관 필드 등 보이지 않음. 이메일 필드에 한 글자 입력하면 갑자기 모든 하단 필드가 한꺼번에 나타남.
- **기대:** 로그인 사용자 이메일 자동 채움 + 폼 즉시 공개.
- **회귀 원인:** S85 직전에 BUG-112 보강으로 추가한 pathname-based reset effect 와 기존 Stage D-1 effect 가 login auto-fill effect 와 race 발생.

#### 근본 원인 — Effect declaration order race

`CheckoutPage.tsx` 에 세 개의 effect 가 있음:

1. **login auto-fill effect** (line ~191) — `setField('email', user.email)` + `revealForm()`
2. **Stage D-1 effect** (line ~297) — `userChanged` 시 `resetForm()`
3. **pathname reset effect** (line ~325) — `/login → /checkout` 시 `resetForm()`

React effect 는 같은 render cycle 에서 declaration order 로 실행됨. 사용자가 로그인 후 `/checkout` 복귀 시 세 effect 가 동시 실행:

```
Render: pathname=/checkout, isLoggedIn=true, user 채워짐
↓
1. login auto-fill: setField('email', user.email) + revealForm() schedule
2. D-1: userChanged=true (null→user.id) → resetForm() schedule
3. pathname reset: prev=/login, current=/checkout → resetForm() schedule
↓
React state flush: schedule 순서대로 적용
   → 결과: form.email='', isFormRevealed=false (login 작업 무효화)
```

이메일 필드에 한 글자 입력 시 `form.email` 변경 → login auto-fill effect 재실행 → `isFormRevealed=false` 보고 `revealForm()` 호출 → 하단 필드 노출. 이게 "타이핑 후 갑자기 나타나는" 증상의 원인.

#### 가드 정책

**D-1 effect:**
- 비로그인(null) → 로그인 + **폼 닫힘** (`!isFormRevealed`) → `resetForm()` **생략**
  - login auto-fill 이 채워줌. 폼이 INITIAL 상태이므로 reset 생략 안전.
- 비로그인 → 로그인 + **폼 펼침** (`isFormRevealed=true`) → `resetForm()` **호출**
  - 게스트 입력 데이터·이메일 stale 정리. cacheComponents stale `isFormRevealed` 도 같은 분기에서 정리.
- 로그인 → 로그아웃 / 계정 전환 (둘 다 non-null) → `resetForm()` **호출** (기존 정책 유지)
- cart 분기: 결제 시도 후 (`orderCartSigRef≠null`) cart 변경 → form 도 `resetForm()`. 이전엔 pathname reset 이 항상 발동해 가려졌던 케이스.

**pathname reset effect:**
- `sessionLoading=true` → effect 자체 early return (prev 갱신·판단 모두 보류). 세션 로드되어 `isLoggedIn` 확정 후에만 reset 여부 결정. race 완화.
- `isLoggedIn=true` → reset 생략. 로그인 케이스는 D-1 이 처리.
- 비로그인 + 다른 경로에서 진입 → reset (기존 BUG-112 보호 유지).

#### 시나리오 검증 매트릭스

| # | 시나리오 | D-1 | pathname | 결과 |
|---|---------|-----|---------|------|
| S1 | 로그인 사용자 직접 진입 | loggingIn=true·!isFormRevealed → 생략 | prev=current → 미발동 | login fill ✅ |
| S2 | 비로그인 직접 진입 | userChanged=false | prev=current → 미발동 | 게스트 UI ✅ |
| S3 | 비로그인 다른 페이지 → /checkout | userChanged=false | !isLoggedIn → reset | 폼 리셋 ✅ |
| S4 | /checkout → /login → 복귀 (보고된 버그) | loggingIn=true·!isFormRevealed → 생략 | isLoggedIn=true → 생략 | login fill ✅ |
| S5 | 로그인 사용자 페이지 이탈 후 복귀 | userChanged=false | isLoggedIn=true → 생략 | **폼 상태 유지** (의도된 UX 개선) |
| S6 | 결제 완료 → cart 비움 → 재진입 | cart 분기에서 resetForm 호출 | isLoggedIn=true → 생략 | 폼 리셋 ✅ |
| S7 | 게스트 폼 펼친 상태 → 로그인 → 복귀 | loggingIn=true·isFormRevealed=true → reset | isLoggedIn=true → 생략 | 폼 리셋 + login fill ✅ |
| S8 | 로그아웃 | userChanged=true·loggingIn=false → reset | (보통 다른 경로) | 폼 리셋 ✅ |

#### 의도된 부수 효과

- **S5 (로그인 사용자 폼 상태 유지)**: 이전엔 페이지 이탈 후 복귀 시 폼 리셋. 새 동작은 입력값·공개 상태 유지. 자기 데이터를 다시 입력하지 않아도 되어 UX 개선. cart 변경/orderResult stale 은 D-1 cart 분기가 별도 처리하므로 안전.

#### 잔존 race (실질 영향 없음)

- pathname 변경이 `isLoggedIn` 변경보다 한 render 빠른 경우, 첫 render 에서 pathname reset 이 `resetForm()` 호출 가능.
- 하지만 이 시점의 폼은 INITIAL 상태 (`!isFormRevealed` 가 "로그인하고 주문하기" 버튼 노출 조건이므로). reset 의 실질 영향 없음.
- `sessionLoading` 가드가 대부분 케이스 차단. 잔존 race 는 cosmetic 깜빡임 가능성도 낮음.

- **해결:** 2026-04-27 / S85 — `next/src/components/checkout/CheckoutPage.tsx` D-1 effect + pathname reset effect 가드 추가. inline 주석은 짧게 유지, 상세 race 분석은 본 항목에 보존.

---

### BUG-130 — ✅ 헤더 다크↔라이트 모드 전환 깜빡임

- **발견:** 2026-04-24 / S72 (가칭 등록)
- **해결:** 2026-04-24 / S73 / `263fe57a`
- **증상:** /story ↔ /shop 등 다크↔라이트 전환 시 로고/아이콘 색 반전이 본문 전환보다 먼저 체감 → "헤더만 깜빡" 체감.
- **근본 원인 (§11-H1 측정 · M-006):** SiteHeader 의 useHeaderTheme useLayoutEffect 가 NavigationVisibilityGate 의 useLayoutEffect 보다 React 컴포넌트 트리 순서상 2~15ms 먼저 commit. pathname 변경 즉시 헤더 색이 new theme 으로 전환 · 본문은 여전히 `data-transitioning=true` 로 hidden. 시각 순서 불일치 발생.
- **수정 (Prototype A):** SiteHeader 에 `effectivePath` state 추가. NavigationVisibilityGate 가 이미 dispatch 중인 `gtr:route-change` 이벤트 (S72 DB-06 해결용 자산) 를 수신하여 effectivePath 갱신. 테마 계산이 gate-LE 와 동일 tick 에 commit → 본문-헤더 동시 전환.
- **측정 후 결과:** 순서 역전 성공 (gate-LE → hdr-LE +4.6~5.3ms). 5ms 는 paint frame 내 처리 → 시각적 동시. 사용자 체감 통과.
- **상세:** `memory/project_bug006_decisions_log.md` D-024 · `memory/project_bug006_measurement_log.md` M-006

---

## 해결됨

### BUG-105 — 모바일 Chrome 하단 네비 영역이 히어로와 충돌 ✅

- **해결:** 2026-04-21
- **방법:** `HeroSection` height `100vh` → `100svh` 전환으로 모바일 브라우저 UI 영역 제외. 오버스크롤 배경색 시스템(OverscrollColor + OverscrollTop) 도입으로 상단 흰 배경 노출 문제도 동시 해결.
- **커밋:** `2d4d59f5` (Session 53)

### BUG-108 — 카페 메뉴 바텀시트 터치 이벤트 통과 (배경 스크롤) ✅

- **해결:** 2026-04-21
- **방법:** `overscroll-behavior:contain` + `touch-action:pan-y`(CSS), `#cns-bg` touchmove preventDefault(JS), 모바일 드래그-닫기 80px 스와이프 제스처 추가(JS).
- **커밋:** `4cc1bca2` (Session 53)

### BUG-104 — 카페 메뉴 바텀시트 하단 세이프티 에리어 iOS 잘림 (흰색) ✅

- **해결:** 2026-04-21
- **방법:** `overflow-y:auto` 컨테이너의 `padding-bottom` 배경 미채움 quirk 해소. panel `padding-bottom` 제거 → `.cns-content`에 `calc(32px + env(safe-area-inset-bottom))` 적용.
- **커밋:** `e9d3ed8f` (Session 53)

---

## 리포트 템플릿

```
### BUG-XXX — {한 줄 요약} {🔴|🟠|🟡|🟢}

- **발견:** 2026-MM-DD / {환경: prod / dev / 특정 브라우저}
- **재현 경로:** {URL · 클릭 시퀀스}
- **기대:** {어떻게 되어야 하는가}
- **실제:** {어떻게 되고 있는가}
- **스크린샷/로그:** {있으면 첨부}
- **추정 범위:** {해당하는 경우}
```
