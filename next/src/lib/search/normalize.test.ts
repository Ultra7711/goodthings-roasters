import { describe, expect, it } from 'vitest';
import { normalizeL1, normalizeL3, normalizeFull, normalizeL1WithMap } from './normalize';

describe('normalize — Layer 1 (공백·특수문자·대소문자)', () => {
  it('공백·하이픈·중점·점을 제거한다', () => {
    expect(normalizeL1('coffee bean')).toBe('coffeebean');
    expect(normalizeL1('drip-bag')).toBe('dripbag');
    expect(normalizeL1('single·origin')).toBe('singleorigin');
    expect(normalizeL1('No.1')).toBe('no1');
  });

  it('연속된 공백도 모두 제거한다', () => {
    expect(normalizeL1('a   b')).toBe('ab');
  });

  it('대문자를 소문자로 변환한다', () => {
    expect(normalizeL1('COFFEE')).toBe('coffee');
    expect(normalizeL1('Refreshing Afternoon')).toBe('refreshingafternoon');
  });

  it('한글은 그대로 유지한다', () => {
    expect(normalizeL1('가을의 밤')).toBe('가을의밤');
  });

  it('빈 문자열은 그대로 반환한다', () => {
    expect(normalizeL1('')).toBe('');
  });
});

describe('normalize — Layer 3 (된소리·거센소리 → 평음)', () => {
  it('거센소리 초성을 평음으로 치환한다', () => {
    // ㅌ → ㄷ
    expect(normalizeL3('티')).toBe('디');
    // ㅋ → ㄱ
    expect(normalizeL3('커피')).toBe('거비');
    // ㅍ → ㅂ
    expect(normalizeL3('피자')).toBe('비자');
  });

  it('된소리 초성을 평음으로 치환한다', () => {
    expect(normalizeL3('까페')).toBe('가베'); // ㄲ→ㄱ, ㅍ→ㅂ
    expect(normalizeL3('떡')).toBe('덕');     // ㄸ→ㄷ
  });

  it('종성의 거센소리·된소리도 치환한다', () => {
    // 'ㄲ' 종성 → 'ㄱ' 종성
    expect(normalizeL3('밖')).toBe('박');
    // 'ㅌ' 종성 → 'ㄷ' 종성
    expect(normalizeL3('같')).toBe('갇');
  });

  it('결과가 NFC 로 재조합되어야 한다 (NFD substring 오매칭 방지)', () => {
    const result = normalizeL3('커피');
    // NFC 로 재조합된 문자열은 각 음절이 완성형 1문자 단위
    // "거비" 의 "거" = U+AC70 (단일 코드포인트)
    expect(result.length).toBe(2);
    expect(result.normalize('NFC')).toBe(result);
    expect(result.charCodeAt(0)).toBeLessThan(0xd7a4);
    expect(result.charCodeAt(0)).toBeGreaterThanOrEqual(0xac00);
  });

  it('영문·숫자는 그대로 유지한다', () => {
    expect(normalizeL3('coffee')).toBe('coffee');
    expect(normalizeL3('no1')).toBe('no1');
  });
});

describe('normalizeFull — L1 + L3 조합', () => {
  it('L1 → L3 순서로 적용한다', () => {
    expect(normalizeFull('COFFEE BEAN')).toBe('coffeebean');
    expect(normalizeFull('가을의 밤')).toBe('가을의밤');
    expect(normalizeFull('Drip-Bag')).toBe('dripbag');
  });

  it('한글 거센소리가 L3 로 변환된다', () => {
    expect(normalizeFull('커피 빈')).toBe('거비빈'); // L1:'커피빈' → L3:'거비빈'
  });
});

describe('normalizeL1WithMap — raw offset 매핑 반환', () => {
  it('각 L1 문자가 raw 의 어느 위치에서 왔는지 매핑한다', () => {
    const { l1, rawOffsetByL1 } = normalizeL1WithMap('Hi there');
    expect(l1).toBe('hithere');
    // 'h'(0) 'i'(1) 't'(3) 'h'(4) 'e'(5) 'r'(6) 'e'(7)  — 공백(idx 2) 제외
    expect(rawOffsetByL1).toEqual([0, 1, 3, 4, 5, 6, 7]);
  });

  it('전부 제거되는 입력은 빈 배열을 반환한다', () => {
    const { l1, rawOffsetByL1 } = normalizeL1WithMap('   ');
    expect(l1).toBe('');
    expect(rawOffsetByL1).toEqual([]);
  });

  it('한글도 정상 매핑한다', () => {
    const { l1, rawOffsetByL1 } = normalizeL1WithMap('가을 의 밤');
    expect(l1).toBe('가을의밤');
    expect(rawOffsetByL1).toEqual([0, 1, 3, 5]);
  });
});
