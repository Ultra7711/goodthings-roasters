import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   csvExport.ts — admin 도메인 내보내기 공통 helper (S232 · S255-C · S268 갱신)

   책임 (S255-C):
   - 파일명 패턴 (KST 시각 + 확장자)
   - KST 셀 포맷 (formatKstDateCell / formatKstDateTimeCell · 도메인 actions 가 재사용)
   - audit log (logExportAudit — admin_export_log INSERT + console 구조화)
   - 내보내기 행 상한 (MAX_EXPORT_ROWS)

   DEC (S232 잠금):
   - DEC-export-3: MAX_EXPORT_ROWS = 10,000 (행 초과 시 caller 가 ROW_LIMIT_EXCEEDED 처리)
   - DEC-export-4: PII 평문 + admin actor 구조화 로그
   - DEC-export-5: 파일명 = {domain}-{YYYY-MM-DD-HHmm}.{ext} (KST)

   S255-C 변경:
   - buildCsv 폐기 → xlsxExport.buildXlsxBuffer 로 일원화.
     Excel 한국 빌드의 BOM 무시 + 시스템 로케일(CP949) 강제 동작으로 인한 한글
     mojibake 우회. xlsx 는 zip+xml internal 이라 인코딩 무관.
   - buildExportFilename 의 확장자 인자화 (default 'xlsx').
   - audit_log enum 'csv_*' 은 backward compat 으로 유지 (라벨만 'XX 내보내기' 로
     갱신 — describeAuditAction).
   - 파일명 의미 변경 (csv → xlsx) — 모듈 파일명만 historical 'csvExport' 그대로.

   S268 변경:
   - logCsvExportAudit → logExportAudit (csv/xlsx 무관 generic naming)
   - console log prefix '[admin.export.csv]' → '[admin.export]' (xlsx 전환 반영)
   - 내부 console.error → logActionError 표준 prefix

   PII 정책:
   - 운영 목적 (회계 / CS / 배송) 평문 허용. 외부 공유 금지 표기.
   - 다운로드 행위는 logExportAudit 으로 console 구조화 기록 (Vercel log 보존).
   ══════════════════════════════════════════════════════════════════════════ */

import { logActionError } from './logActionError';

/** DEC-export-3: 내보내기 행 수 상한 */
export const MAX_EXPORT_ROWS = 10_000;

/* S255-C: buildCsv + escapeCsvField 폐기 — xlsxExport.buildXlsxBuffer 로 일원화.
   Excel 한국 빌드 BOM 무시 + CP949 강제 우회. 필요 시 git history 에서 복원 가능. */

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

/** ISO → KST "YYYY.MM.DD HH:mm" (내보내기 셀 표시용) */
export function formatKstDateTimeCell(iso: string | null): string {
  if (!iso) return '';
  const p = toKstParts(iso);
  return `${p.yyyy}.${pad2(p.mm)}.${pad2(p.dd)} ${pad2(p.hh)}:${pad2(p.mi)}`;
}

/** ISO → KST "YYYY.MM.DD" (내보내기 셀 표시용 — 날짜만) */
export function formatKstDateCell(iso: string | null): string {
  if (!iso) return '';
  const p = toKstParts(iso);
  return `${p.yyyy}.${pad2(p.mm)}.${pad2(p.dd)}`;
}

/** 파일명 — {domain}-{YYYY-MM-DD-HHmm}.{ext} (KST). S255-C: 기본 xlsx.
   확장자 인자 = 'xlsx' (default) | 'csv' (레거시 호환). */
export function buildExportFilename(
  domain: string,
  extension: 'xlsx' | 'csv' = 'xlsx',
  nowIso: string = new Date().toISOString(),
): string {
  const p = toKstParts(nowIso);
  return `${domain}-${p.yyyy}-${pad2(p.mm)}-${pad2(p.dd)}-${pad2(p.hh)}${pad2(p.mi)}.${extension}`;
}

/** "현재 KST" 표시용 (안내 주석 행 사용) */
export function nowKstDisplay(nowIso: string = new Date().toISOString()): string {
  const p = toKstParts(nowIso);
  return `${p.yyyy}.${pad2(p.mm)}.${pad2(p.dd)} ${pad2(p.hh)}:${pad2(p.mi)} KST`;
}

/* ── audit 로그 (DB + console) ─────────────────────────────────────── */

/**
 * 내보내기 행위 audit — admin_export_log 테이블 INSERT + console 병행.
 *
 * - DB: 056 마이그 admin_export_log (영구 보관 + owner 통합 조회)
 * - console: Vercel log 30일+ 보존 (DB INSERT 실패 시 fallback 가시성)
 *
 * RLS: admin_export_log_insert_admin_self — admin 본인 행만 INSERT 허용.
 * INSERT 실패해도 caller 의 다운로드 자체는 영향 없음 (best-effort).
 */
export async function logExportAudit(params: {
  domain: 'subscriptions' | 'orders' | 'users' | 'products' | 'audit';
  actorId: string;
  filters: Record<string, unknown>;
  rowCount: number;
  truncated: boolean;
}): Promise<void> {
  /* eslint-disable-next-line no-console */
  console.log('[admin.export]', JSON.stringify({
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
      logActionError('[logExportAudit] insert failed', error);
    }
  } catch (err: unknown) {
    logActionError(
      '[logExportAudit] caught',
      err instanceof Error ? err : null,
    );
  }
}
