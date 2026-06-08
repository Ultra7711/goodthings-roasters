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
| **DEC-R-auth** | 작성 자격 | **로그인 사용자 누구나** (구매 인증 불필요 → orders 연결 X) |
| **DEC-R2-policy** | 필터 정책 | **유저단 즉시 차단** (AI 미통과 = 게재 거부) + **어드민 사후 검토**(blocked↔approved 토글) |
| **DEC-R2-vendor** | AI vendor | **OpenAI Moderation API 무료 1차** (한국어 정확도 보통). 부족 시 Claude 정밀 하이브리드 — **잔여 확정 필요** |

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
- `reviews`: 본인 insert/update/soft-delete(`status='deleted'`) · `status='approved'` 전체 select · 어드민(owner) 전체
- `review_helpfuls`: 본인 insert/delete · count는 `reviews.helpful_count` 트리거 동기화 또는 집계
- 평균 별점/분포 = SSR snapshot RPC (`menuLikesServer` 'use cache' + cacheTag 패턴 답습 — 카드마다 평균 표시 N+1 회피)

---

## Phase 1 — 텍스트 리뷰 (20~40h · 5~10 sprint)

| Step | 작업 | 추정 | 재사용 |
|------|------|------|--------|
| **1. DB 마이그** | `069_user_reviews` (reviews + review_helpfuls + RLS + 평균/분포 집계 RPC + helpful_count 트리거) | 4~8h | menu_likes(025) RLS·집계 패턴 |
| **2. 별점 UI + 작성 폼** | 인터랙티브 별점(SVG 5개·hover/keyboard a11y) + 작성/수정 폼(`useAuthGuard`·Zod 1~2000자) + soft-delete | 4~8h | biz inquiry 폼·Zod·`useHistoryDismiss` |
| **3. 카드 리스트** | 리뷰 카드(별점·작성자 **마스킹**·날짜·본문·도움돼요·본인 수정/삭제) + **정렬**(최신/별점/도움순) + 페이지네이션 | 4~8h | menuLikesStore(도움돼요 optimistic)·newsletter 페이지네이션 |
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

- **Phase 1 (텍스트)**: 20~40h
- **Phase 2 (AI 필터)**: 8~16h
- **합계: 28~56h** (포토 제외) · sprint 환산 7~14 (1 sprint=4h)

## 회귀 검증 체크리스트 (구현 시)

- [ ] 본인만 자기 리뷰 수정/삭제 (RLS)
- [ ] 비로그인 = read-only (작성 차단)
- [ ] 별점 1~5 범위 외 거부 (Zod + DB check) · body 1~2000자
- [ ] 도움돼요 1인 1회 (review_helpfuls PK) · optimistic 롤백
- [ ] AI 실패 시 graceful → `pending` 큐 (유실 방지)
- [ ] 어드민 owner-only (staff 차단) · CSV PII 보호 + audit
- [ ] 평균★ 집계 카드 N+1 없음 (SSR snapshot)
- [ ] PDP + 바텀시트 양쪽 렌더 · 1440/1024/768/360
- [ ] tsc 0 + vitest pass

## 착수 전 잔여 결정

1. **DEC-R2-vendor 확정** — OpenAI Moderation 무료 단독 / Claude 정밀 추가 / Hybrid (권장: 무료 단독 1차, 운영 데이터 보고 정밀 추가)
2. 작성자 표기 마스킹 규칙 (예: `홍*동` / 닉네임 / 이메일 prefix)
3. 별점 분포 막대 포함 범위 (헤더만 / 정렬 필터까지)
