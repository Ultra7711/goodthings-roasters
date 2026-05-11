# Supabase Migrations

> Good Things Roasters — DB 마이그레이션 파일 + 운영 워크플로우 가이드

## 운영 워크플로우 (중요)

본 프로젝트는 **Supabase 대시보드 SQL Editor 직접 실행** 방식으로 마이그레이션을 적용합니다. Supabase CLI 의 `supabase db push` 는 사용하지 않습니다.

### 신규 마이그 작성 절차

1. 본 디렉토리에 `NNN_description.sql` 파일 생성
   - 번호: 디렉토리 내 최대 번호 + 1 (또는 비어있는 번호 활용 — 아래 §번호 충돌 방지)
   - description: 변경 도메인 명시 (예: `046_products_schema.sql`)
2. 파일 헤더에 다음 정보 명시 (기존 040 / 045 패턴 답습):
   - 파일명 · 도입 목적 · 의존 마이그 · 보안 결정 · 참조 (ADR · memory)
3. SQL 본문 작성 — idempotent 권장 (`create table if not exists` / `add column if not exists`)
4. Git 커밋
5. **production 적용:** Supabase 대시보드 SQL Editor 에 SQL 복사·붙여넣기 후 실행 (사용자 액션)
6. 적용 후 검증 SQL 실행 (테이블 / 컬럼 / RPC 존재 여부 확인)
7. 메모리 / plan docs 에 적용 완료 표시

### 적용 검증 표준 SQL

```sql
-- 테이블 존재 확인
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema='public' AND table_name='<table_name>'
);

-- 컬럼 존재 확인
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema='public' AND table_name='<table>' AND column_name='<col>'
);

-- RPC 존재 확인
SELECT EXISTS (
  SELECT 1 FROM information_schema.routines
  WHERE routine_schema='public' AND routine_name='<rpc_name>'
);

-- RLS 정책 확인
SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='<table>';
```

## 번호 충돌 방지

- 매 커밋 전 `ls supabase/migrations/*.sql | sort` 로 마지막 번호 확인
- 동일 번호 두 파일 (예: `034_a.sql` + `034_b.sql`) **절대 금지** — 알파벳 순으로 SQL 실행되어 의도와 다른 결과 발생 가능
- 동일 sprint 내 다중 마이그 작성 시 연속 번호 (예: `046_a.sql` `047_b.sql`) 사용

### 번호 충돌 해결 (히스토리)

| 일자 | 원본 | 변경 후 | 사유 |
|------|------|---------|------|
| 2026-05-11 (S210) | `034_admin_dashboard_pending_exclude.sql` | `041_admin_dashboard_pending_exclude.sql` | `034_site_settings_signature.sql` 과 번호 충돌. production 적용 완료된 상태에서 local 파일명만 재정렬 |
| 2026-05-11 (S210) | `035_admin_orders_pending_exclude.sql` | `043_admin_orders_pending_exclude.sql` | `035_cafe_events.sql` 과 번호 충돌. production 적용 완료된 상태에서 local 파일명만 재정렬 |

## 비어있는 번호 (의도된 gap)

- **041 사용:** S210 에서 `034_admin_dashboard_pending_exclude.sql` 가 옮겨옴 (위 표 참조)
- **043 사용:** S210 에서 `035_admin_orders_pending_exclude.sql` 가 옮겨옴 (위 표 참조)
- **040 헤더 주석:** "041 — 기존 테스트 데이터 truncate (D-4)" 는 작성 안 됨 (적용 안 함). 041 번호는 S210 에서 위 파일로 사용
- **다음 번호:** `046` 부터 신규 사용 (S210 — Group E/F sprint 진입)

## 마이그 적용 누락 위험 방지

CLI 미사용 환경의 위험: 코드 push 후 production 적용을 잊어버릴 가능성.

**필수 절차:**
1. 마이그 작성 + git commit
2. **즉시** Supabase 대시보드 SQL Editor 에 적용
3. 검증 SQL 실행
4. 결과를 메모리 / sprint 완료 메모에 기록
5. 후속 코드 변경은 마이그 적용 검증 후에만 진행

## 헤더 템플릿

신규 마이그 작성 시 다음 헤더 표준 사용:

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- NNN_description.sql — 한 줄 요약 (Sprint 번호)
--
-- 목적:
--   본 마이그가 해결하는 문제 또는 도입하는 기능.
--
-- 변경 사항:
--   1) ...
--   2) ...
--
-- 보안 결정 (해당 시):
--   - RLS 정책 / service-role only / grant·revoke 등
--
-- 의존:
--   - NNN_xxx.sql (선행 마이그)
--
-- 후속:
--   - 후속 마이그 또는 코드 작업 명시
--
-- 참조:
--   - docs/adr/ADR-NNN.md
--   - memory/project_xxx.md
-- ═══════════════════════════════════════════════════════════════════════════
```

## 관련 문서

- `docs/admin-implementation-plan.md` — Group A~K 마이그 매핑
- `docs/subscription-full-implementation-plan.md` — Phase 3-A 040~045 매핑
- `memory/project_release_blocker_sprint.md` — S210~S216 Sprint 카탈로그
- `docs/adr/ADR-008-toss-billing-integration.md` — Phase 3-A 빌링 통합 설계
