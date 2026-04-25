# GTR BUG & POLISHING

> 프로덕션 배포(`goodthings-roasters.vercel.app`) 이후 발견된 버그·UX·폴리싱 이슈를 누적 기록. 일정 개수 누적 시 일괄 해결 세션 진행.
>
> **최종 업데이트:** 2026-04-25 · Session 76

---

## 진행률

> **20 / 46 closure (43.5%)** · 2026-04-25 S76 기준
>
> 카운트 명령:
> ```bash
> grep -oE "^### BUG-[0-9]+" docs/bug-and-polishing.md | sort -u | wc -l        # total unique
> grep -oE "^### BUG-[0-9]+ — ✅" docs/bug-and-polishing.md | sort -u | wc -l   # closed (inline ✅)
> ```
>
> **세션별 closure 누적:**
> - S53 (legacy `해결됨` 섹션 · BUG-104/105/108) · S70 (BUG-127) · S71 (BUG-109/110) · S72 (BUG-128) · S73 (BUG-130/131/132/135) · S74 (BUG-121/122/123/133/138) · S75 (BUG-134/139) · S76 (BUG-144/145/146)
>
> **데이터 정합 노트:**
> - BUG-105 는 하단 `해결됨` 섹션에만 ✅ · 열린 버그 섹션은 🟠 잔존 (cleanup 후보)
> - BUG-104/108 은 양쪽 섹션 모두 표기 (legacy `해결됨` 정리 후보)

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

### BUG-101 — 첫 진입 시 버튼 호버 연출이 전 버튼에서 발동 🟡

- **발견:** 2026-04-21 / prod
- **재현 경로:** 메인 진입 → 스크롤로 섹션 인터랙션 트리거
- **실제:** 첫 입장 때 페이지 내 모든 버튼의 호버 연출이 순간 발동. 이후엔 정상 (호버 시에만 발동)
- **추정 범위:** CSS transition 초기값 · `transition: all` 또는 hover 상태가 mount 시 한번 적용되는 케이스. `:hover` 가 아닌 `.is-hovering` 클래스 또는 `will-change` 초기 페인트 이슈 가능성.

### BUG-102 — 상품 안내 아코디언 내용이 우측으로 오버플로우·잘림 🟠

- **발견:** 2026-04-21
- **재현 경로:** 상품상세 페이지 → 아코디언 섹션 확장
- **실제:** 내용이 컨테이너 우측 화면 바깥으로 넘침 · 잘림
- **추정 범위:** `ProductDetail` 아코디언 — `overflow-x` · `width: 100%` 누락 또는 `white-space: nowrap` 잔존. Session 47~48 레시피 카드 반응형 이후 회귀 가능성.

### BUG-103 — 인풋필드 헤어라인이 iOS 모바일에서 안 보임 🟡

- **발견:** 2026-04-21 / iOS Safari·Chrome
- **실제:** PC 정상 · iOS 모바일에서 헤어라인 불가시
- **추정 범위:** `border: 1px solid var(--color-line-light)` 가 iOS 고DPR 에서 sub-pixel rendering 으로 사라짐. `0.5px` · `hairline` 토큰 도입 또는 `box-shadow: inset 0 0 0 1px` 대체 검토.

### BUG-104 — ✅ 카페 메뉴 바텀시트 하단 세이프티 에리어 iOS 잘림 (흰색)

- **발견:** 2026-04-21 / iOS
- **재현 경로:** 카페 메뉴 → 상품 탭 → 바텀시트 오픈
- **실제:** 하단 safe-area inset 영역이 바텀시트 배경으로 채워지지 않고 화이트 노출
- **추정 범위:** 바텀시트 컨테이너 `padding-bottom: env(safe-area-inset-bottom)` 가 배경 밖에 적용. `padding` 대신 `min-height` + 내부 `padding` 또는 배경 확장 필요.

### BUG-105 — 모바일 Chrome 하단 네비 영역이 히어로와 충돌 🟠

- **발견:** 2026-04-21 / Android·iOS Chrome
- **재현 경로:** 메인 첫 진입 (히어로 화면)
- **실제:**
  1. 브라우저 하단 네비가 히어로 `100vh` 를 깎음 → 하단에 흰 띠(시즌배너 배경) 노출
  2. 스크롤 중 네비가 사라지면 히어로가 순간 확장
