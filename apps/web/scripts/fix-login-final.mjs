import fs from "fs";

const src = fs.readFileSync(
  "d:/meetezri-live/apps/web/src/app/pages/Login.restored.tsx",
  "utf8",
);

let s = src;

// Imports
s = s.replace(
  'import { Input } from "../components/ui/input";\nimport { Label } from "../components/ui/label";',
  'import { Input } from "../components/ui/input";',
);
s = s.replace(
  '  ShieldCheck,\n',
  "",
);
s = s.replace(
  'import { cn } from "@/lib/utils";\n',
  'import { cn } from "@/lib/utils";\nimport { BrandLogo } from "../components/BrandLogo";\n',
);

// Hero + trust copy
s = s.replace(
  'const LOGIN_HERO_BG = "/solace/login-environment.jpg";',
  `const LOGIN_HERO_BG = "/solace/login-cinematic-lock.png";

/** Navbar height — keep in sync with SolaceLoginNav */
const LOGIN_NAV_H = "4.75rem";`,
);

s = s.replace(
  `    description:
      "Your feelings and data are held quietly, with protection you can rely on.",`,
  `    description: "Your data is encrypted and always protected.",`,
);
s = s.replace(
  `    description:
      "Come as you are—there’s room here to exhale without fear of critique.",`,
  `    description: "We're here to support you, always.",`,
);
s = s.replace(
  `    description:
      "Gentle guidance that learns your rhythm and honors what you need today.",`,
  `    description: "Tools and insights that grow with you.",`,
);

// Remove SolaceWordmark
s = s.replace(
  /interface SolaceWordmarkProps[\s\S]*?^}\n\n/m,
  "",
);

// Replace SolaceLoginNav
const navNew = `function SolaceLoginNav({ className }: SolaceLoginNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <header
      className={cn(
        "relative z-50 shrink-0 border-b border-white/[0.08] bg-[#070815]/75 backdrop-blur-2xl",
        "shadow-[inset_0_-1px_0_rgba(233,30,99,0.14)] supports-[backdrop-filter]:bg-[#070815]/55",
        className,
      )}
      style={{ height: LOGIN_NAV_H }}
    >
      <motion.div className="relative flex h-full w-full items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
        <Link to="/" className="relative z-10 flex shrink-0 items-center">
          <BrandLogo heightClass="h-10" />
        </Link>

        <nav
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 text-[14px] font-normal tracking-wide text-violet-100/78 md:flex"
          aria-label="Primary"
        >
          <Link to="/how-it-works" className="transition-colors hover:text-white/95">
            How It Works
          </Link>
          <Link to="/pricing" className="transition-colors hover:text-white/95">
            Pricing
          </Link>
          <Link to="/privacy" className="transition-colors hover:text-white/95">
            Privacy &amp; Safety
          </Link>
        </nav>

        <div className="relative z-10 hidden items-center gap-5 sm:flex">
          <Link to="/login" className="text-[14px] text-violet-100/78 transition-colors hover:text-white">
            Log In
          </Link>
          <Link
            to="/pricing"
            className="rounded-full bg-gradient-to-r from-[#E91E63] to-[#9C27B0] px-6 py-2.5 text-[13px] font-medium text-white shadow-[0_0_28px_-4px_rgba(233,30,99,0.55)] transition-[box-shadow,transform] duration-300 hover:shadow-[0_0_40px_-2px_rgba(168,85,247,0.42)] active:scale-[0.98]"
          >
            Get Started
          </Link>
        </div>

        <button
          type="button"
          className="relative z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/90 sm:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="solace-login-mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open ? (
        <motion.div
          id="solace-login-mobile-nav"
          className="border-t border-white/[0.06] bg-[#070812]/85 px-4 py-4 backdrop-blur-xl sm:hidden"
        >
          <nav className="flex flex-col gap-3 text-sm text-violet-100/85">
            <Link to="/how-it-works" onClick={() => setOpen(false)}>How It Works</Link>
            <Link to="/pricing" onClick={() => setOpen(false)}>Pricing</Link>
            <Link to="/privacy" onClick={() => setOpen(false)}>Privacy &amp; Safety</Link>
            <Link to="/login" onClick={() => setOpen(false)}>Log In</Link>
            <Link
              to="/pricing"
              onClick={() => setOpen(false)}
              className="mt-1 inline-flex w-fit rounded-full bg-gradient-to-r from-[#E91E63] to-[#9C27B0] px-5 py-2 text-sm font-medium text-white shadow-[0_0_22px_-4px_rgba(233,30,99,0.5)]"
            >
              Get Started
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}`;

