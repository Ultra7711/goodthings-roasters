# 어드민 풀 구현 계획 (Admin Implementation Plan)

> **작성일:** 2026-04-27 (Session 92)
> **최종 업데이트:** 2026-05-28 (Session 290) — **§9 출시 차단 + 후속 일감 통합 audit 신설** · 어드민 외 항목 (S-PND production launch + 리뷰 게시판 + 폴리싱 carry) 통합 SoT 확장.
> **상태:** Group A/B/C/E/F/H/I/J/K/L ✅ / Group D 부분 / Group G 미완 / Group M/N 어드민 미완 / Group O 리뷰 게시판 carry / Architecture deepening (ADR-009) ✅.
> **SoT 원칙:** 본 문서 = 어드민 + 출시 차단 + 후속 일감 통합 SoT. 디자인 reference = `docs/admin-design.md`. ADR = `docs/adr/ADR-009-*.md`. detail spec = `memory/project_admin_*.md` · `memory/project_pending_sprints.md` · `memory/project_reviews_filtering_carryover.md`.

---

## §1. 진행 상태 매트릭스 (S248 기준)

| Group | DB | Lib | Admin UI | Storage | 상태 |
|-------|----|----|---------|---------|------|
| A 인프라 | — | — | ✅ 100% | ✅ buckets | ✅ S92~ |
| B 주문 | — | ✅ ordersServer | ✅ 95% | — | ✅ — CSV ✅ S233 / 환불 carry-over |
| C 사용자 | — | ✅ usersServer | ✅ 100% | — | ✅ — 가입 채널 필터 ✅ S233 |
| D 정기배송 | — | ✅ subscriptionsServer | 🟡 70% | — | 🟡 — D-2 상세 페이지 carry-over · CSV ✅ S233 |
| **E 상품** | ✅ (046+050~052) | ✅ admin/productsServer | ✅ 100% | ✅ (S231/S232) | ✅ — S231 detail/option 마무리 + S232 Storage + create RPC + S245 정렬 + likes hydration |
| **F 카페 메뉴** | ✅ (047) | ✅ cafeMenuServer + admin variant | ✅ 100% | ✅ (S244 menu-images) | ✅ — S244 어드민 신설 + S245 sort_order + likes + 영양시트 |
| **G 운영·문서** | — | — | 🟡 50% | — | 🟡 — G-1 SOP ✅ (운영자용 S310 · `docs/operator-sop.md`) / G-2 E2E ✅ S308 / 개발자용 SOP carry |
| H 사이트 설정 | ✅ (032/034/062/063) | ✅ lib/admin/settings 분리 | ✅ 100% | ✅ | ✅ — signature iframe + SEO meta + S246 LQIP |
| I 통계 | ✅ (033) | ✅ analyticsServer | ✅ 100% (확장 S249+ carry) | — | ✅ — S249+ 강화 carry-over (DEC-S248-1) |
| J 굿데이즈 | ✅ (036) | — | ✅ 100% | ✅ | ✅ — S234 Phase 2 폴리싱 + GoodDays UI 전수 점검 |
| K cafe-events | ✅ (035+058~061+064) | ✅ lib/admin/cafeEvents 분리 (S235) | ✅ 100% | ✅ | ✅ — S235 iframe HTML 모델 + S237 signature 통합 + SEO meta |
| **L RBAC + audit** | ✅ (055~057) | ✅ auditServer | ✅ 100% | — | ✅ — S233 owner/staff 분리 + /admin/audit |
| **M 뉴스레터** | ✅ (065~066) | ✅ newsletter | 🟡 부분 (구독자 목록만) | — | 🟡 — Phase 1+2+3 + Phase 4 도메인 인증 ✅ (2026-05-26) · `/admin/newsletter` 구독자 목록 200건 표시 완료 · 페이지네이션/검색/필터/CSV/bulk send UI carry (S250-2) |
| **N 비즈 문의** | ✅ (067) | ✅ bizSubmit | 🟡 어드민 미완 | — | 🟡 — S243 폼 신설 (어드민 목록 carry) |
| **O 리뷰 게시판** | 📋 (미마이그) | 📋 (미구현) | 🟢 계획확정 | — | 🟢 **DEC 확정(S313)** · 실행계획 `docs/review-implementation-plan.md` · 포토 제외·텍스트+AI · 추정 28~56h · 착수 대기 |

**범례:** ✅ 완료 · 🟡 부분 · 🔴 미완 · ⏸️ 결정 대기

### 1-1. UI 통일성 (Group H · §5-23 칩 표준 · §7-3 hex)

