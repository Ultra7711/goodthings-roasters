/* ══════════════════════════════════════════════════════════════════════════
   csvExport.test.ts — admin CSV 내보내기 helper 단위 테스트 (S232)

   커버리지:
   - escapeCsvField — 따옴표·콤마·줄바꿈 escape
   - buildCsv — UTF-8 BOM + CRLF + 안내 주석 + 헤더 + 데이터 결합
   - buildExportFilename — KST 시각 패턴
   - formatKstDateCell / formatKstDateTimeCell — KST 변환
   ══════════════════════════════════════════════════════════════════════════ */

import { describe, expect, it } from 'vitest';
import {
  buildCsv,
  buildExportFilename,
  escapeCsvField,
  formatKstDateCell,
  formatKstDateTimeCell,
  nowKstDisplay,
} from './csvExport';

describe('escapeCsvField', () => {
  it('null/undefined → 빈 문자열', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });
  it('빈 문자열 통과', () => {
    expect(escapeCsvField('')).toBe('');
  });
  it('숫자 통과', () => {
    expect(escapeCsvField(42)).toBe('42');
  });
  it('일반 텍스트 escape 없음', () => {
    expect(escapeCsvField('홍길동')).toBe('홍길동');
  });
  it('콤마 포함 → quote', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
  });
  it('큰따옴표 포함 → quote + escape', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });
  it('줄바꿈 포함 → quote', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });
  it('CR 포함 → quote', () => {
    expect(escapeCsvField('a\rb')).toBe('"a\rb"');
  });
});

describe('buildCsv', () => {
  it('UTF-8 BOM + sep directive + 안내 주석 + 헤더 + 데이터 + CRLF 종결', () => {
    const csv = buildCsv(
      ['이메일', '이름'],
      [['a@b.com', '홍길동'], ['c@d.com', '김철수']],
      { domain: '구독', generatedAtKst: '2026.05.15 12:34 KST' },
    );
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    /* sep directive — Excel UTF-8 인식 강화 (BOM 무시 빌드 대응) */
    expect(csv).toContain('sep=,\r\n');
    expect(csv).toContain('# 굳띵즈 로스터스 구독 내부 운영 자료');
    expect(csv).toContain('생성 2026.05.15 12:34 KST');
    expect(csv).toContain('이메일,이름');
    expect(csv).toContain('a@b.com,홍길동');
    expect(csv).toContain('c@d.com,김철수');
    expect(csv).toMatch(/\r\n$/);
  });

  it('첫 행은 sep directive (Excel BOM 무시 빌드 대응)', () => {
    const csv = buildCsv(
      ['col1'],
      [['val1']],
      { domain: 'x', generatedAtKst: '2026.01.01 00:00 KST' },
    );
    const lines = csv.replace(/^﻿/, '').split('\r\n');
    expect(lines[0]).toBe('sep=,');
  });

  it('데이터 0행 — 헤더만 출력', () => {
    const csv = buildCsv(
      ['col1'],
      [],
      { domain: 'x', generatedAtKst: '2026.01.01 00:00 KST' },
    );
    /* BOM + sep + 주석 + 헤더 + CRLF 종결 → split 4 segments (sep/notice/header/'') */
    const lines = csv.replace(/^﻿/, '').split('\r\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe('sep=,');
    expect(lines[2]).toBe('col1');
  });

  it('escape 필요한 셀 적용', () => {
    const csv = buildCsv(
      ['note'],
      [['콤마, 포함'], ['"따옴표"']],
      { domain: 'x', generatedAtKst: '2026.01.01 00:00 KST' },
    );
    expect(csv).toContain('"콤마, 포함"');
    expect(csv).toContain('"""따옴표"""');
  });
});

describe('buildExportFilename', () => {
  it('KST 시각 + .csv 확장자', () => {
    /* UTC 2026-05-15T03:34:00Z = KST 12:34 */
    const fn = buildExportFilename('subscriptions', '2026-05-15T03:34:00.000Z');
    expect(fn).toBe('subscriptions-2026-05-15-1234.csv');
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
