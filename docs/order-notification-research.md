# Good Things Roasters — 온라인 주문 실시간 알림 솔루션 조사 보고서

> **작성일:** 2026-05-22
> **작성 목적:** 출시 직전 단계에서, 온라인 주문 접수 시 운영진이 실시간으로 내용을 공유받을 수 있는 채널의 선택지를 정리한다. 솔루션별 작동 방식·도달률·운영비·구현 난이도·한국 환경 적합성을 비교하고, GTR 의 단계별 추천안을 제시한다.
> **현 인프라:** Next.js (Vercel) · Supabase (DB + Realtime + Storage) · Resend (이메일) · 토스페이먼츠 (결제)

---

## 1. 배경 및 핵심 질문

스페셜티 커피 로스터리 자사몰을 출시하면서, 운영진(대표 + 운영 보조 1~2인 가정)은 다음과 같은 운영 시나리오를 마주한다.

- 고객이 결제를 완료하면 **운영진의 휴대폰 또는 PC 에 알림이 즉시 떠야 한다.**
- 알림에는 **누가 / 무엇을 / 얼마에 / 어디로** 가 한눈에 보여야 한다.
- 알림 → 어드민 상세 페이지로 한 번에 진입할 수 있으면 가장 좋다.
- 출시 초기에는 **월 비용을 최소화**하고, 주문량이 늘어나는 시점에 단계적 확장한다.

이 보고서는 위 조건에 부합하는 **10개 솔루션**을 조사하고, GTR 의 현재 인프라와 규모에 맞는 조합을 제시한다.

---

## 2. 솔루션 요약 비교 (10종)

| # | 채널 | 실시간성 | 도달률 (운영진) | 월 비용 (출시 초기) | 구현 난이도 | 한국 적합성 |
|---|---|---|---|---|---|---|
| 1 | 이메일 (Resend) | ⚠ 분~시간 | 30~60% | **0원** (월 3,000건 무료) | 🟢 즉시 | 보조 |
| 2 | 카카오 알림톡 | ✅ 초 단위 | 99%+ | 건당 9~15원 | 🟡 1~2주 (심사) | ⭐⭐⭐ 표준 |
| 3 | SMS / LMS | ✅ 초 단위 | 99% | SMS 12~20원 · LMS 30~40원 | 🟢 반나절 | 알림톡 fallback |
| 4 | **Slack Webhook** | ✅ 초 단위 | 90%+ (앱 깔린 경우) | **0원** (무제한) | 🟢 30분 | ⭐⭐ 내부 운영진용 |
| 5 | Discord Webhook | ✅ 초 단위 | 90%+ | **0원** (무제한) | 🟢 30분 | ⭐ 한국 적합성 ↓ |
| 6 | Telegram Bot | ✅ 초 단위 | 90%+ | **0원** | 🟢 1시간 | ⭐ 한국 적합성 ↓ |
| 7 | 카카오 채널 + 챗봇 | ✅ 초 단위 | 95%+ | 친구톡 단가 ↑ | 🔴 사업자 인증 + 심사 | 운영진용으로는 과잉 |
| 8 | PWA 푸시 (web-push) | ✅ 초 단위 | 70~85% | **0원** (VAPID) | 🟡 1~2일 | iOS 16.4+ 지원 |
| 9 | Supabase Realtime + 어드민 대시보드 | ✅ 즉시 | 켜놨을 때만 | **0원** (현 플랜 포함) | 🟢 반나절 | 보조 채널 |
| 10 | 전용 모바일 앱 + FCM | ✅ 초 단위 | 95%+ | 앱 개발비 (별 프로젝트) | 🔴 별 프로젝트 | 과잉 |

---

## 3. 솔루션별 상세 분석

### 3.1 이메일 (Resend) — 현재 도입 중

#### 작동 방식
주문 완료 시 server action 에서 Resend API 호출 → 운영진 이메일 받는함 → 메일 앱이 받음.

```
[고객 결제] → [server action] → [Resend API] → [운영진 inbox]
                                                      ↓
                                            메일 앱 푸시 (선택적)
```