s = s.replace(/function SolaceLoginNav[\s\S]*?^}\n\ninterface LotusEmblemProps/m, navNew + "\n\ninterface LotusEmblemProps");

// Fix accidental motion.div without import - use div
s = s.replace(/<motion\.div/g, "<motion.div".replace("motion.", "") ? s : s);
s = s.replace(/<motion\.motion\.div/g, "<div");
s = s.replace(/<motion\.motion\.div/g, "<div");
s = s.replace(/<motion\.div/g, "<motion.div");
// simpler: replace all motion. with nothing in nav
s = s.replace(/<motion\.div/g, "<div");
s = s.replace(/<\/motion\.motion\.motion\.div>/g, "</div>");
s = s.replace(/<\/motion\.div>/g, "</motion.div>".replace("motion.", "") || "</motion.div>");
s = s.replace(/<\/motion\.motion\.div>/g, "</div>");
s = s.replace(/<\/motion\.motion\.motion\.div>/g, "</div>");
s = s.replace(/<\/motion\.div>/g, "</div>");

// Replace CinematicLeft with backdrop + quote card
const backdropBlock = `interface EmotionalQuoteCardProps {
  className?: string;
}

function EmotionalQuoteCard({ className }: EmotionalQuoteCardProps) {
  return (
    <aside
      className={cn(
        "max-w-[min(100%,22rem)] rounded-[1.25rem] border border-[#f472b8]/28 bg-black/28 px-5 py-4 backdrop-blur-md",
        "shadow-[0_0_0_1px_rgba(236,72,153,0.1),0_20px_56px_-28px_rgba(0,0,0,0.85)]",
        className,
      )}
      aria-label="Encouragement"
    >
      <Heart
        size={16}
        className="mb-2 text-[#f472b8] drop-shadow-[0_0_10px_rgba(233,30,99,0.45)]"
        aria-hidden
      />
      <p className="solace-login-serif text-[15px] font-medium italic leading-snug tracking-wide text-[#ede9fe]/95 sm:text-[16px]">
        &ldquo;It&rsquo;s okay to take a step back,
        <br />
        as long as you don&rsquo;t give up.&rdquo;
      </p>
    </aside>
  );
}

function LoginSceneBackdrop() {
  const particles = useMemo(() => [...Array(8)].map((_, i) => i), []);

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <img
        src={LOGIN_HERO_BG}
        alt=""
        className="absolute inset-0 h-full w-full scale-[1.03] object-cover object-[32%_62%] lg:object-[28%_58%] xl:object-[26%_56%]"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a14]/75 via-[#12051c]/45 to-[#07040d]/55" />
      <motion.div className="absolute inset-0 bg-gradient-to-t from-[#07040d]/88 via-[#0a0814]/25 to-[#0a0814]/40" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_85%_70%_at_50%_100%,rgba(255,154,71,0.12),transparent_55%)] mix-blend-screen" />
      <div className="absolute inset-y-0 right-0 w-[min(52%,520px)] bg-gradient-to-l from-[#1a0a28]/55 via-[#12051c]/25 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(5,4,12,0.55)_100%)]" />
      {particles.map((i) => (
        <span
          key={i}
          className="solace-login-particle absolute bottom-[18%] left-1/2"
          style={
            {
              "--delay": \`\${i * 0.95}s\`,
              "--ox": \`\${(i % 7) * 22 - 66}px\`,
              "--sx": \`\${(i % 5) * 10 - 20}px\`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}`;

s = s.replace(/interface CinematicLeftProps[\s\S]*?^}\n\nconst otpSlotClass/m, backdropBlock + "\n\nconst otpSlotClass");

