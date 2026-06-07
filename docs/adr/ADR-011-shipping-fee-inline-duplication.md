# ADR-011: 배송비 계산 인라인 중복 — Turbopack minify 버그 회피

**Status:** Accepted
**Date:** 2026-06-07 (S312)
**Deciders:** GTR owner + AI pair
**Related:** ADR-004 (Zustand 제거 · lib/store.ts 삭제) · BUG-fix 2026-04-23 (`69070cdb` · `dc1e7a44` · `4ff1378f`) · [vercel/next.js#86568](https://github.com/vercel/next.js/issues/86568)

## 1. Context

S312 deep module 아키텍처 리뷰에서 **배송비 계산식이 두 곳에 인라인 중복**된 것이 information leakage(정보 누수) 후보로 식별되었다.

- 클라이언트: `useCartQuery` (`hooks/useCart.ts`) — `subtotal === 0 ? 0 : subtotal >= FREE_THRESHOLD ? 0 : BASE_FEE`
- 서버: `createOrderFromInput` (`lib/services/orderService.ts`) — 동일 식
- 두 곳 모두 **`site_settings.shipping`** (`free_threshold`/`base_fee`/`enabled`) 을 단일 source 로 읽어 계산 → 청구 정합성은 이미 보장됨 (불일치 없음)

정석적인 deep module 화는 `calcShippingFee(subtotal, policy)` 순수 함수 하나로 클라·서버가 공유하는 것이다. 실제로 과거 `lib/cartCalc.ts` 에 `calcShippingFee` 가 그 목적으로 존재했다.

**그러나 이 공용화는 이미 실패했고, 결제 매출 손실을 냈다.**

> 교차검증 (S312): 배송비 계산 지점은 `useCartQuery`(클라)·`orderService`(서버) 2곳이 전부다.
> ADR-002(webhook)는 `GET 재조회 totalAmount = orders.total_amount` 정합으로 본 결정을 **보강**하고,
> ADR-008(billing)은 `chargeFirstCycle` 이 `order.total_amount` 를 재사용해 배송비 계산 지점을 추가하지
> 않는다. ADR-010(caller connection)·ADR-004(state)와도 충돌 없음.

## 2. 근거 리서치

### git history (2026-04-23 BUG-fix)

- `orderService.ts` 가 `calcShippingFee` (또는 `SHIPPING_FEE` 상수) 를 import 하면, **Vercel Turbopack 프로덕션 번들의 SWC minify** 단계에서 import 심볼명과 동일 파일 지역변수(`shippingFee`)가 충돌
- 결과: 함수 **호출 결과**가 아니라 함수 **객체**가 변수에 할당됨
  - 증상 1: `shippingFee: [Function]` → `JSON.stringify` 가 drop → RPC `p_shipping_fee` 키 누락 → **PostgREST PGRST202**
  - 증상 2 (재발): `totalAmount = subtotal + function = NaN` → fallback 으로 **배송비 3,000원 silent 누락** (사용자 제보: 14,000원 상품에 배송비 빠진 채 청구)
- **로컬 프로덕션 빌드에선 재현되지 않음** — Vercel 프로덕션 번들 특유

### 알려진 이슈

GTR 만의 문제가 아니다. [vercel/next.js#86568](https://github.com/vercel/next.js/issues/86568) — Turbopack + SWC minify 가 inline 후 변수명을 잘못 처리해 **의미적으로 비등가한 코드**를 생성하는 클래스 버그. webpack + terser 로는 정상.

- 버그 발현 당시 Next.js **16.2.3**, 현재 **16.2.6** (동일 마이너, 이 특정 버그 픽스 확증 없음)

## 3. Decision

**배송비 계산을 공용 함수로 추출하지 않는다. 클라(`useCartQuery`)·서버(`orderService`) 각자 인라인한다.**

- 두 인라인 중복은 정보 누수가 아니라 **번들 버그 회피를 위한 의도적 방어**다.
- 청구 정합성은 양쪽이 `site_settings.shipping` 을 단일 source 로 읽는 것으로 보장한다 (계산 *식* 이 아니라 *정책값* 이 단일 source).
- dead 코드 제거:
  - `lib/cartCalc.ts` 삭제 (`calcShippingFee` 실호출 0 + `CartTotals` 미사용)
  - `hooks/useCart.ts` 의 DEPRECATED 상수 `FREE_SHIPPING_THRESHOLD`/`SHIPPING_FEE` 삭제
  - `orderService.test.ts` 의 dead 함수 단위 테스트 제거

## 4. Alternatives Considered

| 안 | 요약 | 결론 |
|----|------|------|
| **A. deepen 재시도** | `calcShippingFee(subtotal, policy)` 공용 함수로 클라·서버 공유 | **기각** — 버그가 로컬 재현 불가라 검증을 Vercel 실배포 + 실결제 흐름으로만 할 수 있음. 결제 흐름 silent 오염(매출 손실) 직격 + 토스 라이브 심사 대기 중. 배송비 식은 1줄이라 deep module leverage 도 작음 → 리스크/이득 비대칭 극심 |
| **B. 제약 인정 + dead 정리** | 인라인 중복 유지, dead 코드만 제거, ADR 로 박제 | **채택** |

## 5. Consequences

**긍정**
- 결제 흐름 안정성 유지 (검증 불가능한 번들 버그를 건드리지 않음)
- dead 코드(`cartCalc.ts` + 상수) 제거로 codebase 정리
- **미래 아키텍처 리뷰가 "배송비 계산식 중복"을 deepening 후보로 재제안하는 것을 차단** (이 ADR 이 load-bearing reason 을 기록)

**부정**
- 배송비 계산식 1줄이 2곳에 중복 (식 변경 시 양쪽 동기화 — 단 식이 바뀔 일은 드물고, 정책값은 `site_settings` 단일 source)

## 6. Non-goals

- Turbopack minify 버그 자체의 upstream 수정/우회 (vercel/next.js 트래커 영역)
- 배송 정책의 추가 차등화 (지역별/무게별 등 — 도입 시 재검토)

## 7. Re-evaluation Trigger

다음 중 하나가 성립하면 안 A(공용화)를 재검토할 수 있다.

- Next.js / Turbopack 릴리스 노트에 #86568 클래스 minify 버그의 명시적 수정이 확인됨
- 배송 정책이 복잡해져(지역별/무게별 등) 계산식이 1줄을 넘어 실질적 deep module leverage 가 생김
