# Prototype Handoff — Good Things Roasters v1.0

> `goodthings_v1.0.html` → Next.js 전환을 위한 컴포넌트·상태·동작 스펙 문서
> 작성일: 2026-04-10

---

## 1. 전체 구조 요약

| 항목 | 수량 |
|------|------|
| 서브 페이지 (full-screen overlay) | 12 |
| 드로어/패널 | 7 |
| 아코디언 그룹 | 8 |
| 탭 시스템 (인디케이터 포함) | 3 |
| 이미지 캐러셀 | 1 |
| 라이트박스/모달/팝업 | 4 |
| Canvas 시각화 (레이더 차트) | 1 |
| 토스트/알림 | 1 |
| 폼 시스템 | 5 (서브 폼 15+) |
| 데이터 구조 | 9 |
| CSS Custom Properties | 179 |
| 상태 관리 함수 | 40+ |

---

## 2. 서브 페이지 목록

| ID | 용도 | 형제 닫기 대상 |
|----|------|---------------|
| `product-detail-page` | 상품 상세 | — |
| `search-result-page` | 검색 결과 | — |
| `login-page` | 로그인/회원가입/비번찾기/비회원조회 | my-page |
| `my-page` | 마이페이지 (주소·구독·비번변경) | shop, cafe, login, story |
| `shop-page` | 상품 목록 (필터 탭) | cafe-menu, story, gd |
| `cafe-menu-page` | 카페 메뉴 목록 | shop, story, gd |
| `cart-page` | 장바구니 (풀페이지) | — |
| `checkout-page` | 결제 폼 | — |
| `order-complete-page` | 주문 완료 | — |
| `story-page` | 브랜드 스토리 | shop, cafe, login, my-page, gd |
| `gd-page` | Good Days 갤러리 | shop, cafe, story, login, my-page |
| `biz-inquiry-page` | B2B 문의 폼 | — |

### 페이지 열기/닫기 필수 패턴

**열기:**
```
closeOverlay()
형제 서브 페이지 닫기
bringPageToFront(page)
page.classList.add('open')
document.body.style.overflow = 'hidden'
```

**닫기:**
```
closeOverlay()
page.classList.remove('open')
_restoreOverflow()
window.scrollTo({top:0, behavior:'instant'})
resetHeroVideo()
```

---

## 3. 드로어 & 패널

| 컴포넌트 | ID | 동작 |
|----------|-----|------|
| 카트 드로어 | `cart-drawer` | 오른쪽 슬라이드인 (translateX), 350ms ease-spring |
| 카트 오버레이 | `cart-drawer-overlay` | 반투명 딤 배경 |
| 영양정보 시트 | `cns-panel` | 하단 슬라이드업 패널 |
| 영양정보 배경 | `cns-bg` | 딤 배경 |
| 검색 드롭 패널 | `#search-drop` | 헤더 아래 드롭다운 |
| DEV 패널 | `dev-panel` | 개발자 도구 (프로덕션 제거) |

---

## 4. 핵심 컴포넌트 스펙

### 4.1 헤더 — 글래스모피즘 + 스크롤 테마 전환

- **CSS:** `backdrop-filter: blur(16px)`, `background: rgba(250,250,248,0.7)`
- **테마:** 각 섹션의 `data-header-theme="dark|light"` 속성 기반
- **전환:** `hdr-dark` 클래스 토글, 헤더 수직 중심점이 어떤 섹션에 있는지 계산
- **디바운스:** `requestAnimationFrame` 기반 `rafPending` 플래그
- **이벤트:** `window scroll` (passive)

### 4.2 히어로 섹션

- **비디오:** `<video autoplay muted loop playsinline>` (.webm + .mp4 폴백)
- **슬로건 등장:** 800ms 후 `.hero--visible` 클래스 추가 (opacity + translateY 전환, 0.9s)
- **스크롤 마우스:** 1400ms 후 등장, `scrollWheel` keyframe (1.8s infinite)
- **리셋:** `resetHeroVideo()` — `currentTime = 0`, play(), RAF로 클래스 재적용

### 4.3 상품 상세 이미지 캐러셀

