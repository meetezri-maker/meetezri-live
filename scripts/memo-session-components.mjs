import fs from "fs";
import path from "path";

const dir = "apps/web/src/app/pages/app/active-session/components";
const skip = new Set(["SessionStage.tsx", "SessionBackdrop.tsx"]);

for (const file of fs.readdirSync(dir)) {
  if (!file.endsWith(".tsx") || skip.has(file)) continue;
  const p = path.join(dir, file);
  let s = fs.readFileSync(p, "utf8");
  if (s.includes("= memo(")) continue;
  const match = s.match(/export function (\w+)/);
  if (!match) continue;
  const name = match[1];
  if (!s.includes("memo")) {
    if (/import \{([^}]+)\} from "react";/.test(s)) {
      s = s.replace(
        /import \{([^}]+)\} from "react";/,
        (_, inner) => {
          const parts = inner.split(",").map((x) => x.trim());
          if (!parts.includes("memo")) parts.push("memo");
          return `import { ${parts.join(", ")} } from "react";`;
        },
      );
    } else {
      s = `import { memo } from "react";\n${s}`;
    }
  }
  s = s.replace(`export function ${name}`, `function ${name}`);
  if (!s.includes(`export const ${name} = memo`)) {
    s = s.trimEnd() + `\n\nexport const ${name} = memo(${name});\n`;
  }
  fs.writeFileSync(p, s);
  console.log("memo:", file);
}
