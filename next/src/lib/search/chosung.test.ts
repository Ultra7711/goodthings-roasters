import { describe, expect, it } from 'vitest';
import { extractChosung, isChosungOnly, isSingleKoreanSyllable } from './chosung';

describe('extractChosung — 한글 → 초성', () => {
  it('완성형 한글에서 초성만 추출한다', () => {
    expect(extractChosung('커피')).toBe('ㅋㅍ');
    expect(extractChosung('가을의밤')).toBe('ㄱㅇㅇㅂ');
  });

  it('영문·숫자·공백은 그대로 유지한다', () => {
    expect(extractChosung('coffee bean')).toBe('coffee bean');
    expect(extractChosung('a1b2')).toBe('a1b2');
  });

  it('혼합 문자열 처리', () => {
    expect(extractChosung('커피 coffee')).toBe('ㅋㅍ coffee');
  });

  it('빈 문자열은 그대로 반환한다', () => {
    expect(extractChosung('')).toBe('');
  });

  it('된소리·거센소리 초성도 그대로 추출한다 (정규화는 L3 책임)', () => {
    expect(extractChosung('까페')).toBe('ㄲㅍ');
  });
});

describe('isChosungOnly — 쿼리가 초성만으로 구성됐는지', () => {
  it('초성만 있으면 true', () => {
    expect(isChosungOnly('ㅋㅍ')).toBe(true);
    expect(isChosungOnly('ㄱㅇㅇㅂ')).toBe(true);
  });

  it('완성형 한글이 포함되면 false', () => {
    expect(isChosungOnly('커피')).toBe(false);
    expect(isChosungOnly('ㅋ피')).toBe(false);
  });

  it('영문·숫자만 있으면 false', () => {
    expect(isChosungOnly('coffee')).toBe(false);
    expect(isChosungOnly('abc')).toBe(false);
  });

  it('빈 문자열은 false', () => {
    expect(isChosungOnly('')).toBe(false);
  });

  it('중성(모음)·종성만 있으면 false', () => {
    // ㅏ (U+314F) 는 초성 범위(ㄱ~ㅎ, U+3131~U+314E) 밖
    expect(isChosungOnly('ㅏ')).toBe(false);
  });
});

describe('isSingleKoreanSyllable — 단음절 가드', () => {
  it('공백·특수문자 제거 후 1글자 완성형 한글이면 true', () => {
    expect(isSingleKoreanSyllable('티')).toBe(true);
    expect(isSingleKoreanSyllable(' 티 ')).toBe(true);
    expect(isSingleKoreanSyllable('티-')).toBe(true);
  });

  it('2글자 이상은 false', () => {
    expect(isSingleKoreanSyllable('커피')).toBe(false);
  });

  it('영문 1글자는 false', () => {
    expect(isSingleKoreanSyllable('a')).toBe(false);
    expect(isSingleKoreanSyllable('T')).toBe(false);
  });

  it('초성만(ㄱ)은 false — 초성 검색 플로우로 분기되어야 함', () => {
    expect(isSingleKoreanSyllable('ㄱ')).toBe(false);
  });

  it('빈 문자열은 false', () => {
    expect(isSingleKoreanSyllable('')).toBe(false);
    expect(isSingleKoreanSyllable('   ')).toBe(false);
  });
});