- **갤러리:** `#pd-img-wrap` 컨테이너, `#pd-img` 메인 이미지
- **네비게이션:** `#pd-img-prev` / `#pd-img-next` 버튼
- **썸네일:** `#pd-img-thumbs` 하단 (클릭 시 메인 변경)
- **렌더링:** `renderPdGallery(images)` 함수

### 4.4 탭 시스템

| 탭 | ID | 옵션 |
|-----|-----|------|
| 주문 타입 | `pd-order-tab` | 일반 주문 / 정기 배송 |
| 상품 필터 | `sp-filter-tab` | 전체 / 원두 / 드립백 / 정기배송 |
| 카페 필터 | `cm-filter-tab` | 전체 / 시그니처 / 브루잉 / 티 / 논커피 / 디저트 |

- **인디케이터 애니메이션:** `_spPositionIndicator()`, `_cmPositionIndicator()` — 활성 탭 아래 슬라이딩 바

### 4.5 로스트 프로필 (Canvas 레이더 차트)

- **캔버스:** `#pd-radar-canvas` (400x400)
- **5축:** 단맛(sweet), 무게감(body), 여운(aftertaste), 향(aroma), 산미(acidity)
- **애니메이션:** `animateRadar()` — hover 시 프로그레시브 필 효과, IntersectionObserver로 재진입 시 재트리거
- **이징:** 커스텀 `easeOut()`, `easeBack()` 함수
- **유틸:** `_hexToRgba()` 색상 변환
- **로스트 단계:** 5단계 (light → medium-light → medium → medium-dark → dark) 시각화 바, `renderPdRoastSec()`

### 4.6 레시피/브루잉 가이드

- **커피빈:** `_recipeSVGs` 메서드 아이콘 (에어로프레스, 에스프레소, 모카포트, 브루잉) + 스텝 카드
- **드립백:** `DRIP_BAG_RECIPE` (step1~3 + tip), `_DRIP_SVGS` 3개 아이콘
- **렌더:** `renderPdRecipeSec()` — 메서드 선택 → 스텝 카드 순차 등장 (`.reveal` 클래스, staggered delay)

### 4.7 정기배송 시스템

- **탭 전환:** `pd-order-tab` 일반↔정기 토글 (`isSubTab` 플래그)
- **주기 선택:** `SUB_CYCLES` 배열, `_showCycle()` / `_hideCycleCompletely()` 모달 관리
- **가격 표시:** `renderSubPrices()` 구독 할인 가격 UI
- **배지:** `formatSubBadge()` 구독 타입 뱃지
- **카트 통합:** 구독 아이템은 `type:'subscription'` + `period` 필드로 구분

### 4.8 토스트/알림

- **함수:** `showToast(message, duration?)` — 기본 2500ms 자동 dismiss
- **요소:** `#global-toast` (fixed position, 슬라이드 애니메이션)
- **사용처:** 주문번호 복사, 구독 취소, 비밀번호 변경, 장바구니 추가 등

### 4.9 팝업/다이얼로그

- **렌더:** `renderPopup()` — 이미지/본문 영역, 클릭 시 상품 상세 이동
- **24시간 dismiss:** `POPUP_KEY` localStorage, "오늘 하루 보지 않기" 기능
- **오버레이:** 배경 클릭으로 닫기

### 4.10 Good Days 라이트박스

- **요소:** `#gd-lightbox` 풀스크린 이미지 뷰어
- **네비게이션:** `#gd-lb-prev` / `#gd-lb-next` 화살표
- **인덱스:** `_gdLbIdx` 전역 변수, `window._gdOrdered` 이미지 배열
- **트랜지션:** `.gd-lb-settled` 클래스 (600ms 지연 후 추가)

---

## 5. 데이터 구조

### 5.1 PRODUCTS 배열

```typescript
type Product = {
  category: 'Coffee Bean' | 'Drip Bag';
  name: string;              // "가을의 밤 Autumn Night"
  price: string;             // "14,000원"
  volumes: { label: string; price: number }[];
  color: string;             // CSS gradient 또는 hex
  status: null | 'NEW' | '인기 NO.1' | '매진';
  slug: string;
  subscription: boolean;
  images: { bg: string; bgTheme: 'light' | 'dark'; src: string }[];
  desc: string;
  specs: string;
  note: { sweet: number; body: number; aftertaste: number; aroma: number; acidity: number };
  noteTags: string;
  noteColor: string;
  roastStage: string;
  recipe: { method: string; dose: string; temp: string; time: string; water: string }[];
};
```