// Fix motion in backdrop
s = s.replace(
  '<motion.div className="absolute inset-0 bg-gradient-to-t from-[#07040d]/88 via-[#0a0814]/25 to-[#0a0814]/40" />',
  '<div className="absolute inset-0 bg-gradient-to-t from-[#07040d]/88 via-[#0a0814]/25 to-[#0a0814]/40" />',
);

// Tighten WelcomeBlock
s = s.replace(
  '      <h1 className="solace-login-serif text-[clamp(2.15rem,3.6vw,3.35rem)] font-medium leading-[1.08] text-[#faf8fc] drop-shadow-[0_2px_28px_rgba(0,0,0,0.45)]">',
  '      <h1 className="solace-login-serif text-[clamp(1.85rem,3.2vw,2.75rem)] font-medium leading-[1.08] text-[#faf8fc] drop-shadow-[0_2px_28px_rgba(0,0,0,0.45)]">',
);
s = s.replace(
  '      <p className="solace-login-serif mt-2 text-[clamp(1.55rem,2.5vw,2.15rem)] font-medium italic tracking-wide text-[#f472b8] drop-shadow-[0_0_18px_rgba(233,30,99,0.25)]">',
  '      <p className="solace-login-serif mt-1.5 text-[clamp(1.35rem,2.2vw,1.85rem)] font-medium italic tracking-wide text-[#f472b8] drop-shadow-[0_0_18px_rgba(233,30,99,0.25)]">',
);
s = s.replace(
  '      <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[#bdb7d6]/95">',
  '      <p className="mt-3 max-w-md text-[14px] leading-relaxed text-[#bdb7d6]/90 sm:text-[15px]">',
);

// Compact trust stack spacing when compact
s = s.replace(
  '      className={cn("flex flex-col gap-5", compact && "gap-4", className)}',
  '      className={cn("flex flex-col gap-5", compact && "gap-3.5", className)}',
);

// Replace return block
const returnStart = s.indexOf("  return (\n    <div className=\"solace-login-page min-h-screen");
const returnEnd = s.lastIndexOf("  );\n}");

if (returnStart < 0 || returnEnd < 0) {
  console.error("return block not found", returnStart, returnEnd);
  process.exit(1);
}

const authCardInner = s.slice(
  s.indexOf('<LotusEmblem className="mb-6" />', returnStart),
  s.indexOf('{/* Mobile-only trust stack', returnStart),
);

const authCard = authCardInner
  .replace('LotusEmblem className="mb-6"', 'LotusEmblem className="mb-4"')
  .replace('className="mb-8 text-center"', 'className="mb-6 text-center"')
  .replace("my-8 flex items-center gap-4", "my-5 flex items-center gap-4")
  .replace("mt-7 text-center text-[14px]", "mt-5 text-center text-[14px]")
  .replace("mt-8 flex flex-wrap", "mt-5 flex flex-wrap pt-5")
  .replace(
    `            <p className="mt-7 text-center text-[11px] leading-relaxed text-violet-200/42">
              By logging in, you agree to our{" "}
              <Link to="/terms" className="text-[#f472b8]/95 hover:text-[#fbcfe8]">
                Terms &amp; Conditions
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="text-[#f472b8]/95 hover:text-[#fbcfe8]">
                Privacy Policy
              </Link>
            </p>`,
    "",
  );

