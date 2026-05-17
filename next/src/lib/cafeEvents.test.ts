/* ══════════════════════════════════════════════════════════════════════════
   cafeEvents.test.ts — 카페 메뉴 chapter 이벤트 헬퍼 (S234 후속 overlay 재설계)

   범위:
   - selectActiveEvent (자문 §5.3 우선순위)
   - selectComingEvent (7일 내 시작)

   composeEventEyebrow 는 모델 재설계로 dead — 텍스트는 모두 CSS 에 포함.
   ══════════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import {
  CafeEventSchema,
  selectActiveEvent,
  selectComingEvent,
  type CafeEvent,
} from './cafeEvents';

/** Zod v4 의 UUID 패턴 — version 1-8, variant 8/9/a/b. */
const UUID_PREFIX = 'aaaaaaaa-aaaa-4aaa-8aaa-';
const id = (n: number): string =>
  `${UUID_PREFIX}${String(n).padStart(12, '0')}`;

function makeEvent(overrides: Partial<CafeEvent> = {}): CafeEvent {
  return CafeEventSchema.parse({
    id: id(1),
    type: 'campaign',
    enabled: true,
    custom_html_path: '',
    aspect_desktop: '1320/480',
    aspect_tablet: '1024/400',
    aspect_mobile: '390/640',
    image_alt: '',
    start_date: '',
    end_date: '',
    sort_order: 0,
    ...overrides,
  });
}

describe('selectActiveEvent — 자문 §5.3 우선순위', () => {
  it('returns null on empty input', () => {
    expect(selectActiveEvent([], { today: '2026-05-15' })).toBeNull();
  });

  it('skips disabled events', () => {
    const ev = makeEvent({
      id: id(1),
      enabled: false,
      start_date: '2026-05-01',
      end_date: '2026-05-31',
    });
    expect(selectActiveEvent([ev], { today: '2026-05-15' })).toBeNull();
  });

  it('skips events outside date range', () => {
    const past = makeEvent({
      id: id(2),
      start_date: '2026-04-01',
      end_date: '2026-04-30',
    });
    const future = makeEvent({
      id: id(3),
      start_date: '2026-06-01',
      end_date: '2026-06-30',
    });
    expect(selectActiveEvent([past, future], { today: '2026-05-15' })).toBeNull();
  });

  it('treats empty start/end as range-unbounded', () => {
    const ev = makeEvent({ id: id(4) });
    const result = selectActiveEvent([ev], { today: '2026-05-15' });
    expect(result?.id).toBe(id(4));
  });

  it('campaign 가 collab 보다 우선 (type 우선순위)', () => {
    const collab = makeEvent({
      id: id(5),
      type: 'collab',
      start_date: '2026-05-01',
      end_date: '2026-05-31',
    });
    const campaign = makeEvent({
      id: id(6),
      type: 'campaign',
      start_date: '2026-05-01',
      end_date: '2026-05-31',
    });
    const result = selectActiveEvent([collab, campaign], { today: '2026-05-15' });
    expect(result?.type).toBe('campaign');
  });

  it('start_date 최신이 type 우선순위보다 먼저', () => {
    const oldCampaign = makeEvent({
      id: id(7),
      type: 'campaign',
      start_date: '2026-05-01',
      end_date: '2026-05-31',
    });
    const newOneplus = makeEvent({
      id: id(8),
      type: 'oneplus',
      start_date: '2026-05-10',
      end_date: '2026-05-31',
    });
    const result = selectActiveEvent([oldCampaign, newOneplus], { today: '2026-05-15' });
    expect(result?.id).toBe(id(8));
  });

  it('start_date 동률 → type 우선순위', () => {
    const seasonal = makeEvent({
      id: id(9),
      type: 'seasonal',
      start_date: '2026-05-01',
      end_date: '2026-05-31',
    });
    const collab = makeEvent({
      id: id(10),
      type: 'collab',
      start_date: '2026-05-01',
      end_date: '2026-05-31',
    });
    const result = selectActiveEvent([seasonal, collab], { today: '2026-05-15' });
    expect(result?.type).toBe('collab');
  });

  it('start_date + type 동률 → sort_order 작은 값 우선', () => {
    const a = makeEvent({
      id: id(11),
      type: 'campaign',
      start_date: '2026-05-01',
      end_date: '2026-05-31',
      sort_order: 5,
    });
    const b = makeEvent({
      id: id(12),
      type: 'campaign',
      start_date: '2026-05-01',
      end_date: '2026-05-31',
      sort_order: 1,
    });
    const result = selectActiveEvent([a, b], { today: '2026-05-15' });
    expect(result?.id).toBe(id(12));
  });
});

describe('selectComingEvent — 7일 내 시작', () => {
  it('returns null when no upcoming event', () => {
    const farFuture = makeEvent({
      id: id(20),
      start_date: '2026-06-01',
      end_date: '2026-06-30',
    });
    expect(selectComingEvent([farFuture], { today: '2026-05-15' })).toBeNull();
  });

  it('finds event within 7 days', () => {
    const upcoming = makeEvent({
      id: id(21),
      type: 'collab',
      start_date: '2026-05-20',
      end_date: '2026-05-31',
    });
    const result = selectComingEvent([upcoming], { today: '2026-05-15' });
    expect(result?.id).toBe(id(21));
  });

  it('skips already-active event', () => {
    const active = makeEvent({
      id: id(22),
      start_date: '2026-05-01',
      end_date: '2026-05-31',
    });
    expect(selectComingEvent([active], { today: '2026-05-15' })).toBeNull();
  });

  it('multiple upcoming → start_date 가장 가까운 것', () => {
    const a = makeEvent({
      id: id(23),
      start_date: '2026-05-22',
    });
    const b = makeEvent({
      id: id(24),
      start_date: '2026-05-18',
    });
    const result = selectComingEvent([a, b], { today: '2026-05-15' });
    expect(result?.id).toBe(id(24));
  });
});
