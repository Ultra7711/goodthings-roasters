/* ══════════════════════════════════════════
   LegalMiniMap — Legal 본문 우측 섹션 진행 미니맵 (데스크탑 전용)
   ──────────────────────────────────────────
   평상시: 섹션마다 짧은 가로선 · 현재 섹션 active (골드 강조)
   hover/focus: 짧은 선들이 챕터 제목 텍스트 목록으로 펼침 (토스 FAQ 패턴)
   클릭: 해당 섹션으로 smooth scroll (globals.css scroll-padding-top 이 헤더 가림 보정)
   active 추적: IntersectionObserver (GenericCard flashActive 패턴 답습)

   모바일 숨김 — 본문 옆 여백 없음. LegalMiniMap.css @media 에서 display:none.
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useState } from 'react';
import './LegalMiniMap.css';

export type MiniMapItem = {
  /** 본문 섹션의 anchor id (legal-sec-{idx}) */
  id: string;
  /** 섹션 heading 텍스트 */
  label: string;
};

type Props = {
  items: readonly MiniMapItem[];
};

export default function LegalMiniMap({ items }: Props) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? '');

  /* 현재 뷰포트 상단~중앙에 들어온 섹션을 active.
     rootMargin top 음수 = 헤더(공지+헤더) 영역 제외, bottom 음수 = 화면 하단 55% 무시. */
  useEffect(() => {
    const sections = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-120px 0px -55% 0px', threshold: 0 },
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  /* 페이지 끝 근처 도달 시 마지막 섹션 강제 active.
     마지막 섹션이 짧으면 IO active 구역(상단 45%)까지 못 올라와 active 누락 →
     문서 끝 기준 보정 (footer 길이 무관). 끝을 벗어나면 IO 가 다시 잡음. */
  useEffect(() => {
    function onScroll() {
      const scrollBottom = window.scrollY + window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      if (docHeight - scrollBottom < 120) {
        const last = items[items.length - 1];
        if (last) setActiveId(last.id);
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [items]);

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    setActiveId(id);
    history.replaceState(null, '', `#${id}`);
  }

  return (
    <aside className="legal-minimap" aria-label="약관 목차">
      <nav>
        <ul className="legal-minimap-list">
          {items.map((it) => {
            const active = it.id === activeId;
            return (
              <li key={it.id}>
                <a
                  href={`#${it.id}`}
                  className={`legal-minimap-link${active ? ' active' : ''}`}
                  aria-current={active ? 'true' : undefined}
                  onClick={(e) => handleClick(e, it.id)}
                >
                  <span className="legal-minimap-label">{it.label}</span>
                  <span className="legal-minimap-bar" aria-hidden="true" />
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
