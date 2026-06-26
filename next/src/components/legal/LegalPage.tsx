/* ══════════════════════════════════════════
   LegalPage — /legal/[slug]
   ──────────────────────────────────────────
   layout (legal-page / legal-shell / legal-hero / legal-side / LegalSideNav) 은
   /legal/layout.tsx 가 처리. page 는 body 만 (S197 PR-2 후속).

   S281: 검색 페이지에서 ?q=... 로 진입 시 본문 검색어 자동 하이라이트 + 첫 매치
   scrollIntoView. 'use client' 변환 (useSearchParams + useEffect 필요).
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import type { LegalDoc, LegalSection } from '@/app/(main)/legal/[slug]/content';
import LegalMiniMap, { type MiniMapItem } from './LegalMiniMap';

import './LegalPage.css';

type Props = {
  doc: LegalDoc;
};

/* ── S281 검색어 하이라이트 ─────────────────────────────────────────
   text 안에서 query (case-insensitive) 의 모든 위치를 <mark> 로 wrap.
   첫 매치 element 에 onFirstMark ref 콜백 부여 (페이지 단위 1회만 호출되도록
   외부에서 useRef 로 가드). */

type HighlightOptions = {
  query: string;
  /** 페이지 단위 "첫 mark" 추적 — 호출 시 element ref 보고. */
  registerFirstMark: (el: HTMLElement | null) => void;
};

function HighlightedText({ text, opts }: { text: string; opts: HighlightOptions }) {
  const { query, registerFirstMark } = opts;
  if (!query) return <>{text}</>;

  /* 정규식 escape — 사용자 입력에 특수문자 가능 */
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped, 'gi');
  const matches = Array.from(text.matchAll(re));
  if (matches.length === 0) return <>{text}</>;

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (start > cursor) {
      nodes.push(<span key={`t${i}`}>{text.slice(cursor, start)}</span>);
    }
    nodes.push(
      <mark
        key={`m${i}`}
        className="legal-highlight"
        ref={registerFirstMark}
      >
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < text.length) {
    nodes.push(<span key="tail">{text.slice(cursor)}</span>);
  }
  return <>{nodes}</>;
}