#### 장점
- 현 인프라에 이미 도입됨 (newsletter sprint 에서 검증)
- 월 3,000건 무료 (출시 초기 충분)
- 첨부 가능 (영수증 PDF 등)
- 기록 보존 자동

#### 단점
- **실시간성 약함** — 운영진이 이메일 알림을 활성화하지 않으면 즉시 도달하지 않음
- 한국 운영진의 이메일 체크 빈도 ↓ (특히 모바일)
- 도달률 30~60% (스팸 필터, 광고 분류 위험)

#### 운영진 수신 화면 (mockup)

```
┌─────────────────────────────────────────┐
│ Good Things Roasters <noreply@gtr.com>  │
│ [신규 주문] #20260522-001 — 김선영       │
│ 오전 9:42                                │
├─────────────────────────────────────────┤
│ 주문 내역                                │
│ • 케냐 키리냐가 AA · 200g · 1개         │
│ • 에티오피아 코체레 · 200g · 2개        │
│ 합계 67,000원                            │
│ 배송지: 서울 마포구 ...                  │
│ [어드민에서 보기]                        │
└─────────────────────────────────────────┘
```

#### GTR 적합도
✅ 백업/기록용 채널로 유지. 메인 알림 채널로 사용하지 않는 것을 권장.

---

### 3.2 카카오 알림톡 ⭐ — 한국 커머스 표준

#### 작동 방식
주문 완료 시 server action 에서 알림톡 공급사 (SOLAPI / NCP / Bizm) REST API 호출 → 카카오톡 채널에 사전 심사된 템플릿 메시지 발송 → 운영진 카카오톡으로 즉시 도달.

```
[고객 결제] → [server action] → [공급사 API] → [카카오 비즈 메시지 서버]
                                                       ↓
                                             운영진 카카오톡 푸시
                                                       ↓
                                       (도달 실패 시) LMS 자동 전환
```

#### 사전 준비
- 사업자등록증
- 통신판매신고증
- 카카오 비즈 메시지 발신 프로필 등록 (영업일 5~7일)
- 알림톡 템플릿 등록 + 심사 (영업일 1~3일)

#### 장점
- **도달률 99%+** — 한국 거의 모든 운영진이 카카오톡 사용
- 운영진 별도 앱 설치 / 가입 불필요
- 수신자 비용 0원
- 1,000자까지 가능
- 버튼/링크 첨부 가능 (어드민 상세 페이지 deeplink)

#### 단점
- 사업자 인증 + 템플릿 심사 = 진입 장벽
- **광고성 발송 금지** (정보성만 허용)
- 카카오 정책 위반 시 발송 정지 위험
- 건당 단가 발생 (9~15원)

#### 운영진 수신 화면 (mockup)

```
┌──────────────────────────────────────┐
│ 굳띵즈 운영 알림                       │
│ ───────────────                       │
│ [신규 주문 접수]                       │
│                                       │
│ 주문번호 #20260522-001                │
│ 고객 김선영 (010-****-1234)            │
│ 합계 67,000원 (3개 상품)              │
│                                       │
│ 배송지: 서울 마포구 ...                │
│                                       │
│ [어드민에서 보기]                       │
└──────────────────────────────────────┘
```

#### 공급사 비교

| 공급사 | 알림톡 단가 | LMS fallback | 콘솔 UX | 특이사항 |
|---|---|---|---|---|
| **SOLAPI** | 9~12원 | 30~35원 | ⭐⭐⭐ | Stripe 식 결제 / 개발자 친화 |
| **NCP SENS** | 11~14원 | 32~38원 | ⭐⭐ | Naver Cloud 통합 / 안정성 ↑ |
| **Bizm (NHN)** | 12~15원 | 35~40원 | ⭐⭐ | 대기업 안정성 / B2B 영업 |
| **카카오 i 알림톡** | 11~14원 | 별도 | ⭐⭐ | 카카오 직영 |

#### GTR 적합도
⭐⭐⭐ Stage 2 (출시 후 일 5~10건 안정) 시점 도입 권장. 출시 전 사업자 인증·발신 프로필 사전 준비 가능.

---

### 3.3 SMS / LMS

#### 작동 방식
주문 완료 시 server action 에서 공급사 API 호출 → 통신사 망 경유 → 운영진 휴대폰 문자 메시지.

