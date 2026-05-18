import fs from "fs";

const p = "d:/meetezri-live/apps/web/src/app/pages/Login.tsx";
const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
const start = lines.findIndex((l) => l.includes("interface CinematicLeftProps"));
const otpIdx = lines.findIndex((l) => l.startsWith("const otpSlotClass"));

if (start < 0 || otpIdx < 0) {
  console.error("markers", { start, otpIdx });
  process.exit(1);
}

const block = `interface EmotionalQuoteCardProps {
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
    <motion.div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <img
        src={LOGIN_HERO_BG}
        alt=""
        className="absolute inset-0 h-full w-full scale-[1.03] object-cover object-[32%_62%] lg:object-[28%_58%] xl:object-[26%_56%]"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a14]/75 via-[#12051c]/45 to-[#07040d]/55" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#07040d]/88 via-[#0a0814]/25 to-[#0a0814]/40" />
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
}
`.replace(/<motion\.div/g, "<div").replace(/<\/motion\.motion\.div>/g, "</div>");

const out = [...lines.slice(0, start), ...block.split("\n"), ...lines.slice(otpIdx)];
fs.writeFileSync(p, out.join("\n"));
console.log("ok");
