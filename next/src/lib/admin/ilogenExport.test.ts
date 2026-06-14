import { describe, it, expect } from 'vitest';
import { ILOGEN_HEADERS, toIlogenRow, type IlogenOrderInput } from './ilogenExport';

/* ══════════════════════════════════════════════════════════════════════════
   ilogenExport.test.ts — 로젠택배 ILOGEN 양식 매핑 단위 테스트 (S319)
   ══════════════════════════════════════════════════════════════════════════ */

function baseOrder(overrides: Partial<IlogenOrderInput> = {}): IlogenOrderInput {
  return {
    orderNumber: 'GT240601-0001',
    shippingName: '홍길동',
    shippingPhone: '010-1234-5678',
    shippingZipcode: '06236',
    shippingAddr1: '서울시 강남구 테헤란로 123',
    shippingAddr2: '101동 202호',
    shippingMessageCode: null,
    shippingMessageCustom: null,
    items: [{ product_name: '에티오피아 예가체프', product_volume: '200g', quantity: 1 }],
    ...overrides,
  };
}

describe('ILOGEN_HEADERS', () => {
  it('8개 컬럼을 고정 순서로 정의한다', () => {
    // Arrange / Act / Assert
    expect(ILOGEN_HEADERS).toEqual([
      '주문번호',
      '수하인명',
      '수하인전화',
      '수하인휴대폰',
      '수하인주소',
      '물품명',
      '수량',
      '배송메세지',
    ]);
  });
});

describe('toIlogenRow', () => {
  it('헤더와 동일한 8개 컬럼을 순서대로 반환한다', () => {
    // Arrange
    const order = baseOrder();

    // Act
    const row = toIlogenRow(order);

    // Assert
    expect(row).toHaveLength(ILOGEN_HEADERS.length);
    expect(row[0]).toBe('GT240601-0001'); // 주문번호
    expect(row[1]).toBe('홍길동'); // 수하인명
  });

  it('수하인전화는 비우고 휴대폰 컬럼만 채운다', () => {
    // Arrange
    const order = baseOrder({ shippingPhone: '010-9999-0000' });

    // Act
    const row = toIlogenRow(order);

    // Assert
    expect(row[2]).toBe(''); // 수하인전화
    expect(row[3]).toBe('010-9999-0000'); // 수하인휴대폰
  });

  it('휴대폰이 null이면 빈 문자열로 매핑한다', () => {
    // Arrange
    const order = baseOrder({ shippingPhone: null });

    // Act
    const row = toIlogenRow(order);

    // Assert
    expect(row[3]).toBe('');
  });

  it('주소에 우편번호를 [zipcode] 접두로 포함하고 상세주소를 결합한다', () => {
    // Arrange
    const order = baseOrder();

    // Act
    const row = toIlogenRow(order);

    // Assert
    expect(row[4]).toBe('[06236] 서울시 강남구 테헤란로 123 101동 202호');
  });

  it('상세주소(addr2)가 없으면 기본 주소만 결합한다', () => {
    // Arrange
    const order = baseOrder({ shippingAddr2: null });

    // Act
    const row = toIlogenRow(order);

    // Assert
    expect(row[4]).toBe('[06236] 서울시 강남구 테헤란로 123');
  });

  it('우편번호가 없으면 접두 없이 주소만 넣는다', () => {
    // Arrange
    const order = baseOrder({ shippingZipcode: null, shippingAddr2: null });

    // Act
    const row = toIlogenRow(order);

    // Assert
    expect(row[4]).toBe('서울시 강남구 테헤란로 123');
  });

  it('다품목 주문은 물품명을 요약하고 수량은 항상 1(박스 1개)이다', () => {
    // Arrange
    const order = baseOrder({
      items: [
        { product_name: '에티오피아 예가체프', product_volume: '200g', quantity: 1 },
        { product_name: '콜롬비아 수프리모', product_volume: '200g', quantity: 2 },
      ],
    });

    // Act
    const row = toIlogenRow(order);

    // Assert
    expect(row[5]).toContain('에티오피아');
    expect(row[5]).toContain('콜롬비아');
    expect(row[6]).toBe(1); // 수량 = 박스 1개
  });

  it('배송메세지 custom이 있으면 그대로, code면 라벨로 매핑한다', () => {
    // Arrange
    const custom = baseOrder({ shippingMessageCustom: '경비실에 맡겨주세요' });
    const preset = baseOrder({ shippingMessageCode: '문앞' });
    const none = baseOrder();

    // Act / Assert
    expect(toIlogenRow(custom)[7]).toBe('경비실에 맡겨주세요');
    expect(toIlogenRow(preset)[7]).toBe('부재 시 문 앞에 놓아 주세요.');
    expect(toIlogenRow(none)[7]).toBe('');
  });
});
