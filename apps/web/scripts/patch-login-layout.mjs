import fs from "fs";

const path = "d:/meetezri-live/apps/web/src/app/pages/Login.tsx";
const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);

const returnIdx = lines.findIndex((l) => l.trim() === "return (");
const lotusIdx = lines.findIndex((l) => l.includes('LotusEmblem className="mb-6"'));
const mobileIdx = lines.findIndex((l) =>
  l.includes("Mobile-only trust stack after login column"),
);

if ([returnIdx, lotusIdx, mobileIdx].some((i) => i < 0)) {
  console.error("markers missing", { returnIdx, lotusIdx, mobileIdx });
  process.exit(1);
}

let formLines = lines.slice(lotusIdx, mobileIdx).map((l) =>
  l
    .replace('LotusEmblem className="mb-6"', 'LotusEmblem className="mb-4"')
    .replace('className="mb-8 text-center"', 'className="mb-6 text-center"')
    .replace("We?re here for you", "We\u2019re here for you")
    .replace("my-8 flex items-center gap-4", "my-5 flex items-center gap-4")
    .replace("mt-7 text-center text-[14px]", "mt-5 text-center text-[14px]")
    .replace("mt-8 flex flex-wrap", "mt-5 flex flex-wrap"),
);

formLines = formLines.filter(
  (l) =>
    !l.includes('className="mt-7 text-center text-[11px]') &&
    !l.trim().startsWith("By logging in, you agree"),
);

const pad = (n, s) => " ".repeat(n) + s;
const formBlock = formLines.map((l) => pad(18, l.trimStart())).join("\n");

const fullReturn = `${pad(2, "return (")}
${pad(4, '<motion.div className="solace-login-page flex h-dvh max-h-dvh flex-col overflow-hidden bg-[#0b0b1e] text-[#f4f4f8]">'.replace("motion.", ""))}
${pad(6, "<SolaceLoginNav />")}
${pad(6, "")}
${pad(6, '<main className="relative min-h-0 flex-1 overflow-hidden">')}
${pad(8, "<LoginSceneBackdrop />")}
${pad(8, "")}
${pad(8, "{/* Desktop — viewport locked */}")}
${pad(8, '<div className="relative z-10 hidden h-full min-h-0 grid items-center gap-[clamp(28px,5vw,72px)] overflow-hidden px-[clamp(20px,4vw,56px)] lg:grid lg:grid-cols-[minmax(0,1.12fr)_minmax(420px,0.88fr)]">')}
${pad(10, '<section className="flex h-full max-h-full min-h-0 flex-col justify-between py-1">')}
${pad(12, '<div className="min-h-0">')}
${pad(14, "<WelcomeBlock />")}
${pad(14, '<TrustStack className="mt-6" compact />')}
${pad(12, "</div>")}
${pad(12, '<EmotionalQuoteCard className="mt-4 shrink-0" />')}
${pad(10, "</section>")}
${pad(10, "")}
${pad(10, '<div className="flex min-h-0 items-center justify-center py-1">')}
${pad(12, '<div className="w-full max-w-[clamp(420px,36vw,560px)]">')}
${pad(14, "<div")}
${pad(16, "className={cn(")}
${pad(18, '"relative max-h-[calc(100dvh-4.75rem-2.5rem)] overflow-hidden rounded-[2rem] border border-[#d81b60]/28",')}
${pad(18, '"bg-[rgba(11,11,30,0.44)] p-[clamp(1.5rem,2.8vw,2.25rem)] shadow-[0_0_0_1px_rgba(168,85,247,0.14),0_56px_140px_-52px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.09)] backdrop-blur-[26px]",')}
${pad(18, '"supports-[backdrop-filter]:bg-[rgba(11,11,30,0.36)]",')}
${pad(16, ")}")}
${pad(14, ">")}
${pad(16, '<div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-br from-[#E91E63]/[0.08] via-transparent to-[#9C27B0]/[0.1]" />')}
${pad(16, '<motion.div className="pointer-events-none absolute -right-[15%] top-[-5%] h-[50%] w-[75%] rounded-full bg-[radial-gradient(circle,rgba(233,30,99,0.14),transparent_68%)]" />'.replace("motion.", ""))}
${pad(16, '<div className="relative">')}
${formBlock}
${pad(16, "</div>")}
${pad(14, "</div>")}
${pad(14, '<p className="mt-4 flex justify-center gap-2 text-[11px] leading-relaxed text-violet-200/42">')}
${pad(16, '<Shield size={13} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#f472b8]/65" aria-hidden />')}
${pad(16, '<span className="text-center">')}
${pad(18, 'By logging in, you agree to our{" "}')}
${pad(18, '<Link to="/terms" className="text-[#f472b8]/95 hover:text-[#fbcfe8]">Terms &amp; Conditions</Link>{" "}')}
${pad(18, "and{\" \"}")}
${pad(18, '<Link to="/privacy" className="text-[#f472b8]/95 hover:text-[#fbcfe8]">Privacy Policy</Link>')}
${pad(16, "</span>")}
${pad(14, "</p>")}
${pad(12, "</div>")}
${pad(10, "</div>")}
${pad(8, "</div>")}
${pad(8, "")}
${pad(8, "{/* Mobile */}")}
${pad(8, '<div className="relative z-10 flex flex-col overflow-y-auto lg:hidden">')}
${pad(10, '<div className="relative min-h-[min(42svh,22rem)] shrink-0" />')}
${pad(10, '<div className="px-5 pb-6 pt-2">')}
${pad(12, "<WelcomeBlock />")}
${pad(12, '<EmotionalQuoteCard className="mx-auto mt-6 max-w-md" />')}
${pad(10, "</div>")}
${pad(10, '<div className="px-5 pb-10">')}
${pad(12, '<div className="mx-auto w-full max-w-md">')}
${pad(14, '<div className="relative overflow-hidden rounded-[2rem] border border-[#d81b60]/28 bg-[rgba(11,11,30,0.44)] p-7 shadow-[0_0_0_1px_rgba(168,85,247,0.14),0_48px_120px_-48px_rgba(0,0,0,0.9)] backdrop-blur-[26px]">')}
${pad(16, '<div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-br from-[#E91E63]/[0.08] via-transparent to-[#9C27B0]/[0.1]" />')}
${pad(16, '<div className="relative">')}
${formBlock}
${pad(16, "</div>")}
${pad(14, "</div>")}
${pad(14, '<p className="mt-4 text-center text-[11px] leading-relaxed text-violet-200/42">')}
${pad(16, 'By logging in, you agree to our{" "}')}
${pad(16, '<Link to="/terms" className="text-[#f472b8]/95 hover:text-[#fbcfe8]">Terms &amp; Conditions</Link> and{" "}')}
${pad(16, '<Link to="/privacy" className="text-[#f472b8]/95 hover:text-[#fbcfe8]">Privacy Policy</Link>')}
${pad(14, "</p>")}
${pad(12, "</div>")}
${pad(10, "</div>")}
${pad(10, '<div className="border-t border-white/[0.05] bg-[#080812]/40 px-5 py-10 backdrop-blur-md">')}
${pad(12, '<TrustStack compact className="mx-auto max-w-md" />')}
${pad(10, "</div>")}
${pad(8, "</div>")}
${pad(6, "</main>")}
${pad(4, "</div>")}
${pad(2, ");")}
`;

const out = [...lines.slice(0, returnIdx), fullReturn, "}"].join("\n");
fs.writeFileSync(path, out);
console.log("patched ok");