- **추정 범위:** `100vh` → `100svh`/`100dvh` 전환 필요. 또는 JS 로 `--hero-h` 변수 관리. (CLAUDE.md 에 `100svh` 언급 있으나 반영 누락 가능성)

### BUG-106 — iOS Chrome 자동완성 푸른색 배경 노출 🟢

- **발견:** 2026-04-21 / iOS Chrome
- **실제:** 인풋필드 자동완성 시 iOS Chrome 네이티브 푸른 배경색 노출 (디자인 토큰 무시)
- **추정 범위:** `-webkit-autofill` 대응 CSS 누락. `-webkit-box-shadow: 0 0 0 1000px var(--color-bg-primary) inset` + `-webkit-text-fill-color` 로 오버라이드.

### BUG-107 — 모바일 굿데이즈 라이트박스 좌우 버튼 크기·컬러 보정 🟢

- **발견:** 2026-04-21 / 모바일
- **재현 경로:** 굿데이즈 → 이미지 클릭 → 라이트박스
- **실제:** 좌우 스크롤 버튼이 계속 보이고, 기본 회색이 탁함. 크기도 모바일에선 크거나 어색
- **개선 제안:** 크기 조정 + `opacity` 활용 반투명 + 호버/탭 시에만 강조 (idle 시 흐리게)

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

### BUG-111 — 결제 페이지 서브타이틀 위 분할선 전수조사·제거 🟡

- **발견:** 2026-04-24
- **재현 경로:**
  1. 결제 2단계 — "연락처" 타이틀 상단 분할선
  2. 결제 최종 단계(토스 UI 직전) — "결제" 타이틀 상단 분할선
  3. 비회원 주문번호 조회 — 상단 분할선
- **기대:** 서브타이틀 위 분할선은 일괄 제거 (통일성)
- **실제:** 여러 결제 서브섹션 상단에 분할선이 남아 있음
- **작업 방향:** 결제 관련 라우트 전수 grep 후 분할선 토큰·셀렉터 제거. `chp-section--no-border` 패턴 재활용 가능.

### BUG-112 — 비회원 결제에서 "로그인하고 주문하기" 클릭 후 비회원 주문 UI 재노출 🟡

- **발견:** 2026-04-24
- **재현 경로:** 비회원 주문 → 결제 1단계 → "로그인하고 주문하기" 클릭 → 로그인 복귀
- **실제:** 복귀한 결제 페이지에 "비회원으로 주문하기" 아웃라인 박스가 여전히 노출됨
- **기대:** 이미 로그인해서 들어온 사용자에게 비회원 재푸시 UI 제거 (불필요한 선택지)
- **추정 범위:** `CheckoutPage` — 로그인 완료 감지 시 게스트 CTA 박스 hide 로직 누락

### BUG-113 — 비회원 주문 비밀번호 헬퍼·에러 메시지 자수 기준 불일치 🟡

- **발견:** 2026-04-24
- **재현 경로:** 비회원 결제 폼 → 비밀번호 인풋 focus / 잘못된 값 blur
- **실제:** 헬퍼 "4자 이상 입력" 안내 → 에러는 "6자 이상" 경고
- **기대:** 동일 기준 (정책 확정 후 양쪽 통일)
- **추정 범위:** `GuestPasswordField` 헬퍼 상수와 Zod schema `.min()` 불일치

### BUG-114 — 브라우저 자동완성 → 우편번호가 Postcode 검색 없이 미리 채워짐 🟡

- **발견:** 2026-04-24
- **재현 경로:** 결제 폼 자동완성 수락
- **실제:** Daum Postcode 검색 없이 우편번호(zipcode) 필드에 값 주입
- **기대:** 우편번호는 Postcode 검색 결과로만 채워져야 함 (주소 일관성 보장)
- **추정 범위:** `autocomplete="off"` 또는 hidden · read-only · postcode 필드 별도 이름 사용 등

### BUG-115 — 토스 UI 내 퀵 계좌이체 허용 vs 우리 "계좌이체/무통장입금" 중복 검토 🟢

- **발견:** 2026-04-24
- **재현 경로:** 결제 수단 "체크/신용카드" 탭 선택 → 토스 결제창 → 퀵 계좌이체 옵션 노출
- **실제:** 우리 결제 UI 에 "계좌이체/무통장입금" 탭이 있는데, 토스 UI 자체에서도 퀵 계좌이체 허용
- **기대:** 정책 결정 — 우리 탭과 겹치므로 토스 UI 에서 해당 수단 숨길지, 별도 채널로 유지할지 검토
- **작업 방향:** `payments-flow.md` 참조 후 결제수단 허용 리스트 재정의 (토스 결제창 `easyPay` / `accountTransfer` 옵션 검토)

