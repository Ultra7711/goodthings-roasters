# DB 백업 운영 가이드 (Supabase 무료 티어)

> 작성: 2026-06-22 (S322) · 워크플로: `.github/workflows/db-backup.yml`
> 배경: Supabase 무료 티어는 관리형 자동 백업이 없음. 공식 권장(`db dump` + off-site)에 따라
> GitHub Actions 로 매일 logical dump 를 떠 **gpg(AES256) 암호화** 후 artifact 로 보관.

---

## 무엇을 하는가

- **매일 03:00 KST(18:00 UTC)** + 수동 실행 시 Supabase DB 를 덤프.
- 스키마(`schema.sql`) + 데이터(`data.sql`)를 tar 묶음 → **gpg AES256 암호화** → GitHub Actions **artifact** 로 업로드(보존 30일).
- 덤프엔 고객 PII·주문·결제 데이터가 포함되므로 **암호화 상태로만** 저장된다(평문은 잡 종료 전 삭제).

## 1회 설정 (사용자 작업 — 코드로 불가)

repo → **Settings → Secrets and variables → Actions → New repository secret** 에 2개 등록:

| Secret | 값 | 비고 |
|---|---|---|
| `SUPABASE_DB_URL` | Supabase 대시보드 → Project Settings → Database → Connection string → **Session pooler** 탭의 연결문자열(비밀번호 포함) | 무료 티어 Direct(IPv6)는 러너에서 연결 실패 가능 → **Session Pooler(IPv4)** 사용 |
| `BACKUP_GPG_PASSPHRASE` | 직접 정한 강한 패스프레이즈 | ⚠️ **분실 시 복호화 불가** — 비밀번호 관리자 등 안전한 곳에 별도 보관 |

## 첫 실행 검증 (필수)

> ⚠️ 이 워크플로는 로컬에서 검증되지 않았다(GitHub Actions 환경 전용). secret 등록 후 **반드시 1회 수동 실행**으로 동작을 확인할 것.

1. repo → **Actions → "DB Backup" → Run workflow**
2. 잡 로그에서 `schema.sql` / `data.sql` 파일 크기가 0 이 아닌지 확인(덤프 성공)
3. Artifacts 에 `gtr-db-YYYYMMDD-HHMMSS` 가 생성됐는지 확인
4. (권장) 아래 복원 절차로 **한 번 복호화/복원 리허설** — "복원되지 않는 백업"을 방지

## 복원 절차

```bash
# 1. artifact 다운로드 후 압축 해제 → gtr-db-...tar.gz.gpg

# 2. 복호화
gpg --batch --pinentry-mode loopback \
  --passphrase "<BACKUP_GPG_PASSPHRASE>" \
  --decrypt gtr-db-YYYYMMDD-HHMMSS.tar.gz.gpg > restore.tar.gz

# 3. 압축 해제
tar xzf restore.tar.gz   # → schema.sql, data.sql

# 4. 새(또는 대상) DB 에 복원 — 스키마 먼저, 데이터 다음
psql "<대상_DB_URL>" -f schema.sql
psql "<대상_DB_URL>" -f data.sql
```

## 복원 검증 자동화 (S341)

수동 리허설(위 §복원 절차)을 매번 하지 않도록 `.github/workflows/db-restore-verify.yml` 이
**매주 월 04:00 KST** 최신 백업을 격리된 **supabase local** 스택에 실제 복원해 검증한다.
- 실 DB 미접촉(runner 내 임시 스택·잡 종료 시 휘발). 추가 secret 불요(`BACKUP_GPG_PASSPHRASE` 공유).
- supabase local 사용 이유: 백업 schema 의 RLS 가 `auth.uid()` 등 시스템 스키마를 참조 →
  순수 postgres 복원은 정책 생성 실패. local 은 auth/storage/확장 제공.
- 검증: schema 복원(ON_ERROR_STOP) + data 로드 + public 테이블 수·핵심 테이블 존재.
- 실패 시 workflow fail → GitHub 알림 = "복원 안 되는 백업" 상시 감지.
- ⚠️ 첫 실행은 "Run workflow"(수동)로 검증·조정(CLI 플래그·테이블 임계 실측).

## 한계·주의

- ✅ **auth(회원 계정) 포함 — 실측 확인(S341)** — `db dump --data-only` 는 `auth.users`
  (이메일·비밀번호 해시·OAuth metadata) + `auth.identities` **데이터를 포함**한다. 복원 검증
  실측: auth.users 10·auth.identities 11·profiles 10 일치 → **회원 계정까지 복구 가능**
  (비밀번호 재설정 불요). 복원 시 `session_replication_role=replica` 로 FK 우회 로드(또는
  auth.users → public 순서). JWT secret 이 새 프로젝트와 다르면 기존 세션만 무효(재로그인·
  계정/비번 유효). ※ db dump 의 "managed schema 제외"는 스키마 DDL 한정이며 데이터는 포함.
- 🔶 **roles 미포함** — Supabase 관리형 role 은 덤프에서 제외(새 프로젝트 기본 제공이라 무관). RLS 정책은 스키마에 포함됨.
- artifact 보존 **30일** — 더 길게/off-site 보관이 필요하면 외부 스토리지 업로드 단계 추가 검토.
- 🔶 현재는 출시 전이라 실제 고객 데이터가 적음 — 본 백업은 **출시 대비 준비** 성격.
- CLI 플래그(`db dump --data-only` 등)는 표준 패턴이나 CLI 버전에 따라 조정이 필요할 수 있음 → 첫 실행 로그로 확인.