#### 장점
- 100% 도달 (피처폰까지 가능)
- 사업자 인증 절차가 알림톡보다 가벼움 (발신번호 사전 등록만)
- 운영진 카카오톡 안 봐도 도착

#### 단점
- 단가 ↑ (알림톡의 1.5~3배)
- 단순 텍스트 (90자 SMS / 2,000자 LMS)
- 버튼/링크 클릭 시 별 brower 진입
- 알림톡 도입했다면 거의 fallback 으로만 사용

#### GTR 적합도
⚠ 알림톡의 fallback 으로만 사용 권장 (단독 채택 불권장).

---

### 3.4 Slack Incoming Webhook ⭐ — 내부 운영진 최적

#### 작동 방식
Slack 워크스페이스 채널에 webhook URL 1개 발급 → server action 에서 fetch POST → 채널에 카드 메시지 즉시 등장 → 운영진 데스크탑/모바일 푸시.

```
[고객 결제] → [server action]
                  ↓
   fetch(SLACK_WEBHOOK_URL, { method: 'POST', body: JSON })
                  ↓
        Slack #orders 채널 메시지 등장
                  ↓
        ┌─────────────────────────────┐
        ├─ 운영진 데스크탑 알림         │
        ├─ 운영진 모바일 푸시           │
        └─ 채널 멘션 (@channel)        │
                  ↓
        클릭 → /admin/orders/[id]
```

#### 장점
- **완전 무료** (메시지 수 무제한)
- 5분 설정 (워크스페이스 → 앱 → Incoming Webhooks → URL 발급)
- Block Kit 으로 풍부한 카드 메시지 (이미지·버튼·필드 분할)
- 채널 분리 가능 (`#orders` / `#subs` / `#errors`)
- 검색 / 히스토리 보존 자동
- 운영진간 즉시 의견 교환 (스레드)

#### 단점
- 운영진이 Slack 사용 의지 필요 (한국 보편성 ↓)
- 모바일 푸시 = 사용자가 개별 설정 (앱 깔고 알림 켜기)
- 무료 플랜 = 메시지 90일 보존 (이후 조회 제한)

#### 운영진 수신 화면 (mockup)

```
┌────────────────────────────────────────┐
│  #orders                               │
│  Good Things Bot · 오전 9:42           │
│  ───────────────                       │
│  🟢  신규 주문 #20260522-001            │
│                                        │
│  고객      금액         결제 수단        │
│  김선영    67,000원      토스페이먼츠    │
│                                        │
│  상품 (3개)                             │
│  • 케냐 키리냐가 AA · 200g · 1개       │
│  • 에티오피아 코체레 · 200g · 2개      │
│                                        │
│  배송지: 서울 마포구 ...                │
│  요청사항: 부재 시 경비실 맡겨주세요    │
│                                        │
│  [ 어드민에서 보기 ]  [ 발송 처리 ]     │
└────────────────────────────────────────┘
```

#### 구현 흐름 (요약 코드)

```ts
// next/src/lib/notify/slack.ts
export async function notifySlack(payload: SlackBlocks) {
  if (!process.env.SLACK_WEBHOOK_ORDERS) return;
  await fetch(process.env.SLACK_WEBHOOK_ORDERS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

// server action 안 (결제 완료 직후)
await notifySlack(buildOrderBlocks(order));
```

- 실패해도 결제 흐름 막지 않도록 fire-and-forget (`.catch(() => {})`)
- 환경변수 1개 (`SLACK_WEBHOOK_ORDERS`)
- DB 변경 0건

#### GTR 적합도
⭐⭐⭐ **Stage 1 진입 즉시 권장**. 출시 전부터 운영진 단톡방처럼 사용 가능. 알림톡 도입 후에도 병행 유지 (운영진간 내부 의견 교환).

---

### 3.5 Discord Webhook

#### 작동 방식
Slack 과 동일 (webhook URL → POST). UI/UX 다름.

#### 장점
- 완전 무료 + 무제한 (Slack 90일 제한 없음)
- 웹훅 응답 속도 Slack 보다 빠름
- 게임 / 커뮤니티 출신 운영진에게 친숙

