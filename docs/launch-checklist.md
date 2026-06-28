# 오픈 전 통합 체크리스트 (Launch Checklist)

> **이 문서가 출시 관련 일감의 SoT(Single Source of Truth)다.**
> 흩어져 있던 출시 전/후 태스크를 트리거별로 통합한 마스터 인덱스.
> 상세 절차는 각 항목의 **상세** 포인터 문서에 보존하고, 여기서는 트리거·순서·상태만 추적한다.
>
> **갱신 규칙 (차곡차곡 원칙):**
> - 새 출시 관련 일감이 생기면 흩어두지 말고 **이 문서의 해당 트리거 섹션에 추가**한다.
> - 항목 완료 시 상태를 `⬜→✅` 로 바꾸고, 완료 근거(커밋·세션) 한 줄을 남긴다.
> - 완전히 끝나 더 볼 필요 없는 묶음은 **§완료·아카이브** 섹션으로 내린다(삭제 금지).
>
> 작성: S341 (2026-06-28) · 통합 출처: `NEXT_SESSION.md` 대기 태스크 · `docs/upstash-setup.md` · `memory/project_toss_live_review_status.md` · `memory/project_social_login_go_live.md` · (아카이브) `project_release_blocker_sprint.md` OP-1~5 · `PROJECT_STATUS.md §3`

---

## 상태 범례

| 기호 | 의미 |
|------|------|
| ⬜ | 대기 |
| 🔄 | 진행 중 |
| ✅ | 완료 |
| 🔶 | **현재 상태 재확인 필요**(stale 문서 기반·단정 불가) |

## 트리거 범례

| 트리거 | 의미 |
|--------|------|
| **T0** | 외부 의존 없이 **지금** 가능 |
| **T1** | **토스 라이브 심사 통과** 시 (일반결제 + 빌링 **2건 각각** 심사 — 한쪽만 통과 시 다른 쪽 test 유지) |
| **T1-seq** | 토스 통과 **+ 정식 도메인 사이트 연결 후** (순서 의존) |
| **T1-live** | 라이브 전환 **직전~직후** (타이밍 민감) |
| **T2** | 출시 전 **운영자/비즈 결정** 작업 |
| **T3** | 출시 **직후** 보완 |

> 🔴 현재 기본 상태 = **토스 라이브 심사 진행 중**(S295~ · 예상 1~2개월 · 사용자 종료 알림 전까지 유지). 상세 [[project_toss_live_review_status]].

---

## T0 — 지금 가능 (외부 트리거 없음)

- [x] ✅ **042 RPC `set_default_billing_method` drop** (S341) — 코드 소비처 0(DEC-S336-PAY1) 확인 후 drop. 마이그 `109_drop_set_default_billing_method.sql` + billingService 헤더 주석 정리. ⚠️ **사용자: Supabase SQL Editor에서 109 적용 필요**.
- [ ] ⬜ **재등록 시 옛 빌링키 soft delete (빌링 정책)** — S341 조사: `issueBillingMethod`(`billingService.ts:174`)는 새 빌링키 INSERT만·옛것 `deleted_at=null` 잔존·새것 `is_default=false`(기존 있을 시). 결제수단 단일 모델(DEC-S336-PAY1)과 불일치. **단순 정리 아님 — reattach(S339)·자동결제 재개와 정합 필요. ADR-008 §0 선행 로드 후 정책 결정.** 토스 v2 빌링키 삭제 API 없음→DB soft delete만.
  상세: [[feedback_billing_decisions_adr_living_sot]] · `docs/adr/ADR-008` §0
- [ ] ⬜ **(선택) Upstash Cron ping 라우트 선구현**
  `/api/cron/redis-ping` — DB 1주 비활성 삭제 예방(DEC-S323-A). 라이브 직전 구현 권장이나 미리 짜둘 수 있음. ~40줄.
  상세: `docs/upstash-setup.md §8`

---

## T1 — 토스 라이브 심사 통과 시

- [ ] ⬜ **라이브 키 교체 (2건)** — 일반결제 키 + 빌링 키 각각 `test_*`→`live/prod_*`.
  Vercel env **Production+Preview+Development 모두** + `.env.local`. 한쪽만 통과 시 다른 쪽 test 유지.
  상세: [[project_production_toss_key_migration]](S91 사고 반영 매뉴얼) · [[project_toss_live_review_status]]
