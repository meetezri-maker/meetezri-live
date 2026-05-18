import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const filePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/app/pages/Login.tsx",
);
let c = fs.readFileSync(filePath, "utf8");

const replacements = [
  [
    `className="absolute inset-0 h-full w-full object-cover object-[28%_62%] brightness-[0.62] contrast-[1.05] saturate-[1.08] lg:object-[32%_58%]"`,
    `className="absolute inset-0 h-full w-full scale-[1.06] object-cover object-[center_38%] brightness-[0.58] contrast-[1.04] saturate-[1.06] blur-[5px] lg:object-[center_36%] lg:blur-[4px]"`,
  ],
  [
    `const LOGIN_PANEL_SHELL = cn(
  "relative w-full overflow-x-hidden rounded-[32px] border border-[#f472b8]/30",
  "bg-[rgba(10,12,28,0.52)] p-8 backdrop-blur-[28px] sm:p-9",
  "shadow-[0_0_0_1px_rgba(236,72,153,0.14),0_0_56px_-10px_rgba(236,72,153,0.32),0_28px_72px_-28px_rgba(0,0,0,0.8)]",
  "supports-[backdrop-filter]:bg-[rgba(10,12,28,0.48)]",
);`,
    `const LOGIN_PANEL_SHELL = cn(
  "relative w-full overflow-x-hidden rounded-[34px] border border-[#e879a9]/22",
  "bg-[rgba(12,10,24,0.72)] p-8 backdrop-blur-[24px] sm:p-10 lg:p-14",
  "shadow-[0_0_0_1px_rgba(236,72,153,0.1),0_0_40px_-18px_rgba(168,85,247,0.22),0_24px_64px_-32px_rgba(0,0,0,0.82)]",
  "supports-[backdrop-filter]:bg-[rgba(12,10,24,0.68)]",
);`,
  ],
  [
    `className="relative flex h-[78px] w-[78px] items-center justify-center rounded-full border border-[#E91E63]/28 bg-gradient-to-b from-[#E91E63]/12 to-[#9C27B0]/10 shadow-[0_0_36px_-8px_rgba(233,30,99,0.45),inset_0_0_20px_rgba(168,85,247,0.12)]"`,
    `className="relative flex h-[84px] w-[84px] items-center justify-center rounded-full border border-[#E91E63]/24 bg-gradient-to-b from-[#E91E63]/14 to-[#9C27B0]/12 shadow-[0_0_32px_-10px_rgba(233,30,99,0.38),inset_0_0_18px_rgba(168,85,247,0.1)]"`,
  ],
  [
    `className="flex h-[54px] w-full items-center justify-center gap-3 rounded-full border border-white/14 bg-white/[0.05]`,
    `className="flex h-[52px] w-full items-center justify-center gap-3 rounded-2xl border border-white/12 bg-white/[0.045]`,
  ],
  [
    `className="group relative mt-1 flex h-[58px] w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r`,
    `className="group relative mt-1 flex h-[54px] w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r`,
  ],
  [
    `rounded-[32px] bg-gradient-to-br from-[#E91E63]/[0.07] via-transparent to-[#9C27B0]/[0.06]"`,
    `rounded-[34px] bg-gradient-to-br from-[#E91E63]/[0.06] via-transparent to-[#9C27B0]/[0.05]"`,
  ],
  [
    `pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(236,72,153,0.35),transparent_70%)]"`,
    `pointer-events-none absolute -left-12 -top-12 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(236,72,153,0.28),transparent_70%)]"`,
  ],
];

for (const [from, to] of replacements) {
  if (!c.includes(from)) {
    console.warn("missing:", from.slice(0, 60));
  } else {
    c = c.replace(from, to);
  }
}

fs.writeFileSync(filePath, c);
console.log("done");