### BUG-116 — 희망 납품 주기 드롭다운 순서·명칭 정리 🟢

- **발견:** 2026-04-24
- **실제:** 현재 명칭·순서가 임시
- **기대 순서 (임시):** 주 1회 → 주 2회 → 월 1회 → 월 2회
- **비고:** DB 연결 시 재작업 예정이지만 임시 UI 라도 순서·명칭 맞춤

### BUG-117 — 주문요약 "결제예정금액"·"부가세 포함" 폰트 크기 점검 🟡

- **발견:** 2026-04-24 / 특히 모바일
- **실제:** 모바일에서 해당 텍스트가 너무 작게 보임
- **기대:** 결제 전 확인해야 할 최종 금액이므로 모바일 가독성 우선
- **작업 방향:** 타이포 토큰 재적용 — Body S → Body M · 웨이트 재검토

### BUG-118 — 결제 페이지 "결제하기" 버튼 하단 밑줄 버튼 5종 가독성 🟡

- **발견:** 2026-04-24 / 모바일 (데스크탑 공통 여부 확인 필요)
- **실제:** 결제하기 CTA 하단의 밑줄 버튼 5종이 가독성 낮음
- **기대:** 텍스트 크기·색·밑줄 명도 재검토
- **작업 방향:** 데스크탑·모바일 동시 캡처 후 토큰 재설계

### BUG-119 — 결제 2단계 주문요약 아이템 스타일 뱃지 제거 + 수량 텍스트 교체 🟢

- **발견:** 2026-04-24
- **실제:** 아이템에 스타일 뱃지 + 수량 카운터 뱃지
- **기대:** 스타일 뱃지 제거 + 수량은 텍스트로 표시 (예: "× 2")
- **작업 방향:** `CheckoutOrderSummary` 아이템 슬롯 리디자인

### BUG-120 — 토스 결제창 상품 이름 (한글+영문) 영문 잘림 🟡

- **발견:** 2026-04-24
- **재현 경로:** 결제 진행 → 토스 결제창
- **실제:** 상품명 중 영문 부분이 잘려서 표시됨
- **추정 범위:** 토스 결제 요청 `orderName` 길이 제한(100자) 또는 프리픽스·서픽스 조합 순서. 한국어 우선 + 영문 축약 또는 생략 정책 필요.

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

### BUG-125 — 마이페이지 드롭다운 outside 터치 시 하단 아코디언 동작 🟡

- **발견:** 2026-04-24
- **재현 경로:** 마이페이지 드롭다운 오픈 → 드롭다운을 닫으려고 다른 영역 터치
- **실제:** 드롭다운이 닫히면서 터치한 위치의 아코디언이 함께 열림/닫힘
- **기대:** outside tap 은 드롭다운 닫기만 수행, 하단 터치 소비 차단
- **추정 범위:** 드롭다운 바깥 클릭 핸들러가 이벤트 `stopPropagation` 미수행 또는 overlay 가 hit-test 에서 제외

### BUG-126 — 로그인 상태 메뉴 드로어에 로그아웃 버튼 추가 🟡

- **발견:** 2026-04-24
- **실제:** 모바일은 마이페이지 내부까지 진입해야만 로그아웃 가능
- **기대:** 로그인 상태일 때 메뉴 드로어 "마이페이지" 옆에 로그아웃 버튼 노출
- **추정 범위:** `MobileNavDrawer` — `isLoggedIn` 분기에서 로그아웃 버튼 슬롯 추가. 세션 파괴 · 홈 리다이렉트 연결.

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

### BUG-140 — 햄버거 메뉴 드로어 로그인 토글 → "로그아웃 · 마이페이지" 분리 🟡

