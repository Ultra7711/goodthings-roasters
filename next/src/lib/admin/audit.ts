/* ══════════════════════════════════════════════════════════════════════════
   audit.ts — admin 감사 로그 client-safe 헬퍼 (S233-fu Step 3)

   역할:
   - AdminAuditAction → 시안 라벨 + tone
   - filters / details 표시 헬퍼

   클라이언트 (AuditTableClient) + 서버 (auditServer.ts) 양쪽 import.
   ══════════════════════════════════════════════════════════════════════════ */

import type { AdminAuditAction } from './auditServer';

/** 필터 라벨 답습 (orders / subscriptions) */
const PERIOD_LABELS: Record<string, string> = {
  all: '전체 기간',
  '7d': '최근 7일',
  '30d': '최근 30일',
  '90d': '최근 90일',
};

const ORDERS_STATUS_LABELS: Record<string, string> = {
  all: '전체',
  new: '신규',
  shipping: '배송중',
  delivered: '완료',
  cancelled: '취소',
};

const SUBS_STATUS_LABELS: Record<string, string> = {
  all: '전체',
  active: '진행중',
  paused: '일시정지',
  cancelled: '해지',
  expired: '만료',
};

const PAYMENT_LABELS: Record<string, string> = {
  all: '전체 결제',
  card: '카드',
  transfer: '계좌이체',
};

/** 액션 → 시안 라벨 + tone (Badge 표시용) */
export type AuditTone = 'primary' | 'success' | 'warning' | 'neutral' | 'info';

export function describeAuditAction(
  action: AdminAuditAction,
): { label: string; tone: AuditTone } {
  /* S255-C: CSV → Excel(xlsx) 전환 후 라벨 일반화. audit_log enum 'csv_*' 는
     backward compat 유지 (마이그 X) · 사용자 표시 라벨만 '내보내기' 로 갱신. */
  switch (action) {
    case 'csv_subscriptions':    return { label: '정기배송 내보내기', tone: 'info' };
    case 'csv_orders':           return { label: '주문 내보내기', tone: 'info' };
    case 'csv_users':            return { label: '고객 내보내기', tone: 'info' };
    case 'csv_products':         return { label: '상품 내보내기', tone: 'info' };
    case 'csv_audit':            return { label: '감사 로그 내보내기', tone: 'info' };
    case 'grant_admin':          return { label: '운영자 권한 부여', tone: 'success' };
    case 'revoke_admin':         return { label: '어드민 권한 해제', tone: 'neutral' };
    case 'set_admin_level':      return { label: '권한 단계 변경', tone: 'warning' };
    /* S258 P2: 회원 탈퇴 2종 — self = 자기 탈퇴, force = 운영자 직권. */
    case 'self_delete_account':  return { label: '회원 자기 탈퇴', tone: 'neutral' };
    case 'force_delete_account': return { label: '운영자 직권 탈퇴', tone: 'warning' };
    case 'adjust_points':        return { label: '포인트 수동 가감', tone: 'warning' };
  }
}

/** export 필터 jsonb → 사람이 읽을 수 있는 한 줄 요약. */
export function describeExportFilters(
  domain: string,
  filters: Record<string, unknown>,
): string {
  const parts: string[] = [];

  /* status — 도메인 별 라벨 매트릭스 */
  if (typeof filters.status === 'string' && filters.status !== 'all') {
    const labels = domain === 'orders' ? ORDERS_STATUS_LABELS : SUBS_STATUS_LABELS;
    parts.push(`상태: ${labels[filters.status] ?? filters.status}`);
  }

  if (typeof filters.period === 'string' && filters.period !== 'all') {
    parts.push(`기간: ${PERIOD_LABELS[filters.period] ?? filters.period}`);
  }

  if (typeof filters.payment === 'string' && filters.payment !== 'all') {
    parts.push(`결제: ${PAYMENT_LABELS[filters.payment] ?? filters.payment}`);
  }

  if (typeof filters.q === 'string' && filters.q.trim().length > 0) {
    parts.push(`검색: "${filters.q.trim()}"`);
  }

  return parts.length > 0 ? parts.join(' · ') : '전체';
}

/** ISO timestamp → KST "YYYY.MM.DD HH:mm" */
export function formatAuditKstDateTime(iso: string): string {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  const hh = String(kst.getUTCHours()).padStart(2, '0');
  const mi = String(kst.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
}