| ID | 항목 | 상태 |
|---|---|---|
| H-1 ~ H-8 | 버튼/Input/Checkbox/행 클릭/SettingsCard/칩 표준 통일 | ✅ S228~S229 완료 |
| §7-3 Type 1 (#888 · #fff) | hex 직접 사용 정정 | ✅ S230 `981241d6` |
| §7-3 Type 2 (placeholder/info-border/sidebar-avatar) | 토큰 4종 신설 + 마이그 | ✅ S230 `981241d6` |
| §5-23 칩 표준 (`data-slot="chip-radio"`) | 6곳 일관화 | ✅ S229 `88754699` |
| GoodDays UI 전수 점검 (Featured → 추천 · 배지 · EditAltDialog · UploadDialog) | ✅ S234 Phase 2 |
| Helper 자연어화 + 보조용언 띄어쓰기 + window.confirm → ConfirmModal | ✅ S234 Phase 1 |

### 1-2. 구조 개선 (ADR-009 · DEC-8~27 + DEC-S248)

| DEC | 항목 | 상태 | 커밋/sprint |
|---|---|---|---|
| DEC-8 | AdminPageHeader (5 페이지) | ✅ | S227+S229 |
| DEC-9 | AdminPagination (3 페이지) | ✅ | S227 |
| DEC-10 | AdminDataTable (4 페이지) | ✅ | S227+S228 |
| DEC-11 | AdminTabsNav (3 페이지) | ✅ | S227 |
| DEC-12 | AdminBackLink (2 페이지) | ✅ | S227+S229 |
| DEC-13 | Topbar disabled+tooltip 정책 | ✅ | S230-4 |
| DEC-14 | AdminListMeta 폐기 (헤더 흡수) | ✅ | S227 |
| DEC-15 | lib/admin/errors.ts 단일 SoT | ✅ | S227 |
| DEC-16 | lib/admin/productsServer.ts 분리 | ✅ | S227 |
| DEC-17 | listHelpers (factory 폐기 · B안) | ✅ | S229 `afbb82f4` |
| DEC-18 | §5-23 칩 표준 | ✅ | S228 + S229 `88754699` |
| DEC-19 | 시즌 배너 폐기 (cafe-events 통합) | ✅ | S235 |
| DEC-20 | cafe-events 모델 진화 — overlay → iframe HTML → 자동화 | ✅ | S235 (058~061) |
| DEC-21 | sandbox iframe + placeholder 치환 (IMAGE_DESKTOP 4종) + aspect 자동 측정 | ✅ | S235 |
| DEC-22 | signature chapter iframe HTML 모델 (cafe-events 답습) | ✅ | S237 (062) |
| DEC-23 | SEO meta 통합 (signature + cafe-events) | ✅ | S237 (063) + S235 (064) |
| DEC-24 | RBAC owner/staff 분리 + admin_level | ✅ | S233 (055) |
| DEC-25 | admin_export_log audit 도메인 + /admin/audit 통합 페이지 | ✅ | S233 (056~057) |
| DEC-26 | CSV export — owner-only 가드 + audit 등록 (Subs/Orders/Audit) | ✅ | S233 |
| DEC-27 | 배너 LQIP base64 placeholder (마이그 068 + generateImageBlurAction) | ✅ | S246 |
| **DEC-S248-1** | **통계 강화 sprint — 출시 후 carry-over** (실데이터 누적 후 진입) | 📋 carry | S249+ |
| **DEC-S248-2** | **plan 갱신부터** (S248 단계 1) | ✅ | S248 |
| **DEC-S248-3** | **메인 노출 메뉴 어드민 — site_settings 저장 (B 옵션)** | ✅ | S248 단계 2 |
| **DEC-S248-4** | **Dropdown source = `cafe_menus` 전체 + ↑↓ reorder + 검색 + 중복 방지** | ✅ | S248 단계 2 |
| **DEC-S248-5** | **`cafe_menus.status='시그니처'` 마커 그대로 유지** (PDP/리스트 배지 + 정렬 가중 — 단일 책임) | ✅ 잠금 | S248 |
| **DEC-S248-6** | **`/menu` 페이지 정렬 — 기존 status 정렬 그대로** (메인 노출과 분리) | ✅ 잠금 | S248 |
| **DEC-S248-7** | **메인 노출 메뉴 사용자 시각 — 기본 카드 그대로** ("메인 추천" 배지 추가 X) | ✅ 잠금 | S248 |
| **DEC-S248-8** | **0 slot fallback — 기존 `status='시그니처' .slice(0,3)` 자동 fallback** (안전망) | ✅ | S248 단계 2 |

---

## §2. Sprint 카탈로그

### Sprint 진행 현황 (어드민 + 관련)

| Sprint | 범위 | 상태 | 추정 | 모델 |
|---|---|---|---|---|
| S218 | Group E Admin UI Phase 1 (목록+편집) | ✅ | 11~15h | Sonnet 4.6 |
| S227 | Architecture audit + 6 컴포넌트 추출 | ✅ | — | — |
| S228 | Phase 2 PR-A (테이블 4종 마이그) | ✅ | — | — |
| S229 | Phase 2 PR-B/C + 칩 표준 + DEC-17 listHelpers | ✅ | — | — |
| S230 | Phase 3 fix (§7-3 hex + 잔여 6 항목) | ✅ | — | — |
| S231 | ProductEditForm 3탭 마무리 (basic 재정비 + detail + option) | ✅ | — | — |
| S232 | S231-2/3/4/5 carry 일괄 + ProductEdit 폴리싱 (ConfirmModal · Storage 이미지 · sharp webp · create_product RPC · roast_desc prefill · 단계 변경 lock · 동적 행 reorder · 사이드바 polish · DYNAMIC_ROW 토큰) | ✅ | — | — |
| S233 (+ S233-fu) | Users 가입 채널 필터 + Subs/Orders/Audit CSV + RBAC owner/staff + 권한 단계 변경 + /admin/audit 통합 페이지 + 사이드바 폴리싱 | ✅ | — | — |
| S234 Phase 1+2 | Admin 폴리싱 sprint Phase 1 (helper 자연어화 · toast · 보조용언) + Phase 2 (GoodDays UI 전수 점검 · 추천 배지 · EditAltDialog · UploadDialog 정합) | ✅ | — | — |
| S235 | S234 Phase 3 마무리 + cafe-events 3단계 진화 (overlay → iframe HTML → 자동화 · 058~061 마이그) + lib/admin/cafeEventsServer 분리 | ✅ | — | — |
| S236 | S235 carry 옵션 A (sr-* hydration race) 진단 + 어드민 Toaster offset top=72 | ✅ | — | — |
| S237 | 시그니처 chapter iframe HTML 모델 전환 (cafe-events 답습 · 062 마이그) | ✅ | — | — |
| S238 | 외부 미팅용 프로젝트 현황 보고서 작성 (코드 0건) | ✅ | — | — |
| S239 | Banner conversion guide 단일 SoT 통합 | ✅ | — | — |
| S240 | 배너 4 BP 양 끝점 모델 + 폰트 토큰 Pretendard/Inter | ✅ | — | — |
| S241 | 배너 풀블리드 + StoryChapter + Newsletter Phase 1+2+3 부분 (도메인 인증 carry) | 🟡 부분 | — | — |
| S243 | 모바일 햄버거 + Wholesale/FAQ + 비즈니스 폼 (067 biz_inquiries) | 🟡 어드민 carry | — | — |
| S244 | **카페 메뉴 어드민 신설** (목록 + CRUD + 단일 이미지 업로드 · products 답습) + Vercel CPU 진단 | ✅ | — | — |
| S245 | 영양시트 + sort_order 자동 + 카드 정렬 + 컵 용량 + 카페인 매핑 + likes SSR hydration | ✅ | — | — |
| S246 | drawer 플래시 진단 + mypage 폴리싱 + 어드민 배너 LQIP (068 마이그) | ✅ | — | — |
| S247 | /menu 진입 속도 (priority + 클라이언트 분리) + cafe-menu 시각 폴리싱 + 영양시트 모바일 rubber-band fix | ✅ | — | — |
| **S248** | **plan 갱신 (단계 1) + 메인 노출 카페 메뉴 어드민 신설 (단계 2) + 통계 강화 carry-over (단계 3)** | ✅ | **4.5~7h** | Opus 4.7 + Sonnet 4.6 |
| **S249+** | **통계 강화 sprint** (carry-over · DEC-S248-1) — 후보 10종 + Quick Win + Domain Insight | 📋 carry | 14~22h (Quick) + 11~19h (Domain) | Sonnet 4.6 |
| **S250+** | **출시 차단 잔여 — D-2 정기배송 상세 + G-1 SOP + G-2 E2E + 뉴스레터/비즈 어드민** | 📋 | 18~28h | Sonnet 4.6 |
| **S260** | **최종 리뷰어 검토 sprint** (4 reviewer 일괄) | 📋 | 4~6h + 수정 | Opus 4.7 |
| **별** | improve-codebase-architecture 최종 (ADR-009 sweep) | 📋 P3 | 8~10h | Opus 4.7 |

### 2-1. S248 — plan 갱신 + 메인 노출 메뉴 어드민 + 통계 carry-over (4.5~7h · 진행 중)

📄 spec: `memory/NEXT_SESSION.md` (S248 진입) + 본 문서 변경 이력 §8

| 단계 | 항목 | 추정 | 비고 |
|---|---|---|---|
| **S248-1** | **plan 갱신** — §1 매트릭스 + §1-2 DEC-19~27 + §2 Sprint 카탈로그 S231~S247 + S248/S249+ 신설 + §3 우선순위 재정렬 + §4 결정 항목 + §6 합계 + §7 완료 기록 + §8 변경 이력 | 1~1.5h | DEC-S248-2 박음 |
| **S248-2** | **메인 노출 카페 메뉴 어드민 설정** | 3~6h | DEC-S248-3 ~ 8 적용 |
| S248-2a | 마이그 069 — `site_settings.value.home_featured_menu_ids` jsonb (0~3 개 · check constraint) | 0.3h | 062 signature 답습 |
| S248-2b | `lib/admin/homeFeatured.ts` + `homeFeaturedServer.ts` 분리 | 0.5~1h | DEC-15/16 답습 |
| S248-2c | `/admin/settings` 또는 `/admin/home-featured` 슬롯 UI (검색 dropdown + ↑↓ + 중복 방지) | 1.5~2.5h | DEC-S248-4 |
| S248-2d | Server Action `setHomeFeaturedAction` + audit log 등록 | 0.5~1h | DEC-25 답습 |
| S248-2e | `CafeMenuSection.tsx:32` fetch 교체 + 0 slot fallback (DEC-S248-8) | 0.5~1h | 기존 `status='시그니처' .slice(0,3)` 자동 fallback |
| **S248-3** | **통계 강화 carry-over 메모리 작성** — `memory/project_admin_analytics_carryover.md` | 0.5h | DEC-S248-1 박음 |

#### S248-2 메인 노출 메뉴 어드민 UI 사양 (DEC-S248-3 ~ 8)

| 요소 | 사양 |
|---|---|
| 저장 모델 | `site_settings.value.home_featured_menu_ids` jsonb 배열 (길이 0~3 · null 허용) |
| Dropdown source | `cafe_menus` 전체 (is_active=true · status 무관) |
| 옵션 row 표시 | `메뉴명 [카테고리 · status 배지]` |
| 검색 | 메뉴명 ilike (S229 listHelpers `applyIlikeSearch` 답습) |
| Reorder | ↑↓ 버튼 (S245 sort_order 동적 행 reorder 답습) |
| 중복 방지 | 다른 slot 선택된 메뉴는 disabled + "slot N 선택됨" 라벨 |
| 빈 slot 허용 | Yes (1~3 slot 가변) |
| 0 slot fallback (DEC-S248-8) | 모두 비었거나 미설정 시 기존 `status='시그니처' .slice(0,3)` 자동 fallback |
| 사용자 시각 처리 (DEC-S248-7) | 메인 페이지 기본 카드 그대로 — "메인 추천" 배지 등 차별 표시 X |
| `cafe_menus.status='시그니처'` (DEC-S248-5) | **변경 없음** — PDP/리스트 배지 + `/menu` 정렬 가중 용도 유지 (단일 책임) |
| `/menu` 정렬 (DEC-S248-6) | 기존 status 정렬 그대로 — 메인 노출과 분리 |

### 2-2. S249+ — 통계 강화 sprint (carry-over · DEC-S248-1)

📄 spec: `memory/project_admin_analytics_carryover.md` (S248 단계 3 에서 작성 예정)

**진입 조건:** 출시 후 실데이터 50건 이상 또는 운영 14일 이상 누적. Quick Win 묶음 우선.

**🥇 Quick Win 묶음 (14~22h)**
- J. Dashboard 위젯 추가 (어제 대비 / 주간 비교) — 2~4h
- B. 카테고리별 판매량 (Bean / Drip / Cafe) — 3~5h
- A. 매출 트렌드 그래프 (일/주/월) — 6~10h (recharts 1회 도입)
- I. Analytics CSV export — 2~4h (S233 csvExport 답습 + audit 등록)

**🥈 Domain Insight 묶음 (11~19h)**
- C. 정기배송 추이 (활성/일시정지/취소) — 6~10h
- F. 카페 메뉴 좋아요 분석 (top N + 트렌드) — 2~4h
- D. 신규 가입 추이 (signup_provider 별) — 3~5h

**🥉 Deep Analysis (별도 sprint)**
- E. 뉴스레터 추이 — 2~4h (도메인 인증 후)
- H. 코호트 분석 — 8~12h

**❌ 제외**
- G. 검색 쿼리 통계 — 로깅 인프라 부재. 별도 sprint 진입 시 사전 도메인 구축 필요.

### 2-3. S250+ — 출시 차단 잔여 sprint (18~28h)

| ID | 항목 | 추정 | spec |
|---|---|---|---|
| S250-1 | D-2 정기배송 상세 페이지 | 4~6h | `memory/project_admin_ui_followup.md` §D-2 |
| S250-2 | 뉴스레터 어드민 (구독자 목록 + 발송 이력) | 4~6h | `project_newsletter_carryover.md` Phase 4 |
| S250-3 | 비즈 문의 어드민 (목록 + 상세) | 3~5h | S243 carry |
| S250-4 | G-1 SOP 문서 — 운영자용 ✅ (S310 `docs/operator-sop.md`) · 개발자용 carry | 4~6h | DEC-G1 ✅ 운영자용 확정 |
| S250-5 | G-2 E2E 테스트 (critical user flow) | 6~10h | playwright |
| S250-6 | 어드민 페이지 폴리싱 (이전 §2-4 S233 폴리싱 carry — Phase 3 미실행 부분) | 2~4h | S234 Phase 3 잔여 (사이드바·인터랙션·a11y) |

### 2-4. S260 — 최종 리뷰어 검토 sprint (4~6h + 수정)

**범위:** S248~S250 완료 후, 출시 전 마지막 단계. 4 reviewer agent 일괄 호출 → 결과 메모리 저장 → CRITICAL/HIGH 수정.

| ID | 리뷰어 | 범위 | 산출 |
|---|---|---|---|
| S260-1 | **code-reviewer** | admin + 사이트 전수 — readability / pattern consistency / dead code | `memory/review_s260_general.md` |
| S260-2 | **security-reviewer** | auth / RLS / Server Action 권한 / PII 누출 / CSRF | `memory/review_s260_security.md` |
| S260-3 | **typescript-reviewer** | 타입 안정성 / any 잔존 / 제네릭 / discriminated union | `memory/review_s260_typescript.md` |
| S260-4 | **database-reviewer** | Supabase RLS 정합 / N+1 쿼리 / 인덱스 / 트랜잭션 | `memory/review_s260_database.md` |
| **S260-5** | 결과 통합 + CRITICAL/HIGH fix sprint | 별도 추정 (발견에 따라) | 메모리 + fix 커밋 |

**리뷰 트리거 시점:**
- S248~S250 완료 (출시 차단 코어 작업 끝)
- 최종 commit 미push 상태에서 실행

**리뷰 결과 분류 (`~/.claude/rules/common/code-review.md` 답습):**
- CRITICAL → **BLOCK** 출시. 즉시 fix.
- HIGH → **WARN**. 출시 전 fix 권장.
- MEDIUM → carry-over (별 sprint)
- LOW → 기록만

### 2-5. 별 sprint — improve-codebase-architecture 최종 (8~10h)

📄 spec: `memory/project_admin_ui_unification_plan.md` §Sprint 5

mattpocock `improve-codebase-architecture` + `zoom-out` skill 본격 적용. S227 ~ S260 결과 audit 후 최종 refactor. 출시 후 V2+ 진입.

---

## §3. 우선순위 분류 (출시 기준 · S248 갱신)

### 3-1. 출시 전 — P1 (필수 · 22.5~35h)

| 항목 | sprint | 추정 |
|---|---|---|
| ~~plan 갱신 + 메인 노출 메뉴 어드민 + 통계 carry-over~~ | ~~S248~~ | ✅ 완료 (4.5~7h 차감) |
| D-2 정기배송 상세 페이지 | S250-1 | 4~6h |
| 뉴스레터 어드민 (구독자 목록 + 발송 이력) | S250-2 | 4~6h |
| 비즈 문의 어드민 (목록 + 상세) | S250-3 | 3~5h |
| G-1 SOP 문서 (운영자용 ✅ S310 · 개발자용 carry) | S250-4 | 4~6h |
| G-2 E2E 테스트 (critical flow) | S250-5 | 6~10h |
| 어드민 페이지 폴리싱 (S234 Phase 3 carry) | S250-6 | 2~4h |
| 최종 리뷰어 검토 (4 reviewer + fix) | S260 | 4~6h + α |

### 3-2. 출시 후 1~2주 — P1 (carry-over)

| 항목 | spec |
|---|---|
| 뉴스레터 도메인 인증 + production 발송 활성 | `project_newsletter_carryover.md` |
| Newsletter Phase 4 발송 history UI | 동일 |
| 비즈 문의 첨부 파일 (S243-C) | S243 carry |

### 3-3. 출시 후 1개월 — P2 (14~22h)

| 항목 | sprint |
|---|---|
| 통계 강화 Quick Win (Dashboard 위젯 / 카테고리별 / 매출 트렌드 / Analytics CSV) | S249+ |

### 3-4. 출시 후 2~3개월 — P2 (11~19h)

| 항목 | sprint |
|---|---|
| 통계 강화 Domain Insight (정기배송 추이 / 카페 메뉴 좋아요 / 가입 추이) | S249+ |
| Users CSV (PII 정책 합의 후) | S232-4 carry |
| Products CSV | — |

### 3-5. 출시 후 V2+ — P3 (~24~30h)

| 항목 |
|---|
| 통계 강화 Deep Analysis (뉴스레터 / 코호트 / 검색 쿼리 로깅 인프라) |
| Users 구독상태 / 활성도 필터 (6개월 후 데이터 누적 후) |
| Excel export 옵션 |
| improve-codebase-architecture 최종 sweep |

---

## §4. 출시 전 결정 필요 항목

### 4-1. 마감된 결정 (참고용)

| ID | 항목 | 결정 | 시점 |
|---|---|---|---|
| ~~DEC-7~~ | products 이미지 업로드 정책 | ✅ **β Storage** 채택 + sharp webp 자동 변환 | S231/S232 완료 |
| ~~S230-3~~ | ProductEditForm shipping/seo 탭 | ✅ **β 제거** (3탭 축소) | S231 완료 |
| ~~DEC-export-4~~ | CSV PII 익명화 정책 | ✅ **평문 + owner-only 가드 + audit log** | S233 완료 |

### 4-2. 미확정 결정 (현재)

| ID | 항목 | 시점 | 옵션 |
|---|---|---|---|
| ~~DEC-G1~~ | SOP 문서 범위 | ✅ **운영자(사업자)용 확정** (S310) — `docs/operator-sop.md` 작성. 개발자용 SOP는 별도 carry | — |
| ~~DEC-newsletter-3~~ | 뉴스레터 도메인 인증 시점 | ✅ **완료 2026-05-26** — Google Workspace + Resend DKIM/SPF/DMARC 모두 PASS | `project_newsletter_phase4_complete.md` |
| **DEC-S249-1** | 차트 라이브러리 선택 | S249+ 진입 전 | CSS-only / **recharts (권장)** / nivo / Tremor |
| **DEC-S249-2** | Quick Win + Domain 묶음 동시 진입 vs 분리 | S249+ 진입 전 | 일괄 / Quick → 검증 → Domain |
| ~~DEC-R1-UI~~ | 리뷰 UI 위치 | ✅ **통합 확정 (S313)** — 상품 PDP 섹션 + 메뉴 바텀시트 내부 | `docs/review-implementation-plan.md` |
| ~~DEC-R2-policy~~ | AI 필터링 차단 정책 | ✅ **확정 (S313)** — 유저단 즉시 차단 + 어드민 사후 검토(blocked↔approved) | 〃 |
| ~~DEC-R2-vendor~~ | AI 필터링 옵션 | ✅ **OpenAI Moderation 무료 단독 (S313)** — 부족 시 운영 데이터 보고 Claude 추가 | `docs/review-implementation-plan.md` |
| ~~DEC-R-display~~ | 작성자 표시 | ✅ **닉네임 자동생성 (S313)** — profiles.nickname + 마이페이지 편집 (Phase 1 Step 0) | 〃 |
| ~~DEC-R-meta~~ | 별점 요약 | ✅ **분포 막대 + 정렬 (S313)** (최신/도움순/별점) | 〃 |
| ~~DEC-R1-photo~~ | 리뷰 사진 업로드 포함 여부 | ✅ **제외 확정 (S313)** — Phase 3 보류 (도입 시 어드민 승인제) | 〃 |
| ~~DEC-R-auth~~ | 작성 자격 | ✅ **확정 (S313)** — 로그인 누구나 (구매 인증 불필요) | 〃 |

---

## §5. carry-over spec link (memory/* 참조)

상세 spec 은 본 문서가 아닌 `memory/` 의 spec 파일 참조. 본 문서는 일감 추적 SoT.

| memory 파일 | 역할 |
|---|---|
| [project_admin_ui_unification_plan.md](../next/../memory/project_admin_ui_unification_plan.md) | UI 통일성 마스터 plan (S227~S231 sprint 카탈로그 + 12 사용자 지정 규칙) |
| [project_admin_ui_followup.md](../next/../memory/project_admin_ui_followup.md) | S217 미완 audit (Group E/F admin UI 일감 분해) |
| [project_admin_architecture_audit.md](../next/../memory/project_admin_architecture_audit.md) | S227 architecture audit (8 컴포넌트 + 3 lib candidate · LANGUAGE.md 답습) |
| [project_admin_product_new_replan.md](../next/../memory/project_admin_product_new_replan.md) | S231 products/new 재기획 spec (실 PDP 모델 + RHF) |
| [project_admin_users_filter_extension.md](../next/../memory/project_admin_users_filter_extension.md) | S232-1 Users 가입 채널 필터 spec |
| [project_admin_export_feature.md](../next/../memory/project_admin_export_feature.md) | S232-2/3 CSV export spec (Orders + Subscriptions) |
| [project_admin_cafe_menu_upload.md](../next/../memory/project_admin_cafe_menu_upload.md) | F-Admin-3 / Storage 통합 spec |
| [project_release_blocker_sprint.md](../next/../memory/project_release_blocker_sprint.md) | 출시 차단 sprint 카탈로그 (S210~S221) |
| [project_session{N}_complete.md](../next/../memory/) | 세션별 완료 스냅샷 (S227·S228·S229·...) |
| [NEXT_SESSION.md](../next/../memory/NEXT_SESSION.md) | 다음 세션 진입 prompt |

(상대 경로는 git tracked 가 아니므로 참고용. 실제 위치: `C:\Users\ideal\.claude\projects\C--Git-goodthings-roasters\memory\`)

---

## §6. 합계 추정 (S248 갱신)

| 단계 | 합계 | 비고 |
|---|---|---|
| 출시 전 P1 (S250 + S260) | **~19.5~29h** | 1주 풀타임 (S248 완료 차감) |
| 출시 후 1~2주 P1 | 도메인 인증·DEC-G1 합의 등 (시간 추정 ↓) | 뉴스레터 production + 비즈 첨부 |
| 출시 후 1개월 P2 (Quick Win) | ~14~22h | S249+ 통계 Quick Win 묶음 |
| 출시 후 2~3개월 P2 (Domain) | ~11~19h | S249+ 통계 Domain Insight 묶음 |
| 출시 후 V2+ P3 | ~24~30h | Deep Analysis + 필터 확장 + arch sweep |
| **전체 잔여** | **~68.5~100h** | 출시 전 풀타임 1주 + 출시 후 3~6개월 |

---

## §7. 완료 기록 (sprint 별)

### S227 — Architecture audit + 6 컴포넌트 추출 ✅

- mattpocock skill 본격 적용 (diagnose / improve-codebase-architecture / zoom-out)
- 6 공통 컴포넌트 추출 (AdminPageHeader/DataTable/Pagination/TabsNav/EmptyState/BackLink)
- lib/admin/errors.ts (DEC-15) + lib/admin/productsServer.ts 분리 (DEC-16)
- ADR-009 작성
- 8 후보 중 2 hypothetical seam 보류 (Drop/ListMeta)
- 커밋: `2e005e28..c18b972a`

### S228 — Phase 2 PR-A 테이블 4 페이지 마이그 ✅

- Orders/Users/Subscriptions/Products → AdminPageHeader/DataTable/TabsNav/Pagination 적용
- -304 LOC + 8 회귀 fix (Tailwind v4 cascade / admin-theme reset / Switch height 등)
- §5-23 칩 표준 신설 (DEC-18)
- 17 commits `fde3a148..04fb6d18`

### S229 — Phase 2 PR-B/C + 칩 표준 + DEC-17 listHelpers ✅

- PR-B 상세 3 파일 (AdminBackLink + AdminTopbarActions 합성)
- PR-C 단일 5 파일 (AdminPageHeader + §5-23 칩 + H-1/H-7)
- 칩 §5-23 표준 6곳 일관화 (`data-slot="chip-radio"` retrofit)
- **DEC-17 변경** — 풀 factory 폐기 → `lib/admin/listHelpers.ts` (AdminListResult<T,S,F> + applyRange + applyIlikeSearch)
- 학습 4종 (feedback memory 2건 신규)
- 8 commits `b1c4056b..c484569d`

### S230 — Phase 3 잘못 구현 fix ✅

- §7-3 hex Type 1+2 일괄 정정 + 토큰 4종 신설 (`981241d6`)
- 잔여 6 항목 완료 (탭 결정 β 채택 · Topbar 정책 · lib 분리 · base layer · 인덱스 갱신)

### S231 — ProductEditForm 3탭 마무리 ✅

- basic 재정비 + detail + option 탭 완성 + shipping/seo 제거 (3탭 축소)
- NativeSelectWrap / FlavorChipInput / PriceInput / slider 신규 자산 5종
- 5축 slider + 로스팅 5단계 칩 + Tag input + flavor_desc + note_color hidden
- 마이그 049 적용
- 10 commits `c9daf1ab..f57d0169`

### S232 — S231 carry 일괄 + 사이드바 폴리싱 ✅

- ConfirmModal + imageProcessing helper + ProductActiveToggleClient + ProductDangerZoneClient
- mode='create' 분기 (Discriminated Union) + Storage 이미지 + sharp webp 자동 변환
- create_product RPC 트랜잭션 + 영구 삭제 ConfirmModal danger + requireTextMatch
- roast_desc 자동 prefill + 단계 변경 lock + 동적 행 ↑↓ reorder
- 사이드바 sticky + Lucide + collapse/expand + next/link
- 마이그 050/051/052 적용
- 6 commits `3032f056..f7d250c4`

### S233 (+ S233-fu) — Users 필터 + CSV + RBAC + audit ✅

- Users 가입 채널 DropdownFilter + Subs/Orders CSV
- RBAC owner/staff + 권한 단계 변경 UI
- /admin/audit 통합 페이지 + 감사 로그 CSV
- csvExport helper + 16 테스트 + getAdminOwnerClaims + setAdminLevelAction
- 5 owner 가드 박음 (CSV 3종 + 영구 삭제 + 사이트 설정 + audit 페이지/CSV)
- 마이그 053~057 적용
- 9 commits `d0b81576..1a7d385a`

### S234 Phase 1+2 — Admin 폴리싱 sprint ✅

- Phase 1: window.confirm → ConfirmModal · toast 자연어화 · 보조용언 띄어쓰기
- Phase 2: Featured → "추천" · 추천 배지 + 비공개 배지 + 토글 위/아래 · EditAltDialog · UploadDialog §5-12 답습
- DEC-1~15 박음
- 13 commits `a333c39b..7fe32abf`

### S235 — S234 Phase 3 + cafe-events 3단계 진화 ✅

- cafe-events 모델 진화 — overlay → iframe HTML → 자동화 (placeholder 치환 IMAGE_DESKTOP 4종 + aspect 자동 측정)
- lib/admin/cafeEventsServer 분리 (DEC-15/16 답습)
- 마이그 058~061 적용 + production HTML reference (운영자 자산)
- DEC-19~24 박음
- 36 commits `e8b98fee..70cf284a`

### S236 — sr-* hydration race 진단 + Toaster offset ✅

- S235 carry 옵션 A 진단 결과 dev-only Turbopack/HMR race 확정 (production 영향 없음 · DEC-25 박음)
- 어드민 Toaster offset top=72 적용 (Topbar 56 sticky 와 충돌 해소)
- 1 commit `479fa28f`

### S237 — 시그니처 chapter iframe HTML 모델 ✅

- cafe-events 답습 (062 마이그 — site_settings.signature_iframe)
- DEC-26/27 박음 (iframe 모델 + Storage prefix 답습)
- 5 commits `fc5027ab..05c95820`

### S244 — 카페 메뉴 어드민 신설 + Vercel CPU 진단 ✅

- 카페 메뉴 어드민 (목록 + CRUD + 단일 이미지 업로드 · products 답습)
- Vercel CPU 진단 (Sentry traces 1.0→0.1 + robots.txt)
- 028 마이그 menu-images 버킷 재사용
- 11 신규 파일 (types/lib/page/actions/4 client comp/MenuEditForm)
- DEC-S244-1~5 + DEC-OBS-1~2 박음
- 2 commits `afab2aef..fa04488b`

### S245 — 영양시트 + sort_order 자동 + 카드 정렬 + 컵 용량 + likes SSR ✅

- 영양시트 + 알레르기 19종 + stone-light 토큰
- sort_order 자동 채번 (전체 단일 시퀀스 · 3중 안전망)
- 카드 정렬 + 페이지네이션 BP 별 + popular = menu_likes 카운트
- 컵 용량 일괄 + 카페인 매핑 + 단위 자동 + 고카페인 동기화
- SSR likes hydration + GenericCard prop 확장
- DEC-S245-1~22 + DEC-P20-1~22 박음
- 27 commits `8a8b941e..462edbcf`

### S246 — drawer 플래시 + mypage 폴리싱 + 어드민 배너 LQIP ✅

- drawer 플래시 5단 추적 — focus({preventScroll:true}) 진짜 원인
- mypage 폴리싱 4건 + 영양시트 hero/content 색 분리 (stone-medium 신설)
- 어드민 배너 LQIP base64 placeholder (068 마이그 + generateImageBlurAction)
- 운영자 production HTML 2종 (Dripbag · UBE) inline style LQIP 부착
- 11 commits `1c7c8999..f76be7c4`

### S247 — /menu 진입 속도 + cafe-menu 폴리싱 + 영양시트 모바일 rubber-band ✅

- (A) /menu 진입 속도 — priority + B user liked client 분리 + B-fix store.fetched reset
- (B) cafe-menu 시각 폴리싱 — ✦ 카드 16→20 / 시트 24→28 + 온도 pill 11px + height 20 + padding 6
- (C) 영양시트 모바일 rubber-band fix — OverscrollTop 패턴 답습 (⚠ iOS 26 WebKit Bug 297779 잔존 · A 옵션 유지)
- 신규 메모리 1건 (`feedback-multi-account-verification`)
- 9 commits `d34c83e4..a07ee35a`

### S248 — plan 갱신 + 메인 노출 메뉴 어드민 + 통계 carry-over ✅

- 단계 1 plan 갱신 ✅ (S248 · 2026-05-22)
- 단계 2 메인 노출 카페 메뉴 어드민 설정 ✅ (mig 069 + SettingsForm + HomeFeaturedSubForm + lib/siteSettings + actions + CafeMenuSection fetch 교체 + 0 slot fallback)
- 단계 3 통계 강화 carry-over ✅ (별 메모리 파일 없이 `docs/admin-implementation-plan.md` §2-2 에 직접 spec 박음 · S249+ Quick Win 4종 + Domain Insight 3종 + Deep 2종 + 제외 1종)

---

## §8. 변경 이력

| 날짜 | 세션 | 변경 |
|---|---|---|
| 2026-04-27 | S92 | 초기 작성 — 정책 변경 + 작업 그룹 7개 |
| 2026-05-02 | S124 | Group H·I·J 추가 |
| 2026-05-11 | S209 | §0 진행률 신설 + 의존 audit 44개 + 출시 전 처리 확정 |
| 2026-05-13 | S217 | DB 전환 / Admin UI 두 열 분리 + P0/P1/P2 분류 |
| 2026-05-14 | S230 | 마스터 통합 재구성 — 모든 어드민 일감 SoT 일원화 / Sprint 카탈로그 S230~S234 + 별 / 폴리싱 sprint §2-4 + 최종 리뷰어 검토 sprint §2-5 신설 / memory carry-over link 박음 / 합계 추정 갱신 |
| 2026-05-22 | S248 | **plan 갱신** — §1 매트릭스에 Group L (RBAC+audit) · Group M (뉴스레터) · Group N (비즈 문의) 신설 / §1-2 DEC-19~27 + DEC-S248-1~8 박음 / §2 Sprint 카탈로그에 S231~S247 결과 row 추가 + S248 단계별 항목 박음 + S249+ 통계 강화 carry-over 신설 + S250+ 출시 차단 잔여 + S260 최종 리뷰어 / §3 출시 전 P1 재추정 (4.5~7h S248 + 23~37h S250 + 4~6h S260) + 출시 후 P2 통계 강화 묶음 / §4 마감 결정 분리 + DEC-G1·newsletter-3·S249-1·2 미확정 분리 / §6 전체 잔여 71.5~106h 재계산 |
| **2026-05-28** | **S290** | **§9 출시 차단 + 후속 일감 통합 audit 신설** — 어드민 SoT 를 확장하여 어드민 외 항목 (S-PND production launch + Group O 리뷰 게시판 + 폴리싱 carry) 까지 단일 SoT 통합 / §1 매트릭스에 Group O (리뷰 게시판) 신설 / DEC-newsletter-3 ✅ 완료 마킹 (Phase 4) / DEC-R1-UI · DEC-R2-policy · DEC-R2-vendor · DEC-R1-photo 미확정 추가 / §9 도메인 5종 (A 어드민 / B 카페·상품 CSV / C 리뷰 / D 인프라·launch / E 폴리싱) + 우선순위 권장 진입 순서 + 전체 잔여 131~219h 재계산 |
| **2026-05-29** | **S301** | **§9 우선순위 정정 — 도메인 구조 명확화** — `goodthings-roasters.com`(하이픈)=토스 심사 제출용 **임시** 도메인(Vercel 배포 ✅ S293~298) / 원래 `goodthingsroasters.com`(카페24 서비스 중·`hello@`)=토스 통과 후 전환. §9-1 D 의 S-PND-V1 → V1a(임시 배포 ✅)+V1b(원래 도메인 전환 carry·통과 트리거) 분리 · S-PND-3 토스 키=통과 트리거 / §9-2 진입순서 재정렬 (외부 대기=토스 심사 / 심사 대기 동안 진행=어드민 운영 도구 S250+S260 / 통과 트리거 묶음=키+도메인+로고) / "출시 차단" 실체 = 토스 통과+원래 도메인 전환, 어드민 운영 도구는 준비 작업으로 재분류 / 코드 0·문서만 |
| **2026-05-28** | **S291** | **S248 stale 정정 + Group M 상태 구체화** — S248 단계 1+2+3 모두 ✅ 완료 마킹 (`/admin/settings` HomeFeaturedSubForm + mig 069 + lib/siteSettings + CafeMenuSection fetch 교체 실제 구현 확인 · plan 문서가 stale) / DEC-S248-2~8 ✅ 일괄 마킹 / §2-1 S248 sprint ⏳ → ✅ / §1 Group M 뉴스레터 "어드민 미완" → "부분 (구독자 목록만 · 페이지네이션/검색/CSV/bulk send carry)" 구체화 / §9-1 + §9-2 + §9-4 합계 재계산 (출시 차단 30~50h → 27~44h · 전체 131~219h → 128~213h) / §3-1 + §6 합계 재계산 (전체 71.5~106h → 68.5~100h) / 코드 변경 0 · 문서만 |

---

## §9. 출시 차단 + 후속 일감 통합 audit (S290 · 2026-05-28)

> 본 섹션은 어드민 외 항목 (production launch · 리뷰 게시판 · 폴리싱 carry) 까지 단일 SoT 통합. §1~§8 어드민 매트릭스 + carry-over 메모리 5종 통합 audit 결과.
>
> **읽기 순서:** §9-1 도메인별 매트릭스 → §9-2 우선순위 → §9-3 결정 대기 → §9-4 합계

### §9-1. 도메인별 잔여 일감

#### A. 어드민 미작업 (§1~§7 reference + 본 audit 갱신)

| ID | 항목 | 상태 | 추정 | sprint |
|----|------|------|------|--------|
| D-2 | 정기배송 상세 페이지 | 🟡 70% | 4~6h | S250-1 |
| G-1 | SOP 문서 (운영자용 ✅ · 개발자용 carry) | ✅ 운영자 S310 | 4~6h | S250-4 |
| G-2 | E2E 테스트 critical flow | ⏸️ 0% | 6~10h | S250-5 |
| M-admin | 뉴스레터 어드민 (구독자 목록 + 발송 이력 + bulk send UI + CSV + 검색/필터/페이지네이션) | 🟡 미완 | 4~6h | S250-2 |
| N-admin | 비즈 문의 어드민 (목록 + 상세) | 🟡 미완 | 3~5h | S250-3 |
| ~~S248-2~~ | ~~메인 노출 카페 메뉴 어드민 (`site_settings.home_featured` 0~3 슬롯 · DEC-S248-3~8)~~ | ✅ S248 완료 | — | — |
| §234 P3 | 어드민 페이지 폴리싱 carry (사이드바·인터랙션·a11y) | 📋 | 2~4h | S250-6 |
| S260 | 최종 리뷰어 검토 (code + security + typescript + database 4 reviewer 일괄 + CRITICAL/HIGH fix) | 📋 | 4~6h + α | S260 |

#### B. 카페 메뉴 / 상품 / 검색

| ID | 항목 | 상태 | 추정 |
|----|------|------|------|
| E-CSV | Products CSV export | 📋 carry | — |
| C-CSV | Users CSV (PII 정책 합의 후) | 📋 carry · S232-4 | — |
| (자체 어드민) | products / cafe-menu CRUD + Storage + 영양시트 + sort_order 자동 + likes SSR | ✅ 100% (S231~S245) | — |

#### C. 리뷰 게시판 (Group O · `project_reviews_filtering_carryover.md`)

| Phase | 항목 | 추정 | 진입 조건 |
|-------|------|------|----------|
| Phase 1 Step 1 | UI 위치 결정 (DEC-R1-UI) | 결정 | 사용자 confirm |
| Phase 1 Step 2 | DB 마이그 (069_user_reviews · RLS + check + target xor) | 4~8h | DEC-R1-UI 후 |
| Phase 1 Step 3 | 작성 폼 + 별점 UI (Radix Slider 또는 직접 SVG 5개 · `useAuthGuard`) | 4~8h | — |
| Phase 1 Step 4 | 카드 리스트 + 페이지네이션 + 메뉴/상품 카드 평균 별점 메타 | 4~8h | — |
| Phase 1 Step 5 | 어드민 모더레이션 (`/admin/reviews` 목록 + 상태 변경 + CSV + owner-only) | 4~8h | — |
| Phase 1 Step 6 (옵션) | 사진 업로드 (Storage + sharp webp · DEC-R1-photo) | +4~8h | DEC-R1-photo |
| Phase 2 Step 1 | AI 필터링 정책 + vendor 결정 (DEC-R2-policy + DEC-R2-vendor) | 결정 | 사용자 confirm |
| Phase 2 Step 2 | server action + audit log + `moderation_result` jsonb 컬럼 | 4~8h | — |
| Phase 2 Step 3 | 어드민 검토 큐 UI (status='pending' 탭 + 'blocked' 탭) | 4~8h | — |

**합계:** Phase 1 16~32h (사진 제외) / 20~40h (포함) · Phase 2 8~16h · 전체 24~48h (사진 제외) / 28~56h (포함)
**DEC 잠금:** R1 최소 도입 · R2 무료 우선 (OpenAI Moderation) · R3 S247 어드민 통계 후 (✅ 충족)

#### D. 인프라 · production launch (S301 갱신 — 임시 심사 도메인 배포 완료 / 원래 도메인 전환은 토스 통과 트리거)

> **도메인 구조 (S301 명확화):** 현재 `goodthings-roasters.com`(하이픈) = **토스 심사 제출용 임시 도메인** (Vercel 배포본). 토스 라이브 심사 통과 시 → 원래 `goodthingsroasters.com`(하이픈 없음 · `hello@` 이메일 도메인 · **현재 카페24 서비스 중**) 으로 전환. 즉 "진짜 출시" = 토스 통과 + 원래 도메인 마이그.

| ID | 항목 | 우선순위 | 추정 |
|----|------|---------|------|
| S-PND-V1a | Vercel 배포 + 임시 심사 도메인 `goodthings-roasters.com` (가입 + repo 연결 + env + 함수 리전 icn1) | ✅ 완료 (S293~S298) | — |
| 토스 심사 | 라이브 심사 (임시 도메인 제출 · 빌링+일반결제 S294/S295) | 🔴 **외부 대기** (진행 중) | — |
| S-PND-3 | **(통과 트리거)** 토스 결제 키 교체 + PPT 갱신(S297) + `.env.local`/Vercel live 키 | 🔴 통과 직후 | 30분 + PPT |
| S-PND-V1b | **(통과 트리거)** 원래 도메인 `goodthingsroasters.com` 전환 (카페24 → Vercel · DNS/NS 마이그 · 기존 서비스 다운타임/전파 주의) | 🔴 통과 직후 | 2~4h |
| S-PND-V2 | **(통과 트리거)** Newsletter 로고 production URL 확인 | 🟢 도메인 전환 후 | 30분 |
| S-PND-4 carry | Lighthouse LCP 측정 (PageSpeed Insights) | 🟡 진단 | 1h |

#### E. 폴리싱 / carry

| ID | 항목 | 상태 | 추정 |
|----|------|------|------|
| S-PND-1+2 carry | PDP/cart 모바일 rubber-band white | carry · 진단 자산 확보 시 | L17 정합 (진단 자산 없으면 답습 차단) |
| S-PND-5 | Hero 영상 품질 + 로딩 0 (Onyx Coffee Lab 레퍼런스 · 리서치/agent 선행 의무) | 🟡 | 4~10h |
| CS AI 봇 | Claude API + tool use (주문 조회 / FAQ lookup) | 별도 sprint · 운영 데이터 누적 후 | 20~40h |
| arch sweep | improve-codebase-architecture 최종 (S227~S260 결과 audit) | 출시 후 V2+ | 8~10h |

### §9-2. 우선순위 권장 진입 순서 (S301 재정렬 — 임시 도메인 배포 완료 기준)

0. **✅ Vercel 배포 + 임시 심사 도메인** (S293~S298 완료)
1. **🔴 [외부 대기] 토스 라이브 심사 통과** — 우리 코드 작업 없음. 통과 신호 대기 (default 진행 중 가정).
2. **🟡 [심사 대기 동안 진행] A. 어드민 운영 도구 묶음** (S250-1~6 + S260) — 19.5~29h. 토스·도메인과 무관하게 준비 가능 → **지금 진입 가능한 메인 작업**.
3. **🔴 [통과 트리거 묶음] 출시 전환** — S-PND-3(결제 키+PPT) + S-PND-V1b(원래 도메인 `goodthingsroasters.com` 전환·DNS/NS) + S-PND-V2(뉴스레터 로고) + Lighthouse LCP — 2~5h. 토스 통과가 신호.
4. **🟡 C. Group O 리뷰 게시판 Phase 1** — DEC-R1-UI confirm 후 16~32h
5. **🟡 Group O Phase 2 AI 필터링** — DEC-R2-* confirm 후 8~16h
6. **🟢 B. CSV PII 정책 + S249+ Quick Win** — 출시 후 1개월 14~22h
7. **🟢 S249+ Domain Insight + CSV 추가** — 출시 후 2~3개월 11~19h
8. **🟢 V2+ Deep Analysis + CS AI 봇 + arch sweep** — 출시 후 V2+ 52~80h

> **핵심 변화 (S301):** Vercel 배포·임시 도메인은 ✅. "출시 차단"의 실체는 ① 토스 심사 통과(외부 대기) ② 통과 후 원래 도메인 전환(트리거 묶음). 어드민 운영 도구(2번)는 출시 차단이 아니라 **심사 대기 동안 진행하는 준비 작업**으로 재분류.

### §9-3. 결정 대기 매트릭스

§4-2 미확정 결정 cross-reference. 본 audit 진입 전 사용자 confirm 의무.

| 우선순위 | DEC ID | 결정 시점 |
|---------|--------|----------|
| ~~🔴 출시 차단~~ | ~~DEC-G1 (SOP 범위)~~ | ✅ S310 확정 (운영자용) |
| 🟡 출시 후 1개월 | DEC-S249-1 (차트 라이브러리) · DEC-S249-2 (Quick/Domain 묶음) | S249+ 진입 전 |
| 🟡 리뷰 게시판 진입 | DEC-R1-UI · DEC-R1-photo · DEC-R2-policy · DEC-R2-vendor | Group O Phase 1/2 진입 전 |

### §9-4. 전체 잔여 합계 재계산 (S290 audit)

| 단계 | 합계 |
|------|------|
| 출시 차단 (A + D 핵심: S250 + S260 + S-PND-3 + S-PND-V1) | **~27~44h** (1주 풀타임) |
| 리뷰 게시판 (C: Group O Phase 1+2 사진 제외) | **24~48h** |
| 출시 후 1개월 (B + 어드민 통계 Quick Win) | **14~22h** |
| 출시 후 2~3개월 (Domain Insight + CSV PII) | **11~19h** |
| 출시 후 V2+ (Deep Analysis + arch sweep + CS AI 봇) | **52~80h** |
| **전체 잔여** | **~128~213h** |

### §9-5. carry-over 메모리 cross-reference

본 §9 통합 audit 의 detail spec 메모리:

| 메모리 파일 | 역할 |
|-------------|------|
| `memory/project_pending_sprints.md` | S-PND-1~5 + S-PND-V1~V3 카탈로그 (S290 갱신) |
| `memory/project_reviews_filtering_carryover.md` | Group O 리뷰 게시판 Phase 1+2 spec |
| `memory/project_newsletter_phase4_complete.md` | Newsletter Phase 4 도메인 인증 완료 스냅샷 |
| `memory/project_session290_complete.md` | S290 favicon system + 본 §9 audit 진입 |
| `memory/lesson_pdp_overscroll_thrash.md` | L1~L17 답습 차단 (S-PND-1+2 carry 진입 시) |
| `memory/lesson_hero_video_thrash.md` | L6~L13 답습 차단 (S-PND-5 진입 시) |
| `memory/carry_s_pnd_5_hero_video_plan.md` | S-PND-5 Phase 2 진입 자료 |

---

## Appendix A. 초기 설계 자료 (S92~S217 historical)

> 본 섹션은 초기 설계 / 결정 배경 보존용. 진행 추적은 §1~§3 참조.

### A-1. UI 라이브러리 — shadcn/ui (S92 결정)

- 풀 어드민 50~70h 작업 규모 → 약 30% 단축 (35~50h)
- form / table / dialog / dropdown 등 표준 컴포넌트
- Tailwind 기반 (메인 사이트와 같은 빌드 파이프라인)
- 메인 디자인 시스템과 별도 — 어드민 전용 토큰·테마 (admin-theme.css)

### A-2. 이미지 업로드 — Supabase Storage (S92 결정)

옵션 비교 결과 Supabase Storage 채택:
- `is_admin()` RLS 헬퍼 (020 마이그레이션) 를 Storage 정책에 그대로 재사용
- 이미지 transform (resize/format/webp) 내장
- DB + Storage 백업 일원화
- 1만 장 돌파 시 R2 마이그레이션 옵션 보유

### A-3. 라우팅 구조 (S92 결정)

```
app/admin/
  login/page.tsx         # 별도 로그인 (메인 /login 과 분리)
  (authed)/
    layout.tsx           # RBAC 가드 + 사이드바 + 헤더
    page.tsx             # 대시보드 (간단한 통계)
    orders/              # 목록 + [orderNumber] 상세
    users/               # 목록 + [id] 상세
    products/            # 목록 + new + [slug]/edit
    menu/                # 목록 + new + [id]/edit (미완)
    subscriptions/       # 목록 + [id] 상세 (D-2 미완)
    analytics/
    gooddays/
    settings/
    cafe-events/
```

### A-4. 인증 흐름 (S92 결정)

- `/admin/login` 진입 → Supabase auth 로그인
- 로그인 성공 → `is_admin(user.id)` 검증
- admin 이면 `/admin` 리다이렉트, 아니면 403 + 자동 로그아웃
- `/admin/*` 모든 라우트 → `app/admin/(authed)/layout.tsx` 에서 `requireAdmin` 가드

### A-5. 클라이언트 의사결정 필요 항목 (S92 출처 · 상태 갱신)

| 항목 | 결정 | 상태 |
|---|---|---|
| admin 계정 운영 | 단일 계정 시작 (다계정은 boundary 발생 시 검토) | ✅ |
| 상품 카테고리 확장 | Coffee Bean / Drip Bag 만 (확장은 별 sprint) | ✅ 잠금 |
| 카페 메뉴 카테고리 | 시그니처/브루잉/티/논커피/디저트/기타 (어드민 편집 X) | ✅ 잠금 |
| 재고 관리 정밀도 | 옵션별 `soldOut` 토글만 (수량 X) | ✅ 잠금 |
| 상품 이미지 정책 | 다중 갤러리 (1번 = 대표) | ✅ 잠금 |
| 어드민 다국어 | 한국어만 | ✅ 잠금 |

### A-6. fetch 전환 영향 파일 (S209 audit · 44개 · 모두 마이그 완료)

- 상품 (E-4 영향) ~36개 — `lib/products.ts` 하드코딩 → DB ✅ S211/S212
- 카페 메뉴 (F-3 영향) ~8개 — `lib/cafeMenu.ts` 하드코딩 → DB ✅ S213/S214