#### 단점
- 한국 B2B 환경에서 Discord 사용 빈도 ↓
- 비즈니스 신뢰도 ↓ (게임 이미지)

#### GTR 적합도
⭐ 운영진이 이미 Discord 사용 중이면 Slack 대체 가능. 그 외에는 Slack 우선.

---

### 3.6 Telegram Bot

#### 작동 방식
BotFather 로 봇 생성 → `chat_id` 획득 → server 에서 `sendMessage` API 호출 → 운영진 텔레그램 푸시.

#### 장점
- 완전 무료
- API 풍부 (운영진이 봇에게 명령 보내기 가능 — 예: `/today` → 오늘 매출 응답)
- 메시지 보존 무제한
- 매우 빠른 푸시

#### 단점
- 한국 운영진 가입률 ↓
- 비즈니스 사용 사례 ↓ (한국 한정)

#### GTR 적합도
⚠ 비추천 (운영진 친숙도 문제). 단, 1인 사업장이고 운영자가 Telegram 사용자라면 가능.

---

### 3.7 카카오 채널 + 챗봇

#### 작동 방식
운영자용이 아니라 **고객 대응용** 채널. 운영진 알림 용도로는 과잉.

#### GTR 적합도
❌ 운영진 알림 용도로는 추천하지 않음. 고객용 채널은 별개 sprint.

---

### 3.8 PWA 푸시 (Web Push API)

#### 작동 방식
1. 운영진이 어드민 페이지에서 "푸시 알림 받기" 버튼 클릭 → VAPID subscription 생성
2. subscription 을 Supabase 에 저장
3. 주문 발생 시 server 에서 web-push 라이브러리로 모든 subscription 에 푸시 전송
4. 운영진 휴대폰 / 데스크탑 OS 레벨 푸시

```
[고객 결제] → [server] → web-push → [VAPID]
                                      ↓
                          ┌───────────┴───────────┐
                          ↓                       ↓
                     OS 푸시 (휴대폰)         OS 푸시 (데스크탑)
```

#### 장점
- **추가 비용 0원** (Resend / Slack / 알림톡 모두 끊겨도 동작)
- 추가 인프라 0
- OS 레벨 푸시 (잠금 화면에도 등장)
- iOS 16.4+ 지원 (홈 화면 추가 시)

#### 단점
- 운영진이 각 디바이스에서 푸시 구독 수동 등록 필요
- iOS Safari 빈도 제한 (스팸 방지)
- 디바이스 변경 시 재구독 필요
- 잠금 해제 안 한 상태 도달률 ↓

#### 운영진 수신 화면 (휴대폰 잠금 화면)

```
┌────────────────────────────────────────┐
│  굳띵즈 어드민 · 지금                    │
│  신규 주문 #20260522-001                │
│  김선영 · 67,000원 (3개)                │
│  [밀어서 열기]                          │
└────────────────────────────────────────┘
```

#### GTR 적합도
⭐⭐ Stage 3 (Slack + 알림톡 운영 안정 후) 도입 권장. 운영진 휴대폰 잠금 화면 즉시성 추가.

---

### 3.9 Supabase Realtime + 어드민 대시보드

#### 작동 방식
Supabase Realtime 구독으로 `orders` 테이블 INSERT 이벤트 수신 → 어드민 페이지에 새 주문 카드 즉시 등장 + 알림음.

```
[고객 결제]
      ↓
   orders 테이블 INSERT
      ↓
Supabase Realtime broadcast (WebSocket)
      ↓
어드민 페이지가 켜져 있으면 → 카드 즉시 등장 + 알림음
어드민 페이지가 꺼져 있으면 → 도달 안 됨
```

#### 장점
- 현 Supabase 플랜에 이미 포함
- 추가 비용 0
- 어드민 페이지 안에서 즉시 확인 + 처리 흐름 연결

#### 단점
- **운영진이 어드민 탭을 켜놓고 있어야 도달** (실시간 알림 의미 약함)

#### GTR 적합도
✅ 보조 채널로 권장. **단독 사용 X**. 다른 채널 (Slack / 알림톡) + 어드민 켜져 있을 때 보강용.

---