### 5.2 CAFE_MENU 배열

```typescript
type CafeMenuItem = {
  id: string;                // "s01"
  name: string;
  cat: 'signature' | 'brewing' | 'tea' | 'non-coffee' | 'dessert';
  status: '시그니처' | 'NEW' | '';
  price: number;
  img: string;
  bg: string;
  menuDesc: string;
  vol: string;
  kcal: string; satfat: string; sugar: string;
  sodium: string; protein: string; caffeine: string;
  allergen: string;
};
```

### 5.3 Cart Item

```typescript
type CartItem = {
  id: number;               // Date.now()
  slug: string;
  name: string;
  price: string;            // "14,000원"
  priceNum: number;
  qty: number;
  color: string;
  image: { src: string; bg: string };
  type: 'normal' | 'subscription';
  period: string | null;
  category: string;
  volume: string | null;
};
```

### 5.4 GD_IMAGES 배열 (Good Days 갤러리)

```typescript
type GdImage = {
  src: string;              // "images/gallery/KakaoTalk_..."
  featured?: boolean;       // true면 span 셀(큰 이미지)로 배치
};
```

- 총 44장, `featured: true` 5장
- **매거진 패턴** (`GD_PATTERNS`): A(5장, span 0) → B(3장) → C(5장, span 4) → D(2장) → E(1장) = 16장 1사이클 반복
- **렌더링:** featured/normal 풀을 분리 → 패턴의 spanIdx 위치에 featured 우선 배치
- **셔플:** `window._gdOrdered` 배열에 최종 순서 저장 (라이트박스 네비게이션 기준)
- **플레이스홀더:** 이미지 부족 시 `GD_PLACEHOLDER_COLORS` 5색 순환
- **메인 페이지 미니 그리드** (`#main-gd-grid`): featured 4장 + normal 4장 = 8장 프리뷰

### 5.5 DRIP_BAG_RECIPE

```typescript
type DripBagRecipe = {
  step1: string;
  step2: string;
  step3: string;
  tip: string;
};
```

### 5.6 CAT_LABEL

카테고리 slug → 한글명 매핑 (`'Coffee Bean' → '원두'` 등). 검색 결과·뱃지·초성 검색에 사용.

### 5.7 _mpOrders (마이페이지 주문 Mock)

```typescript
type MockOrder = {
  date: string;              // "2026.03.28"
  number: string;            // "GT-20260328-00051"
  name: string;
  items: {
    name: string; slug: string; category: string;
    volume: string; qty: number; priceNum: number;
    image: { src: string; bg: string };
  }[];
};
```

### 5.8 프로토타입 더미 데이터

| 상수 | 용도 |
|------|------|
| `_PROTO_ACCOUNT` | 테스트 계정 (good@goodthings.com / good1234) |
| `DUMMY_ADDR` | 주소 폼 더미 데이터 (실서비스 시 Daum Postcode API) |
| `SUB_CYCLES` | 정기배송 주기 옵션 배열 |

### 5.9 STORE_CONFIG

```javascript
const STORE_CONFIG = {
  FREE_SHIPPING_THRESHOLD: 30000,  // 무료 배송 기준
  SHIPPING_FEE: 3000,              // 기본 배송비
};
```

---

## 6. 상태 관리 함수

### 6.1 코어 유틸리티

| 함수 | 역할 |
|------|------|
| `bringPageToFront(el)` | z-index 동적 관리 (`_zPageTop` 카운터 증가) |
| `_restoreOverflow()` | `.sub-page.open` 또는 `#cart-drawer.open` 존재 시 body overflow hidden 유지 |
| `openOverlay()` | 검색 오버레이 활성화 + 헤더 `.has-panel` 추가 |
| `closeOverlay()` | 검색 오버레이 해제 + `.has-panel` 제거 |
| `resetHeroVideo()` | 히어로 비디오 currentTime 리셋 + 슬로건 재애니메이션 |
| `updateCartBadge()` | 장바구니 수량 표시 업데이트 (99+ 캡) |
| `goHome()` | 모든 페이지 닫기 + 스크롤 리셋 |
| `copyToClipboard(text)` | Clipboard API + `_fallbackCopy()` 폴백 |
| `showToast(msg, dur?)` | 글로벌 토스트 알림 (기본 2500ms) |
| `shakeField(el)` | 필드 에러 시 흔들림 애니메이션 (400ms) |
| `equalizeBtnRows()` | 버튼 행 높이 정렬 (반응형) |
| `_pdPrevPage` | 상품 상세 뒤로가기 추적 ('main' / 'search' / 'shop') |

