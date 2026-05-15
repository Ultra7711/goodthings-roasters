/* ══════════════════════════════════════════════════════════════════════════
   lib/admin/users.ts — 어드민 사용자 목록·상세 순수 헬퍼 (S169 PR-1)

   역할:
   - role 탭 정의 (전체 / admin / customer) + tone 매핑
   - searchParams (q · role · page) Zod 파싱
   - 검색어 sanitize (PostgREST .or ilike 우회 방지)
   - 가입일 포맷 (YYYY.MM.DD)
   - 표시 형태 (ListedUser) 타입

   설계:
   - 클라이언트(UsersTableClient) + 서버(usersServer) 양쪽이 import 하므로
     반드시 client-safe (next/headers · cookies 의존 금지).
   - Supabase 호출은 usersServer.ts 의 fetchAdminUsers() 에 격리.
   - orders.ts 답습 — 동형 패턴 (PAGE_SIZE · STATUS_TABS → ROLE_TABS).

   RLS:
   - 020 의 profiles_select_admin 정책이 admin 에게 모든 profiles 행 SELECT 허용.
   - 030 의 orders_select_admin 정책이 admin 에게 모든 orders 행 SELECT 허용.
   - service_role 우회 불필요.
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';

/* ── 상수 ────────────────────────────────────────────────────────────── */

/** 페이지당 행 수 (orders 와 동일) */
export const PAGE_SIZE = 10;

/** role 탭 정의 */
export const ROLE_TABS = [
  { id: 'all', label: '전체' },
  { id: 'admin', label: '운영자' },
  { id: 'customer', label: '고객' },
] as const;

export type RoleTabKey = (typeof ROLE_TABS)[number]['id'];

/** profiles.role enum (020_profiles_role_rbac.sql) */
export type DbUserRole = 'admin' | 'customer';

/** S232: profiles.admin_level (055 마이그) — admin 권한 단계. customer = null. */
export type AdminLevel = 'owner' | 'staff';

/** Badge tone — orders 의 StatusTone 부분집합 */
export type RoleTone = 'primary' | 'neutral';

/**
 * DB role + admin_level → 시안 라벨 + tone.
 * S232: admin 안에서 owner='관리자' / staff='운영자' 분리.
 */
export function describeRole(
  role: DbUserRole,
  adminLevel: AdminLevel | null,
): { label: string; tone: RoleTone } {
  if (role !== 'admin') return { label: '고객', tone: 'neutral' };
  return adminLevel === 'owner'
    ? { label: '관리자', tone: 'primary' }
    : { label: '운영자', tone: 'primary' };
}

/* ── 가입 채널 (053_profiles_signup_provider.sql) ───────────────────── */

/** profiles.signup_provider enum */
export type SignupProvider = 'email' | 'google' | 'kakao' | 'naver';

/** DropdownFilter 옵션 — 'all' = 전체 */
export const PROVIDER_OPTIONS = [
  { id: 'all', label: '전체' },
  { id: 'email', label: '이메일' },
  { id: 'google', label: '구글' },
  { id: 'kakao', label: '카카오' },
  { id: 'naver', label: '네이버' },
] as const;

export type ProviderFilterKey = (typeof PROVIDER_OPTIONS)[number]['id'];

/** DB provider → 시안 라벨 (테이블 셀 표시) */
export function describeProvider(provider: SignupProvider): string {
  switch (provider) {
    case 'email': return '이메일';
    case 'google': return '구글';
    case 'kakao': return '카카오';
    case 'naver': return '네이버';
  }
}

/* ── 검색 입력 sanitize ──────────────────────────────────────────────── */

/**
 * q 를 PostgREST .or() ilike 절에 안전히 삽입하기 위한 sanitize.
 * - 와일드카드 (% _), 메타문자 (, *), 따옴표·백슬래시 제거.
 * - 공백 양끝 trim, 60자 cap.
 *
 * orders.sanitizeSearchQuery 와 동일 규칙.
 */