### 3.10 전용 모바일 앱 + FCM

#### 작동 방식
별도 iOS / Android 앱 개발 → 운영진이 설치 → FCM 푸시.

#### 장점
- 모든 OS 레벨 푸시 안정성 최고
- 잠금 화면 / 백그라운드 도달률 ↑

#### 단점
- **별도 앱 개발 = 별 프로젝트** (3~6개월)
- 앱스토어 등록 / 심사 / 유지보수
- 운영진 < 5인 규모에서는 과잉

#### GTR 적합도
❌ 현 규모 + 출시 단계에서는 과잉. Stage 3 이후 일 50건 이상 + 운영진 확장 시점 재검토.

---

## 4. 비용 시나리오 분석 — 일 주문량별 월 예상

> 운영진 알림 발송 건수만 계산 (고객 알림 별개). 알림톡 정확한 단가는 공급사·계약 조건에 따라 변동.

### 시나리오 A — 출시 직후 (일 5건 / 월 ~150건)

| 채널 조합 | 월 예상 비용 | 비고 |
|---|---|---|
| **Slack + Resend + Supabase Realtime** | **0원** | ⭐ 권장 출발점 |
| 위 + 카카오 알림톡 (선택) | 약 1,500~2,300원 | 150건 × 10~15원 |
| 알림톡 단독 | 약 1,500~2,300원 | Slack 없으면 의견 교환 채널 부재 |
| 알림톡 + LMS fallback 30% | 약 2,800~4,000원 | 알림톡 도달 실패 fallback |
| Resend 단독 (현재) | 0원 | 도달률 30~60% — 비추천 |

### 시나리오 B — 출시 1~3개월 (일 10건 / 월 ~300건)

| 채널 조합 | 월 예상 비용 | 비고 |
|---|---|---|
| Slack + Resend | **0원** | 운영진 휴대폰 푸시 의존도 ↓ |
| **Slack + 알림톡** | 약 3,000~4,500원 | ⭐ Stage 2 권장 |
| Slack + 알림톡 + LMS fallback 30% | 약 5,700~8,100원 | 알림톡 + 도달 실패 대비 |
| Slack + 알림톡 + PWA 푸시 | 약 3,000~4,500원 | 푸시 추가 = 0원 |

### 시나리오 C — 안정기 (일 30건 / 월 ~900건)

| 채널 조합 | 월 예상 비용 | 비고 |
|---|---|---|
| Slack + 알림톡 | 약 8,100~13,500원 | |
| **Slack + 알림톡 + LMS fallback + PWA 푸시** | 약 15,400~25,000원 | ⭐ Stage 3 권장 |
| 알림톡 단독 + LMS fallback | 약 15,400~25,000원 | Slack 빠지면 의견 교환 부재 |

### 시나리오 D — 성수기 / 프로모션 (일 100건 / 월 ~3,000건)

| 채널 조합 | 월 예상 비용 | 비고 |
|---|---|---|
| Slack + 알림톡 + LMS fallback + PWA 푸시 | 약 51,000~85,000원 | |
| Resend 비용 추가 | 월 3,001~50,000건 = $20 (약 28,000원) | Resend 무료 한도 초과 시 |

> **참고:** 운영진이 1인이 아닌 N명일 때, 알림톡은 N배 (운영진 각자에게 발송). Slack 은 채널 1개 = N명 무관.

---

## 5. GTR 단계별 추천안

### Stage 1 — 출시 직전 ~ 일 5건 미만 (현 시점)

**조합:** Slack Webhook + Resend (현재) + Supabase Realtime 어드민 대시보드 보강

| 채널 | 역할 | 비용 |
|---|---|---|
| **Slack #orders** | 메인 알림 채널. 운영진간 의견 교환 겸용 | 0원 |
| Resend 이메일 | 백업 / 기록 보존 (현 상태 유지) | 0원 |
| Supabase Realtime | 어드민 페이지 켜놨을 때 즉시 카드 등장 | 0원 |

**월 예상 비용: 0원**
**구현 sprint 추정: 2~4h** (Slack workspace 생성 + webhook 발급 + server action 1곳 추가 + 어드민 카운트 배지)

