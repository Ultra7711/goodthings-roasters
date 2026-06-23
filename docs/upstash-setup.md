# Upstash Redis 연결 가이드 — Rate Limiting 활성화

> 작성: S323 · 대상: 라이브 전 보안 마무리
> 코드는 이미 완비됨(`next/src/lib/auth/rateLimit.ts`). 이 문서는 **env 연결 + 롤아웃 절차**만 다룬다.

---

## 1. 현재 상태 (✅ 코드로 검증)

| 항목 | 상태 |
|------|------|
| Rate limit 코드 | ✅ 완비. 18개 API 라우트에 배선됨(아래 §7) |
| 작동 조건 | `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` 존재 시 활성화 |
| **env 미설정 시** | 🔴 **모든 rate limit 패스스루(OFF)** — carding뿐 아니라 인증·주문·결제·PIN·탈퇴·카트 전부 무방어 |
| carding 차단 | 추가로 `CARDING_LIMIT_ENABLED='true'` 필요. 없으면 dry-run(카운트만, 차단 X) |
| `.env.example` | ✅ 3개 키 문서화됨(81~87줄) |
| 🔶 프로덕션 현재 설정 여부 | 코드로 확인 불가 → **Vercel 대시보드에서 직접 확인 필요** |

> 메커니즘: `rateLimit.ts`의 `getRedis()`가 url/token 없으면 `null` 반환 → 모든 limiter `null` → `checkRateLimit`/`checkCardingLimit`이 항상 `null`(통과) 반환. 로컬 개발용 패스스루가 프로덕션에도 그대로 적용되는 구조.

---

## 2. 필요 환경변수 (3개)

| 키 | 출처 | 비고 |
|----|------|------|
| `UPSTASH_REDIS_REST_URL` | Upstash(또는 Vercel 연동 자동 주입) | REST 엔드포인트 |
| `UPSTASH_REDIS_REST_TOKEN` | 동상 | REST 토큰(서버 전용·`NEXT_PUBLIC_` 금지) |
| `CARDING_LIMIT_ENABLED` | 수동 설정 | `true`일 때만 carding 실차단. 초기엔 `false`로 dry-run |

---

## 3. 연결 절차 — Vercel Marketplace 경로 (권장)

`.env.example`에 "Vercel Marketplace 연동 시 자동 주입"이라 명시된 의도된 경로. env 2개를 자동 등록해줘 수동 복붙 실수가 없다.

1. **Vercel 대시보드 → 프로젝트 → Integrations(또는 Storage) → Marketplace**에서 **Upstash** 검색 → Install
2. 첫 설치 시 "기존 Upstash 계정 연결" vs "Vercel이 Upstash 계정 관리" 중 선택 (둘 다 무료티어 DB 생성 가능)
3. Redis 데이터베이스 생성 — **리전은 Vercel 배포 리전(icn1=서울에 가까운 곳)** 과 가깝게 선택(레이턴시)
4. 프로젝트에 연결(Save) → `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` 이 **Production/Preview/Development** env에 자동 추가됨
5. **재배포 필요** — env는 새 배포부터 적용됨

> 대안(직접 가입): console.upstash.com 에서 DB 생성 → REST URL/TOKEN 복사 → Vercel 프로젝트 env에 수동 등록. Marketplace 경로가 더 안전.

> ⚠️ **연결 타이밍 주의 (ToS §I.5 Resource Inactivity)**: **무료 플랜 DB는 1주일간 요청이 없으면 Upstash가 삭제할 수 있음**(유료는 3개월). 트래픽 0인 라이브 전에 미리 연결만 해두면 1주 비활성으로 DB가 삭제되어(삭제 시 env는 남아도 연결 실패 → 다시 전부 패스스루) 다시 만들어야 한다. → **연결은 라이브 직전~직후로** 잡거나, 미리 연결한다면 라이브까지 주기적 요청(헬스체크)으로 활성 유지.

---

## 4. 롤아웃 — 2단계 (안전)

### Step 1 — env 연결 + dry-run 관측 (carding OFF 유지)
- §3 완료 → 재배포
- `CARDING_LIMIT_ENABLED`는 **아직 설정 안 함(또는 false)**
- 이 시점에 즉시 작동: **인증·주문·결제·PIN·탈퇴·카트 rate limit 전부 ON**. carding만 dry-run(카운트만).
- 🔶 **24h 관측**: 정상 사용자가 429를 맞지 않는지 로그 확인(프리셋 한도가 실트래픽에 맞는지). 트래픽 0~저 상태라 사실상 회귀 위험 낮음.

### Step 2 — carding 실차단 활성화
- Vercel env에 `CARDING_LIMIT_ENABLED=true` 추가 → 재배포
- 이후 카드 거절 5회/10분 초과 시 `429 too_many_card_attempts` 차단
- 프로덕션 부팅 시 `[rateLimit] CARDING_LIMIT_ENABLED is not "true"...` 경고가 **사라지면** 활성화 확정(`rateLimit.ts:67`)

