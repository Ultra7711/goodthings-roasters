import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   csvExport.ts — admin 도메인 CSV 내보내기 공통 helper (S232)

   책임:
   - 필드 escape (RFC 4180 준수)
   - UTF-8 BOM + CRLF 라인 결합
   - 첫 행 안내 주석 (내부 자료 표기)
   - 파일명 패턴 (KST 시각)

   DEC (S232 잠금):
   - DEC-export-1: CSV 우선 (Excel 별 도입)
   - DEC-export-2: UTF-8 BOM (Excel 한글 호환)
   - DEC-export-3: MAX_EXPORT_ROWS = 10,000 (행 초과 시 caller 가 ROW_LIMIT_EXCEEDED 처리)
   - DEC-export-4: PII 평문 + admin actor 구조화 로그 (audit_log 별 sprint)
   - DEC-export-5: 파일명 = {domain}-{YYYY-MM-DD-HHmm}.csv (KST)

   PII 정책:
   - 운영 목적 (회계 / CS / 배송) 평문 허용. 외부 공유 금지 표기.
   - 다운로드 행위는 logCsvExportAudit 으로 console 구조화 기록 (Vercel log 보존).
   ══════════════════════════════════════════════════════════════════════════ */

/** DEC-export-3: CSV 행 수 상한 */
export const MAX_EXPORT_ROWS = 10_000;

/**
 * RFC 4180 escape — 큰따옴표 / 콤마 / 줄바꿈 포함 시 quote.
 * - null / undefined → 빈 문자열
 * - 큰따옴표 = 두 번 escape ("")
 */
export function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.length === 0) return '';
  const needsQuote = /[",\r\n]/.test(str);
  if (!needsQuote) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * headers + rows → CSV 문자열 (UTF-8 BOM + CRLF + 안내 주석 첫 행).
 *
 * - 첫 행: # 굳띵즈 로스터스 내부 운영 자료 — 외부 공유 금지 (KST 시각)
 * - 둘째 행: 헤더
 * - 셋째 행~: 데이터
 */
export function buildCsv(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>,
  meta: { domain: string; generatedAtKst: string },
): string {
  const BOM = '﻿';
  const CRLF = '\r\n';
  const notice = `# 굳띵즈 로스터스 ${meta.domain} 내부 운영 자료 — 외부 공유 금지 · 생성 ${meta.generatedAtKst}`;
  const headerLine = headers.map(escapeCsvField).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvField).join(','));
  return BOM + [notice, headerLine, ...dataLines].join(CRLF) + CRLF;
}

/* ── KST 포맷 헬퍼 ───────────────────────────────────────────────────── */

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toKstParts(iso: string): {
  yyyy: number; mm: number; dd: number; hh: number; mi: number;
} {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return {
    yyyy: kst.getUTCFullYear(),
    mm: kst.getUTCMonth() + 1,
    dd: kst.getUTCDate(),
    hh: kst.getUTCHours(),
    mi: kst.getUTCMinutes(),
  };
}

/** ISO → KST "YYYY.MM.DD HH:mm" (CSV 셀 표시용) */
export function formatKstDateTimeCell(iso: string | null): string {
  if (!iso) return '';
  const p = toKstParts(iso);
  return `${p.yyyy}.${pad2(p.mm)}.${pad2(p.dd)} ${pad2(p.hh)}:${pad2(p.mi)}`;
}

/** ISO → KST "YYYY.MM.DD" (CSV 셀 표시용 — 날짜만) */
export function formatKstDateCell(iso: string | null): string {
  if (!iso) return '';
  const p = toKstParts(iso);
  return `${p.yyyy}.${pad2(p.mm)}.${pad2(p.dd)}`;
}

/** 파일명 — {domain}-{YYYY-MM-DD-HHmm}.csv (KST) */
export function buildExportFilename(domain: string, nowIso: string = new Date().toISOString()): string {
  const p = toKstParts(nowIso);
  return `${domain}-${p.yyyy}-${pad2(p.mm)}-${pad2(p.dd)}-${pad2(p.hh)}${pad2(p.mi)}.csv`;
}

/** "현재 KST" 표시용 (안내 주석 행 사용) */
export function nowKstDisplay(nowIso: string = new Date().toISOString()): string {
  const p = toKstParts(nowIso);
  return `${p.yyyy}.${pad2(p.mm)}.${pad2(p.dd)} ${pad2(p.hh)}:${pad2(p.mi)} KST`;
}

/* ── audit 로그 (DB + console) ─────────────────────────────────────── */

/**
 * CSV 내보내기 행위 audit — admin_export_log 테이블 INSERT + console 병행.
 *
 * - DB: 056 마이그 admin_export_log (영구 보관 + owner 통합 조회)
 * - console: Vercel log 30일+ 보존 (DB INSERT 실패 시 fallback 가시성)
 *
 * RLS: admin_export_log_insert_admin_self — admin 본인 행만 INSERT 허용.
 * INSERT 실패해도 caller 의 다운로드 자체는 영향 없음 (best-effort).
 */
export async function logCsvExportAudit(params: {
  domain: 'subscriptions' | 'orders' | 'users' | 'products' | 'audit';
  actorId: string;
  filters: Record<string, unknown>;
  rowCount: number;
  truncated: boolean;
}): Promise<void> {
  /* eslint-disable-next-line no-console */
  console.log('[admin.export.csv]', JSON.stringify({
    domain: params.domain,
    actor_id: params.actorId,
    filters: params.filters,
    row_count: params.rowCount,
    truncated: params.truncated,
    at: new Date().toISOString(),
  }));

  try {
    const { createRouteHandlerClient } = await import('@/lib/supabaseServer');
    const supabase = await createRouteHandlerClient();
    const { error } = await supabase.from('admin_export_log').insert({
      actor_id: params.actorId,
      domain: params.domain,
      filters: params.filters,
      row_count: params.rowCount,
      truncated: params.truncated,
    });
    if (error) {
      console.error('[logCsvExportAudit] insert failed', {
        code: error.code,
        message: error.message?.slice(0, 200),
      });
    }
  } catch (err: unknown) {
    console.error('[logCsvExportAudit] caught', {
      message: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
    });
  }
}
