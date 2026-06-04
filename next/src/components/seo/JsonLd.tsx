/* ══════════════════════════════════════════
   JsonLd — structured data(<script type="application/ld+json">) 렌더 (SEO 2차)

   - JSON.stringify 후 '<' 를 escape 하여 </script> injection 차단
     (product.desc 등 운영자 입력이 섞일 수 있어 방어).
   ══════════════════════════════════════════ */

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}
