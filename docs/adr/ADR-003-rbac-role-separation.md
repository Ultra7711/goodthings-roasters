# ADR-003 — RBAC 역할 분리 (admin / customer)

- **Status:** Accepted
- **Date:** 2026-04-17
- **Session:** Backend P2-F Session 13
- **Migration:** `supabase/migrations/020_profiles_role_rbac.sql`

## Context

Session 12 까지 인증은 "로그인 여부" 단일 축이었다. 어드민 UI 구축 · 민감 RPC 호출 등 **앱 레벨 역할 분리**가 필요해졌다. Supabase 는 JWT `role` claim 을 `authenticated`/`anon`/`service_role` 로 이미 점유하고 있어, 앱 역할과 충돌한다.

## Decision

앱 레벨 역할을 **`profiles.role` 컬럼 + `public.is_admin(uuid)` SECURITY DEFINER 헬퍼** 로 관리한다.

### 1. 저장소

- `profiles.role public.user_role not null default 'customer'`
- enum: `('customer', 'admin')` — CHECK + text 대신 enum 채택 (타입 안전·인덱스 효율)
- 부분 인덱스 `profiles_role_idx ... where role = 'admin'` — admin 목록 조회 최적화

### 2. 불변성 보호

- `prevent_profiles_role_change` 트리거: 클라이언트 `UPDATE profiles SET role = ...` 시도 차단
- 예외 플래그: `app.allow_role_change = 'true'` — `grant_admin` / `revoke_admin` RPC 내부에서만 set
- 동일 패턴: `profiles.email` 불변 트리거 (migration 001, ADR-001 §3)

### 3. 조회 헬퍼

- `public.is_admin(uid uuid) returns boolean`
- `STABLE`: 트랜잭션 내 결과 불변 → RLS 행별 재평가 방지
- `SECURITY DEFINER + search_path = public, pg_catalog`: 호출자가 `profiles_select_own` 통과 못해도 role 조회 가능
- RLS · 서버 가드 양쪽에서 동일 함수 호출 → 단일 소스

### 4. RPC (역할 변경)

- `grant_admin(target_id uuid, reason text) returns void`
- `revoke_admin(target_id uuid, reason text) returns void`
- 공통 가드:
  - `auth.uid()` null → `insufficient_privilege`
  - 호출자 본인 admin 이어야 함
  - self-grant / self-revoke 차단 (회사 정책: 최소 2인 admin 유지)
- 감사 로그: `admin_audit` 테이블 (actor_id · target_user_id · action · reason · created_at)

### 5. 부트스트랩 admin

- RPC 조건(호출자 admin) 을 만족하는 자가 DB 초기 상태에 없음
- Supabase 대시보드 SQL Editor 에서 `set_config('app.allow_role_change','true',true)` 로 플래그 우회 → 첫 admin 수동 UPDATE
- 프로덕션 배포 체크리스트 항목

### 6. 기존 `adminAuth.ts` 와 관계

`next/src/lib/auth/adminAuth.ts` 의 `isAdminRequest(request)` 는 `x-admin-secret` 헤더 기반 API 키 검증으로, CI · curl · 운영 스크립트 전용이다. 본 ADR 의 `isAdmin(userId)` 는 **실제 유저 세션 기반** 역할 확인이며 서로 용도가 다르다. 양쪽 모두 서비스 운영 단계에서 유지한다.

### 7. 서버 가드 (Next.js)

`next/src/lib/auth/getClaims.ts`:
- `isAdmin(userId): Promise<boolean>` — Route Handler / 서버 컴포넌트 공용
- `getAdminClaims(): Promise<AdminClaims | null>` — Route Handler 용 (null → 401/403 응답)
- `requireAdminOrRedirect(): Promise<AdminClaims>` — 서버 컴포넌트 용 (`/login` / `/` 리다이렉트)

## Alternatives Considered

### (A) Supabase JWT `role` claim 확장

```sql
-- custom claims 를 JWT 에 주입 (GoTrue hook)
```

**기각**: Supabase JWT `role` 은 PostgREST 권한 부여 용도 (`authenticated`/`anon`/`service_role`). 앱 역할과 섞으면 RLS 정책 `to <role>` 문법과 충돌. custom claims 주입 경로는 있으나 권장되지 않고, JWT 만료 전까지 역할 변경이 반영되지 않는 문제가 있음.

### (B) 별도 `user_roles (user_id, role)` join 테이블

**기각**: 현재 스코프에서 한 유저당 단일 역할만 필요. 다중 역할(예: `editor` + `analyst`) 요구 발생 시 migration 으로 전환 가능. YAGNI.

### (C) `raw_app_meta_data` JSON 필드 사용

**기각**: auth schema 조작 필요. SECURITY DEFINER 트리거로 수정 가능하지만 `profiles` 가 이미 앱-도메인 단일 소스로 확립되어 일관성 붕괴.

## Consequences

### 긍정

- RLS policy · 서버 가드 공통 함수 재사용
- 감사 로그 자동화
- 클라이언트 직접 승격 불가 (트리거 + 정책 이중 방어)
- enum 제약으로 오타 role 값 차단

### 부정 / 리스크

- 부트스트랩 admin 은 SQL 수동 실행 필요 (자동화 없음 — 프로덕션 런북 기록 필요)
- `is_admin()` 호출이 RLS policy 에 삽입되면 per-row evaluate 비용 발생 가능. `(select is_admin((select auth.uid())))` 서브쿼리 래핑 + STABLE 선언으로 per-statement 캐시 활용 — 하지만 정책별 벤치 검증 필요.
- self-grant 차단은 계정 1개만 admin 인 상태에서 강등 불가 → 수동 SQL 개입 필요.

## Follow-ups

- `admin_audit` 로그 조회용 admin UI 엔드포인트 (Session 14+)
- 어드민 UI 방향 결정 (Supabase 대시보드 vs 직접 구현)
- admin 역할 기반 RLS 확장: orders/payments 전체 조회, settlement 리포트 접근 등
