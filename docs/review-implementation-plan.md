# 유저 리뷰 구현 계획 (텍스트 리뷰 + AI 필터링)

> **작성:** 2026-06-08 (S313) · **상태:** 결정 확정 · 착수 대기
> **출처:** `memory/project_reviews_filtering_carryover.md` (설계) + S313 결정 확정
> **범위:** 텍스트 리뷰(별점·본문·도움돼요·평균/분포) + AI 욕설 필터. **포토 리뷰 제외(Phase 3 보류).**

---

## 결정 잠금 (DEC — S313 확정)

| ID | 결정 | 값 |
|----|------|-----|
| **DEC-R1-UI** | 리뷰 UI 위치 | **상품 = PDP 내 섹션 / 메뉴 = 바텀시트(CafeNutritionSheet) 내부** (통합형) |
| **DEC-R1-photo** | 포토 리뷰 | **제외** (Phase 3 보류 — 도입 시 "어드민 승인제" 조건. Egress(월 5GB)·이미지 모더레이션 부담 때문) |
| **DEC-R-auth** | 작성 자격 | **상품 = 실 구매자만** / **카페 메뉴 = 회원 누구나** (S314 재검토 확정). 상품은 `order_items.product_slug` + `orders.status ∈ {paid, shipping, delivered}` 구매 이력을 RLS insert policy 의 `EXISTS` 로 DB 강제. 메뉴는 주문 데이터에 menu 가 없어 구매 검증 물리적 불가 → authenticated 만. (취소·환불 계열 제외) |
| **DEC-R2-policy** | 필터 정책 | **유저단 즉시 차단** (AI 미통과 = 게재 거부) + **어드민 사후 검토**(blocked↔approved 토글) |
| **DEC-R2-vendor** | AI vendor | ✅ **OpenAI Moderation 무료 단독** (S313 확정). 부족 시 운영 데이터 보고 Claude 추가 |
| **DEC-R-display** | 작성자 표시 | ✅ **닉네임** (S313 확정) — `profiles.nickname` 자동생성 + 마이페이지 편집. 실명 노출 0 |
| **DEC-R-meta** | 별점 요약 | ✅ **분포 막대 + 정렬**(최신/도움순/별점) (S313 확정) |

---

## DB 스키마 (예시 — `069_user_reviews.sql`)

```sql
-- 리뷰 본체
create table public.reviews (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users,
  product_slug text,                                   -- products 도메인
  menu_id      text references public.cafe_menu_items(id),  -- cafe 도메인 (id = text)
  rating       int2 not null check (rating between 1 and 5),
  body         text not null check (length(body) between 1 and 2000),
  status       text not null default 'approved'
                 check (status in ('pending','approved','blocked','deleted')),
  helpful_count int not null default 0,                -- 도움돼요 캐시 카운트
  moderation_result jsonb,                             -- AI 필터 결과 보존
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  -- 상품 XOR 메뉴 (정확히 하나)
  constraint reviews_target_xor check (
    (product_slug is not null and menu_id is null) or
    (product_slug is null and menu_id is not null)
  )
);

-- 도움돼요 (menu_likes 패턴 답습 — 중복 방지 PK)
create table public.review_helpfuls (
  review_id  uuid not null references public.reviews(id) on delete cascade,
  user_id    uuid not null references auth.users,
  created_at timestamptz default now(),
  primary key (review_id, user_id)
);

-- 인덱스: 도메인별 조회 + 정렬
create index reviews_product_idx on public.reviews(product_slug, created_at desc) where status='approved';
create index reviews_menu_idx    on public.reviews(menu_id, created_at desc)      where status='approved';
```

**RLS**
- `reviews` insert (DEC-R-auth · S314): 본인(`user_id = auth.uid()`) + 도메인별 분기
  - **메뉴**(`menu_id` not null): authenticated 면 누구나
  - **상품**(`product_slug` not null): 아래 구매 이력 `EXISTS` 강제 (server action 우회 차단)
    ```sql
    exists (
      select 1 from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where o.user_id = auth.uid()
        and oi.product_slug = reviews.product_slug
        and o.status in ('paid', 'shipping', 'delivered')
    )
    ```
- `reviews`: 본인 update/soft-delete(`status='deleted'`) · `status='approved'` 전체 select · 어드민(owner) 전체
- `review_helpfuls`: 본인 insert/delete · count는 `reviews.helpful_count` 트리거 동기화 또는 집계
- 평균 별점/분포 = SSR snapshot RPC (`menuLikesServer` 'use cache' + cacheTag 패턴 답습 — 카드마다 평균 표시 N+1 회피)

---

## Phase 1 — 텍스트 리뷰 (24~48h · 6~12 sprint)