const newReturn = `  return (
    <div className="solace-login-page flex h-dvh max-h-dvh flex-col overflow-hidden bg-[#0b0b1e] text-[#f4f4f8]">
      <SolaceLoginNav />

      <main className="relative min-h-0 flex-1 overflow-hidden">
        <LoginSceneBackdrop />

        {/* Desktop — single viewport, no page scroll */}
        <div className="relative z-10 hidden h-full min-h-0 items-center gap-[clamp(24px,4vw,64px)] overflow-hidden px-[clamp(20px,3.5vw,56px)] lg:grid lg:grid-cols-[minmax(0,1.12fr)_minmax(420px,0.88fr)]">
          <section className="flex h-full max-h-full min-h-0 flex-col justify-between py-1">
            <div className="min-h-0 space-y-0">
              <WelcomeBlock />
              <TrustStack className="mt-5" compact />
            </div>
            <EmotionalQuoteCard className="mt-3 shrink-0" />
          </section>

          <motion.div className="flex min-h-0 items-center justify-center py-1">
            <div className="w-full max-w-[clamp(420px,36vw,560px)]">
              <div
                className={cn(
                  "relative max-h-[calc(100dvh-4.75rem-2rem)] overflow-y-auto overflow-x-hidden rounded-[2rem] border border-[#d81b60]/28",
                  "bg-[rgba(11,11,30,0.44)] p-[clamp(1.35rem,2.6vw,2.1rem)] shadow-[0_0_0_1px_rgba(168,85,247,0.14),0_56px_140px_-52px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.09)] backdrop-blur-[26px]",
                  "supports-[backdrop-filter]:bg-[rgba(11,11,30,0.36)] [scrollbar-width:thin]",
                )}
              >
                <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-br from-[#E91E63]/[0.08] via-transparent to-[#9C27B0]/[0.1]" />
                <div className="pointer-events-none absolute -right-[15%] top-[-5%] h-[50%] w-[75%] rounded-full bg-[radial-gradient(circle,rgba(233,30,99,0.14),transparent_68%)]" />
                <div className="relative">
${authCard.split("\n").map((l) => "                  " + l.trimStart()).join("\n")}
                </div>
              </div>
              <p className="mt-3 flex justify-center gap-2 text-[11px] leading-relaxed text-violet-200/42">
                <Shield size={13} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#f472b8]/65" aria-hidden />
                <span className="text-center">
                  By logging in, you agree to our{" "}
                  <Link to="/terms" className="text-[#f472b8]/95 hover:text-[#fbcfe8]">Terms &amp; Conditions</Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="text-[#f472b8]/95 hover:text-[#fbcfe8]">Privacy Policy</Link>
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Mobile — scroll when needed */}
        <div className="relative z-10 flex h-full min-h-0 flex-col overflow-y-auto lg:hidden">
          <div className="min-h-[min(38svh,20rem)] shrink-0" aria-hidden />
          <motion.div className="px-5 pb-5 pt-1">
            <WelcomeBlock />
            <EmotionalQuoteCard className="mx-auto mt-5 max-w-md" />
          </div>
          <div className="px-5 pb-8">
            <div className="mx-auto w-full max-w-md">
              <div className="relative overflow-hidden rounded-[2rem] border border-[#d81b60]/28 bg-[rgba(11,11,30,0.44)] p-7 shadow-[0_0_0_1px_rgba(168,85,247,0.14),0_48px_120px_-48px_rgba(0,0,0,0.9)] backdrop-blur-[26px]">
                <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-br from-[#E91E63]/[0.08] via-transparent to-[#9C27B0]/[0.1]" />
                <div className="relative">
${authCard.split("\n").map((l) => "                  " + l.trimStart()).join("\n")}
                </div>
              </div>
              <p className="mt-4 text-center text-[11px] leading-relaxed text-violet-200/42">
                By logging in, you agree to our{" "}
                <Link to="/terms" className="text-[#f472b8]/95 hover:text-[#fbcfe8]">Terms &amp; Conditions</Link> and{" "}
                <Link to="/privacy" className="text-[#f472b8]/95 hover:text-[#fbcfe8]">Privacy Policy</Link>
              </p>
            </div>
          </div>
          <div className="border-t border-white/[0.05] bg-[#080812]/40 px-5 py-8 backdrop-blur-md">
            <TrustStack compact className="mx-auto max-w-md" />
          </div>
        </div>
      </main>
    </div>
  );`;

let fixedReturn = newReturn.replace(/<motion\.div/g, "<div").replace(/<\/motion\.div>/g, "</div>");

s = s.slice(0, returnStart) + fixedReturn + "\n}\n";

fs.writeFileSync("d:/meetezri-live/apps/web/src/app/pages/Login.tsx", s);
console.log("wrote Login.tsx", s.length);
