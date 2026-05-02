# GTR — Design Audit V2 Input

> Claude Design 자문 1 (`design-audit-prompt.md`) 의 첨부 input.
> Claude Design 응답을 받기 전 사용자 (또는 어시스턴트) 가 마지막으로 점검하는 단일 자료.

---

## 1. 브랜드·톤 한 페이지 요약

**브랜드:** Good Things Roasters (굳띵즈)
**카테고리:** Specialty Coffee Roastery (소규모, 출시 전)
**현재 디자인 톤:** Warm-shifted Black & White, editorial, 잔잔한 여백, 한국어 본문 우선
**핵심 가치:** "느린 속도, 정확한 결과" — 화려함보다 침착함, 톤 다운된 럭셔리
**타깃 사용자:**
- 1차 — 30~40대 specialty coffee 애호가 (홈브루 익숙)
- 2차 — 선물·정기배송 신규 진입자
- 3차 — 카페 메뉴 호기심 사용자

**보이스:**
- 정중한 한국어 (~요/~습니다 체)
- 전문 용어는 한국어/영어 병기 (예: 산미 acidity)
- 광고 카피 톤 지양, 정보 위주
- 영문 표기 — 브랜드명/고유명사만 대문자, 나머지 sentence case

---

## 2. 페이지 인벤토리 (13)

| # | 페이지 | 라우트 | 목적 | 주요 요소 | 우선순위 |
|---|--------|--------|------|----------|---------|
| 1 | **메인** | `/` | 첫 인상·브랜드 톤 + 핵심 흐름 진입 | hero video · 시즌 배너 · 베스트 원두 스크롤 · 카페 메뉴 섹션 · 굿데이즈 · 스토리 발췌 · CTA | 🔴 최우선 |
| 2 | **샵 (목록)** | `/shop` | 원두/드립백 탐색 | 카테고리 탭 · 상품 그리드 · 좋아요 · 정렬 | 🟠 |
| 3 | **상품 상세** | `/shop/[slug]` | 구매 의사결정 | 이미지·플레이버 노트·레시피·아코디언·옵션·CTA | 🟠 |
| 4 | **카페 메뉴** | `/menu` | 음료/디저트 카테고리 탐색 + 영양정보 | 카테고리 필터 · 카드 그리드 · 좋아요 · 영양 시트 | 🟡 |
| 5 | **굿데이즈** | `/gooddays` | 갤러리 (브랜드 분위기) | 마조닉 그리드 · 라이트박스 | 🟡 |
| 6 | **스토리** | `/story` | 브랜드 서사 | 스크롤리텔링 · 텍스트 위주 | 🟡 |
| 7 | **카트** | `/cart` | 장바구니 검토 | 아이템·수량·합계·CTA | 🟠 |
| 8 | **체크아웃** | `/checkout` | 결제 진입 | 배송지·결제수단·약관·CTA | 🔴 (전환율) |
| 9 | **주문 완료** | `/order-complete` | 결제 후 confirmation | 주문번호·요약·후속 안내 | 🟢 |
| 10 | **로그인** | `/login` | 진입 | 이메일·OAuth (Naver/Kakao) | 🟢 |
| 11 | **마이페이지** | `/mypage` | 회원 콘솔 (주문·정기배송·프로필) | 아코디언 다수 (주문내역·정기배송·찜·주소·프로필) | 🔴 최우선 |
| 12 | **검색** | `/search` | 상품·메뉴 통합 검색 | 검색창 · 결과 그리드 · 4-layer 매칭 | 🟢 |
| 13 | **비즈니스 문의** | `/biz-inquiry` | B2B 문의 폼 | 폼 입력·드롭다운 | 🟢 |

**자문 1 집중 대상:** 메인 (1) + 마이페이지 (11). 나머지 11 개는 시스템 가이드 + UX 우선순위 리스트 + 컴포넌트 단위 개선안으로.

---

## 3. 핵심 컴포넌트 인벤토리