### 6.2 카트 함수

| 함수 | 동작 |
|------|------|
| `addToCart(info)` | slug/type/period/volume 기준 중복 병합, 드로어 렌더 |
| `removeCartItem(id)` | 필터 후 재렌더 |
| `updateCartQty(id, delta)` | 최소 1 보장 (`Math.max(1, qty+delta)`) |
| `renderCartDrawer()` | cartItems 배열에서 전체 HTML 재생성 |
| `parseCartPrice(str)` | "14,000원" → 14000 변환 |

### 6.3 가격 계산

```
subtotal = cartItems.reduce((s, i) => s + (i.priceNum * i.qty), 0)
free = subtotal >= 30000
shipping = free ? 0 : 3000
total = subtotal + shipping
```

---

## 7. 검색 시스템 — 4계층 매칭

| 계층 | 함수 | 처리 |
|------|------|------|
| L1 | `_srchL1(s)` | `toLowerCase()` + 공백·특수문자 제거 |
| L2 | SEARCH_SYNONYMS | 양방향 동의어 사전 (원두↔coffee bean, 아아↔아이스아메리카노 등) |
| L3 | `_srchL3(s)` | NFD 분해 → 된소리/거센소리→평음 변환 → NFC 재조합 |
| L4 | `_getChosung(s)` | 초성 추출 (ㅋㅍ → 커피) |

**단일 음절 규칙:** 단일 한국어 음절은 상품명·카테고리만 검색 (desc/specs 제외), L3 정규화 미적용

**결과 페이지네이션:** `PER_PAGE = 5`, `currentPage` 기반

---

## 8. 폼 시스템

### 8.1 로그인 페이지 (4가지 모드)

| 모드 | 전환 함수 | 필드 |
|------|----------|------|
| 로그인 | `setLoginMode('login')` | 이메일, 비밀번호 |
| 회원가입 | `setLoginMode('register')` | 이름, 이메일, 비밀번호, 비밀번호 확인 |
| 비밀번호 찾기 | `setLoginMode('reset')` | 이메일 |
| 비회원 주문조회 | `setLoginMode('guest')` | 이메일, 주문번호 |

### 8.2 체크아웃 폼

| 섹션 | 필드 | 조건 |
|------|------|------|
| 연락처 | 이메일 (필수) | — |
| 배송지 | 이름, 전화, 주소1(검색), 우편번호, 주소2 | 주소2는 주소 선택 후 표시 |
| 배송방법 | 드롭다운 (일반/빠른/날짜지정) | 날짜지정 시 날짜 입력 표시 |
| 비회원 비번 | 비밀번호, 비밀번호 확인 | `data-guest="true"` — 비회원일 때만 |
| 결제수단 | 라디오 (카드/계좌이체) | 계좌이체 시 은행·입금자명 표시 |

### 8.3 마이페이지 아코디언

| 아코디언 | 내용 |
|----------|------|
| 배송지 관리 | 이름, 전화, 주소(검색+직접입력), 우편번호 |
| 구독 관리 (복수) | 중첩 서브 아코디언, 배송주기 셀렉트 |
| 비밀번호 변경 | 현재 비밀번호, 새 비밀번호, 확인 |

### 8.4 B2B 문의 폼

| 섹션 | 필드 |
|------|------|
| 개인정보 | 이름, 이메일, 전화 |
| 사업자정보 | 상호, 업종(드롭다운), 주소, 사업자등록번호 |
| 현황 | 장비, 원두 공급처, 연간 물량(드롭다운), 주문 주기(드롭다운) |
| 메시지 | textarea |

### 8.5 공통 폼 패턴

- **헬퍼 텍스트:** `.input-helper` 클래스로 통일
- **전화번호:** `formatPhoneNumber()` 자동 하이픈
- **Enter 키:** 다음 필드 포커스 이동
- **검증 함수:** `isEmailValid()`, `isPwValid()`, `attachEmailValidation()`, `attachPhoneValidation()`
- **상태 토큰:** error/success/info/warning 색상 (System Feedback 토큰)