### Stage 2 — 출시 1~3개월 / 일 5~10건

**조합:** Stage 1 + 카카오 알림톡 추가

| 채널 | 역할 | 비용 (월) |
|---|---|---|
| Slack | 내부 협업 + 백업 | 0원 |
| **카카오 알림톡** | 운영진 휴대폰 즉시 도달 메인 | 약 1,500~4,500원 |
| LMS fallback | 알림톡 실패 시 자동 전환 | 약 1,500~3,500원 |
| Resend | 백업 / 기록 | 0원 |
| Supabase Realtime | 어드민 보강 | 0원 |

**월 예상 비용: 약 3,000~8,000원**
**구현 sprint 추정: 6~10h** (공급사 가입 + 발신 프로필 + 템플릿 심사 + 통합 + 테스트)

**선행 준비 (Stage 1 단계에서 미리)**
- 사업자등록증 / 통신판매신고증 확보
- SOLAPI 또는 NCP SENS 콘솔 가입
- 카카오 비즈 메시지 발신 프로필 등록 (영업일 5~7일 소요)
- 템플릿 초안 작성 → 심사 신청 (영업일 1~3일)

### Stage 3 — 안정기 / 일 10건 이상

**조합:** Stage 2 + PWA 푸시 + Slack App 화

| 채널 | 역할 | 비용 (월) |
|---|---|---|
| Slack App | Block Kit button (어드민 deeplink + 발송 처리 1탭) | 0원 |
| 카카오 알림톡 | 운영진 휴대폰 메인 | 약 8,000~13,500원 |
| LMS fallback | 자동 전환 | 약 2,500~4,000원 |
| **PWA 푸시** | 잠금 화면 즉시 도달 | 0원 |
| 어드민 대시보드 | 통계 위젯 + 신규 주문 배지 | 0원 |

**월 예상 비용: 약 10,500~17,500원**
**구현 sprint 추정: 8~14h** (PWA 푸시 + Slack App + Block Kit 버튼 인터랙션)

---

## 6. GTR 적합도 종합 평가 매트릭스

| 솔루션 | 출시 직전 (Stage 1) | 출시 1~3개월 (Stage 2) | 안정기 (Stage 3) |
|---|---|---|---|
| **Slack Webhook** | ⭐⭐⭐ 즉시 도입 | ⭐⭐⭐ 유지 | ⭐⭐⭐ App 화 확장 |
| 이메일 (Resend) | ✅ 백업 | ✅ 백업 | ✅ 백업 |
| Supabase Realtime | ✅ 보조 | ✅ 보조 | ✅ 보조 |
| **카카오 알림톡** | 사전 준비 | ⭐⭐⭐ 도입 | ⭐⭐⭐ 메인 |
| LMS fallback | — | ⭐⭐ 도입 | ⭐⭐⭐ 유지 |
| PWA 푸시 | — | — | ⭐⭐ 도입 |
| Discord / Telegram | ⚠ Slack 대체 시만 | ⚠ Slack 대체 시만 | ⚠ Slack 대체 시만 |
| 카카오 채널 | ❌ 운영진용 X | ❌ | ❌ |
| 전용 모바일 앱 | ❌ 과잉 | ❌ 과잉 | ⚠ 일 50+ 시 재검토 |

---

## 7. 구현 로드맵 (출시 직전 ~ 안정기)

### 7.1 Stage 1 즉시 진입 가능 작업 (S250-7 sprint 후보 · 2~4h)

1. Slack 워크스페이스 생성 (운영진 초대)
2. `#orders` 채널 + Incoming Webhook URL 발급
3. `lib/notify/slack.ts` 신규 (fire-and-forget)
4. `app/api/checkout/complete` 또는 토스 webhook handler 에서 호출
5. Block Kit 카드 메시지 디자인 (주문번호 · 고객 · 금액 · 상품 · 배송지 · deeplink)
6. 환경변수 `SLACK_WEBHOOK_ORDERS` Vercel 등록
7. 테스트 (스테이징에서 mock 결제)

### 7.2 Stage 2 사전 준비 (Stage 1 진행과 병행)

