/* ══════════════════════════════════════════════════════════════════════════
   csvExport.test.ts — admin 내보내기 helper 단위 테스트 (S232 · S255-C 갱신)

   커버리지 (S255-C 후):
   - buildExportFilename — KST 시각 패턴 + 확장자 인자 ('xlsx' default · 'csv' 호환)
   - formatKstDateCell / formatKstDateTimeCell — KST 변환
   - nowKstDisplay — KST 표시

   폐기 (S255-C):
   - escapeCsvField / buildCsv 폐기 → xlsxExport.buildXlsxBuffer 일원화.
   ══════════════════════════════════════════════════════════════════════════ */

import { describe, expect, it } from 'vitest';
import {
  buildExportFilename,
  formatKstDateCell,
  formatKstDateTimeCell,
  nowKstDisplay,
} from './csvExport';

describe('buildExportFilename', () => {
  it('기본 확장자 = xlsx', () => {
    /* UTC 2026-05-15T03:34:00Z = KST 12:34 */
    const fn = buildExportFilename('subscriptions', 'xlsx', '2026-05-15T03:34:00.000Z');
    expect(fn).toBe('subscriptions-2026-05-15-1234.xlsx');
  });

  it('extension 인자 미지정 시 xlsx 폴백', () => {
    const fn = buildExportFilename('orders');
    expect(fn).toMatch(/^orders-\d{4}-\d{2}-\d{2}-\d{4}\.xlsx$/);
  });

  it('csv 확장자 명시 (레거시 호환)', () => {
    const fn = buildExportFilename('orders', 'csv', '2026-05-15T03:34:00.000Z');
    expect(fn).toBe('orders-2026-05-15-1234.csv');
  });
});

describe('formatKstDateCell / formatKstDateTimeCell', () => {
  it('null → 빈 문자열', () => {
    expect(formatKstDateCell(null)).toBe('');
    expect(formatKstDateTimeCell(null)).toBe('');
  });
  it('UTC ISO → KST YYYY.MM.DD', () => {
    expect(formatKstDateCell('2026-05-14T15:00:00.000Z')).toBe('2026.05.15');
  });
  it('UTC ISO → KST YYYY.MM.DD HH:mm', () => {
    expect(formatKstDateTimeCell('2026-05-14T15:30:00.000Z')).toBe('2026.05.15 00:30');
  });
});

describe('nowKstDisplay', () => {
  it('KST 표시 + " KST" 접미', () => {
    expect(nowKstDisplay('2026-05-14T15:30:00.000Z')).toBe('2026.05.15 00:30 KST');
  });
});