- [ ] ⬜ **테스트 결제·구독 데이터 일괄 삭제** — `docs/ops/cleanup-test-billing-data.sql`(Supabase SQL Editor·비가역).
  보존: billing_methods(빌링키)·회원·주소. 트리거=통과 **후**.
  상세: `NEXT_SESSION.md` 대기 태스크 #1 · [[project_session340_complete]]
- [ ] ⬜ **도메인 전환** — `goodthingsroasters.com`(정식·하이픈X) Vercel 추가+DNS → `NEXT_PUBLIC_APP_URL` 교체(임시 하이픈→정식·3환경) → 재배포.
  상세: [[project_toss_live_review_status]] §도메인 전환 체크리스트(DEC-S310-DOMAIN)
- [ ] ⬜ **GSC 등록** — 도메인 속성 + DNS TXT 인증 + sitemap 제출 + Rich Results Test(Product·LocalBusiness·Organization). ⚠️ 임시 도메인으로 선등록 금지.
  상세: 동상
- [ ] ⬜ **PPTX 갱신 + 마이페이지 캡처** — S297 sprint(b_06c/d + 마이페이지 4장). 캡처=로컬 Windows(OS시계).
  상세: `scripts/payment-route-capture/` · `NEXT_SESSION.md` 대기 태스크 #3
- [ ] ⬜ **D-2 정기배송 본진행** — 실 빌링키 + cron 자동결제 실거래 검증.
  상세: [[feedback_billing_decisions_adr_living_sot]] · `docs/adr/ADR-008` §0

---

## T1-seq — 토스 통과 + 정식 도메인 연결 후 (순서 의존)

> ⚠️ 정식 도메인에 사이트가 올라가기 **전**엔 네이버 검수·구글 검증이 "검수원 접속 불가"로 반려 위험. 순서 절대 준수.
> **마스터 상세:** `docs/social-login-go-live-checklist.md` · [[project_social_login_go_live]]

- [ ] ⬜ **네이버** — ① 검수 신청→승인(영업일 며칠) ② 서비스 URL `localhost`→정식도메인 ③ 로고 업로드(`gtr-naver-app-logo-140.png`·생성완료). Callback 4개 등록 ✅.
- [ ] ⬜ **카카오** — Redirect URI + JS SDK 도메인에 정식 추가. (작동 중·이메일 미수집→검수 불필요 추정 🔶)
- [ ] ⬜ **구글** — Supabase Redirect URLs 정식 도메인(`/**`) + OAuth 동의화면 게시(Testing→Production). (기본 scope·검증 불필요 추정 🔶)

---

## T1-live — Upstash Redis (라이브 직전~직후 · 타이밍 민감)

> **마스터 상세:** `docs/upstash-setup.md` (무료티어 ToS 리서치·롤아웃 2단계·장애 대응 전부 수록).
> ⚠️ 무료 DB 1주 비활성 시 Upstash 삭제(ToS §I.5) → **연결은 실트래픽 시작 시점에** 맞추거나 Cron ping 동반.
> 현재: env 미설정 → **모든 rate limit 패스스루(OFF)**. 부팅 시 carding dry-run 경고 출력 중(`rateLimit.ts:67`).

- [ ] ⬜ **Step 0 — Marketplace 연결** — Vercel→Upstash 설치·DB 생성(리전 서울 근처). **카드 미등록 유지**(무료·깜짝청구 구조적 불가).
- [ ] ⬜ **Step 1 — env 주입 + 재배포** — `UPSTASH_REDIS_REST_URL`/`TOKEN` 자동 주입 확인. 이 시점 인증·주문·결제·PIN·탈퇴·카트 RL **전부 ON**, carding만 dry-run.
- [ ] ⬜ **Step 1 관측** — 24h 정상 사용자 429 오탐 없음 확인.
- [ ] ⬜ **Step 2 — carding 실차단** — Vercel env `CARDING_LIMIT_ENABLED=true` 추가+재배포. 부팅 경고 소멸 = 활성 확정.
- [ ] ⬜ **Cron ping** — DB 1주 삭제 방지(T0에서 선구현 가능).
- [ ] ⬜ **Usage 모니터링** — Upstash 콘솔 월 command(500K 무료한도) 추이.

