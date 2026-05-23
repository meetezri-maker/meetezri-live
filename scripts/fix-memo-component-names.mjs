import fs from "fs";
import path from "path";

const dir = "apps/web/src/app/pages/app/active-session/components";
for (const file of fs.readdirSync(dir)) {
  if (!file.endsWith(".tsx")) continue;
  const p = path.join(dir, file);
  let s = fs.readFileSync(p, "utf8");
  const m = s.match(/export const (\w+) = memo\((\w+)\)/);
  if (!m || m[1] !== m[2]) continue;
  const name = m[1];
  const inner = `${name}Component`;
  s = s.replace(new RegExp(`function ${name}\\(`, "g"), `function ${inner}(`);
  s = s.replace(
    `export const ${name} = memo(${name});`,
    `export const ${name} = memo(${inner});`,
  );
  fs.writeFileSync(p, s);
  console.log("fixed", file);
}