export function sanitizeSearchQuery(raw: string): string {
  return raw
    .trim()
    .replace(/[%_,()*"\\]/g, '')
    .slice(0, 60);
}

/* ── searchParams 파싱 ──────────────────────────────────────────────── */

const SearchParamsSchema = z.object({
  role: z.enum(['all', 'admin', 'customer']).default('all'),
  provider: z.enum(['all', 'email', 'google', 'kakao', 'naver']).default('all'),
  q: z.string().default(''),
  page: z.coerce.number().int().min(1).max(9999).default(1),
});

export type AdminUsersSearchParams = z.infer<typeof SearchParamsSchema>;

/**
 * URL searchParams (object) → 정규화된 필터.
 * 잘못된 값은 기본값(전체·1페이지)로 fallback (UI 깨짐 방지).
 */
export function parseSearchParams(
  raw: Record<string, string | string[] | undefined>,
): AdminUsersSearchParams {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') flat[k] = v;
    else if (Array.isArray(v) && v.length > 0) flat[k] = v[0];
  }
  const parsed = SearchParamsSchema.safeParse(flat);
  if (parsed.success) return parsed.data;
  /* 부분적으로만 깨졌어도 전부 기본값으로. UX 우선. */
  return SearchParamsSchema.parse({});
}

/* ── 표시 형태 (서버 → 클라 전달) ────────────────────────────────────── */

/** 시안 테이블 1행 표시용 */
export type ListedUser = {
  id: string;                  /* uuid (key 용) */
  email: string;
  fullName: string | null;
  displayName: string | null;
  role: DbUserRole;
  adminLevel: AdminLevel | null;   /* 055: admin 권한 단계. customer = null */
  signupProvider: SignupProvider;  /* 053: 가입 채널 */
  createdAtIso: string;        /* DB 원본 timestamptz */
  orderCount: number;          /* 누적 주문 수 (orders.user_id 그룹 카운트) */
};

/** 상세 페이지 — 프로필 단일 행 */
export type UserDetailProfile = {
  id: string;
  email: string;
  fullName: string | null;
  displayName: string | null;
  phone: string | null;
  role: DbUserRole;
  adminLevel: AdminLevel | null;   /* 055: admin 권한 단계 */
  createdAtIso: string;
  updatedAtIso: string;
};

/** 상세 페이지 — 사용자 주문 1행 (최근 N개) */
export type ListedUserOrder = {
  id: string;
  orderNumber: string;
  createdAtIso: string;
  status:
    | 'pending'
    | 'paid'
    | 'shipping'
    | 'delivered'
    | 'cancelled'
    | 'refund_requested'
    | 'refund_processing'
    | 'refunded';
  totalAmount: number;
};

/** admin_audit 1행 (역할 변경 이력 · S232 set_admin_level 추가) */
export type AdminAuditEntry = {
  id: string;
  actorId: string | null;
  actorEmail: string | null;       /* JOIN profiles.email */
  action: 'grant_admin' | 'revoke_admin' | 'set_admin_level';
  reason: string | null;
  createdAtIso: string;
};

/* ── 표시 포맷 헬퍼 ──────────────────────────────────────────────────── */

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 내부: ISO → KST 분해 */
function toKstParts(iso: string): { yyyy: number; mm: number; dd: number } {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return {
    yyyy: kst.getUTCFullYear(),
    mm: kst.getUTCMonth() + 1,
    dd: kst.getUTCDate(),
  };
}

/** ISO timestamp → KST "YYYY.MM.DD" (가입일 표시) */
export function formatJoinedDate(iso: string): string {
  const p = toKstParts(iso);
  return `${p.yyyy}.${pad2(p.mm)}.${pad2(p.dd)}`;
}

/** ISO timestamp → KST "YYYY.MM.DD HH:mm" (감사 로그 시각) */
export function formatAuditTimestamp(iso: string): string {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = kst.getUTCFullYear();
  const mm = kst.getUTCMonth() + 1;
  const dd = kst.getUTCDate();
  const hh = kst.getUTCHours();
  const mi = kst.getUTCMinutes();
  return `${yyyy}.${pad2(mm)}.${pad2(dd)} ${pad2(hh)}:${pad2(mi)}`;
}

/** 이름 표시 우선순위 — display_name → full_name → email local-part. */
export function resolveUserName(u: {
  email: string;
  fullName: string | null;
  displayName: string | null;
}): string {
  return (
    u.displayName?.trim() ||
    u.fullName?.trim() ||
    u.email.split('@')[0] ||
    u.email
  );
}