---

## T2 — 출시 전 운영자/비즈 결정

- [ ] ⬜ **상품 카탈로그 데이터 입력** — 원두 6종 + 옵션·레시피·이미지 (운영자 작업).
- [ ] ⬜ **카페 메뉴 데이터 입력** — 메뉴 항목 + 가격 + 이미지 (운영자 작업).
- [ ] ⬜ **시그니처 챕터 콘텐츠 입력** — HTML 1종 + 이미지 3종.
- [ ] ⬜ **정기배송 할인율 확정** — 현재 UI는 0% 가정 작동. 비즈 결정.
- [ ] ⬜ **정기배송 주기 옵션 확정** — 현재 2·4·8주 임시.
- [ ] 🔶 **Supabase 운영 DB 분리** — S341 audit: 코드 구조는 **env 교체만으로 분리 가능**(하드코딩 0·`NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` 기반). **현재 로컬·Vercel이 동일 Supabase 프로젝트 사용(미분리)** 확인. → 출시 시 prod 전용 프로젝트 생성+env 교체 결정(비즈/운영). 코드 작업 0.
- [x] ✅ **보안 점검 — 토스 응답 로그/저장 마스킹** (S341 audit+fix) — 일반결제(paymentService)는 C-3 마스킹 정상. **빌링(billingService)에서 카드정보 평문 저장 결함 발견→수정**(chargeFirstCycle·chargeRecurringCycle 2곳 `maskTossPayload` 적용·PCI DSS 3.4). 커밋 예정.
- [ ] 🔶 **보안 점검 — RLS production 적용 확인** — S341 audit: 마이그 코드 **완비**(007/030/031/044 존재·민감테이블 service_role 격리·체계적). **production 실적용은 코드로 확인 불가**(SQL Editor 수동 워크플로). → Supabase SQL Editor에서 `SELECT polname, tablename FROM pg_policies WHERE schemaname='public' ORDER BY tablename;` 실행해 마이그와 대조. (저심각: reviews·newsletter_subscribers RLS 미확인)

---

## T3 — 출시 직후

- [ ] ⬜ **포인트 시스템 P5** — 라이브 임박 시 §17. 상세 [[project_points_system_backlog]].
- [ ] ⬜ **Supabase 자동 백업(Pro) 활성화 시점 결정** — `PROJECT_STATUS.md §5.1`.
- [ ] ⬜ **상품 신규 등록 폼 마무리 / 카페 메뉴 어드민 UI / 정기배송 상세** — 출시 후 1~2주.
- [ ] ⬜ **Header Server/Client 경계 재평가** — 출시 후 RUM(LCP·INP) 데이터 기반 (구 pre_production_checklist H6 보류분).

---

## 부록 A — 출처 문서 맵

| 영역 | 마스터/상세 문서 |
|------|------------------|
| 토스 라이브 심사 상태·도메인 | `memory/project_toss_live_review_status.md` |
| 키 교체 매뉴얼 | `memory/project_production_toss_key_migration.md` (S91) |
| Upstash·rate limit | `docs/upstash-setup.md` |
| 소셜 로그인 | `docs/social-login-go-live-checklist.md` |
| 빌링 정책 SoT | `docs/adr/ADR-008` §0 |
| 데이터 삭제 SQL | `docs/ops/cleanup-test-billing-data.sql` |
| 포인트 시스템 | `docs/points-implementation-plan.md` §17 · `memory/project_points_system_backlog.md` |

## 부록 B — 완료·아카이브 (참고용·재작업 불요)

- ✅ 코드 리뷰 출시 전 항목(H3~M8) — S51·S120 완료. 구 `project_pre_production_checklist.md`(아카이브).
- ✅ Group E/F DB 전환 + Admin UI sprint(S210~S221) — 후속 세션 완료. 구 `project_release_blocker_sprint.md`(아카이브). OP-1~5는 위 T1/T1-live 로 흡수.
- ✅ 자동결제 루프 R-1~R-3d + 약관 R-4 — S337~S340 완료·배포.
