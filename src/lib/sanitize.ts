import "server-only";
import sanitizeHtmlLib from "sanitize-html";

// Sanitize blog article HTML before rendering.
// Even though only authenticated admins write it, we still strip anything that
// could execute script — defense-in-depth against a compromised admin account
// or a rich-text editor bug that lets crafted markup through.
//
// Uses sanitize-html (htmlparser2-based) rather than DOMPurify + jsdom: the
// latter drags in @exodus/bytes as an ESM dep that Vercel's Node bundler emits
// a CJS require() for, which crashes at runtime.
//
// Allow-list mirrors what the RichTextEditor toolbar produces
// (headings, paragraphs, lists, links, quotes, inline emphasis, images).

const OPTIONS: sanitizeHtmlLib.IOptions = {
  allowedTags: [
    "p", "br", "hr",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "strong", "b", "em", "i", "u", "s", "sub", "sup",
    "ul", "ol", "li",
    "blockquote", "code", "pre",
    "a", "img",
    "span", "div",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel", "class"],
    img: ["src", "alt", "title", "width", "height", "class"],
    "*": ["class"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
  // Force safe rel on target=_blank links (sanitize-html has a built-in for this).
  transformTags: {
    a: (tagName, attribs) => {
      const out = { ...attribs };
      if (out.target === "_blank") {
        out.rel = out.rel && /noopener/.test(out.rel) ? out.rel : "noopener noreferrer";
      }
      return { tagName, attribs: out };
    },
  },
};

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtmlLib(html, OPTIONS);
}
