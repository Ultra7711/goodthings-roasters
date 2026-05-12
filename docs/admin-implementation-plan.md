# 어드민 풀 구현 계획 (Admin Implementation Plan)

> **작성일:** 2026-04-27 (Session 92)
> **최종 업데이트:** 2026-05-13 (Session 217 audit) — S210~S216 결과 반영. Group E/F **DB 전환 ✅ / Admin UI ⏸️** 두 축 분리. 잔여 작업 재산정.
> **상태:** DB 인프라 (046/047/048) 완료. **Admin UI 미구현** — 출시 가능 여부 = P0/P1 분류로 판단 (§0-1 참조).
> **결정 배경:** 클라이언트 운영 가능성 확보 — Supabase 대시보드 운영 정책 폐기, 직접 구현으로 전환.

---

> **마이그레이션 운영 워크플로우:** `supabase/migrations/README.md` 참조 (Supabase 대시보드 SQL Editor 직접 적용 · CLI 미사용 · 번호 충돌 방지 절차). S210 (2026-05-11) 에서 `034`·`035` 번호 충돌 2건 정리 (`041` · `043` 으로 rename) — production 영향 없음 (이미 적용 완료된 상태).

## 0. 현재 진행률 (S217 audit 기준 2026-05-13)

> Group E/F 는 **DB 전환** 과 **Admin UI 구현** 이 별개 작업. S211~S215 가 진행한 것은 DB 전환 (types + lib + seed + 의존 파일 마이그). Admin UI 페이지(`/admin/products`, `/admin/menu`)는 여전히 placeholder.

| Group | 추정 | DB 전환 | Admin UI | 비고 |
|-------|------|---------|----------|------|
| **A** 인프라 | 7~9h | — | ✅ 100% | `/admin/login` + (authed)/layout + Storage 버킷 + shadcn/ui |
| **B** 주문 | 5~8h | — | ✅ 80%+ | 목록·상세·발송 dialog. 환불·취소·CSV 외부 안내 |
| **C** 사용자 | 4~6h | — | ✅ 100% | 목록·상세·admin 승격·audit 자동 기록 |
| **D** 정기배송 | 4~6h | — | 🟡 60% | 목록 page.tsx 만 (S188 minimal). 상세 페이지 미구현. 강제 해지·일시중지·next_delivery_at 수동 조정 미완 |
| **E** 상품 | 20~29h | ✅ 100% (S211/S212) | ⏸️ **0%** | DB ✅ — types + productsServer.listProductsAdmin() 준비. UI 🔴 `/admin/products` = AdminPlaceholder · `/admin/products/new` = 시안 mock (실 저장 X · Storage 미연결) · `/admin/products/[id]/edit` 자체 없음 |
| **F** 카페 메뉴 | 12~17h | ✅ 100% (S213/S214) | ⏸️ **0%** | DB ✅ — types + cafeMenuServer.listCafeMenuAdmin() 준비. UI 🔴 `/admin/menu` = AdminPlaceholder · new/edit 페이지 자체 없음 |
| **G** 운영·문서 | 4~5h | — | ⏸️ 0% | SOP `docs/admin-operation-guide.md` 미작성 · E2E 미도입 |
| **H** 설정 | 7~11h | ✅ (032/034) | ✅ 100% | 공지·배송·시즌·서명 |
| **I** 통계 | 5~7h | ✅ (033) | ✅ 100% | 대시보드 + 매출 + 카페 좋아요 |
| **J** 굿데이즈 | 6~8h | ✅ (036) | ✅ 100% | 50장 seed + 드래그 리오더 |
| **K** cafe-events (plan 외) | — | ✅ (035) | ✅ 100% | S151 신규 — DB + Server Action + 4-bp 미리보기 |

