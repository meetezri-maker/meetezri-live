import { describe, it, expect } from "vitest";
import { journalHtmlToLines, journalHtmlToPlainText } from "./journalRichText";

describe("journalHtmlToPlainText", () => {
  it("keeps editor lines (<div>), empty lines (<div><br></div>) and <br> breaks", () => {
    expect(journalHtmlToPlainText("First line<div>Second line</div><div><br></div><div>After a blank line</div>")).toBe(
      "First line\nSecond line\n\nAfter a blank line"
    );
    expect(journalHtmlToPlainText("a<br>b<br><br>c")).toBe("a\nb\n\nc");
    expect(journalHtmlToPlainText("<div>text<br></div><div>next</div>")).toBe("text\nnext");
  });

  it("separates paragraphs and headings with a blank line", () => {
    expect(journalHtmlToPlainText("<h2>Morning</h2><p>Slept well.</p><p>Walked.</p>")).toBe("Morning\n\nSlept well.\n\nWalked.");
  });

  it("keeps ordered, unordered and nested lists with their markers", () => {
    const html = "<ul><li>Tea</li><li>Walk<ul><li>Park</li><li>River</li></ul></li></ul><ol start=\"3\"><li>Three</li><li>Four</li></ol>";
    expect(journalHtmlToPlainText(html)).toBe("- Tea\n- Walk\n  - Park\n  - River\n\n3. Three\n4. Four");
  });

  it("decodes entities, keeps typed repeated spaces and drops script/style content", () => {
    expect(journalHtmlToPlainText("Fish &amp; chips &lt;3 &quot;yes&quot;&nbsp;&nbsp;two<script>alert(1)</script><style>p{}</style>")).toBe(
      'Fish & chips <3 "yes"  two'
    );
    expect(journalHtmlToPlainText("  spaced \n  out  ")).toBe("spaced out");
  });

  it("keeps quotes, preformatted whitespace, rules and image markers", () => {
    expect(journalHtmlToPlainText("<blockquote>Be kind.</blockquote>")).toBe("> Be kind.");
    expect(journalHtmlToPlainText("<pre>a  b\n  c</pre>")).toBe("a  b\n  c");
    expect(journalHtmlToPlainText("one<hr>two")).toBe("one\n\n---\n\ntwo");
    expect(journalHtmlToPlainText('Look <img src="data:x"> and <img alt="sunset" src="y">')).toBe("Look [image] and [image: sunset]");
  });

  it("keeps Unicode exactly: Urdu, emoji and mixed text", () => {
    const urdu = "آج میں نے بہت سکون محسوس کیا۔ 😊 Calm (3)";
    expect(journalHtmlToPlainText(`<div>${urdu}</div>`)).toBe(urdu);
  });

  it("returns empty text for empty or whitespace-only content", () => {
    expect(journalHtmlToPlainText("")).toBe("");
    expect(journalHtmlToPlainText(null)).toBe("");
    expect(journalHtmlToPlainText("<div><br></div>")).toBe("");
  });

  it("describes each line's role for the PDF", () => {
    const lines = journalHtmlToLines("<h1>Title</h1><ol><li>One</li></ol><blockquote>Q</blockquote>");
    expect(lines.map((l) => [l.kind, l.text, l.marker ?? null, l.level ?? null])).toEqual([
      ["heading", "Title", null, 1],
      ["list-item", "One", "1.", null],
      ["quote", "Q", null, null],
    ]);
  });
});
