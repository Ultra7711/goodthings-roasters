/* ══════════════════════════════════════════════════════════════════════════
   clientDownload.ts — admin 클라이언트 파일 다운로드 helper (S255-C)

   server action 이 반환한 base64 → Uint8Array → Blob → <a download> 클릭.
   xlsx 전환 후 3 client (orders / users / subscriptions) handleExport 공통 사용.
   ══════════════════════════════════════════════════════════════════════════ */

export const XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * base64 string 으로 직렬화된 xlsx Buffer 를 디코딩 후 다운로드.
 *
 * server action 응답 (`result.xlsxBase64`) 를 그대로 첫 인자로 전달.
 */
export function downloadXlsxFromBase64(base64: string, filename: string): void {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: XLSX_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