**잔여 작업 (Admin UI 위주):**
- Group E (상품) Admin UI: 20~29h (DB 작업 8~12h 차감 — 이미 완료)
- Group F (카페 메뉴) Admin UI: 8~12h (DB 작업 4~5h 차감 — 이미 완료)
- Group D (정기배송) 상세 페이지: 2~3h
- Group G (운영·문서·E2E): 4~5h
- **합계 ≈ 34~49h**

### 0-1. P0/P1/P2 출시 차단 분류 (S217)

| 우선순위 | 기준 | 항목 |
|---------|------|------|
| **P0 출시 전 필수** | admin 부재 시 출시 직후 즉시 운영 차단 | 없음 (모든 데이터 SQL Editor 임시 대응 가능) |
| **P1 출시 직후 1주 내** | admin 없으면 1주 내 운영 부담 누적 | E-Admin (상품 등록·수정·이미지) · F-Admin (메뉴 등록·수정) |
| **P2 출시 후 V2** | 1~2개월 운영 가능 (코드 hot-patch / SQL editor 임시) | G (SOP·E2E) · D-2 정기배송 상세 · 상품 옵션 일괄 편집 등 |

> **출시 차단 평가 결과 (S217):** 카탈로그 6종(상품)·35개(메뉴) 변경 빈도가 낮고, SQL Editor 로 가격·재고 임시 변경 가능 → **P0 = 없음.** 단 P1 admin UI 는 출시 후 1~2주 내 구축 필수. 자세한 sprint 분할: `memory/project_release_blocker_sprint.md` §S218~S221 참조.

---

## 1. 결정 사항 요약

| 항목 | 결정 |
|------|------|
| **어드민 범위** | 풀 어드민 — 주문·사용자·정기배송·상품·카페 메뉴·사이트 설정·통계·굿데이즈 갤러리 |
| **UI 라이브러리** | shadcn/ui 도입 확정 |
| **인증 라우트** | `/admin/login` 별도 (메인 `/login` 과 분리) |
| **출시 시점** | 정기배송 출시보다 먼저. 출시 전 운영 가능 상태 확보 |
| **admin 계정 운영** | 단일 계정 시작, 보안 강도 약하면 다계정 검토 |
| **디자인 일관성** | 메인 사이트와 무관 — 추후 개선 가능 |
| **이미지 업로드** | Supabase Storage |
| **아이콘** | lucide-react (이미 설치됨) |
| **어드민 디자인** | 표준 어드민 UI (shadcn/ui 기본 gray 테마) — 메인 사이트 디자인 시스템과 무관 |

### 1-1. UI 라이브러리 — shadcn/ui

- 풀 어드민 50~70h 작업 규모 → 약 30% 단축 기대 (35~50h)
- form / table / dialog / dropdown 등 표준 컴포넌트 확보
- Tailwind 기반 (메인 사이트와 같은 빌드 파이프라인)
- 메인 디자인 시스템과는 별도 — 어드민 전용 토큰·테마

### 1-2. 이미지 업로드 — Supabase Storage 채택

옵션 비교 (2026-04-27 검토):

| 옵션 | 비용 | 통합성 | 변환 | 채택 사유·기각 사유 |
|------|------|--------|------|---------------------|
| **Supabase Storage** | Free 1GB / Pro $25 100GB | ⭐⭐⭐⭐⭐ (이미 사용 중) | 내장 | ✅ 채택 — 인증·RLS 통합 |
| Vercel Blob | Free 1GB / Pro $20 5GB | ⭐⭐⭐⭐ | 별도 | 기각 — Supabase 탈피 의도 없음 |
| Cloudflare R2 | Free 10GB·egress 무제한 | ⭐⭐⭐ | $5/mo 별도 | 기각 — 1만 장 미만 규모 |
| AWS S3+CloudFront | Free 5GB | ⭐⭐ | 별도 | 기각 — 운영 복잡도 |
| UploadThing | Free 2GB | ⭐⭐⭐⭐ | 약함 | 기각 — 자체 인증 충돌 |
| Cloudinary | Free 25 credits | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 기각 — 변환 요구 단순 |

