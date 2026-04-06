/**
 * Plain text from HTML for previews and counts. Decodes entities (e.g. &nbsp;)
 * so they don't appear as literal text after stripping tags.
 */
export function htmlToPlainText(html: string): string {
  if (!html.trim()) return "";
  if (typeof document !== "undefined") {
    const div = document.createElement("div");
    div.innerHTML = html;
    const raw = div.textContent ?? div.innerText ?? "";
    return raw.replace(/\u00A0/g, " ");
  }
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
    .replace(/&#xa0;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\u00A0/g, " ");
}

/** Truncate for card previews without an ellipsis suffix. */
export function truncatePreview(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen).trimEnd();
}
