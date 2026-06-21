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

## 한계·주의

- 🔶 **roles 미포함** — Supabase 관리형 role 은 덤프에서 제외(스키마+데이터로 새 프로젝트 복원에는 충분). RLS 정책은 스키마에 포함됨.
- artifact 보존 **30일** — 더 길게/off-site 보관이 필요하면 외부 스토리지 업로드 단계 추가 검토.
- 🔶 현재는 출시 전이라 실제 고객 데이터가 적음 — 본 백업은 **출시 대비 준비** 성격.
- CLI 플래그(`db dump --data-only` 등)는 표준 패턴이나 CLI 버전에 따라 조정이 필요할 수 있음 → 첫 실행 로그로 확인.