채택 근거:
- `is_admin()` RLS 헬퍼 (020 마이그레이션) 를 Storage 정책에 그대로 재사용
- 이미지 transform (resize/format/webp) 내장
- DB + Storage 백업 일원화
- 1만 장 돌파 시 R2 마이그레이션 옵션 보유

---

## 2. 작업 그룹

### 🔴 Group A — 어드민 인프라 (모든 작업의 전제)

| # | 작업 | 추정 |
|---|------|------|
| **A-1** | shadcn/ui 도입 — `npx shadcn init` + 기본 컴포넌트 (Button, Input, Table, Dialog, Form, Toast) | 1~2h |
| **A-2** | `app/admin/login/page.tsx` 신규 — Supabase auth + `is_admin()` 검증 후 진입 | 2h |
| **A-3** | `app/admin/layout.tsx` 신규 — RBAC 가드 + 사이드바 + 헤더 (회원가입 차단) | 2h |
| **A-4** | `lib/auth/adminAuth.ts` 점검·확장 — `requireAdmin` 가드 패턴이 layout 레벨에서 작동하도록 | 1h |
| **A-5** | `/admin/` 진입 시 admin role 로그인 안 되어 있으면 `/admin/login` 리다이렉트 | 30m |
| **A-6** | Supabase Storage 버킷 신규 — `product-images`, `menu-images` (admin 전용 RLS 정책) | 1h |

→ **합계 7~9h**

### 🟠 Group B — 주문 어드민 (출시 직후 가장 시급한 운영 작업)

| # | 작업 | 추정 |
|---|------|------|
| **B-1** | `/admin/orders` — 주문 목록 (상태·날짜·검색 필터, 페이지네이션) | 2~3h |
| **B-2** | `/admin/orders/[orderNumber]` — 주문 상세 (배송 정보·결제 정보·아이템) | 1~2h |
| **B-3** | 발송 처리 UI — 기존 `/api/admin/orders/[orderNumber]/ship` API 호출 (송장번호 입력 + 상태 변경) | 1~2h |
| **B-4** | 주문 취소·환불 안내 (Toss 콘솔 링크 + 환불 처리 절차 노트) | 1h |

→ **합계 5~8h**

### 🟡 Group C — 사용자 어드민

| # | 작업 | 추정 |
|---|------|------|
| **C-1** | `/admin/users` — 사용자 목록 (이메일·가입일·역할·상태) | 2h |
| **C-2** | `/admin/users/[id]` — 사용자 상세 (주문 내역·정기배송·주소) | 2h |
| **C-3** | admin 승격·강등 UI — `admin_audit` 테이블 자동 기록 (020 마이그레이션 활용) | 1~2h |
| **C-4** | (보류) 단일 계정 운영 시 C-3 보류 — SQL 수동 승격 유지 | — |

→ **합계 4~6h** (C-3 포함 시)

### 🟢 Group D — 정기배송 어드민 (정기배송 풀 구현과 함께)

> 본 그룹은 `docs/subscription-full-implementation-plan.md` Group F 와 통합. 정기배송 출시 직전 진행.

| # | 작업 | 추정 |
|---|------|------|
| **D-1** | `/admin/subscriptions` — 목록 (사용자·상품·cycle·상태·다음 배송일) | 2~3h |
| **D-2** | `/admin/subscriptions/[id]` — 상세·강제 해지·일시중지·다음 배송일 수동 조정 | 2~3h |
| **D-3** | (Phase 3) 자동 결제 실패 모니터링 대시보드 | 출시 후 |

→ **합계 4~6h**

### 🔵 Group E — 상품 도메인 어드민 (거대 작업) — 🔴 출시 전 처리 확정 (S209)

> **현재 상품은 `next/src/lib/products.ts` (339줄, S209 기준) 하드코딩.** DB 마이그레이션 + 데이터 이관 + fetch 전환이 어드민 UI 구현보다 큼.
> **S209 audit:** 의존 파일 **44개** (상품 + 카페 메뉴 합산). E-4 fetch 전환 범위 §6-3 참조.