- **발견:** 2026-04-25 / S76
- **현재:** 모바일 햄버거 드로어에서 단일 슬롯 토글. 비로그인 시 "로그인", 로그인 후 같은 슬롯이 "로그아웃" 으로 전환.
- **제안:** 로그인 상태에서 **"로그아웃 · 마이페이지"** 두 링크를 별도로 노출, 각각 분리된 액션 연결.
- **근거:** 단일 슬롯 토글은 로그인 후 마이페이지 진입에 별도 경로 필요. 분리 시 1탭으로 양쪽 모두 접근 가능 + 로그인 상태 인지가 명확.
- **고려:** 시각 노이즈 미미 / 가독성 우려는 구분자 (`·` 또는 두 행 분리) 디자인으로 해결 가능.
- **관련:** BUG-126 (로그인 상태 메뉴 드로어 로그아웃 버튼 추가) 의 구체화 안으로 통합 검토 필요. BUG-126 → BUG-140 으로 흡수 또는 묶음 처리 후보.
- **묶음:** BUG-147 과 동일 모바일 헤더/네비 영역 → S77 묶음 E 동시 처리 권장.
- **추정 범위:** `MobileNavDrawer` `isLoggedIn` 분기에서 단일 토글 → 두 슬롯 분리 · 라우팅 분기.

### BUG-147 — 모바일 로그인 페이지 4종 헤더에 X 닫기 버튼 추가 (escape route) 🟡

- **발견:** 2026-04-25 / S76
- **배경:** 데스크탑에서 폼 입력 중 페이지 이탈 방지 의도로 로그인 페이지 4 모드 (login · register · reset · guest-lookup) 헤더에 로고만 노출. 데스크탑은 탭/즐겨찾기/멀티 윈도우 등 escape route 풍부 → OK.
- **현재 (모바일):** 모바일은 escape 옵션이 데스크탑보다 적음 (탭·즐겨찾기·다중 윈도우 부재) → 페이지 진입 시 "로고 → 홈" 외 출구 없음 → 답답함. 오히려 사용자가 앱·탭 자체를 종료하여 사이트 전체에서 이탈할 위험 ↑.
- **기대:** **모바일 한정** 헤더 좌상단에 **X 닫기 버튼** 추가 → `router.back()` 으로 이전 페이지 복귀. 데스크탑 헤더는 변경 없음 (현재 의도 유지).
- **추가 안전망 (폼 dirty state):** 로그인 mode 외 (register · reset · guest-lookup) 에서 사용자 입력이 있는 상태로 X 클릭 시 "입력한 내용이 사라집니다. 닫으시겠습니까?" 확인 모달. login mode 는 dirty 무시 (입력 부담 작음) — 디자인 결정 사항.
- **적용 대상:**
  1. `/login` mode='login' (로그인)
  2. `/login` mode='register' (회원가입)
  3. `/login` mode='reset' (비밀번호 재설정)
  4. `/login` mode='guest-lookup' (비회원 주문 조회)
- **제외:** 비즈인콰이어리 (`/biz-inquiry`) 는 현재 모바일 헤더가 정상 노출되어 escape 가능 → 작업 불필요.
- **근거 (산업 표준):** 카카오·토스·쿠팡 등 메이저 한국 모바일 서비스는 폼/모달 페이지에 햄버거 대신 X 닫기 또는 ← back 버튼 노출. "갇힘" 회피 = retention 향상 패턴.
- **묶음:** BUG-140 과 동일 모바일 헤더/네비 영역 → S77 묶음 E 동시 처리 권장.
- **추정 범위:** `LoginPage.tsx` 헤더 영역 (mode 4종 공통) 에 모바일 한정 X 버튼 + onClick `router.back()` + dirty state 확인 모달 (선택).

### BUG-141 — 비즈니스 인콰이어리 "관심 제품" 모두 선택 시 페이지 좌우 가로 스크롤 🟠

- **발견:** 2026-04-25 / S76
- **재현 경로:** /biz-inquiry → "관심 제품" 체크박스 모두 선택 → 선택된 라벨 합산 폭이 인풋 필드를 초과하면서 페이지 가로 스크롤 발생
- **실제:** 관심 제품 인풋필드가 자체 폭을 넘어 가로 확장 → 같은 행/폼 내 다른 인풋필드까지 같이 끌려가서 오버플로우. 페이지가 좌우 스크롤됨.
- **기대:** 관심 제품 인풋필드 가로 크기 내에서 **선택된 라벨 텍스트만 좌우 스크롤** 되거나 줄바꿈. 페이지 전체 스크롤 발생 금지.
- **추정 범위:** `BizInquiryPage` 관심 제품 선택 표시 컨테이너에 `overflow-x: auto` + `white-space: nowrap` + `min-width: 0` (flex shrink). 부모 폼 wrapper 에 `overflow-x: hidden` 안전망.
- **결정 필요:** 가로 스크롤 vs 줄바꿈(wrap) 중 디자인 선택.

