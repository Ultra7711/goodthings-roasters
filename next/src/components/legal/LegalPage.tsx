/* ══════════════════════════════════════════
   LegalPage — /legal/[slug]
   ──────────────────────────────────────────
   정적 컨텐츠 페이지. 5종 (terms · privacy · business-info · shipping · returns).
   - 좌측 사이드 내비 (데스크탑) / 모바일은 상단 가로 스크롤 chip
   - 우측 본문 (heading · paragraphs · bullets · definitions)
   - 헤더 light 테마 (headerThemeConfig 등록)
   - useAccordion=true 인 정보 페이지 (shipping · returns) 는 heading 단위 아코디언
   ══════════════════════════════════════════ */

import Link from 'next/link';
import type { LegalDoc, LegalSection } from '@/app/(main)/legal/[slug]/content';
import { LEGAL_NAV } from '@/app/(main)/legal/[slug]/content';
import Accordion from '@/components/common/Accordion';

type Props = {
  doc: LegalDoc;
};

/** heading 있는 섹션과 직후의 heading-less 섹션을 하나의 그룹으로 묶음. */
type SectionGroup = {
  heading: string;
  sections: LegalSection[];
};

function groupByHeading(sections: LegalSection[]): SectionGroup[] {
  const groups: SectionGroup[] = [];
  for (const section of sections) {
    if (section.heading) {
      groups.push({ heading: section.heading, sections: [section] });
    } else if (groups.length > 0) {
      groups[groups.length - 1].sections.push(section);
    } else {
      // heading 없는 첫 섹션 → 임시 그룹 (보통 발생 안 함)
      groups.push({ heading: '', sections: [section] });
    }
  }
  return groups;
}

function SectionContent({ section }: { section: LegalSection }) {
  return (
    <>
      {section.paragraphs?.map((para, i) => (
        <p key={`p-${i}`} className="legal-paragraph">
          {para}
        </p>
      ))}
      {section.bullets && section.bullets.length > 0 && (
        <ul className="legal-bullets">
          {section.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
      {section.definitions && section.definitions.length > 0 && (
        <dl className="legal-defs">
          {section.definitions.map((d, i) => (
            <div key={i} className="legal-def-row">
              <dt>{d.label}</dt>
              <dd>{d.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}

export default function LegalPage({ doc }: Props) {
  const groups = doc.useAccordion ? groupByHeading(doc.sections) : null;

  return (
    <div className="legal-page" data-header-theme="light">
      <div className="legal-shell">
        <header className="legal-hero">
          <h1 className="legal-title">{doc.title}</h1>
          {doc.effectiveDate && (
            <p className="legal-effective">{doc.effectiveDate}</p>
          )}
        </header>

        <div className="legal-layout">
          <aside className="legal-side" aria-label="약관 메뉴">
            <nav>
              <ul className="legal-side-list">
                {LEGAL_NAV.map((item) => {
                  const active = item.slug === doc.slug;
                  return (
                    <li key={item.slug}>
                      <Link
                        href={`/legal/${item.slug}`}
                        className={`legal-side-link${active ? ' active' : ''}`}
                        aria-current={active ? 'page' : undefined}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>

          <article className="legal-body">
            {doc.intro && doc.intro.length > 0 && (
              <div className="legal-intro">
                {doc.intro.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            )}

            {groups ? (
              <div className="legal-accordion-list">
                {groups.map((group, idx) => (
                  <Accordion
                    key={`${group.heading}-${idx}`}
                    label={group.heading}
                    defaultOpen
                  >
                    {group.sections.map((section, i) => (
                      <SectionContent key={i} section={section} />
                    ))}
                  </Accordion>
                ))}
              </div>
            ) : (
              doc.sections.map((section, idx) => (
                <section key={idx} className="legal-section">
                  {section.heading && (
                    <h2 className="legal-section-heading">{section.heading}</h2>
                  )}
                  <SectionContent section={section} />
                </section>
              ))
            )}

            {doc.footer && doc.footer.length > 0 && (
              <footer className="legal-footer">
                {doc.footer.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </footer>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}
