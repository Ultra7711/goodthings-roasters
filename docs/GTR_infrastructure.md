# GTR 기술 인프라 및 운영 비용 계획

> Good Things Roasters (주식회사 브이티이코프)  
> 작성일: 2026년 4월 | 문서 버전: v2.0

---

## 목차

1. [기술 스택](#1-기술-스택)
2. [전체 인프라 아키텍처](#2-전체-인프라-아키텍처)
3. [호스팅 인프라](#3-호스팅-인프라)
4. [이메일 시스템](#4-이메일-시스템)
5. [도메인 및 DNS](#5-도메인-및-dns)
6. [결제 시스템](#6-결제-시스템)
7. [운영 비용 요약](#7-운영-비용-요약)

---

## 1. 기술 스택

| 구분 | 기술/서비스 | 역할 |
|------|------------|------|
| 프론트엔드 | Next.js 14 | 웹사이트 및 쇼핑몰 UI |
| 호스팅 | Vercel | 서버리스 배포 플랫폼 |
| 데이터베이스 | Supabase (PostgreSQL) | 회원/주문/상품 데이터 관리 |
| 결제 | Toss Payments API | 국내 카드/간편결제 처리 |
| 이메일 발신 | Resend | 주문확인/배송안내 자동 이메일 |
| 이메일 수신 | Google Workspace | 고객 문의 수신 및 답변 |
| 도메인 | Gabia → Cafe24 DNS | goodthingsroasters.com |

---

## 2. 전체 인프라 아키텍처

```
[ 사용자 ]
    │
    ▼ HTTPS
┌─────────────────────────────────┐
│  Vercel (Edge Network)          │
│  Next.js 14                     │
│  - 프론트엔드 UI                  │
│  - API Routes (서버사이드 로직)    │
└────────────┬────────────────────┘
             │
      ┌──────┴──────┐
      ▼             ▼
┌──────────┐  ┌─────────────────┐
│ Supabase │  │  Toss Payments  │
│PostgreSQL│  │  결제 처리       │
│회원/주문 │  │  카드/간편결제   │
└──────────┘  └─────────────────┘
             │
      ┌──────┴──────┐
      ▼             ▼
┌──────────┐  ┌──────────────────────┐
│  Resend  │  │   Google Workspace   │
│  자동발신 │  │  hello@goodthings... │
│  이메일  │  │  고객 문의 수신       │
└──────────┘  └──────────────────────┘

[ 도메인/DNS ]
Gabia (등록) → Cafe24 네임서버 → DNS 레코드 관리
```

---

## 3. 호스팅 인프라

### Vercel

- Next.js 공식 배포 플랫폼
- GitHub push 시 자동 빌드/배포
- HTTPS 인증서 자동 발급

| 플랜 | 대역폭 | 함수 실행 | 비용 |
|------|--------|----------|------|
| Hobby (무료) | 100GB/월 | 100GB-hrs/월 | 무료 |
| Pro | 1TB/월 | 1,000GB-hrs/월 | $20/월 |

> 초기 런칭은 무료 플랜으로 시작, 트래픽 증가 시 Pro 전환

### Supabase

- PostgreSQL 기반 BaaS
- 회원 인증, 주문/상품 데이터 관리
- Row Level Security (RLS) 적용 필수

| 플랜 | DB 용량 | MAU | 비용 |
|------|--------|-----|------|
| Free (무료) | 500MB | 50,000명 | 무료 |
| Pro | 8GB | 무제한 | $25/월 |

---

## 4. 이메일 시스템

### 이메일 흐름

```
[ 자동 발신 흐름 ]

고객 행동 (회원가입 / 주문완료 / 배송출발)
    │
    ▼
Next.js API Route (Vercel)
    │  Resend API 호출
    ▼
Resend
    │  noreply@goodthingsroasters.com 으로 발송
    │  reply-to: hello@goodthingsroasters.com
    ▼
고객 받은 편지함

---

[ 고객 답장 / 문의 흐름 ]

고객 (이메일 답장 또는 직접 문의)
    │
    ▼
Google Workspace
    hello@goodthingsroasters.com
    Gmail UI에서 확인 및 답변
```

### Resend (자동 발신)

- 역할: 시스템 자동 발송 전용 (받은 편지함 없음)
- 발신 주소: `noreply@goodthingsroasters.com`
- 도메인 인증: Cafe24 DNS에 TXT 레코드 추가 필요

**자동 발송 대상:**
- 회원가입 인증
- 주문 확인
- 배송 안내
- 비밀번호 재설정

| 플랜 | 발송 한도 | 비용 |
|------|---------|------|
| Free | 3,000건/월 | 무료 |
| Pro | 50,000건/월 | $20/월 |

### Google Workspace (수신)

| 주소 | 용도 |
|------|------|
| `hello@goodthingsroasters.com` | 고객 문의 수신, 일반 커뮤니케이션 |
| `noreply@goodthingsroasters.com` | Resend 발신 주소 (reply-to → hello@) |

- 비용: $6/월 (약 ₩8,500)

---

## 5. 도메인 및 DNS

### 현재 도메인 정보

- **도메인:** goodthingsroasters.com
- **등록사:** Gabia (가비아)
- **현재 네임서버:** Cafe24 (`NS1.CAFE24.COM`, `NS2.CAFE24.COM`)

### DNS 구성 옵션

```
[ 옵션 A — 현재 구성 (Cafe24 유지) ]

가비아 (도메인 소유)
    │
    ▼ 네임서버 위임
Cafe24 DNS
    ├── A 레코드:     @ → 76.76.21.21         (Vercel 루트)
    ├── CNAME:       www → cname.vercel-dns.com (Vercel www)
    ├── TXT/MX:      Resend 이메일 인증
    └── TXT/MX:      Google Workspace 이메일 인증

---

[ 옵션 B — Vercel DNS로 네임서버 변경 ]

가비아 (도메인 소유)
    │
    ▼ 네임서버 변경
Vercel DNS (ns1.vercel-dns.com / ns2.vercel-dns.com)
    └── 모든 DNS 레코드를 Vercel 대시보드에서 통합 관리
```

**옵션 선택 기준:**

| | 옵션 A (Cafe24 유지) | 옵션 B (Vercel DNS) |
|--|---------------------|-------------------|
| DNS 관리 위치 | Cafe24 관리자 | Vercel 대시보드 |
| Cafe24 서비스 병행 | ✅ 가능 | ❌ 불가 |
| 관리 편의성 | 보통 | 간편 |
| 권장 상황 | Cafe24 이메일 등 병행 시 | Vercel만 사용 시 |

### DNS 레코드 설정값

| 타입 | 호스트명 | 값 | 용도 |
|------|---------|-----|------|
| A | @ | 76.76.21.21 | Vercel 루트 도메인 |
| CNAME | www | cname.vercel-dns.com | Vercel www 연결 |
| TXT/MX | (다수) | Resend/Google 제공값 | 이메일 인증 |

---

## 6. 결제 시스템

### 결제 흐름

```
고객 (결제 버튼 클릭)
    │
    ▼
Next.js 프론트엔드 (Vercel)
    │  Toss Payments 결제창 호출
    ▼
Toss Payments
    │  카드사 / 간편결제사 결제 처리
    │  승인 결과 반환
    ▼
Next.js API Route (서버사이드)
    │  시크릿 키로 최종 승인 검증  ← 반드시 서버사이드에서 처리
    │
    ├──▶ Supabase DB  (주문 정보 저장)
    └──▶ Resend       (주문 확인 이메일 발송)
```

> **보안 주의:** Toss Payments 시크릿 키는 반드시 서버사이드(API Route)에서만 사용. 클라이언트에 노출 금지.

### Toss Payments 수수료

| 결제 수단 | 수수료율 |
|---------|---------|
| 신용/체크카드 | 약 1.5 ~ 3.5% |
| 간편결제 (카카오, 네이버 등) | 약 1.5 ~ 3.0% |
| 월정액 | 없음 |

### 카페24 솔루션 vs Toss Payments 직접 연동 비교

| 항목 | 카페24 솔루션 | Toss Payments 직접 연동 |
|------|------------|----------------------|
| PG 수수료 (카드) | 약 2.0 ~ 3.5% | 약 1.5 ~ 3.5% |
| PG 수수료 (간편) | 약 2.0 ~ 3.5% | 약 1.5 ~ 3.0% |
| PG 수수료 (이체) | 약 1.8% | 약 1.0 ~ 1.5% |
| 플랫폼 판매 수수료 | **+3% (브랜드몰)** | **없음** |
| **실질 합산** | **약 5.0 ~ 6.5%** | **약 1.5 ~ 3.5%** |

> 영세/중소 사업자 우대 수수료(연 매출 3억 이하)는 두 방식 모두 동일 적용됨.

---

## 7. 운영 비용 요약

### 초기 고정 비용

| 항목 | 서비스 | 플랜 | 월 비용 |
|------|--------|------|--------|
| 도메인 | 가비아 | 연간 결제 | 약 ₩2,000 |
| 프론트엔드 호스팅 | Vercel | Hobby (무료) | ₩0 |
| 데이터베이스 | Supabase | Free | ₩0 |
| 자동 발신 이메일 | Resend | Free | ₩0 |
| 도메인 이메일 | Google Workspace | Business Starter | 약 ₩8,500 |
| **합계** | | | **약 ₩10,500/월** |

### 단계별 비용 성장

```
① 런칭 초기
   모든 무료 플랜 운영
   └── 월 약 ₩10,500
       │
       │  트래픽 증가 → Vercel Pro 전환 ($20/월)
       ▼
② 성장기
   Vercel Pro 추가
   └── 월 약 ₩40,000 ~ 50,000
       │
       │  DB 용량 증가 → Supabase Pro 전환 ($25/월)
       ▼
③ 확장기
   Vercel Pro + Supabase Pro
   └── 월 약 ₩75,000 ~ 90,000
```

| 단계 | 상황 | 추가 전환 | 월 예상 비용 |
|------|------|---------|-----------|
| 런칭 초기 | 트래픽 소량 | 없음 | 약 ₩10,500 |
| 성장기 | 트래픽 증가 | Vercel Pro | 약 ₩40,000~50,000 |
| 확장기 | DB 용량 증가 | + Supabase Pro | 약 ₩75,000~90,000 |

---

## 권고사항

- 초기에는 모든 서비스 무료 플랜으로 시작, 실제 사용량 확인 후 플랜 전환 결정
- Toss Payments 직접 연동 유지 → 카페24 대비 수수료 절감
- Toss Payments 시크릿 키는 반드시 서버사이드(API Route)에서만 처리
- Supabase RLS(Row Level Security) 정책 반드시 적용
- Google Workspace는 런칭 초기부터 도입 권장
- 향후 비용 이슈 발생 시 Hetzner + Coolify 셀프호스팅 이전 검토