| # | 작업 | 추정 |
|---|------|------|
| **E-1** | DB 마이그레이션 신규 — `products`, `product_volumes`, `product_recipes`, `product_images`, `flavor_notes` | 3~4h |
| **E-2** | RLS 정책 — admin 전체 권한, 사용자 read-only | 1h |
| **E-3** | 데이터 이관 — `lib/products.ts` 의 PRODUCTS 배열 → DB seed (마이그레이션 또는 어드민 UI 통한 입력) | 2~3h |
| **E-4** | fetch 경로 전환 — `ShopPage`, `BeansScrollSection`, `[slug]/page.tsx`, `searchData.ts`, `cartService`, `orderService` 모두 DB fetch 로 | 4~6h |
| **E-5** | `/admin/products` — 목록 (카테고리·상태·재고 필터) | 2~3h |
| **E-6** | `/admin/products/new` + `[id]/edit` — 등록·수정 폼 (다용량·플레이버 노트·레시피·이미지 업로드) | 4~6h |
| **E-7** | 이미지 업로드 — Supabase Storage 통합 (다중 업로드·미리보기·삭제) | 2~3h |
| **E-8** | 단위·통합 테스트 — 데이터 이관 정합성·fetch 흐름 | 2~3h |

→ **합계 20~29h** (shadcn/ui 도입 가정)

### 🟣 Group F — 카페 메뉴 도메인 어드민 — 🔴 출시 전 처리 확정 (S209)

> 상품과 동일 구조. `next/src/lib/cafeMenu.ts` (180줄, S209 기준) 하드코딩 → DB 전환.
> **S209 audit:** 메뉴 35개 (시그니처 8 + 브루잉 4 + 티 3 + 논커피 7 + 디저트 8 + 기타). 14개 필드. 의존 8곳 (`CafeMenuPage`, `CafeMenuCard`, `CafeMenuGrid`, `CafeNutritionSheet`, `CafeFilterTabs`, `MenuCardBadges`, `home/CafeMenuSection`, `search/SearchResultCard`). API `/api/menu-likes/[menuId]` 가 CAFE_MENU 배열로 id 검증 — DB 전환 시 함께 갱신 필요.

| # | 작업 | 추정 |
|---|------|------|
| **F-1** | DB 마이그레이션 — `cafe_menu_items`, `cafe_menu_categories`, `nutrition_facts` | 2~3h |
| **F-2** | RLS 정책 + 데이터 이관 | 1~2h |
| **F-3** | fetch 경로 전환 — `CafeMenuPage`, `CafeMenuGrid`, `CafeNutritionSheet`, `searchData` | 3~4h |
| **F-4** | `/admin/menu` — 목록·카테고리 관리 | 2h |
| **F-5** | `/admin/menu/new` + `[id]/edit` — 등록·수정 (영양 정보·이미지) | 3~4h |
| **F-6** | 이미지 업로드 통합 | 1~2h |

→ **합계 12~17h**

### ⚙️ Group H — 사이트 설정 어드민 (S124 신규)

> 공지 문구·시즌 배너·배송 정책 — 코드 배포 없이 운영 중 변경 가능하게.

| # | 작업 | 추정 |
|---|------|------|
| **H-1** | DB 마이그레이션 — `site_settings` (key/value) 테이블 + `season_banners` 테이블 | 1h |
| **H-2** | `/admin/settings` — 공지 문구 편집 (on/off 토글 + 텍스트 입력) | 1~2h |
| **H-3** | `/admin/settings` — 무료 배송 정책 (always_free / threshold / fixed · 금액 입력) | 1~2h |
| **H-4** | `/admin/settings` — 시즌 배너 (라벨·타이틀·문구·이미지 업로드 + on/off 토글) | 2~3h |
| **H-5** | 프론트엔드 연동 — 공지 바·시즌 배너·배송 계산을 DB fetch 로 전환 | 2~3h |

