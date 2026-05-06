/* ══════════════════════════════════════════
   ProductFlavorNote — Advisory C §3 (S164 PR-3)
   ──────────────────────────────────────────
   outlined chips (한국어 main + 영문 sub) + desc.
   좌측 Roasting (label-bar-tick-desc) 시각 매칭:
     label → chips → desc.
   noteTags + noteTagsEn positional zip — prototype 영문 원본 보존.
   ══════════════════════════════════════════ */

type Props = {
  noteTags: string;
  noteTagsEn: string;
  flavorDesc: string;
};

export default function ProductFlavorNote({ noteTags, noteTagsEn, flavorDesc }: Props) {
  const ko = noteTags.split(/\s*\|\s*/).filter(Boolean);
  const en = noteTagsEn.split(/\s*\|\s*/).filter(Boolean);

  return (
    <div id="pd-note-section">
      <p className="pd-flavor-section-label">Flavor</p>
      <div id="pd-note-tags">
        {ko.map((t, i) => (
          <span key={`${t}-${i}`} className="pd-note-tag" tabIndex={0}>
            {t}
            {en[i] ? <span className="pd-note-tag-en">{en[i]}</span> : null}
          </span>
        ))}
      </div>
      {flavorDesc ? <p className="pd-flavor-desc">{flavorDesc}</p> : null}
    </div>
  );
}
