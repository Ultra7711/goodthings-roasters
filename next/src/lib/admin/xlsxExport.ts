import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   xlsxExport.ts — admin 도메인 XLSX 내보내기 (S255-C)

   배경:
   - 한국 Excel (Windows 11 기본 + Office 한국 빌드) 가 UTF-8 BOM 을 무시하고
     시스템 로케일 (CP949) 로 강제 디코딩하는 알려진 동작 → CSV 한글 mojibake.
   - 우회: xlsx 는 zip + xml internal 포맷이라 인코딩 무관. Excel/Numbers/Sheets
     모두 정상 인식.

   설계:
   - ExcelJS workbook → addWorksheet → notice + header + data rows → writeBuffer.
   - server action 반환은 base64 string (Next.js Server Action 직렬화 가장 안전).
     client 가 atob → Uint8Array → Blob.
   - 시트 이름 = domain (한글 OK).
   - 헤더 행 bold. notice 행은 평문 (운영 안내).
   - audit log 'csv_*' enum 은 backward compat 유지 (라벨만 갱신 — describeAuditAction).

   재사용:
   - MAX_EXPORT_ROWS / nowKstDisplay / formatKstDate* / buildExportFilename /
     logExportAudit 은 csvExport.ts 의 helper (S268 rename).
   ══════════════════════════════════════════════════════════════════════════ */

import ExcelJS from 'exceljs';

/**
 * headers + rows → xlsx Buffer.
 *
 * 구조 (worksheet):
 * - 1행: `# 굳띵즈 로스터스 {domain} 내부 운영 자료 — 외부 공유 금지 · 생성 {KST}`
 * - 2행: 헤더 (bold)
 * - 3행~: 데이터
 */
export async function buildXlsxBuffer(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>,
  meta: { domain: string; generatedAtKst: string; includeNotice?: boolean },
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '굳띵즈 로스터스';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(meta.domain);

  /* notice 행 = 내부 운영 자료 경고 (기본 포함). 단 ILOGEN 등 외부 프로그램에
     그대로 업로드하는 기계 입력 파일은 includeNotice:false 로 제외 (행 밀림·오인 방지). */
  const includeNotice = meta.includeNotice !== false;
  if (includeNotice) {
    const noticeText = `# 굳띵즈 로스터스 ${meta.domain} 내부 운영 자료 — 외부 공유 금지 · 생성 ${meta.generatedAtKst}`;
    worksheet.addRow([noticeText]);
  }
  worksheet.addRow([...headers]);
  for (const row of rows) {
    worksheet.addRow(row.map((v) => (v === null || v === undefined ? '' : v)));
  }

  /* 헤더 행 bold (notice 유무에 따라 1행 또는 2행). notice 행은 평문. */
  worksheet.getRow(includeNotice ? 2 : 1).font = { bold: true };

  /* 컬럼 자동 너비 — 최대값 추정 (한글 1자 ≈ 2 width). headers 길이 기준
     최소치만 보장하여 단순 폴리싱 유지. */
  worksheet.columns = headers.map((h) => ({
    width: Math.max(12, Math.min(40, h.length * 2 + 4)),
  }));

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/** Buffer → base64 string (Server Action 응답 직렬화용). */
export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

/** xlsx mime type (client Blob type 용). */
export const XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
