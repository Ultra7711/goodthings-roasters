'use server';

/* ══════════════════════════════════════════════════════════════════════════
   lib/bizSubmit.ts — B2B 비즈니스 문의 server action (S243-A-2)

   책임:
   - /biz-inquiry 의 BizInquiryPage submit 처리 (게스트 + 회원 공통)
   - Zod 검증 (필수 6 + biz_type + 동의 + 선택 필드)
   - biz_inquiries INSERT (회원이면 user_id 자동 연결)
   - 운영자 알림 메일 (Resend · sendBizInquiryNotificationEmail · fire-and-forget)

   분리 사유:
   - lib/biz.ts 는 BIZ_*_OPTIONS 등 client-safe 상수 export.
   - server action 은 'use server' 모듈로 격리 (export 전부 server function 됨).

   참조:
   - 067_biz_inquiries.sql (RLS · 정책 · 컬럼)
   - lib/email/notifications.ts (sendBizInquiryNotificationEmail)
   - lib/newsletter.ts (S241 답습 패턴)
   ════════════════════════════════════════════════════════════════════════ */

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { sendBizInquiryNotificationEmail } from '@/lib/email/notifications';
import {
  BIZ_TYPE_OPTIONS,
  BIZ_VOLUME_OPTIONS,
  BIZ_CYCLE_OPTIONS,
  BIZ_PRODUCT_OPTIONS,
} from '@/lib/biz';

/* ─── 입력 스키마 ──────────────────────────────────────────────────────── */

const TYPE_VALUES = BIZ_TYPE_OPTIONS.map((o) => o.value) as [string, ...string[]];
const VOLUME_VALUES = BIZ_VOLUME_OPTIONS.map((o) => o.value) as [string, ...string[]];
const CYCLE_VALUES = BIZ_CYCLE_OPTIONS.map((o) => o.value) as [string, ...string[]];
const PRODUCT_VALUES = BIZ_PRODUCT_OPTIONS.map((o) => o.value) as [string, ...string[]];

/* 필수 텍스트 — 빈 문자열 차단 + 길이 상한 (스팸/abuse 방어) */
const nonEmpty = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} 필수`).max(max, `${label} 길이 초과`);

const submitSchema = z.object({
  name: nonEmpty('고객명', 100),
  email: z.string().trim().toLowerCase().email('이메일 형식 오류').max(200),
  phone: nonEmpty('전화번호', 30),
  company: nonEmpty('상호명', 200),
  bizType: z.enum(TYPE_VALUES),
  address: nonEmpty('사업장 주소', 300),
  regNum: z.string().trim().max(20).optional().default(''),
  equipment: z.string().trim().max(500).optional().default(''),
  currentBean: z.string().trim().max(200).optional().default(''),
  products: z.array(z.enum(PRODUCT_VALUES)).max(PRODUCT_VALUES.length).default([]),
  monthlyVolume: z.enum(VOLUME_VALUES).optional().or(z.literal('')).default(''),
  deliveryCycle: z.enum(CYCLE_VALUES).optional().or(z.literal('')).default(''),
  message: nonEmpty('요청 사항', 5000),
  /* 동의 — false 면 invalid_consent 로 거부 (PIPA) */
  consent: z.literal(true, { message: '개인정보 수집·이용 동의 필요' }),
});

export type BizInquirySubmitInput = z.input<typeof submitSchema>;

export type BizInquirySubmitResult =
  | { ok: true }
  | { ok: false; error: 'invalid_input' | 'invalid_consent' | 'db_error'; detail?: string };

/* label 변환 헬퍼 — value → label (값 없으면 null) */
function labelOf(
  value: string,
  options: { value: string; label: string }[],
): string | null {
  if (!value) return null;
  return options.find((o) => o.value === value)?.label ?? null;
}

export async function submitBizInquiry(
  input: BizInquirySubmitInput,
): Promise<BizInquirySubmitResult> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    /* 동의 누락은 별도 에러 코드로 분리 (UX 분기 명확화) */
    const consentIssue = parsed.error.issues.find(
      (i) => i.path.length === 1 && i.path[0] === 'consent',
    );
    if (consentIssue) {
      return { ok: false, error: 'invalid_consent' };
    }
    return {
      ok: false,
      error: 'invalid_input',
      detail: parsed.error.issues[0]?.message,
    };
  }

  const data = parsed.data;

  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /* client 측 id 사전 생성 — RLS 패턴 (Newsletter Phase 1 답습 · S243-A-2 fix).
     RETURNING (.select().single()) 사용 시 PostgreSQL 이 SELECT 정책도 적용하는데
     anon 은 owner_select / admin_select 어느 쪽도 매칭 안 되어 INSERT 전체가
     42501 RLS violation 으로 fail. RETURNING 제거 + id 미리 생성으로 우회. */
  const id = randomUUID();
  const createdAt = new Date();

  const { error } = await supabase.from('biz_inquiries').insert({
    id,
    user_id: user?.id ?? null,
    name: data.name,
    email: data.email,
    phone: data.phone,
    company: data.company,
    biz_type: data.bizType,
    address: data.address,
    reg_num: data.regNum || null,
    equipment: data.equipment || null,
    current_bean: data.currentBean || null,
    products: data.products,
    monthly_volume: data.monthlyVolume || null,
    delivery_cycle: data.deliveryCycle || null,
    message: data.message,
  });

  if (error) {
    console.error('[biz-inquiry] insert failed', error);
    return {
      ok: false,
      error: 'db_error',
      detail:
        process.env.NODE_ENV === 'development'
          ? `${error?.code ?? ''} ${error?.message ?? ''}`.trim() || 'unknown'
          : undefined,
    };
  }

  /* 운영자 알림 메일 — fire-and-forget. label 변환은 호출 측에서 완료 후 전달. */
  const submittedAt = createdAt.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const productLabels = data.products
    .map((p) => labelOf(p, BIZ_PRODUCT_OPTIONS))
    .filter((l): l is string => l !== null);

  void sendBizInquiryNotificationEmail(id, {
    name: data.name,
    email: data.email,
    phone: data.phone,
    company: data.company,
    bizTypeLabel: labelOf(data.bizType, BIZ_TYPE_OPTIONS) ?? data.bizType,
    address: data.address,
    regNum: data.regNum || null,
    equipment: data.equipment || null,
    currentBean: data.currentBean || null,
    productLabels,
    monthlyVolumeLabel: labelOf(data.monthlyVolume, BIZ_VOLUME_OPTIONS),
    deliveryCycleLabel: labelOf(data.deliveryCycle, BIZ_CYCLE_OPTIONS),
    message: data.message,
    submittedAt,
  });

  return { ok: true };
}