> 작성자 = 닉네임(실명 노출 0). 닉네임 인프라가 **선행(Step 0)**.

| Step | 작업 | 추정 | 재사용 |
|------|------|------|--------|
| **0. 닉네임 인프라** | `profiles.nickname` 컬럼 + `handle_new_user` 자동생성(형용사+명사+숫자·중복 허용) + 기존회원 backfill + 마이페이지 프로필 편집 UI | 4~8h | handle_new_user(008)·마이페이지 폼 |
| **1. DB 마이그** | `069_user_reviews` (reviews + review_helpfuls + RLS + 평균/분포 집계 RPC + helpful_count 트리거) | 4~8h | menu_likes(025) RLS·집계 패턴 |
| **2. 별점 UI + 작성 폼** | 인터랙티브 별점(SVG 5개·hover/keyboard a11y) + 작성/수정 폼(`useAuthGuard`·Zod 1~2000자) + soft-delete. **상품: 미구매자 작성 차단**(버튼 비활성+안내·SSR 구매여부 prefetch) / **메뉴: 로그인만** | 4~8h | biz inquiry 폼·Zod·`useHistoryDismiss`·order_items 조회 |
| **3. 카드 리스트** | 리뷰 카드(별점·작성자 **닉네임**·날짜·본문·도움돼요·본인 수정/삭제) + **정렬**(최신/별점/도움순) + 페이지네이션 | 4~8h | menuLikesStore(도움돼요 optimistic)·newsletter 페이지네이션 |
| **4. 통합 + 메타** | PDP 하단 섹션 + 바텀시트 내부 영역 + **평균★+분포 막대**(헤더) + 상품/메뉴 **카드 평균★·리뷰수 메타** | 4~8h | ProductDetailPage·CafeNutritionSheet·menuLikesServer snapshot |
| **5. 어드민 모더레이션** | `/admin/reviews` 목록+필터(status/도메인)+상태 토글(approved↔blocked)+영구삭제+CSV+owner-only | 4~8h | biz/newsletter 어드민·AdminTabsNav·CSV |

---

## Phase 2 — AI 욕설 필터링 (8~16h · 2~4 sprint)

> 정책 = DEC-R2-policy(유저단 즉시 차단 + 어드민 사후). vendor = OpenAI Moderation 무료 1차.

| Step | 작업 | 추정 |
|------|------|------|
| **1. moderation 서버** | `lib/admin/reviewModeration.ts` — Moderation API 호출 → 정책 적용 → `moderation_result` 보존 + audit | 4~8h |
| **2. 작성 흐름 통합 + 검토 큐** | 작성 server action 안에서 호출 → **미통과=게재 거부(blocked)** / 통과=approved. 어드민 `/admin/reviews`에 "검토 큐"(pending) + "차단됨"(blocked) 탭 → 수동 승인/거부 | 4~8h |

**graceful**: AI 호출 실패 시 throw 말고 `status='pending'`(어드민 큐)로 — 정상 리뷰 유실 방지.
**환경변수**: `OPENAI_API_KEY` (무료 Moderation도 키 필요). (옵션) `ANTHROPIC_API_KEY` Claude 정밀 시.

---

## Phase 3 — 포토 리뷰 (보류)

도입 시 조건: **어드민 승인 후 게재**(즉시 노출 X·부적절 이미지 차단). webp+해상도 cap(`clientImageProcessing.ts`)·장수 2장. 용량/egress 추이를 텍스트 출시 후 실데이터로 판단. 필요 시 사진만 Cloudinary 무료(25GB)·Vercel Blob 분리.

---

## 리뷰 유도책 (S314 검토 — 기획 보강)

> **배경:** 상품 = 실 구매자만(DEC-R-auth) 으로 모수가 좁아져 구매자를 리뷰로 다시 끌어오는 유도책이 핵심. GTR 에 적립금/쿠폰 시스템 부재(전용 테이블 없음 · orders.discount 컬럼만) 확인.

### 비금전 유도책 — Phase 1 과 함께 (금전비용 0 · 기존 인프라 재사용) ✅ 채택

| # | 유도책 | 재사용 자산 | 추정 |
|---|--------|-------------|------|
| 1 | **마이페이지 "작성 가능한 리뷰" 섹션** — 배송완료(delivered) 구매 중 미작성 상품 목록 + CTA | order_items 조회 · OrderHistory | 2~4h |
| 2 | **주문내역 CTA 버튼** — 마이페이지 주문내역 배송완료 건에 "리뷰 쓰기" 인라인 | OrderHistory 컴포넌트 | 1~2h |
| 3 | **빈 상태 "첫 리뷰" 문구** — 리뷰 0건 상품/메뉴에 "첫 리뷰를 남겨주세요" | PDP/시트 빈 상태 | ~0.5h |
| 4 | **배송완료 이메일 CTA** — shippingNotificationEmail 에 "리뷰 남기기" 버튼 | Resend · 이메일 템플릿 | 1~2h |

