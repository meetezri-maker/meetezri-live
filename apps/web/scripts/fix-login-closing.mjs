import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const filePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/app/pages/Login.tsx",
);
let c = fs.readFileSync(filePath, "utf8");
const before = (c.match(/<\/motion\.motion.div>/g) || []).length;
const wrong = (c.match(/<\/motion\.div>/g) || []).length;
c = c.split("</motion.div>").join("</div>");
fs.writeFileSync(filePath, c);
console.log("wrong closings fixed:", wrong, "before typo:", before);