→ **합계 7~11h**

### 📊 Group I — 통계 어드민 (S124 신규)

| # | 작업 | 추정 |
|---|------|------|
| **I-1** | `/admin` 대시보드 — 기간별 매출·주문수·신규 사용자 요약 카드 | 2~3h |
| **I-2** | `/admin/analytics/sales` — 상품별 판매량·매출 테이블 (기간 필터·정렬) | 2~3h |
| **I-3** | `/admin/menu` 목록에 좋아요 수 컬럼 추가 (menu_likes 집계) | 1h |

→ **합계 5~7h**

### 🖼️ Group J — 굿데이즈 갤러리 어드민 (S124 신규)

| # | 작업 | 추정 |
|---|------|------|
| **J-1** | DB 마이그레이션 — `gooddays_gallery` 테이블 (url·alt·sort_order·is_active) + Storage 버킷 `gooddays-images` | 1h |
| **J-2** | 기존 50장 이미지 → DB seed 스크립트 | 1h |
| **J-3** | GoodDaysPage fetch → DB 전환 | 1~2h |
| **J-4** | `/admin/gooddays` — 이미지 목록·드래그 리오더·업로드·삭제 | 3~4h |

→ **합계 6~8h**

### 🔘 Group G — 운영·문서

| # | 작업 | 추정 |
|---|------|------|
| **G-1** | SOP 문서 — `docs/admin-operation-guide.md` (사업자용 운영 매뉴얼) | 2h |
| **G-2** | 어드민 E2E 테스트 — 주문 발송·상품 등록·이미지 업로드 핵심 플로우 | 2~3h |

→ **합계 4~5h**

---

## 3. 합계·진행 순서

### 3-1. 합계

| 그룹 | 추정 (shadcn/ui 도입) |
|------|----------------------|
| A 인프라 | 7~9h |
| B 주문 | 5~8h |
| C 사용자 | 4~6h |
| D 정기배송 | 4~6h |
| E 상품 | 20~29h |
| F 카페 메뉴 | 12~17h |
| G 운영·문서 | 4~5h |
| H 사이트 설정 *(S124 신규)* | 7~11h |
| I 통계 *(S124 신규)* | 5~7h |
| J 굿데이즈 갤러리 *(S124 신규)* | 6~8h |
| **합계** | **74~106h** |

### 3-2. 권장 진행 순서 (출시 전)

| 단계 | 범위 | 추정 | 산출 |
|------|------|------|------|
| **S-1** | A 그룹 (인프라) | 7~9h | `/admin/login` + layout + Storage 버킷 |
| **S-2** | B 그룹 (주문) | 5~8h | 주문 발송·취소 운영 가능 |
| **S-3** | C-1·C-2 (사용자 목록·상세) | 4h | 사용자 조회 가능 (C-3 승격은 후속) |
| **S-4** | E-1~E-4 (상품 DB 전환) | 9~13h | 하드코딩 → DB 전환 완료, fetch 정상 |
| **S-5** | E-5~E-8 (상품 어드민 UI + 이미지) | 11~16h | 상품 CRUD 완료 |
| **S-6** | F (카페 메뉴 풀 구현) | 12~17h | 메뉴 CRUD 완료 |
| **S-7** | 정기배송 풀 구현 (`subscription-full-implementation-plan.md` Group A·B·C·D) | 14~19h | 정기배송 사용자 흐름 완성 |
| **S-8** | D (정기배송 어드민) | 4~6h | 정기배송 운영 가능 |
| **S-9** | G (SOP·E2E) + 인수 검증 | 4~5h | 출시 가능 |

→ **출시 전 합계 약 70~97h. 1.5~2주 풀타임 작업.**

### 3-3. 출시 후 V2 (별도 계획)

