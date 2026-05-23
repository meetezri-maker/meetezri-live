import fs from "fs";

const p = "apps/web/src/app/pages/app/active-session/ActiveSession.tsx";
const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);

const start = lines.findIndex((l) => l.includes("const [pipPos, setPipPos]"));
const end = lines.findIndex(
  (l, i) => i > start && l.includes("}, [anchorPipBelowTranscriptOnce]);"),
);
if (start < 0 || end < 0) {
  console.error("markers not found", start, end);
  process.exit(1);
}

const replacement = [
  "  const sessionContainerRef = useRef<HTMLDivElement>(null);",
  "  const leftSessionChromeRef = useRef<HTMLDivElement>(null);",
  "  const { pipPos, handlePipPointerDown, handlePipPointerMove, handlePipPointerUp } =",
  "    usePipDrag({ sessionContainerRef, leftSessionChromeRef });",
];

// Remove duplicate sessionContainerRef if start-1 is sessionContainerRef
let removeFrom = start - 1;
if (lines[removeFrom]?.includes("sessionContainerRef")) {
  removeFrom = start;
} else {
  removeFrom = start;
}

const out = [
  ...lines.slice(0, removeFrom - 1),
  ...replacement,
  ...lines.slice(end + 1),
];
fs.writeFileSync(p, out.join("\n"));
console.log("Removed pip lines", start, end);