→ Phase 1 Step 4(통합) 직후 또는 병행. 합계 +4.5~8.5h.

### 금전 보상(적립금/쿠폰) — Phase 4 별도 (토스 라이브 심사 후) ⏸ 보류

- **사유:** 적립금/쿠폰 = 결제·주문·정산에 깊게 관여하는 신규 시스템 + 토스 연동. 심사 중 결제 플로우 변경 리스크 → 통과 후 독립 sprint.
- **적립금 결제 메커니즘(설계 메모):**
  - 토스 결제 `amount` = 상품합계 − 검증된 적립금 사용분 (적립금은 PG 무관 · 내부 잔액 차감).
  - 금액 위변조 방어와 정합: 서버가 적립금 사용분 잔액 검증 후 `amount` 재계산(기존 orderService 재계산 레이어 확장).
  - 전액 적립금 결제(amount=0)는 토스 0원 결제 불가 → PG 우회 주문확정 분기 필요(014 settlement 주석 "전액쿠폰 결제" 신호 보존과 연계).
  - 리뷰 보상 = 작성 시 내부 적립금 잔액 증가(결제 무관) + 어뷰징 방어(중복·저품질 차단·승인 후 지급 등).
- **준비물(Phase 4 진입 시):** 별도 `docs/reward-system-plan.md` + ADR(적립금 회계 처리·전액결제 분기). 본 Phase 에서는 리뷰 보상 훅 지점만 표시.

---

## 재사용 인프라 매핑 (순수 신규 최소화)

| 리뷰 기능 | 재사용 자산 |
|-----------|-------------|
| 도움돼요 카운트 | `menuLikesStore` (optimistic + SSR snapshot) |
| 작성/수정/삭제·어드민 모더레이션 | biz inquiry CRUD + `/admin/biz` |
| 목록 페이지네이션/필터/CSV | newsletter·biz 어드민 |
| 평균/분포 집계(카드 N+1 회피) | `menuLikesServer` 'use cache' snapshot |
| 게스트/회원/owner 권한 | 기존 RLS 패턴 |
| 모달/시트 dismiss | `useHistoryDismiss` |
| **순수 신규** | 별점 UI(SVG), reviews/review_helpfuls 테이블, 분포 막대 |

---

## 추정 종합

- **Phase 1 (텍스트 + 닉네임 인프라 Step 0)**: 24~48h
- **Phase 2 (AI 필터)**: 8~16h
- **비금전 유도책 (1~4)**: 4.5~8.5h
- **합계: 36.5~72.5h** (포토·금전보상 제외) · sprint 환산 9~18 (1 sprint=4h)
- **금전 보상(적립금/쿠폰)**: Phase 4 별도 · 토스 심사 후 (미추정)

## 회귀 검증 체크리스트 (구현 시)

- [ ] 본인만 자기 리뷰 수정/삭제 (RLS)
- [ ] 비로그인 = read-only (작성 차단)
- [ ] **상품 = 실 구매자만** (미구매자 작성 차단 · RLS EXISTS · server action 우회 차단) / **메뉴 = 회원 누구나**
- [ ] 구매 판정 = paid/shipping/delivered (pending·cancelled·환불 계열 작성 차단)
- [ ] 별점 1~5 범위 외 거부 (Zod + DB check) · body 1~2000자
- [ ] 도움돼요 1인 1회 (review_helpfuls PK) · optimistic 롤백
- [ ] AI 실패 시 graceful → `pending` 큐 (유실 방지)
- [ ] 어드민 owner-only (staff 차단) · CSV PII 보호 + audit
- [ ] 평균★ 집계 카드 N+1 없음 (SSR snapshot)
- [ ] PDP + 바텀시트 양쪽 렌더 · 1440/1024/768/360
- [ ] tsc 0 + vitest pass

## 착수 전 결정 — 전부 확정 (S313 · S314)

- ✅ AI vendor = **OpenAI Moderation 무료 단독**
- ✅ 작성자 = **닉네임**(자동생성 + 마이페이지 편집 · 실명 노출 0)
- ✅ 별점 = **분포 막대 + 정렬**(최신/도움순/별점)
- ✅ 작성 자격(S314 재검토) = **상품 = 실 구매자만(RLS EXISTS 강제) / 메뉴 = 회원 누구나**. 구매 판정 = paid/shipping/delivered.

→ **미결 사항 없음.** 닉네임 인프라(Phase 1 Step 0) 선행 후 리뷰 본체 착수.