---

## 9. 애니메이션 패턴

### CSS Keyframes

| 이름 | 용도 | 시간 |
|------|------|------|
| `pageEnter` | 서브 페이지 진입 | 350ms ease-spring |
| `staggerUp` | 주문 완료 요소 순차 등장 | 0.5s, 0.1s~0.45s 딜레이 |
| `checkBounce` | 체크 아이콘 바운스 | elastic scale |
| `scrollWheel` | 히어로 스크롤 마우스 | 1.8s infinite |
| `cat-arrow-in` | 카테고리 화살표 | 600ms |

### 이징 토큰

| 토큰 | 값 |
|------|-----|
| `--ease-spring` | `cubic-bezier(.16,1,.3,1)` |
| `--ease-default` | `ease-out` |
| `--ease-drawer` | `cubic-bezier(.25,.46,.45,.94)` |

### 애니메이션 라이브러리

- **GSAP 미사용** — 순수 CSS 트랜지션 + `requestAnimationFrame`
- **IntersectionObserver:** 스크롤 리빌 (`.sr--visible` 클래스), threshold: 0.3, rootMargin: `0px 0px -40px 0px`
- **스크롤 리빌 CSS:** `.sr-img` (blur→sharp + fade-in), `.sr-txt` (fade-in + translateY)
- **서브 페이지 내 스크롤 리빌:** root 컨테이너를 서브 페이지 스크롤러로 지정 (story, gd 등)

---

## 10. 로그인/인증 상태

- **전역 변수:** `window.isLoggedIn = false` (프로토타입 토글)
- **UI 반영:** `document.body.classList.add/remove('logged-in')`
- **영향 범위:** 로그인 아이콘 전환, 마이페이지 주문 목록, 체크아웃 비회원 필드, 카트 내 구독 옵션

---

## 11. localStorage 사용

| 키 | 용도 |
|----|------|
| `gt_products` | 상품 데이터 편집 저장 |
| `gt_drip_recipe` | 드립백 레시피 편집 저장 |
| `gt_cafe_menu` | 카페 메뉴 편집 저장 |
| `POPUP_KEY` | 팝업 24시간 dismiss 게이트 |

## 12. 키보드 & 이벤트

| 이벤트 | 동작 |
|--------|------|
| Enter (검색 인풋) | 검색 실행 |
| Escape (전역) | 검색 오버레이 닫기 |
| Enter (폼 필드) | 다음 필드 포커스 이동 |
| scroll (window, passive) | 헤더 테마 전환 |
| resize | 버튼 행 높이 재정렬 |

## 13. 푸터

- **사업자정보 토글:** `.f-biz-toggle` 클릭 → `.f-biz-inline` 펼침/접힘
- **구성:** 사업자 정보, 이용약관, 개인정보처리방침, SNS 링크

---

## 14. Next.js 전환 시 주요 결정 사항

### 라우팅

| 프로토타입 | Next.js App Router |
|-----------|-------------------|
| `.sub-page.open` 클래스 토글 | `/shop`, `/menu`, `/story` 등 실제 라우트 |
| `bringPageToFront()` z-index | 라우트 전환 애니메이션 |
| `_restoreOverflow()` | 레이아웃 단에서 관리 |

### 상태 관리

| 현재 | 전환 후 |
|------|---------|
| 전역 변수 (`cartItems`, `isLoggedIn`) | Zustand 또는 Context API |
| `PRODUCTS` / `CAFE_MENU` 상수 배열 | Supabase DB → Server Component fetch |
| localStorage 편집 데이터 | Supabase + 어드민 UI |

### 컴포넌트 분리

| 프로토타입 (인라인) | Next.js 컴포넌트 |
|-------------------|-----------------|
| 헤더 + 글래스모피즘 | `Header.tsx` + `useHeaderTheme()` 훅 |
| 카트 드로어 | `CartDrawer.tsx` + `useCart()` 훅 |
| 검색 시스템 | `SearchPanel.tsx` + `useSearch()` 훅 |
| 폼 검증 | `useFormValidation()` 훅 통합 |
| 상품 상세 | `ProductDetail.tsx` + 서브 컴포넌트 |

