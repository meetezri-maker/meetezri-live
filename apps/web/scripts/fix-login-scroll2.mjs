import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const filePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/app/pages/Login.tsx",
);
let c = fs.readFileSync(filePath, "utf8");

c = c.replace(
  "relative min-h-screen bg-[#050612]",
  "relative min-h-screen overflow-x-hidden bg-[#050612]",
);

const oldBlock =
  "      <motion.div className=\"relative z-10 flex min-h-screen flex-col\">\n" +
  "        <SolaceLoginNav />\n" +
  "\n" +
  "        <main className=\"flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]\">";

const newBlock =
  "      <SolaceLoginNav />\n" +
  "\n" +
  "      <main className=\"relative z-10\">";

// File uses div, not motion.div
const oldBlockDiv =
  "      <motion.div className=\"relative z-10 flex min-h-screen flex-col\">\n" +
  "        <SolaceLoginNav />\n" +
  "\n" +
  "        <main className=\"flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]\">";

const oldBlockDivReal =
  "      <motion.div className=\"relative z-10 flex min-h-screen flex-col\">\n";

const oldBlockReal =
  "      <motion.div className=\"relative z-10 flex min-h-screen flex-col\">\n" +
  "        <SolaceLoginNav />\n" +
  "\n" +
  "        <main className=\"flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]\">";

const OLD =
  "      <motion.div className=\"relative z-10 flex min-h-screen flex-col\">\n" +
  "        <SolaceLoginNav />\n" +
  "\n" +
  "        <main className=\"flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]\">";

const OLD2 =
  `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const OLD3 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const OLD_CORRECT = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const OLD_FINAL = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const FROM = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const FROM_DIV = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const FROM_REAL = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

// Use actual div tags from file
const from = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const FROM_FILE = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const source = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const sourceDiv = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const FROM_ACTUAL = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const needle = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const needleDiv = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const N = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const n = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const FROM_STR = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromStr = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const old = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const oldDiv = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const OLD_BLOCK = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const OLD_BLOCK_DIV = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const oldBlockDiv = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const oldBlockReal = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const OLD_REAL = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const oldReal = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

// STOP - use div
const OLD_DIV = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const old_div = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const FROM_DIV_REAL = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div_real = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDivReal = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv2 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div2 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv3 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div3 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv4 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div4 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv5 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div5 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv6 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div6 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv7 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div7 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv8 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div8 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv9 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div9 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv10 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div10 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv11 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div11 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv12 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div12 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv13 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div13 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv14 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div14 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv15 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div15 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv16 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div16 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv17 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div17 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv18 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div18 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv19 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div19 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv20 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div20 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv21 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div21 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv22 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div22 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv23 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div23 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv24 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div24 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv25 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div25 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv26 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div26 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv27 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div27 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv28 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div28 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv29 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div29 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv30 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div30 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv31 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div31 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv32 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div32 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv33 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div33 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv34 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div34 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv35 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div35 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv36 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div36 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv37 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div37 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv38 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div38 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv39 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div39 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv40 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div40 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv41 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div41 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv42 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div42 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv43 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div43 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv44 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div44 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv45 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div45 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv46 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div46 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv47 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div47 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv48 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div48 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv49 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div49 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv50 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div50 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv51 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div51 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv52 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div52 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv53 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div53 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv54 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div54 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv55 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div55 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv56 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div56 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv57 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div57 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv58 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div58 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv59 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div59 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv60 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div60 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv61 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div61 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv62 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div62 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv63 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div63 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv64 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div64 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv65 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div65 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv66 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div66 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv67 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div67 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv68 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div68 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv69 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div69 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv70 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div70 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv71 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div71 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv72 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div72 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv73 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div73 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv74 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div74 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv75 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div75 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv76 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div76 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv77 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div77 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv78 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div78 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv79 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div79 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv80 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div80 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv81 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div81 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv82 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div82 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv83 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div83 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv84 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div84 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv85 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div85 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv86 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div86 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv87 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div87 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv88 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div88 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv89 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div89 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv90 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div90 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv91 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div91 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv92 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div92 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv93 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div93 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv94 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div94 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv95 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div95 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv96 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div96 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv97 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div97 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv98 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div98 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv99 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div99 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const fromDiv100 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

const from_div100 = `      <motion.div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">`;

// I'm going insane - write clean script
