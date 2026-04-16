/* ══════════════════════════════════════════════════════════════════════════
   mask.ts — Toss 응답의 민감 필드 마스킹 (P2-B Session 6 / CRITICAL C-3)

   역할:
   - Toss `/v1/payments/confirm` · `GET /v1/payments/{paymentKey}` 응답에는
     카드 번호 앞 6 + 뒤 4 (`523452******1234`), 가상계좌 번호, 구매자 연락처·
     이메일·CI 등 PII 가 포함될 수 있다. Toss 는 카드번호 중간 자리를 이미
     마스킹해 내려주지만(PCI DSS 3.4), **미래 스펙 변동 혹은 사내 파이프라인에서
     payment_transactions.raw_payload 로 적재된 JSON 이 재가공될 가능성** 에
     대비해 저장 단계에서 한 번 더 보수적으로 가린다.
   - MVP 현재는 재가공 파이프라인이 없지만 payment_events / 감사 뷰어가 추가될
     때 원본 노출 위험을 미리 없애는 목적.

   원칙:
   - **파괴적 아님**. 원본을 변형하지 않고 "마스킹된 복사본" 을 돌려준다.
   - 알려진 민감 필드만 가린다 (allowlist). 미지 필드는 그대로 둔다.
   - 최상위 키와 `card` · `virtualAccount` · `easyPay` · `mobilePhone` · `cashReceipt`
     · `cancels[]` 까지만 재귀. 전체 DFS 는 비용이 커 스펙 확정된 경로만 처리.

   참조:
   - docs/payments-flow.md §6.1 (PII 최소 저장 원칙)
   - docs/adr/ADR-002-payment-webhook-verification.md §6
   - Toss Payments "결제 확인" 응답 스펙:
     https://docs.tosspayments.com/reference#payment
   ══════════════════════════════════════════════════════════════════════════ */

/* ── 카드번호 마스킹 ────────────────────────────────────────────────────── */

/**
 * 카드번호(PAN) 앞 6자리 · 뒤 4자리 만 남기고 가린다.
 * Toss 는 이미 `523452******1234` 형태로 내려주지만 우리가 한 번 더 덮어쓴다.
 * - 길이 10 미만: 전부 `*`
 * - 그 외: 앞 6 + 중간 `*`…* + 뒤 4
 */
export function maskCardNumber(input: string | null | undefined): string | null {
  if (!input) return input ?? null;
  const digits = input.replace(/\D/g, '');
  if (digits.length < 10) return '*'.repeat(digits.length || 0);
  const head = digits.slice(0, 6);
  const tail = digits.slice(-4);
  const middle = '*'.repeat(Math.max(4, digits.length - 10));
  return `${head}${middle}${tail}`;
}

/* ── 가상계좌번호 마스킹 ────────────────────────────────────────────────── */

/**
 * 계좌번호는 앞 3자리 · 뒤 3자리 만 남긴다.
 * - 길이 6 미만: 전부 `*`
 */
export function maskAccountNumber(input: string | null | undefined): string | null {
  if (!input) return input ?? null;
  const digits = input.replace(/\D/g, '');
  if (digits.length < 6) return '*'.repeat(digits.length || 0);
  const head = digits.slice(0, 3);
  const tail = digits.slice(-3);
  const middle = '*'.repeat(Math.max(3, digits.length - 6));
  return `${head}${middle}${tail}`;
}

/* ── 이메일 마스킹 ─────────────────────────────────────────────────────── */

import { maskEmailAddress } from '../utils/maskEmail';

/**
 * 이메일 마스킹 — `lib/utils/maskEmail` 공용 유틸 래퍼 (null 허용).
 *
 * 2026-04-17 code-review H-2 통합:
 *   기존에는 `{head}***{tail}@domain` 규칙이었으나, email 로깅 경로와
 *   규칙이 달라 공용 유틸 (`j***@example.com`) 로 일원화. tail 자리 제거는
 *   PII 재식별 위험을 낮추는 방향이라 DB 저장 측면에서도 수용 가능.
 */
export function maskEmail(input: string | null | undefined): string | null {
  if (!input) return input ?? null;
  return maskEmailAddress(input);
}

/* ── 휴대폰 마스킹 ─────────────────────────────────────────────────────── */

/**
 * 한국 휴대폰 11자리(010XXXXYYYY) → `010-****-YYYY`.
 * 자릿수 판독이 애매하면 중간 4자리를 `*` 로 가린다.
 */