| 컴포넌트 | 위치 | 핵심 특징 | 알려진 이슈 |
|---------|------|----------|------------|
| **AnnouncementBar** | 전 페이지 상단 | 자동 합성 텍스트 (배송 정책 ↔ 합성) · on/off · 색상 테마 4종 | — |
| **SiteHeader** | 전 페이지 상단 | 글래스모피즘 (`backdrop-filter`) · 스크롤 위치 따른 dark↔light 동적 전환 | inline `style` 로만 backdrop-filter (Lightning CSS quirk) |
| **CartDrawer** | 전 페이지 우측 | 슬라이드인 드로어 · ESC/외부클릭 닫기 | useState race condition 처리 완료 |
| **ProductCard** | /shop · 메인 베스트 | 이미지·이름·플레이버 노트 chips·가격·좋아요 | bgTheme(dark/light) 컨텍스트 지원 |
| **CafeMenuCard** | /menu · 메인 카페섹션 | 음료 이미지·이름·가격·좋아요 | 좋아요 외부 store 격리 |
| **ProductAccordions** | /shop/[slug] | 상품 상세 정보 펼침 | 자동 합성 무료배송 안내 (S129) |
| **HeartButton** | 상품·메뉴 카드 | pill·glass·파티클 효과 (S101) | layout shift 방지 (S110) |
| **HeroVideo** | / | 풀 viewport 비디오 | 회귀 발생 잦음 (S103, S94) |
| **SeasonBanner** | / 카페섹션 | 어드민 편집 (S129) · 이미지+텍스트 | aspect-ratio 제거 (S102) |
| **GoodDaysLightbox** | /gooddays | yet-another-react-lightbox | 핀치 X 깜빡임 fix (S123) |
| **SearchPanel** | header · 전 페이지 오버레이 | 4-layer 매칭 (정규화→동의어→발음→초성) | divider has-panel 패턴 |
| **InputField** | 폼 전체 | 헬퍼·전화번호 자동 하이픈·Enter 네비 | — |
| **MyPageAccordion** | /mypage | 다중 아코디언 (주문·정기배송·찜·주소·프로필) | useState 11개 → 외부 store (S118) |
| **OAuth** (Naver/Kakao) | /login | 동의 화면 · 회원가입 자동 | Synthetic email 전략 |

**드로어·모달 패턴:**
- 우측 슬라이드인 (CartDrawer 표준)
- backdrop blur (inline style 강제, Lightning CSS quirk 회피)
- z-index — overlay 보다 panel +1

---

## 4. 디자인 토큰 (압축본)

### Color — Warm-shifted B&W

```
Background
  primary    #FBF8F3  cream
  secondary  #EFEAE0
  inverse    #1E1B16  warm black
  surface-warm   #EADFD1  sandy beige (Phil·시즌배너)
  surface-subtle #F5F1EA  마이페이지·체크아웃 패널

Text
  primary    #1C1B19  헤딩·CTA
  secondary  #4A4843  본문
  tertiary   #6B6863  보조
  caption    #9C9890  플레이스홀더
  inverse    #FAFAF8  on-dark

Accent (sparingly)
  gold-light       #A5693A
  gold-on-dark     #D9A36A
  gold-on-image    #F0C89C
  label-on-warm    #857052

Feedback
  error #C4554E  success #5C7A4B  info #4A6B8A  warning #B8943F
```

### Type — Pretendard / Inter

| Level | Size | Weight |
|-------|------|--------|
| Display | 48–64 | 300 |
| H1 | 36–40 | 300 |
| H2 | 28–32 | 400 |
| H3 | 20–24 | 500 |
| Body L | 17–18 | 400 |
| Body M | 15–16 | 400 |
| Body S | 13–14 | 400 |
| Label | 11–12 | 500–600 |

### Spacing (4px 기반)
`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 56 · 64 · 80 · 96 · 120`

### Breakpoints
| 구간 | px |
|------|----|
| 데스크탑 | 1440 (기준) |
| 랩탑 | 1024 |
| 태블릿 | 768 |
| 모바일 | 360 |

### 핵심 높이
| 요소 | Desktop | Mobile |
|------|---------|--------|
| 공지바 | 36 | 32 |
| 헤더 | 64 | 56 |
| 히어로 | 100vh | 100svh |
| 섹션 패딩 | 120 | 80 |

### 헤더 글래스모피즘
- 반투명 + `backdrop-filter` blur
- 스크롤 위치 따른 dark/light 동적 전환
- 활성 페이지 / 검색 패널 / SRP 별 분기

---

## 5. 알려진 UX 통점 (메모리 audit)

### 메인 (/)
- Hero video: 회귀 잦음 (S103, S94 멈춤 회귀)
- 시즌 배너: aspect-ratio 제거 (S102) — 비율 처리 결정 필요
- 모바일 그라데이션 버그 (S102 fix)
- 굿데이즈 백그라운드 cream flash (S122)
- 베스트 원두 스크롤: 카드 수 / 보이는 카드 수 처리