function SectionContent({ section, opts }: { section: LegalSection; opts: HighlightOptions }) {
  return (
    <>
      {section.paragraphs?.map((para, i) => (
        <p key={`p-${i}`} className="legal-paragraph">
          <HighlightedText text={para} opts={opts} />
        </p>
      ))}
      {section.bullets && section.bullets.length > 0 && (
        <ul className="legal-bullets">
          {section.bullets.map((b, i) => (
            <li key={i}>
              <HighlightedText text={b} opts={opts} />
            </li>
          ))}
        </ul>
      )}
      {section.definitions && section.definitions.length > 0 && (
        <dl className="legal-defs">
          {section.definitions.map((d, i) => {
            /* P10 — 외부 사이트 링크는 default 로 label(기관명) 에. 전화번호(value)
               에 걸면 사용자가 전화 걸기로 오인. linkOn='value' 명시 시 회사명 등
               value 자체에 link (예: 토스페이먼츠(주)). */
            const linkOnValue = d.linkOn === 'value';
            const linkedLabel = d.link && !linkOnValue;
            const linkedValue = d.link && linkOnValue;
            return (
              <div key={i} className="legal-def-row">
                <dt>
                  {linkedLabel ? (
                    <a href={d.link} className="legal-link" target="_blank" rel="noopener noreferrer">
                      <HighlightedText text={d.label} opts={opts} />
                    </a>
                  ) : (
                    <HighlightedText text={d.label} opts={opts} />
                  )}
                </dt>
                <dd>
                  {linkedValue ? (
                    <a href={d.link} className="legal-link" target="_blank" rel="noopener noreferrer">
                      <HighlightedText text={d.value} opts={opts} />
                    </a>
                  ) : (
                    <HighlightedText text={d.value} opts={opts} />
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </>
  );
}

export default function LegalPage({ doc }: Props) {
  const searchParams = useSearchParams();
  const rawQ = searchParams.get('q')?.trim() ?? '';
  /* 매우 짧은 쿼리는 노이즈 (예: "1" 매치 다수) — 2자 이상만 highlight. */
  const query = rawQ.length >= 2 ? rawQ : '';

  /* 페이지 단위 "첫 mark" 추적. doc/query 변경 시 useMemo deps 가 바뀌어
     자동으로 새 closure (captured=false 부터 시작) 생성. 별도 reset effect 금지 —
     ref 콜백이 박힌 firstMarkRef.current 를 effect 가 덮어쓰는 race 회피 (S281 학습). */
  const firstMarkRef = useRef<HTMLElement | null>(null);

  // captured = closure 변수 (doc/query 변경 시 new closure 생성으로 자동 reset).
  // 별 reset effect 금지 — ref 콜백이 박힌 firstMarkRef.current 를 effect 가 덮어쓰는 race 회피 (S281 학습).
  const registerFirstMark = useMemo(() => {
    let captured = false;
    return (el: HTMLElement | null) => {
      if (!el || captured) return;
      firstMarkRef.current = el;
      captured = true; // eslint-disable-line react-hooks/immutability
    };
  }, [doc, query]); // eslint-disable-line react-hooks/exhaustive-deps

  /* 렌더 직후 첫 mark 가 캡처되면 scrollIntoView (smooth · 중앙). */
  useEffect(() => {
    if (!query) return;
    /* S334: 검색어 첫 매치로 점프하기 전 맨 위로 — 진입 scrollY 가 큰 경우(하단)
       "거슬러 올라감" 방지. GenericCard 의 scrollTo(0)→scrollIntoView 패턴 차용. */
    window.scrollTo({ top: 0, behavior: 'instant' });
    /* 렌더 commit 직후 → next frame 에 scroll (layout 안정화 후). */
    const id = requestAnimationFrame(() => {
      const el = firstMarkRef.current;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [query, doc]);

  const opts: HighlightOptions = { query, registerFirstMark };

  /* 미니맵 항목 — heading 있는 섹션만. id 는 본문 section 의 anchor 와 일치. */
  const navItems: MiniMapItem[] = useMemo(
    () =>
      doc.sections
        .map((s, idx) => ({ id: `legal-sec-${idx}`, label: s.heading ?? '' }))
        .filter((it) => it.label !== ''),
    [doc],
  );

  return (
    <>
      <header className="legal-hero">
        <h1 className="legal-title">
          <HighlightedText text={doc.title} opts={opts} />
        </h1>
        {/* 시행일 — 없는 페이지(payment-faq)도 빈 줄로 높이 reserve.
            hero 높이 통일 → sidenav 시작 위치 페이지 전환 시 안 튐. */}
        {doc.effectiveDate ? (
          <p className="legal-effective">{doc.effectiveDate}</p>
        ) : (
          <p className="legal-effective" aria-hidden="true">&nbsp;</p>
        )}
      </header>

      <article className="legal-body">
        {doc.intro && doc.intro.length > 0 && (
        <div className="legal-intro">
          {doc.intro.map((line, i) => (
            <p key={i}>
              <HighlightedText text={line} opts={opts} />
            </p>
          ))}
        </div>
      )}

      {doc.sections.map((section, idx) => (
        <section key={idx} id={`legal-sec-${idx}`} className="legal-section">
          {section.heading && (
            <h2 className="legal-section-heading">
              <HighlightedText text={section.heading} opts={opts} />
            </h2>
          )}
          <SectionContent section={section} opts={opts} />
        </section>
      ))}

        {doc.footer && doc.footer.length > 0 && (
          <footer className="legal-footer">
            {doc.footer.map((line, i) => (
              <p key={i}>
                <HighlightedText text={line} opts={opts} />
              </p>
            ))}
          </footer>
        )}
      </article>

      {navItems.length > 0 && <LegalMiniMap items={navItems} />}
    </>
  );
}