### CSS 토큰

현재 179개 CSS Custom Properties → Tailwind config 또는 CSS Modules로 이관.
디자인 토큰 시스템 유지 (MUI/Mantine 미사용 원칙).

---

## 15. 픽셀 이식 패턴 및 주의사항 (RP-3 Shop 경험 기록)

> Shop 페이지(RP-3) 이식 과정에서 발견된 패턴. 동일 구조인 카페 메뉴 페이지(RP-5) 및 이후 페이지 작업 시 참고.

---

### 15.1 `backdrop-filter` — inline style 주입 필수

CSS 클래스로 `backdrop-filter`를 설정하면 **부모에 `transition` 속성이 있을 경우 Chrome GPU compositor layer가 선점**되어 블러가 동작하지 않는다.

```tsx
// ❌ CSS 클래스 방식 → 블러 불발
// ✅ React inline style로 직접 주입
<div
  className="sp-qa-content"
  style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
>
```

부모(카드 썸네일)에서 `overflow: hidden` 제거도 필수 — backdrop-filter가 부모 overflow에 막히지 않도록 이미지 줌 클리핑은 별도 래퍼(`.sp-card-img-wrap`)에서 처리.

---

### 15.2 button-in-button 구조 — `<div role="button">`

확장 바(`.sp-qa-bar`) 안에 닫기 버튼(`.sp-qa-close`)이 함께 있어야 **바 확장 시 X 버튼이 자연스럽게 딸려 이동**하는 연출이 가능하다.

- `<button>` 안에 `<button>` → HTML 스펙 위반 (interactive content 중첩 금지)
- **해결:** 확장 바를 `<div role="button" tabIndex={0}>` 으로 변경 → 닫기 `<button>`을 내부에 배치

```tsx
<div className="sp-qa-bar" role="button" tabIndex={0} onClick={handleBarClick}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleBarClick(...); }}>
  <span className="sp-qa-bar-text">{text}</span>
  <button className="sp-qa-close" onClick={(e) => { e.stopPropagation(); close(); }}>
    <svg>...</svg>
  </button>
</div>
```

닫기 버튼 CSS는 `position: absolute; top:0; right:0` (바 기준) — 바가 `width: 124px → 100%`로 확장될 때 X 버튼이 우측 끝으로 슬라이드.

---

### 15.3 Quick Add 패널 열림/닫힘 연출

#### 열림 시퀀스
```
0ms    : 바 확장(124px→100%, duration-hover=200ms) + 블러 패널 페이드 인 + X 아이콘 등장
220ms  : 라벨 슬라이드 업 (translateY 6px→0)
290ms  : 볼륨 버튼 동시 등장 (translateY 4px→0)
```

#### 닫힘 클래스 패턴
프로토타입과 동일하게 `sp-card--qa-closing` React 상태로 구현:

```tsx
// closeQa()
setQaOpen(false);
setQaClosing(true);           // sp-card--qa-closing 클래스 추가
clearTimers();
closeTimerRef.current = setTimeout(() => setQaClosing(false), 250); // 바 수축 완료 후 제거
```

```css
.sp-card--qa-closing .sp-qa-bar {
  opacity: 1;
  transition: width var(--duration-hover) ease, opacity var(--duration-transition);
}
```

#### `display: none` → `opacity + pointer-events` 전환 필수
QA 콘텐츠 내부 요소(라벨, 버튼)에 개별 transition을 걸려면 부모가 `display: none`이면 안 된다. `position: absolute`이므로 레이아웃 영향 없이 전환 가능:

```css
/* ❌ display:none → 내부 요소 transition 불가 */
/* ✅ opacity + pointer-events */
.sp-qa-content { display: flex; opacity: 0; pointer-events: none; }
.sp-card--qa-open .sp-qa-content { opacity: 1; pointer-events: auto; }
```

---

### 15.4 hover bar 표시 — CSS hover 룰 금지

CSS `.sp-card:hover .sp-qa-bar { opacity: 1 }` 를 사용하면 **닫힌 직후 마우스가 카드 위에 있을 때 바가 즉시 재등장**하는 문제가 발생한다.

**프로토타입과 동일하게 JS 인라인 스타일(400ms 딜레이)만 사용:**

