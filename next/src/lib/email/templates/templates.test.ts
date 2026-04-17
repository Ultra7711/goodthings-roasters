/* ══════════════════════════════════════════════════════════════════════════
   templates.test.ts — 이메일 템플릿 렌더링 + CTA 링크 회귀 방어

   사양: docs/milestone.md "Session 11 스코프" #6
   - `publicToken` 존재 시 `/order-complete?token={uuid}` CTA 렌더
   - 잘못된 UUID (또는 미지정) 시 CTA 생략
   - `order_number` 쿼리 형태의 레거시 링크가 템플릿에 섞여 들어가지 않음
   - buildOrderCompleteUrl 의 UUID v4 검증 가드
   ════════════════════════════════════════════════════════════════════════ */

import { describe, expect, it, beforeEach } from 'vitest';

import { renderOrderConfirmationEmail } from './orderConfirmationEmail';
import { renderShippingNotificationEmail } from './shippingNotificationEmail';
import { buildOrderCompleteUrl, getAppUrl } from './urls';

const VALID_TOKEN = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
const ORDER_NUMBER = 'GT-20260417-00042';

const BASE_ORDER_PROPS = {
  orderNumber: ORDER_NUMBER,
  recipientName: '홍길동',
  subtotal: 30000,
  shippingFee: 3000,
  discountAmount: 0,
  totalAmount: 33000,
  method: 'card' as const,
  items: [{ name: '에티오피아 예가체프', quantity: 1, unitPrice: 30000 }],
};

beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = 'https://goodthingsroasters.com';
});

describe('buildOrderCompleteUrl', () => {
  it('UUID v4 publicToken 에 대해 /order-complete?token=... 반환', () => {
    expect(buildOrderCompleteUrl(VALID_TOKEN)).toBe(
      `https://goodthingsroasters.com/order-complete?token=${VALID_TOKEN}`,
    );
  });

  it('publicToken 이 undefined 면 null', () => {
    expect(buildOrderCompleteUrl(undefined)).toBeNull();
  });

  it('UUID v4 형식이 아니면 null (order_number 등 거부)', () => {
    expect(buildOrderCompleteUrl(ORDER_NUMBER)).toBeNull();
    expect(buildOrderCompleteUrl('not-a-uuid')).toBeNull();
    expect(buildOrderCompleteUrl('')).toBeNull();
  });

  it('NEXT_PUBLIC_APP_URL 후행 슬래시 정규화', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://staging.goodthingsroasters.com/';
    expect(buildOrderCompleteUrl(VALID_TOKEN)).toBe(
      `https://staging.goodthingsroasters.com/order-complete?token=${VALID_TOKEN}`,
    );
  });

  it('getAppUrl 누락 시 기본 도메인 폴백', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(getAppUrl()).toBe('https://goodthingsroasters.com');
  });
});

describe('renderOrderConfirmationEmail — CTA', () => {
  it('publicToken 존재 시 HTML/text 에 /order-complete?token=... 링크 포함', () => {
    const { html, text } = renderOrderConfirmationEmail({
      ...BASE_ORDER_PROPS,
      publicToken: VALID_TOKEN,
    });
    const expectedUrl = `https://goodthingsroasters.com/order-complete?token=${VALID_TOKEN}`;
    expect(html).toContain(expectedUrl);
    expect(html).toContain('주문 내역 보기');
    expect(text).toContain(expectedUrl);
  });

  it('publicToken 미지정 시 CTA 블록 생략', () => {
    const { html, text } = renderOrderConfirmationEmail(BASE_ORDER_PROPS);
    expect(html).not.toContain('/order-complete?token=');
    expect(html).not.toContain('주문 내역 보기');
    expect(text).not.toContain('/order-complete?token=');
  });

  it('CTA 링크에 orderNumber enumeration 파라미터가 섞이지 않음', () => {
    const { html, text } = renderOrderConfirmationEmail({
      ...BASE_ORDER_PROPS,
      publicToken: VALID_TOKEN,
    });
    expect(html).not.toContain(`?orderNumber=${ORDER_NUMBER}`);
    expect(html).not.toContain(`orderNumber=${ORDER_NUMBER}`);
    expect(text).not.toContain(`?orderNumber=${ORDER_NUMBER}`);
  });

  it('잘못된 publicToken 은 CTA 생략 (guard 우회 불가)', () => {
    const { html } = renderOrderConfirmationEmail({
      ...BASE_ORDER_PROPS,
      publicToken: 'invalid-uuid',
    });
    expect(html).not.toContain('주문 내역 보기');
    expect(html).not.toContain('invalid-uuid');
  });

  it('depositCompleted 모드에서도 CTA 정상 렌더', () => {
    const { html, subject } = renderOrderConfirmationEmail({
      ...BASE_ORDER_PROPS,
      publicToken: VALID_TOKEN,
      depositCompleted: true,
    });
    expect(subject).toContain('입금이 확인되었습니다');
    expect(html).toContain(`/order-complete?token=${VALID_TOKEN}`);
  });
});

describe('renderShippingNotificationEmail — CTA', () => {
  it('publicToken 존재 시 HTML/text 에 CTA 링크 포함', () => {
    const { html, text } = renderShippingNotificationEmail({
      orderNumber: ORDER_NUMBER,
      recipientName: '홍길동',
      carrier: 'CJ대한통운',
      trackingNumber: '1234567890',
      publicToken: VALID_TOKEN,
    });
    const expectedUrl = `https://goodthingsroasters.com/order-complete?token=${VALID_TOKEN}`;
    expect(html).toContain(expectedUrl);
    expect(html).toContain('주문 내역 보기');
    expect(text).toContain(expectedUrl);
  });

  it('publicToken 미지정 시 CTA 블록 생략', () => {
    const { html } = renderShippingNotificationEmail({
      orderNumber: ORDER_NUMBER,
      recipientName: '홍길동',
    });
    expect(html).not.toContain('/order-complete?token=');
    expect(html).not.toContain('주문 내역 보기');
  });

  it('CTA 링크에 orderNumber enumeration 파라미터가 섞이지 않음', () => {
    const { html } = renderShippingNotificationEmail({
      orderNumber: ORDER_NUMBER,
      publicToken: VALID_TOKEN,
    });
    expect(html).not.toContain(`?orderNumber=${ORDER_NUMBER}`);
  });
});