1. 사업자 인증 서류 확보
2. SOLAPI / NCP SENS 콘솔 비교 후 결정
3. 카카오 비즈 메시지 발신 프로필 등록 (5~7일)
4. 알림톡 템플릿 초안 작성
   - `[신규 주문] {{order_number}} 접수 — {{customer_name}} / {{amount}}원 ({{item_count}}건)`
5. 템플릿 심사 신청 (1~3일)
6. 출시 후 일 5건 도달 시점 통합 sprint 진입

### 7.3 Stage 3 진입 시점 결정 기준

- 일 주문 10건 이상 안정 + 운영진 휴대폰 잠금 화면 즉시성 필요 인식 시
- 또는 알림톡 도달률 통계상 95% 미만으로 떨어질 때 PWA 푸시 fallback 우선
- 또는 운영진 확장 (3인 이상) 시점

---

## 8. 결론 및 권고

### 8.1 즉시 권고
**Slack Webhook 메인 채널 + Resend 백업 + Supabase Realtime 어드민 대시보드 보강** 조합을 출시 전 도입한다. 월 비용 0원·구현 2~4h·외부 의존성 0.

### 8.2 단계 권고
- **Stage 1 → 2 전환:** 일 5건 도달 + 사업자 인증 완료 시점에 카카오 알림톡 도입.
- **Stage 2 → 3 전환:** 일 10건 안정 + 운영진 잠금 화면 즉시성 필요 시점에 PWA 푸시 + Slack App 확장.

### 8.3 회피 권고
- Discord / Telegram — 한국 비즈니스 보편성 ↓
- 카카오 채널 + 챗봇 — 운영진 알림 용도로는 과잉
- 전용 모바일 앱 — 일 50건 미만 단계에서는 비용 대비 가치 부족
- Resend 단독 — 도달률 부족, 백업 채널로만 유지

### 8.4 의사결정 잠금 (DEC 후보)
- **DEC-NOTIFY-1:** 운영진 알림 메인 채널 = Slack (Stage 1) → 카카오 알림톡 추가 (Stage 2)
- **DEC-NOTIFY-2:** 백업 채널 = Resend 이메일 유지
- **DEC-NOTIFY-3:** 보조 채널 = Supabase Realtime + 어드민 카운트 배지 (모든 단계)
- **DEC-NOTIFY-4:** Stage 2 공급사 = SOLAPI 우선 (가격 + 콘솔 UX 기준) — 가입 단계 재확정

---

## 부록 A — Slack Webhook 구현 예시 (참고 자료)

```ts
// next/src/lib/notify/slack.ts
type SlackBlocks = {
  text: string;
  blocks?: Array<unknown>;
};

export async function notifySlack(payload: SlackBlocks) {
  const url = process.env.SLACK_WEBHOOK_ORDERS;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    // 결제 흐름 막지 않도록 silent
    console.error('[slack] failed', e);
  }
}

export function buildOrderBlocks(order: Order): SlackBlocks {
  return {
    text: `신규 주문 #${order.order_number}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `🟢 신규 주문 #${order.order_number}` },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*고객*\n${order.customer_name}` },
          { type: 'mrkdwn', text: `*금액*\n${order.total.toLocaleString()}원` },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*상품 (${order.items.length}개)*\n` +
            order.items.map(i => `• ${i.name} · ${i.quantity}개`).join('\n'),
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '어드민에서 보기' },
            url: `https://goodthingsroasters.com/admin/orders/${order.id}`,
          },
        ],
      },
    ],
  };
}
```

---

## 부록 B — 공식 문서 / 가격 페이지 참고

- Slack Incoming Webhook 공식 가이드: https://api.slack.com/messaging/webhooks
- Slack Block Kit Builder: https://app.slack.com/block-kit-builder
- 카카오 비즈 메시지 공식: https://business.kakao.com/info/bizmessage/
- SOLAPI 가격: https://solapi.com/pricing/
- NCP SENS 가격: https://www.ncloud.com/product/applicationService/sens
- Web Push API (MDN): https://developer.mozilla.org/docs/Web/API/Push_API

> 가격은 본 보고서 작성 시점 (2026-05-22) 공시 기준. 공급사 정책 / 협상 / 볼륨 할인에 따라 변동.

---

*문서 끝.*