export function maskPhoneNumber(input: string | null | undefined): string | null {
  if (!input) return input ?? null;
  const digits = input.replace(/\D/g, '');
  if (digits.length < 7) return '*'.repeat(digits.length);
  const head = digits.slice(0, 3);
  const tail = digits.slice(-4);
  return `${head}-****-${tail}`;
}

/* ── Toss 응답 마스킹 ──────────────────────────────────────────────────── */

/**
 * JSON 값이 "객체" 인지 좁혀주는 타입 가드.
 * Toss 응답 `cancels` 는 배열이므로 별도 처리한다.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function maskCardSubobject(card: unknown): Record<string, unknown> {
  if (!isRecord(card)) return {};
  const out: Record<string, unknown> = { ...card };
  if (typeof card.number === 'string') {
    out.number = maskCardNumber(card.number);
  }
  return out;
}

function maskVirtualAccountSubobject(va: unknown): Record<string, unknown> {
  if (!isRecord(va)) return {};
  const out: Record<string, unknown> = { ...va };
  if (typeof va.accountNumber === 'string') {
    out.accountNumber = maskAccountNumber(va.accountNumber);
  }
  // `secret` 은 웹훅 검증용 값으로 payments.webhook_secret 컬럼에 따로 저장된다.
  // raw_response 에는 남기지 않는다.
  if ('secret' in va) {
    out.secret = '[REDACTED]';
  }
  return out;
}

function maskMobilePhoneSubobject(mp: unknown): Record<string, unknown> {
  if (!isRecord(mp)) return {};
  const out: Record<string, unknown> = { ...mp };
  if (typeof mp.customerMobilePhone === 'string') {
    out.customerMobilePhone = maskPhoneNumber(mp.customerMobilePhone);
  }
  return out;
}

function maskCashReceiptSubobject(cr: unknown): Record<string, unknown> {
  if (!isRecord(cr)) return {};
  const out: Record<string, unknown> = { ...cr };
  // 현금영수증 발행번호(휴대폰/사업자/주민등록번호 중 하나)
  if (typeof cr.receiptKey === 'string') {
    out.receiptKey = `${cr.receiptKey.slice(0, 4)}****`;
  }
  return out;
}

/**
 * Toss confirm / getPayment 응답을 DB 저장 전에 마스킹한다.
 *
 * 대상 필드 (Toss Payment 객체 스펙 기준):
 * - `card.number`
 * - `virtualAccount.accountNumber` / `virtualAccount.secret`
 * - `easyPay.amount` 는 숫자라 마스킹 불필요. `easyPay.discountAmount` 도 마찬가지.
 * - `mobilePhone.customerMobilePhone`
 * - `cashReceipt.receiptKey`
 * - `cancels[].*` — 카드 취소는 card 정보가 안 들어오지만 미래 대비해 배열 원소별 재귀.
 * - 최상위 `customerEmail` · `customerMobilePhone` (Toss 가 간혹 top-level 로 내리기도 함)
 *
 * @param raw Toss API 응답 원본 (객체가 아니면 그대로 반환)
 */
export function maskTossPayload(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;

  const masked: Record<string, unknown> = { ...raw };

  if (isRecord(raw.card)) masked.card = maskCardSubobject(raw.card);
  if (isRecord(raw.virtualAccount)) masked.virtualAccount = maskVirtualAccountSubobject(raw.virtualAccount);
  if (isRecord(raw.mobilePhone)) masked.mobilePhone = maskMobilePhoneSubobject(raw.mobilePhone);
  if (isRecord(raw.cashReceipt)) masked.cashReceipt = maskCashReceiptSubobject(raw.cashReceipt);

  if (typeof raw.customerEmail === 'string') {
    masked.customerEmail = maskEmail(raw.customerEmail);
  }
  if (typeof raw.customerMobilePhone === 'string') {
    masked.customerMobilePhone = maskPhoneNumber(raw.customerMobilePhone);
  }

  // cancels[] — 부분 환불 이력. 카드 정보가 들어올 여지가 있어 원소별 마스킹.
  if (Array.isArray(raw.cancels)) {
    masked.cancels = raw.cancels.map((item) => {
      if (!isRecord(item)) return item;
      const next: Record<string, unknown> = { ...item };
      if (isRecord(item.card)) next.card = maskCardSubobject(item.card);
      return next;
    });
  }

  return masked;
}