### BUG-142 — 라벨 eyebrow 애니메이션 스크롤 위치 반응 (중앙 진입/이탈 역재생) 🟢

- **발견:** 2026-04-25 / S76
- **현재:** eyebrow 라벨 (예: 섹션 상단 "01 — Story" 등) 등장 애니메이션이 1회 진입 시점 기준으로만 재생. 스크롤로 화면 중앙에서 멀어진 후 다시 돌아와도 정적 상태 유지.
- **기대:** 라벨이 **화면 중앙 근처에 진입하면 재생 · 중앙에서 멀어지면 역재생** (양방향). 스크롤 위치를 progress 로 환산하여 애니메이션 timeline 연동.
- **추정 범위:** `IntersectionObserver` threshold 다단 + `scroll-timeline` (CSS) 또는 IO progress → CSS variable bind. 모바일 성능 고려 (rAF throttle).
- **참조:** Phase 2 "Scroll Variable Font" 트랙 (`project_design_interaction_plan.md`) 과 묶음 후보.

### BUG-143 — 모바일 버튼 호버 애니메이션 종료 후 액션 실행 (UX 호흡) 🟡

- **발견:** 2026-04-25 / S76
- **현재:** 모바일 탭 시 호버 애니메이션과 액션 (네비게이션·서브밋) 이 동시 발화 → 사용자가 호버 피드백을 인지하기 전에 다음 화면 진입. "탭한 게 인식됐는지" 확신이 약함.
- **기대:** 탭 → 호버 애니메이션 재생 → **재생 종료 후 액션 실행**. 호흡 늘리기 + 명확한 피드백.
- **추정 범위:** 공통 CTA 컴포넌트 (`cta-btn-*`) 의 click 핸들러를 `pointercoarse` 미디어 쿼리/touch 디바이스 분기에서 `transitionend` (또는 토큰 duration) 후 액션 실행으로 래핑. desktop 동작은 즉시 유지.
- **리스크:** 응답성 저하 체감 가능 → 토큰 duration 200~300ms 범위로 조정 필요 + double tap 차단 정책 확인.

### BUG-144 — ✅ 모바일 버튼 드래그 시 호버 애니메이션 발화 차단 🟡 — S76 closure

- **발견:** 2026-04-25 / S76
- **해결:** 2026-04-25 / S76
- **현재:** 모바일에서 페이지 스크롤을 위해 손가락이 버튼 위를 지나가면 호버 애니메이션이 잠깐 재생됨 → 의도하지 않은 활성화 피드백.
- **기대:** **드래그/스크롤 제스처 도중에는 호버 애니메이션 차단**. 명확한 탭만 호버 발화.
- **수정:** `globals.css` 에 `@media (hover: none)` 블록 추가 — 모든 CTA 변종 (`cta-btn-*` · `lp-*` · `chp-*` · `ocp-*` · `cp-*` · `bi-*` · `mp-*` · `pd-cart-btn` · `st-map-overlay-btn` · `season-cta` · `roastery-cta-btn`) 의 `:hover::after` gold rule 을 touch 디바이스에서 `transform: scaleX(0)` 으로 강제 → tap 시에도 발화하지 않음. 데스크탑 hover 동작은 유지.
- **잔여 (BUG-143):** tap → 호버 재생 → 종료 후 액션 실행 (호흡 늘리기) 은 별도 트랙. desktop 동작 일관성 + 모바일 즉시 액션 vs 지연 액션 디자인 결정 선행 필요.

### BUG-145 — ✅ 카카오맵 마커 팝업 "카카오맵 상세" → "상세보기" 명칭 변경 🟢 — S76 closure

- **발견:** 2026-04-25 / S76
- **해결:** 2026-04-25 / S76
- **수정:** `KakaoMap.tsx` L147 `detailLink.textContent` 교체 + 파일 헤더 주석 (L9, L99) 명칭 정리.

### BUG-146 — ✅ 카카오맵 마커 크기 확대 🟢 — S76 closure

- **발견:** 2026-04-25 / S76
- **해결:** 2026-04-25 / S76
- **수정:** `KakaoMap.tsx` `MarkerImage` Size 28×36 → **40×52** (1.42×) · offset Point(14, 36) → (20, 52) 비례 갱신. 바닥 중앙 앵커 유지. 시인성 향상 + 모바일 가독성 보강.

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
