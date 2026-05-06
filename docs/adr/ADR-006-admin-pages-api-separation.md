# ADR-006 — Admin pages ↔ API 분리 (Server Action vs REST API)

- **Status:** Accepted
- **Date:** 2026-05-06
- **Session:** S166 — improve-codebase-architecture Candidate 7
- **Related:** ADR-003 §6 (dual channel 가드 분리)
- **Implementation:** `next/src/lib/admin/dispatch.ts` · `next/src/lib/admin/dispatchResponse.ts`

## Context

S128 B-3 에서 어드민 출고 전환 (`dispatch_order` RPC) 을 두 채널로 노출했다.

| 채널 | 용도 | 인증 |
|------|------|------|
| Server Action (`actions.ts:dispatchOrderAction`) | 어드민 UI (송장 다이얼로그) | `getAdminClaims()` (cookie session) |
| REST API (`POST /api/admin/orders/[orderNumber]/ship`) | 운영자 curl/스크립트 | `isAdminRequest()` (`x-admin-secret` 헤더) |

ADR-003 §6 가 dual channel 정당화 ("CI · curl · 운영 스크립트 전용" 과 "유저 세션 기반" 양쪽 모두 운영 단계 유지) 를 명시했지만, 비즈니스 로직 (Zod 검증 + RPC 호출 + 메일 fire-and-forget) 이 양쪽에 80% 동일하게 복제되어 있었다.

S166 Round 0 진단에서 추가로 확인된 drift:

1. **로직 중복** — actions.ts (122줄) ↔ route.ts (127줄) 의 비즈니스 부분이 거의 동일
2. **Supabase client 선택 비일관** — service_role (RPC) vs RLS 클라 선택 룰이 코드 주석에만 산발
3. **인증 가드 dual pattern** — `getAdminClaims()` (Server Action) ↔ `isAdminRequest()` (REST API)
4. **Result envelope 비일관** — Server Action `{ ok: true, ...payload } | { ok: false, error, detail? }` ↔ REST API `apiSuccess({ data })` / `apiError(code, { detail })`

향후 어드민 mutation (refund · restock · 상품 DB 전환 sprint) 추가 시 패턴 답습 기준이 부재했다.

## Decision

Admin 영역의 mutation 책임을 다음 5개 축으로 분리한다.

### 1. Dual channel 유지

- **Server Action** (`<page>/actions.ts`) = 어드민 UI 채널. `getAdminClaims()` 가드.
- **REST API** (`/api/admin/.../route.ts`) = 운영자 curl/스크립트/외부 통합 채널. `isAdminRequest()` (`x-admin-secret`) 가드.
- ADR-003 §6 재확인.

### 2. 비즈니스 로직 SoT

- 양쪽 채널이 호출하는 비즈니스 로직 = **`lib/admin/<domain>.ts`** 모듈.
- 모듈 책임: 입력 검증 (Zod) · DB 조회 · RPC 호출 · 외부 fire-and-forget (메일/큐).
- 모듈 비책임: 인증 · cache invalidation · HTTP envelope.

### 3. 인증 가드 위치

- **호출자 책임** — 비즈니스 모듈은 인증 결과를 받지도 않고 검증하지도 않는다.
- Server Action: `getAdminClaims()` → null 시 `unauthorized` Result 즉시 반환.
- REST API: `isAdminRequest(request)` → false 시 `apiError('unauthorized')` 즉시 반환.

### 4. Result 패턴

- 비즈니스 모듈 return 타입 = **domain Result**: `{ ok: true; data: S } | { ok: false; error: E; detail? }`.
- Server Action: domain Result 그대로 return (+ `unauthorized` union 추가 가능).
- REST API: 변환 helper (`<domain>ResultToApiResponse`) 로 `apiSuccess`/`apiError` envelope 변환.

### 5. Cache invalidation 책임

- **Server Action 만** `revalidatePath` / `revalidateTag` 호출.
- REST API 는 외부/자동 채널이므로 명시적 cache invalidation 안 함 (다음 RSC 요청 시 자연 갱신).
- 비즈니스 모듈은 cache 책임 없음.

## Consequences

### 긍정

- 비즈니스 로직 단일 SoT — 회귀 시 한 곳만 수정.
- 채널 의도 명시 — placeholder 5곳 (users / products / menu / subscriptions / gooddays) sprint 진입 시 패턴 답습 가능.
- 가드/envelope 의 책임 위치가 명확 — 새 admin mutation 도입 시 결정 부담 감소.

### 부정

- 비즈니스 모듈 + 변환 helper 라는 추가 abstraction 1단계.
- domain Result 와 REST envelope 가 다른 두 type 을 양 채널이 다루어야 함.

### 적용 범위 (S166)

- S166 Candidate 7 에서 `dispatchOrder` 만 적용. 호출처 2곳 정합 (Server Action + REST API).
- `settings/actions.ts` · `cafe-events/actions.ts` 는 호출처가 1곳 (UI Server Action 만) 이라 단일 채널. 본 ADR 패턴 적용 불필요.
- 향후 양쪽 채널 노출이 필요한 admin mutation 만 본 ADR 패턴 강제.

## Alternatives Considered

### (A) Server Action 단일화 — REST API 폐기

- 운영자 curl 시나리오를 별도 CLI tool 로 분리.
- 장점: 채널 단일화로 코드 단순.
- 단점: ADR-003 §6 결정 변경 (superseded). UI 다운/batch 시 backup 채널 상실. 외부 시스템 통합 (예: 배송사 webhook → ship 자동 호출) 시 추가 작업.
- **거부 이유**: 운영자 curl 사용 흔적 미확정 + ADR-003 §6 와의 충돌 회피.

### (B) REST API 단일화 — Server Action 폐기

- 모든 mutation `/api/admin/...` 으로 통일 + Server Component 가 fetch.
- 장점: 외부 시스템 통합 가능 / 표준 envelope.
- 단점: Server Actions 의 cookie 자동 + revalidate 직접 호출 이점 상실 / 마이그레이션 비용 큼.
- **거부 이유**: Next.js App Router 의 Server Action 패턴 이점 포기 비용이 큼.

### (D) Audit only — 코드 변경 없이 ADR 만 작성

- 향후 어드민 sprint 시 자연 정합.
- **거부 이유**: 80% 로직 중복이 잔존. 회귀 risk 누적.

## Implementation Notes

### dispatchOrder 적용 (S166 PR-1 · `be65cd1d`)

```text
lib/admin/dispatch.ts          (SoT)         — 검증 + RPC + 메일
lib/admin/dispatchResponse.ts  (변환 helper) — DispatchResult → REST envelope
actions.ts:dispatchOrderAction (호출자)      — 가드 + revalidate
route.ts:POST /ship            (호출자)      — 가드 + 변환
```

| 채널 | 가드 | 호출 | 후처리 |
|------|------|------|--------|
| Server Action | `getAdminClaims()` | `dispatchOrder(input)` | `revalidatePath` |
| REST API | `isAdminRequest()` | `dispatchOrder(input)` | `dispatchResultToApiResponse(result)` |

### 운영자 curl 폐기 결정 (carry-over)

`/api/admin/orders/.../ship` 의 운영자 사용 흔적을 운영팀과 확인한 뒤,
사용 빈도 0 이 확정되면 옵션 (A) 마이그레이션을 별 sprint 로 진입한다.
패턴 (helper 추출 완료) 가 구축되어 있어 마이그레이션 비용은 작다.