- 자동 결제 (Toss 빌링키·스케줄러·재시도) — `subscription-full-implementation-plan.md` Group E
- 알림 메일 (Resend) — `subscription-full-implementation-plan.md` Group G
- 어드민 대시보드 통계 (LTV·해지율·매출)

---

## 4. 기술 결정 상세

### 4-1. 라우팅 구조

```
app/
  admin/
    login/
      page.tsx         # 별도 로그인 (메인 /login 과 분리)
    layout.tsx         # RBAC 가드 + 사이드바
    page.tsx           # 대시보드 (간단한 통계)
    orders/
      page.tsx         # 목록
      [orderNumber]/page.tsx
    users/
      page.tsx
      [id]/page.tsx
    products/
      page.tsx
      new/page.tsx
      [id]/edit/page.tsx
    menu/
      page.tsx
      new/page.tsx
      [id]/edit/page.tsx
    subscriptions/
      page.tsx
      [id]/page.tsx
```

### 4-2. 인증 흐름

- `/admin/login` 진입 → Supabase auth 로그인
- 로그인 성공 → `is_admin(user.id)` 검증
- admin 이면 `/admin` 리다이렉트, 아니면 403 + 자동 로그아웃
- `/admin/*` 모든 라우트 → `app/admin/layout.tsx` 에서 `requireAdmin` 가드
- 메인 사이트 `/login` 으로 admin 이 로그인하면 → 메인 사이트 정상 사용 가능 (admin 도 일반 사용자 권한 보유). 단 `/admin/*` 진입 시 `is_admin()` 추가 검증

### 4-3. Supabase Storage 버킷 구조

```
product-images/
  {product_slug}/
    main.webp
    detail-1.webp
    detail-2.webp
menu-images/
  {menu_slug}/
    main.webp
```

RLS 정책:
- INSERT/UPDATE/DELETE — `is_admin(auth.uid())` 만
- SELECT — public (이미지는 공개)

### 4-4. shadcn/ui 도입

```bash
cd next
npx shadcn@latest init
npx shadcn@latest add button input label table dialog dropdown-menu form toast
```

- 어드민 전용 — `app/admin/**/*` 에서만 사용
- 메인 사이트는 기존 디자인 시스템 유지
- 어드민 색상 토큰은 shadcn 기본 (회색 위주) 사용

---

## 5. 클라이언트 의사결정 필요 항목

S-1 진입 전·중에 확정 받을 사항:

1. **admin 계정 운영** — 단일 계정 시작 OK? 다계정 필요 시점·기준?
2. **상품 카테고리 확장** — 현재 `Coffee Bean` / `Drip Bag` 만. 향후 추가 카테고리 (굿즈·기프트셋 등) 계획?
3. **카페 메뉴 카테고리** — 현재 카테고리 구조 유지? 어드민에서 카테고리도 편집 가능해야 하는지?
4. **재고 관리 정밀도** — 단순 재고 수량? 또는 옵션별 (200g/500g/1kg) 개별 재고? 또는 품절 토글만?
5. **상품 이미지 정책** — 단일 메인 이미지? 또는 다중 갤러리?
6. **어드민 다국어** — 한국어만? 또는 영어·일본어 등?

---

## 6. 영향받는 기존 자산

### 6-1. 재사용 가능

- `020_profiles_role_rbac.sql` — `is_admin()` 헬퍼·`admin_audit` 테이블
- `next/src/lib/auth/adminAuth.ts` — `requireAdmin` / `getAdminClaims`
- `next/src/app/api/admin/me/route.ts` — admin 인증 확인
- `next/src/app/api/admin/orders/[orderNumber]/ship/route.ts` — 발송 처리 API

### 6-2. 도메인 전환 대상 (하드코딩 → DB)

- `next/src/lib/products.ts` (339줄 · S209) — Group E
- `next/src/lib/cafeMenu.ts` (180줄 · S209) — Group F

### 6-3. fetch 전환 영향 파일 (S209 audit — 총 44개)

