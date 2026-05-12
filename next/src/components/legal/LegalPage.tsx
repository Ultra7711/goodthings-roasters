/* ══════════════════════════════════════════
   LegalPage — /legal/[slug]
   ──────────────────────────────────────────
   layout (legal-page / legal-shell / legal-hero / legal-side / LegalSideNav) 은
   /legal/layout.tsx 가 처리. page 는 body 만 (S197 PR-2 후속).
   - useAccordion=true 인 정보 페이지 (shipping · returns) 는 heading 단위 아코디언
   ══════════════════════════════════════════ */

import type { LegalDoc, LegalSection } from '@/app/(main)/legal/[slug]/content';
import Accordion from '@/components/common/Accordion';

import './LegalPage.css';

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
                    <a href={d.link} className="legal-link" target="_blank" rel="noopener noreferrer">{d.label}</a>
                  ) : d.label}
                </dt>
                <dd>
                  {linkedValue ? (
                    <a href={d.link} className="legal-link" target="_blank" rel="noopener noreferrer">{d.value}</a>
                  ) : d.value}
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
  const groups = doc.useAccordion ? groupByHeading(doc.sections) : null;

  return (
    <>
      <header className="legal-hero">
        <h1 className="legal-title">{doc.title}</h1>
        {doc.effectiveDate && (
          <p className="legal-effective">{doc.effectiveDate}</p>
        )}
      </header>

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
    </>
  );
}