```tsx
// mouseenter → 400ms 딜레이 후 bar.style.opacity = '1'
// mouseleave → bar.style.opacity = ''  (CSS base opacity:0으로 페이드)
// openQa()  → bar.style.opacity = ''  (inline 초기화)
```

CSS에 `.sp-card:hover .sp-qa-bar` 룰을 두지 않는 것이 핵심.

---

### 15.5 필터 탭 인디케이터 — `isMounted` ref 패턴

초기 마운트 시 인디케이터가 슬라이드 없이 즉시 배치되어야 한다. `useEffect`가 최초 실행인지 탭 변경인지 구분하는 ref 필요:

```tsx
const isMounted = useRef(false);
useEffect(() => {
  if (!isMounted.current) {
    isMounted.current = true;
    positionIndicator(false); // 즉시 배치 (애니메이션 없음)
  } else {
    positionIndicator(true);  // 탭 변경 → 슬라이드
  }
}, [active]);
```

---

### 15.6 카드 재애니메이션 — React `key` 전략 + `isInitRef`

필터 전환 시 카드 목록이 재애니메이션되려면 React가 컴포넌트를 언마운트 후 재마운트해야 한다:

```tsx
// key에 필터값 포함 → 필터 변경 시 강제 언마운트
<ShopCard key={`${filter}-${product.slug}`} ... />
```

초기 로드와 필터 전환의 딜레이를 구분하기 위한 `isInitRef`:

```tsx
const isInitRef = useRef(true);
useEffect(() => { isInitRef.current = false; }, []);

// 초기 로드: baseDelay=420ms (탭/타이틀 등장 후 카드 진입)
// 필터 전환: baseDelay=0ms (즉시)
<ShopCard baseDelay={isInitRef.current ? 420 : 0} colIndex={i % 3} />
```

---

### 15.7 헤더 테마 fallback — `fallbackThemeRef`

페이지 진입 직후 스크롤 위치가 0이면 테마를 감지 못할 수 있다. `useHeaderTheme`의 fallback에 단순 `'dark'` 하드코딩 대신 ref 패턴 사용:

```ts
const fallbackThemeRef = useRef<HeaderTheme>(initialTheme);
useEffect(() => { fallbackThemeRef.current = initialTheme; }, [initialTheme]);
if (!theme) theme = fallbackThemeRef.current;
```

`headerThemeConfig.ts`에 라우트별 `initialTheme` 등록 필수.

---

### 15.8 스크롤 리빌 초기화 — `SRInitializer` pathname 의존

페이지 이동 시 `sr--visible` 클래스가 남아 있으면 푸터 등 새 페이지 요소가 이미 보인 것으로 간주되어 등장 애니메이션이 스킵된다.

`SRInitializer.tsx`의 `useEffect`를 `pathname` 의존성으로 걸어 매 라우트 이동마다 초기화:

```ts
useEffect(() => {
  document.querySelectorAll<HTMLElement>('[data-sr]').forEach((el) => {
    el.classList.remove('sr--visible');
  });
  // ... IntersectionObserver 재등록
}, [pathname]);
```

`footer.blk`에 `overflow: hidden`이 있으면 translateY 초기 상태가 클리핑되어 애니메이션 불발 → `overflow: visible` 필수.

---

### 15.9 카페 메뉴 페이지(RP-5) 적용 시 체크리스트

| 항목 | 상태 | 비고 |
|------|------|------|
| `backdrop-filter` inline style 주입 | — | 카드 내 블러 패널이 있을 경우 |
| `<div role="button">` 구조 | — | 내부에 인터랙티브 요소 포함 시 |
| CSS hover 룰 없이 JS inline만 사용 | — | bar/CTA 표시 제어 |
| 필터 탭 `isMounted` ref | — | `cm-filter-tab` 인디케이터 |
| 카드 key에 필터값 포함 | — | 필터 전환 시 재애니메이션 |
| `headerThemeConfig.ts` `/menu` 등록 | — | 라이트/다크 초기 테마 |
| `sp-card--qa-closing` 패턴 적용 | — | 메뉴 카드 CTA가 있을 경우 |
| `footer.blk { overflow: visible }` | ✅ | globals.css 이미 적용됨 |
| `SRInitializer` pathname 의존 | ✅ | 이미 적용됨 |
