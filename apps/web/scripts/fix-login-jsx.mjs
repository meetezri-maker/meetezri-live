import fs from "fs";

const p = "d:/meetezri-live/apps/web/src/app/pages/Login.tsx";
const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);

function removeOrphanBlock(lines) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // orphan: closing divs then Link to terms without opening p
    if (
      line.includes("<Link to=\"/terms\"") &&
      lines[i - 1]?.trim() === "" &&
      lines[i - 2]?.trim() === "</div>"
    ) {
      // skip until after </p> and extra </motion.div> closes (3 divs + blank + link block)
      while (i < lines.length && !lines[i].includes("<p className=\"mt-3 flex justify-center")) {
        if (lines[i].includes("<p className=\"mt-4 text-center")) break;
        i++;
      }
      continue;
    }
    out.push(line);
    i++;
  }
  return out;
}

let fixed = removeOrphanBlock(lines);

// Also remove duplicate pt-7 if any left
fixed = fixed.map((l) =>
  l.includes("pt-5 items-center") && l.includes("pt-7")
    ? l.replace(" pt-7", "")
    : l,
);

fs.writeFileSync(p, fixed.join("\n"));
console.log("lines", lines.length, "->", fixed.length);