### 마이페이지 (/mypage)
- **진입 백지 시간** (S89 — UX 패치 A+B+C 적용했지만 근본 문제 잔존)
- **아코디언 회귀** (S117 — 진단·완화)
- **useState → store 마이그레이션** (S118) — 상태 관리 복잡
- 정기배송 변경 UI (S117)
- 좋아요 토스트 (S117)
- 주문 배송비 라벨 (S117)
- 정기배송 일시정지 UI (S113)
- 정기배송 아코디언 (3버튼·배송 건너뛰기·해지 모달, S99)
- **사용자 의견:** 정보 밀도가 높고 아코디언 다수 → 스캔 어려움

### 카트 (/cart)
- Race condition fix (S113)
- 진입 지연 (S82 BUG-150)

### 체크아웃 (/checkout)
- 주소 더미 (실서비스 시 Daum Postcode API 필요)
- 결제 위젯 실패 화면 CTA 디자인 후속
- 토스 결제창 "이전" 복귀 무한 대기 버그
- 카카오 OAuth 시 자동 로그인/회원가입 흐름

### 검색 (/search)
- 단일 음절 쿼리 오매칭 fix (CLAUDE.md 정책)
- 4-layer 매칭 (정규화→동의어→발음→초성)
- 검색 패널 라우트 전환 버그 fix (S112)

### 메뉴 (/menu)
- 좋아요 race condition (S114, S116)
- 메뉴 소팅 (S114)
- 카카오 맵 모바일 팝업 미동작 (🟡 우선 진단 대기, S123)

### 모바일 공통
- iOS Safari 푸터 flash (S82 fix)
- 더블탭/핀치 X 깜빡임 fix (S123)
- 드로어 전환 잔상 (S82 fix)
- Mobile body padding-top (S75)
- 모바일 탭 피드백 (S81 BUG-143)
- iOS overscroll 배경색 시스템 (project_overscroll_system)

### 헤더·네비
- BUG-130 cream flash specificity fix (S97)
- 스토리 white flash (S94 BUG-178)
- 동일 라우트 재클릭 시 진입 연출 (rules/web/lessons §8)

---

## 6. 벤치마크 (사용자 선호)

| 브랜드 | 선호 포인트 |
|--------|-----------|
| **Blue Bottle Coffee** (`bluebottlecoffee.com`) | 미니멀·여백·photography forward·sky blue accent · 사실 기반 톤 · scroll editorial · "less is more" 표본 |
| **Drop Coffee** (Stockholm, `dropcoffee.com`) | Scandinavian editorial · 서체 위주 · pastel + dim accent · 제품 정보 정연 |
| **Aesop** (`aesop.com`) | 텍스트 중심 럭셔리 · serif 사용 · 침묵 · 프로덕트 컨텍스트화 (참조용 — coffee 아니지만 톤 무드) |
| **MUJI** (`muji.com/jp` 또는 글로벌) | 무인 · 정보 정연 · 일본어 그리드 · 카테고리 전환 패턴 (B2C UX 참조) |
| **Apple** (`apple.com`, 톤만) | 스크롤리텔링 · 큰 타이포 · 여백 사용 (참조용 — 직접 모방 아님) |

**제외:** 한국 specialty coffee 브랜드 (사용자 선호로 제외 — 차별화 의도)
**적용 비율:** Blue Bottle ~ 50% · Drop Coffee ~ 30% · 기타 카테고리 ~ 20%

---

## 7. 제약 조건

### 기술
- Next.js 16 (App Router · cacheComponents · React 19 Activity)
- Tailwind v4 (Lightning CSS) + CSS Custom Properties
- Radix UI (headless)
- Pretendard / Inter
- Supabase Auth/DB/Storage
- 모바일 first 고려 (다만 데스크탑 기준 디자인)

### 운영·법적
- 한국어 우선 (영문 보조)
- 통신판매업 신고 정보 푸터 표기 의무
- 결제 토스페이먼츠 (위젯 + 카드/계좌이체)
- 정기배송 출시 전 (자동 결제는 V2)
- 카카오/네이버 OAuth (synthetic email 전략)

### 디자인
- 브랜드 톤 유지 — Warm-shifted B&W (큰 색조 변경 자제)
- Pretendard / Inter 유지 (사용자 명시 — Fraunces serif 폐기 S127)
- 어드민은 자문 대상 외 (별도 디자인 시스템)

### 사용자 명시 호불호
- ✅ 한국어 본문 자연스러움 (광고 카피 톤 지양)
- ✅ 정보 정연·정중한 보이스
- ✅ 미니멀 (Blue Bottle / Drop Coffee 톤)
- ❌ 화려한 그라데이션 / 네온 / 챗봇·인터럽티브 모달
- ❌ 한국 specialty coffee 직접 모방
- ❌ Fraunces serif (Pretendard 단일 통일)
