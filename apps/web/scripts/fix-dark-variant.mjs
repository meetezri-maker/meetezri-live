import fs from "fs";
import path from "path";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("Usage: node fix-dark-variant.mjs <file>...");
  process.exit(1);
}

for (const file of files) {
  const abs = path.resolve(file);
  let s = fs.readFileSync(abs, "utf8");
  const before = (s.match(/ dark:/g) || []).length;
  s = s.replace(/ dark:([^\s"]+)/g, " [html[data-ezri-theme=dark]_&]:$1");
  fs.writeFileSync(abs, s);
  const after = (s.match(/ dark:/g) || []).length;
  console.log(`${path.basename(abs)}: replaced ${before - after} dark: variants (${after} remaining)`);
}
