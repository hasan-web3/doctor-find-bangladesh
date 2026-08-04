// Every value in here comes from the database (doctor names, bios, hospital
// descriptions, FAQ answers, the brand name), which means an admin can type
// anything into it. Serialising straight into a <script> body is therefore not
// safe: the HTML parser ends the element at the first literal "</script>" it
// sees, no matter that it sits inside a JSON string. One such sequence in a
// doctor bio would close the tag early and let the rest of that field render as
// markup.
//
// Escaping "<" to its < form fixes it at the source: still valid JSON
// (JSON.parse and Google's structured-data parser both read < as "<"), but
// the literal character never reaches the HTML parser, so no tag can be closed
// early. Escaping just "<" is sufficient — without it there is no way to open
// or close an element.
function toSafeJsonLd(item: Record<string, unknown>): string {
  return JSON.stringify(item).replace(/</g, "\\u003c");
}

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: toSafeJsonLd(item) }}
        />
      ))}
    </>
  );
}