---

## 5. 검증 방법

| 검증 | 방법 |
|------|------|
| env 주입 확인 | Vercel → Project → Settings → Environment Variables 에 2개 키 존재 |
| rate limit 작동 | 동일 IP로 카트 쓰기 60회/분 초과 → `429 rate_limited` + `Retry-After` 헤더 |
| carding dry-run→차단 전환 | Step 1에선 거절 반복해도 통과 / Step 2에선 5회 초과 시 `429 too_many_card_attempts` |
| 부팅 경고 소멸 | Vercel 함수 로그에서 dry-run 경고 미출현 |

> ⚠️ carding 실거래 테스트는 토스 라이브 키 + 실카드가 필요하므로, **라이브 직전 또는 직후** Step 2를 적용하는 게 현실적. Step 1(env 연결)은 지금 해도 무방.

---

## 6. 무료티어 — 공식 출처 리서치 결과 (S323)

> 출처: Upstash 공식 [Pricing](https://upstash.com/pricing/redis) · [Pricing & Limits 문서](https://upstash.com/docs/redis/overall/pricing) · **[Terms of Service(2025-04)](https://upstash.com/trust/terms.pdf) 본문 직접 정독**.

### 한도 (✅ 공식 확정)
| 항목 | 무료티어 |
|------|----------|
| 월 commands | **500K** (≈ 일 16,667) |
| 데이터 크기 | **256 MB** |
| 월 대역폭 | **10 GB** |
| DB 개수 | **1** |
| 최대 요청 크기 | 10 MB |
| 초과 단가(유료 전환 시) | $0.20 / 100K commands |

### 상업/프로덕션 사용 — ✅ 적격 (ToS 본문 확인)
- **무료티어에 상업·프로덕션 사용을 금지하는 조항이 ToS에 없음** (Vercel Hobby와 결정적 차이). 공식 문서도 무료티어를 "small production workloads에 적합"으로 표현.
- Acceptable Use(ToS §C)가 금지하는 것: 불법·스팸·악성코드/C2·**Upstash 서비스 자체의 재판매**(§C.4)·**원격 스토리지 서버 또는 다운로드 콘텐츠 제공을 주목적으로 사용**(§C.8). → 커머스 백엔드의 rate-limiting 용도는 **전부 비해당, 적격**.
- ⚠️ 제약: **1인/1법인당 무료 계정 1개**(ToS §B.2). 과도한 부하 시 throttle/suspend 권리(§C.6 대역폭·§C.7 Fair Use).

### 깜짝 청구 — ✅ 구조적으로 불가 (카드 미등록 시)
- ToS §H.1 + Pricing FAQ: **신용카드를 등록해야 pay-as-you-go로 전환**됨. 카드 미등록 = 무료티어 hard cap 유지.
- 한도 초과 시: "이메일 알림 + best-effort로 DB 유지하되 케이스에 따라 rate limit 가능". **자동 과금 조항 없음**.
- 결론: **카드 미등록 상태로 운영**하면 비용 0 보장. (유료 필요 시점에만 카드 등록 + 콘솔에서 월 예산 상한 설정 가능)

### 카드 등록 정책 (참고)
- **카드 미등록으로 무료 운영 가능** — 무료 DB는 카드 불요(ToS §H.4 "Free accounts are not required to provide payment information").
- 카드 교체(다른 카드로 변경): ✅ 가능. 콘솔에서 **여러 카드 등록 + 기본(default) 지정** 가능.
- ⚠️ **카드 등록 = 해당 DB가 pay-as-you-go로 전환**되고, ToS §H.2 **"유료로 전환된 특정 DB는 무료로 되돌릴 수 없음"**. 무료 복귀는 그 DB 삭제 후 새 무료 DB 생성 우회 필요(🔶 콘솔 동작).
- → 운영 원칙: **무료가 목표면 카드 자체를 등록하지 않는다.** 유료가 정말 필요해질 때(월 command 한도 근접)만 등록.

### 우리 용도 적합성 판단 (🔶 추정 — 실측 전)
- rate-limit은 요청당 Redis command 수개 소비(sliding window). 초기 저트래픽(주문 0~소량)에서 500K/월은 충분할 것으로 **추정**.
- 단, **모든 API 요청이 command를 소비**하므로(인증·카트·결제 등 18 라우트), 트래픽 증가 시 소진 가능 → **Upstash 콘솔 Usage에서 월 command 추이 모니터링 필수**. 한도 근접 시 유료 전환(저렴) 또는 프리셋 조정 검토.

---

## 7. 배선된 라우트 (참조 · 코드 검증)

| 프리셋 | 라우트 | 한도 |
|--------|--------|------|
| `auth_initiate` | `/api/auth/{naver,kakao}` | 10/min |
| `auth_callback` | `/api/auth/{naver,kakao}/callback` | 20/min |
| `order_create` | `/api/orders` | 10/min |
| `payment_confirm` | `/api/payments/confirm` | 10/min |
| `payment_confirm_reject`(carding) | `/api/payments/confirm` | 5/10min |
| `guest_pin` | `/api/orders/guest-lookup` | 5/10min |
| `account_delete` | `/api/account/delete` | 3/15min |
| `cart_write` | `/api/cart{,/[id],/merge}` · `/api/billing/*` · `/api/account/addresses` · `/api/reviews/[id]/helpful` · `/api/menu-likes/[menuId]` | 60/min |

---

## 8. Redis 장애 대응 — 코드 검증 + 의사결정 (S323)

> 무료티어는 **1주 비활성 시 DB 삭제**(§3 경고). 삭제·장애 시 rate-limit 코드가 어떻게 동작하는지 소스로 검증한 결과와 대응 결정.

### 라이브러리 fail-open 동작 (✅ `@upstash/ratelimit` 소스 검증)
- `limit()`은 **기본 `timeout = 5000ms`** 보유(`index.mjs:743`)
- `Promise.race([Redis응답, 5초타임아웃])`(`:805`) → **5초 안에 무응답(hang)이면 `{ success: true, reason: "timeout" }` 통과(fail-open)**(`:909~916`)
- 즉 "연결 hang"은 5초 후 통과. 무한 대기는 아님.

### 즉시-에러(reject)는 fail-open이 못 막음 (✅ 검증)
- `safeEval`은 NOSCRIPT 외 에러를 **그대로 재throw**(`:154`)
- 호출부 `checkRateLimit`/`checkCardingLimit`은 **try-catch 밖에서 await**(`payments/confirm/route.ts:52,:66` · `orders/route.ts:59`) → throw 시 핸들러가 못 잡아 **500**
- 단 `recordCardingAttempt`만 `void` fire-forget(`payments/confirm/route.ts:103`) → throw해도 라우트는 생존

### 장애 형태별 영향
| 장애 형태 | 동작 | 사용자 영향 |
|-----------|------|-------------|
| 연결 hang(무응답) | 5초 timeout → fail-open | 모든 요청 5초 지연 후 통과(차단X) |
| 즉시 에러(404/401/bad token) | throw 재전파 | 결제·주문·카트 **500** |

🔶 DB 삭제 시 Upstash REST가 hang으로 응답할지 즉시-에러로 응답할지는 미검증(둘 다 나쁨: 5초 지연 또는 500).

### 의사결정 (DEC-S323)
- **A. Cron ping** — DB 1주 비활성 삭제를 ping으로 예방. **라이브 직전 구현**(코드 미리 작성 시 Vercel Pro·Upstash 연결방식·rateLimit 변경으로 stale 위험 → YAGNI). **진짜 해법**: DB가 살아있으면 carding 방어가 항상 작동.
- **C. graceful fallback(try-catch fail-open)** — **보류**. fail-open은 carding이 **조용히 꺼지는 silent failure** 위험(token 실수로 Redis 에러나도 통과). A가 있으면 필수 아님. 필요해지면 **"에러 로깅(Sentry) 동반 fail-open"** 형태로만 — 통과시키되 carding 꺼짐을 즉시 인지.
- **핵심 근거**: *fail-open이 carding을 죽이는 게 아니라, DB가 죽는 게 carding을 죽인다.* → A(DB를 살림)가 본질, C는 드문 즉시-에러 500 방어용 보조(가용성↔관측성 트레이드오프).

### 라이브 직전 A 구현 — 참조 (코드 위치)
- Cron 라우트 신규: `/api/cron/redis-ping/route.ts` — `CRON_SECRET` 헤더 검증 + Redis 가벼운 명령(ping)
- `rateLimit.ts`에 `pingRedis()` export 추가(현재 `getRedis()` singleton 재사용)
- `vercel.json`(또는 `vercel.ts`) `crons` — Hobby는 일 1회 제한(1주 방지엔 충분)·Pro 자유
- `.env.example`에 `CRON_SECRET` 추가 + Vercel 등록
- 예상 작업량: 코드 ~40줄·복잡도 낮음·🔶 ~1시간

---

## 9. 사용자 선행 액션 요약

- [ ] **라이브 직전~직후**에 Vercel Marketplace에서 Upstash Redis 통합 설치 + DB 생성(§3 — 비활성 1주 삭제 주의)
- [ ] **카드 미등록** 유지(무료 운영). 카드 등록 시 유료 전환·무료 복귀 불가(§6)
- [ ] env 2개 자동 주입 확인 후 재배포(Step 1)
- [ ] 24h 관측(429 오탐 없음 확인)
- [ ] 라이브 직전/직후 `CARDING_LIMIT_ENABLED=true` 추가 + 재배포(Step 2)
- [ ] Upstash 콘솔 Usage에서 월 command 추이 모니터링
