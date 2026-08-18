"""
Week 2 workbook extraction — reads the .docx and emits a line-per-paragraph dump that keeps the
formatting signals the plain-text dump loses.

Each line is prefixed with flags so the mapping can tell a section heading from prose:
  B = every run in the paragraph is bold
  L = the paragraph is a list item
  S = the paragraph carries a named Word style

Read only: nothing is written back to the .docx.
"""

import sys
import zipfile
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/w2/w2.docx"
out = sys.argv[2] if len(sys.argv) > 2 else "/tmp/w2/w2-flagged.txt"

doc = ET.fromstring(zipfile.ZipFile(path).read("word/document.xml"))
body = doc.find(W + "body")


def runs(p):
    return p.findall(W + "r")


def text_of(p):
    return "".join(t.text or "" for t in p.iter(W + "t"))


def all_bold(p):
    rs = [r for r in runs(p) if (r.find(W + "t") is not None)]
    if not rs:
        return False
    for r in rs:
        rpr = r.find(W + "rPr")
        if rpr is None or rpr.find(W + "b") is None:
            return False
    return True


def style_of(p):
    ppr = p.find(W + "pPr")
    if ppr is None:
        return ""
    s = ppr.find(W + "pStyle")
    return s.get(W + "val") if s is not None else ""


def is_list(p):
    ppr = p.find(W + "pPr")
    return ppr is not None and ppr.find(W + "numPr") is not None


lines = []
for child in body:
    if child.tag == W + "p":
        txt = text_of(child).strip()
        flags = ""
        flags += "B" if all_bold(child) else "-"
        flags += "L" if is_list(child) else "-"
        st = style_of(child)
        flags += "S" if st else "-"
        lines.append(f"{flags}|{st}|{txt}")
    elif child.tag == W + "tbl":
        lines.append("---|TBL|[TABLE START]")
        for row in child.findall(W + "tr"):
            cells = []
            for tc in row.findall(W + "tc"):
                cells.append(" / ".join(text_of(p).strip() for p in tc.findall(W + "p") if text_of(p).strip()))
            lines.append("---|TBL|| " + " || ".join(cells))
        lines.append("---|TBL|[TABLE END]")

with open(out, "w", encoding="utf-8") as fh:
    fh.write("\n".join(lines))

print("lines:", len(lines))
print("bold paragraphs:", sum(1 for line in lines if line.startswith("B")))
