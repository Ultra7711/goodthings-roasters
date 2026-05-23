/* ══════════════════════════════════════════════════════════════════════════
   xlsxExport.test.ts — buildXlsxBuffer + bufferToBase64 단위 테스트 (S255-C)
   ══════════════════════════════════════════════════════════════════════════ */

import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { buildXlsxBuffer, bufferToBase64, XLSX_MIME_TYPE } from './xlsxExport';

describe('buildXlsxBuffer', () => {
  it('Buffer 를 반환하며 ZIP signature 로 시작 (xlsx = OOXML zip)', async () => {
    const buf = await buildXlsxBuffer(
      ['이메일', '이름'],
      [['a@b.com', '홍길동']],
      { domain: '구독', generatedAtKst: '2026.05.15 12:34 KST' },
    );
    expect(buf).toBeInstanceOf(Buffer);
    /* xlsx = ZIP = "PK\x03\x04" magic bytes */
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
  });

  it('한글 셀 값을 손실 없이 보존', async () => {
    const headers = ['이메일', '이름', '상태'];
    const data: ReadonlyArray<ReadonlyArray<string | number>> = [
      ['a@b.com', '홍길동', '진행중'],
      ['c@d.com', '김철수', '취소'],
    ];
    const buf = await buildXlsxBuffer(headers, data, {
      domain: '주문',
      generatedAtKst: '2026.05.15 12:34 KST',
    });

    /* 다시 열어서 확인 — Node 22 Buffer<ArrayBufferLike> vs ExcelJS Buffer
       타입 불일치 회피용 cast. */
    const wb = new ExcelJS.Workbook();
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    await wb.xlsx.load(buf as any);
    const ws = wb.getWorksheet('주문');
    expect(ws).toBeTruthy();

    /* 1행 = notice, 2행 = headers, 3행~ = data */
    const noticeRow = ws!.getRow(1).values as unknown[];
    expect(String(noticeRow[1])).toContain('# 굳띵즈 로스터스 주문');

    const headerRow = ws!.getRow(2).values as unknown[];
    expect(headerRow[1]).toBe('이메일');
    expect(headerRow[2]).toBe('이름');
    expect(headerRow[3]).toBe('상태');

    const firstData = ws!.getRow(3).values as unknown[];
    expect(firstData[2]).toBe('홍길동');
    expect(firstData[3]).toBe('진행중');
  });

  it('null/undefined 셀을 빈 문자열로 정규화', async () => {
    const buf = await buildXlsxBuffer(
      ['a', 'b'],
      [[null, undefined]],
      { domain: 'x', generatedAtKst: '2026.01.01 00:00 KST' },
    );
    const wb = new ExcelJS.Workbook();
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    await wb.xlsx.load(buf as any);
    const ws = wb.getWorksheet('x');
    const row = ws!.getRow(3).values as unknown[];
    /* ExcelJS 는 빈 문자열 셀을 undefined 로 표현 가능 — 어느 쪽이든 falsy */
    expect(row[1] ?? '').toBe('');
    expect(row[2] ?? '').toBe('');
  });
});

describe('bufferToBase64', () => {
  it('Buffer → base64 string round-trip', () => {
    const original = Buffer.from('hello 한글');
    const b64 = bufferToBase64(original);
    expect(typeof b64).toBe('string');
    const decoded = Buffer.from(b64, 'base64');
    expect(decoded.equals(original)).toBe(true);
  });
});

describe('XLSX_MIME_TYPE', () => {
  it('OOXML spreadsheet mime type', () => {
    expect(XLSX_MIME_TYPE).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  });
});