**상품 (E-4 영향) — 약 36개:**
- 페이지: `app/(main)/shop/[slug]/page.tsx`
- 컴포넌트: `home/LineupSection.tsx`, `home/SignatureChapterView.tsx`, `home/CafeMenuSection.tsx`, `shop/ShopPage.tsx`, `shop/ShopCard.tsx`, `product/ProductDetailPage.tsx`, `product/ProductGallery.tsx`, `product/ProductRecipeGuide.tsx`, `product/ProductFlavorRadar.tsx`, `product/ProductRoastStage.tsx`, `product/DripBagSteps.tsx`, `product/ProductAccordions.tsx`, `product/PurchaseRow.tsx`, `order/OrderItemRow.tsx`, `auth/mypage/WelcomeCard.tsx`, `admin/subscriptions/SubscriptionsTableClient.tsx`, `admin/settings/SettingsForm.tsx`
- 훅: `hooks/useCart.ts`, `hooks/useProductPurchase.ts`
- 유틸/서비스: `lib/cart/mapRow.ts`, `lib/services/cartService.ts`, `lib/services/orderService.ts`, `lib/search/searchData.ts`, `lib/search/engine.ts`, `lib/search/types.ts`
- 테스트: `cartService.test.ts`, `orderService.test.ts`, `search/matcher.test.ts`, `search/engine.test.ts`

**카페 메뉴 (F-3 영향) — 약 8개:**
- 페이지·컴포넌트: `cafe/CafeMenuPage.tsx`, `cafe/CafeMenuCard.tsx`, `cafe/CafeMenuGrid.tsx`, `cafe/CafeNutritionSheet.tsx`, `cafe/CafeFilterTabs.tsx`, `cafe/MenuCardBadges.tsx`, `home/CafeMenuSection.tsx`, `search/SearchResultCard.tsx`
- 유틸: `lib/search/searchData.ts` (상품과 공유)
- API: `app/api/menu-likes/[menuId]/route.ts` — CAFE_MENU 배열로 id 검증

> **출시 차단 평가 (S209):** 가격 변경 / 신메뉴 추가 / 신상품 등록 시 코드 수정 + 재배포 필요. 3개월 이내 운영 시 누적 차단 — 출시 전 처리 확정.

---

## 7. 변경 이력

| 날짜 | 세션 | 변경 내용 |
|------|------|----------|
| 2026-04-27 | S92 | 초기 작성 — 정책 변경 (Supabase 대시보드 → 직접 구현) 반영 + 풀 어드민 작업 그룹 7개 + 출시 전 9단계 진행 순서 |
| 2026-05-02 | S124 | 신규 그룹 H·I·J 추가, Lucide 아이콘 확정 |
| 2026-05-11 | S209 | **현재 진행률 §0 신설.** Group A·B·C·D·H·I·J 완료 반영 (cafe-events 신규 등재 = Group K, S151). Group E `lib/products.ts` 라인 수 295 → 339 갱신, fetch 영향 파일 6개 → **36개** 확장 (S209 audit). Group F `lib/cafeMenu.ts` 180줄 명시, 의존 8곳 명시. Group E/F **출시 전 처리 확정** (사용자 결정 S209). DB 마이그레이션 028~045 추가 사실 §0 표에서 추적. |
| 2026-05-13 | S217 | **§0 표를 DB 전환 / Admin UI 두 열로 분리.** S210~S216 DB 전환 완료 결과 반영. Group E/F DB 전환 ✅ (046/047 + types + productsServer/cafeMenuServer + seed + 44 파일 마이그), Admin UI 는 여전히 placeholder/mock 상태 명시. Group D 진행률 95% → 60% 정정 (상세 페이지 미구현 발견). §0-1 P0/P1/P2 분류 신설 — 출시 차단 항목 0 평가 (P0 = 없음, P1 = E/F Admin UI). 잔여 작업 36~51h → **34~49h** 재산정 (DB 작업 12~17h 차감). |
