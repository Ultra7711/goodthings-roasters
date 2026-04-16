/* ══════════════════════════════════════════
   HighlightText
   MatchSpan 배열을 받아 <mark> 로 감싼 React 노드 생성.
   - 특정 field 에 해당하는 span 만 적용 (SRP 카드는 name 만 하이라이트).
   - 겹치는 span 은 머지, 범위 밖은 plain text.
   ══════════════════════════════════════════ */

import type { FieldKey, MatchSpan } from '@/lib/search/types';

type Props = {
  text: string;
  spans: readonly MatchSpan[];
  field: FieldKey;
  /** 텍스트가 길 때 앞뒤 잘라낼지 — 기본 false (name 은 잘라내지 않음) */
  maxLength?: number;
};

/** 같은 field 의 span 만 필터 + start 오름차순 정렬 + 겹침 머지 */
function normalizeSpans(
  spans: readonly MatchSpan[],
  field: FieldKey,
  textLen: number,
): Array<{ start: number; end: number }> {
  const filtered = spans
    .filter((s) => s.field === field && s.start < textLen && s.end > 0)
    .map((s) => ({
      start: Math.max(0, s.start),
      end: Math.min(textLen, s.end),
    }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);

  const merged: Array<{ start: number; end: number }> = [];
  for (const span of filtered) {
    const last = merged[merged.length - 1];
    if (last && span.start <= last.end) {
      last.end = Math.max(last.end, span.end);
    } else {
      merged.push({ ...span });
    }
  }
  return merged;
}

export default function HighlightText({ text, spans, field, maxLength }: Props) {
  const source = maxLength && text.length > maxLength ? text.slice(0, maxLength) + '…' : text;
  const normalized = normalizeSpans(spans, field, source.length);
  if (normalized.length === 0) return <>{source}</>;

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (let i = 0; i < normalized.length; i++) {
    const { start, end } = normalized[i];
    if (start > cursor) {
      nodes.push(<span key={`t${i}`}>{source.slice(cursor, start)}</span>);
    }
    nodes.push(
      <mark key={`m${i}`} className="search-highlight">
        {source.slice(start, end)}
      </mark>,
    );
    cursor = end;
  }
  if (cursor < source.length) {
    nodes.push(<span key="tail">{source.slice(cursor)}</span>);
  }
  return <>{nodes}</>;
}
