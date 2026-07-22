import "server-only";
import DOMPurify from "isomorphic-dompurify";

// Sanitize blog article HTML before rendering.
// Even though only authenticated admins write it, we still strip anything that
// could execute script — defense-in-depth against a compromised admin account
// or a rich-text editor bug that lets crafted markup through.
//
// Allowed: the exact tag set produced by our RichTextEditor toolbar
// (headings, paragraphs, lists, links, quotes, inline emphasis, images).
// Blocked: <script>, event handlers, iframe/embed/object, javascript: URLs,
// data: URLs (except images), style tags/attributes with JS.

const CONFIG: Parameters<typeof DOMPurify.sanitize>[1] = {
  ALLOWED_TAGS: [
    "p", "br", "hr",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "strong", "b", "em", "i", "u", "s", "sub", "sup",
    "ul", "ol", "li",
    "blockquote", "code", "pre",
    "a", "img",
    "span", "div",
  ],
  ALLOWED_ATTR: ["href", "title", "target", "rel", "src", "alt", "width", "height", "class"],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button", "meta", "link"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur", "style"],
  ADD_ATTR: ["target", "rel"],
};

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return "";
  const clean = DOMPurify.sanitize(html, CONFIG);
  // Force target="_blank" on links to also carry rel="noopener noreferrer"
  // — DOMPurify won't add that on its own.
  return String(clean).replace(
    /<a\b([^>]*?)target="_blank"([^>]*?)>/gi,
    (_, before, after) => {
      const attrs = `${before} ${after}`;
      if (/\brel=/.test(attrs)) return `<a${before}target="_blank"${after}>`;
      return `<a${before}target="_blank" rel="noopener noreferrer"${after}>`;
    }
  );
}
