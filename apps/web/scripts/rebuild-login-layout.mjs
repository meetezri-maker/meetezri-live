import fs from "fs";

const p = "d:/meetezri-live/apps/web/src/app/pages/Login.tsx";
let s = fs.readFileSync(p, "utf8");

// --- constants ---
s = s.replace(
  'const LOGIN_NAV_H = "4.75rem";',
  'const LOGIN_NAV_H = "76px";\nconst LOGIN_MAIN_H = "calc(100vh - 76px)";',
);

// --- Eye import ---
if (!s.includes("Eye,")) {
  s = s.replace(
    "  Headphones,\n} from \"lucide-react\";",
    "  Headphones,\n  Eye,\n  EyeOff,\n} from \"lucide-react\";",
  );
}

// --- Lotus 78px ---
s = s.replace(
  'className="relative flex h-[72px] w-[72px]',
  'className="relative flex h-[78px] w-[78px]',
);

// --- Backdrop: single overlay ---
s = s.replace(
  /function LoginSceneBackdrop\(\) \{[\s\S]*?^}\n\nconst otpSlotClass/m,
  `function LoginSceneBackdrop() {
  return (
    <motion.div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <img
        src={LOGIN_HERO_BG}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center bottom"
        style={{ objectPosition: "center bottom" }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, rgba(5,6,18,0.78), rgba(5,6,18,0.35), rgba(5,6,18,0.8))",
        }}
      />
    </motion.div>
  );
}

const otpSlotClass`.replace(/<motion\.div/g, "<motion.div").replace(/motion\./g, ""),
);

// fix backdrop - remove motion if any
s = s.replace(
  /<motion\.motion\.div className="pointer-events-none absolute inset-0 z-0/g,
  '<div className="pointer-events-none absolute inset-0 z-0',
);
s = s.replace(
  /function LoginSceneBackdrop\(\) \{[\s\S]*?return \(\n    <div className="pointer-events-none/,
  (m) => m.replace("motion.", ""),
);

// Re-apply backdrop cleanly
const backdropFn = `function LoginSceneBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <img
        src={LOGIN_HERO_BG}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: "center bottom" }}
      />
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, rgba(5,6,18,0.78), rgba(5,6,18,0.35), rgba(5,6,18,0.8))",
        }}
      />
    </div>
  );
}`;

s = s.replace(/function LoginSceneBackdrop\(\) \{[\s\S]*?\n\}\n\nconst otpSlotClass/, backdropFn + "\n\nconst otpSlotClass");
s = s.replace(/<motion\.div\n        className="absolute inset-0"/, '<div\n        className="absolute inset-0"');
s = s.replace(/      <\/motion\.motion\.div>\n    <\/motion\.div>/g, "      </div>\n    </div>");

// --- Extract panel inner: LotusEmblem through panel trust ---
const lotusIdx = s.indexOf('<LotusEmblem className="mb-4" />');
const trustEnd = s.indexOf(
  '                  </div>\n                  </motion.div>\n                  </motion.div>\n                  \n              <p className="mt-3 flex justify-center',
);
if (lotusIdx < 0) {
  // try without motion
  const alt = s.indexOf(
    '                  </div>\n                  </div>\n                  \n              <p className="mt-3 flex justify-center',
  );
  if (alt < 0) {
    console.error("panel markers not found");
    process.exit(1);
  }
}

let panelEndMarker =
  '                  </motion.div>\n                  </motion.div>\n                  \n              <p className="mt-3 flex justify-center';
let panelEnd = s.indexOf(panelEndMarker);
if (panelEnd < 0) {
  panelEndMarker =
    '                  </div>\n                  </motion.div>\n                  \n              <p className="mt-3 flex justify-center';
  panelEnd = s.indexOf(panelEndMarker);
}
if (panelEnd < 0) {
  panelEndMarker =
    '                  </div>\n                  </div>\n                  \n              <p className="mt-3 flex justify-center';
  panelEnd = s.indexOf(panelEndMarker);
}

const panelInner = s.slice(lotusIdx, panelEnd).trim();

// --- Insert LoginAuthPanel before export function Login ---
const panelComponent = `
const LOGIN_PANEL_SHELL = cn(
  "relative w-full overflow-hidden rounded-[34px] border border-[#f472b8]/22",
  "bg-[rgba(12,10,24,0.72)] p-[clamp(32px,3vw,52px)] backdrop-blur-[24px]",
  "shadow-[0_0_0_1px_rgba(236,72,153,0.12),0_0_72px_-16px_rgba(255,77,148,0.22),0_32px_80px_-32px_rgba(0,0,0,0.85)]",
  "supports-[backdrop-filter]:bg-[rgba(12,10,24,0.65)]",
);

interface LoginAuthPanelProps {
  loginStep: "credentials" | "mfa" | "knowledge";
  setLoginStep: (step: "credentials" | "mfa" | "knowledge") => void;
  form: ReturnType<typeof useForm<LoginFormValues>>;
  onSubmit: (data: LoginFormValues) => Promise<void>;
  handleGoogleLogin: () => Promise<void>;
  handleMfaSubmit: (e: React.FormEvent) => Promise<void>;
  handleKnowledgeSubmit: (e: React.FormEvent) => Promise<void>;
  handleRequestRecoveryCode: () => Promise<void>;
  handleVerifyRecoveryCode: () => Promise<void>;
  handleVerifyEmailAuthCode: () => Promise<void>;
  isLoading: boolean;
  mfaCode: string;
  setMfaCode: (v: string) => void;
  knowledgeCode: string;
  setKnowledgeCode: (v: string) => void;
  emailAuthCode: string;
  setEmailAuthCode: (v: string) => void;
  emailAuthCodeSent: boolean;
  setEmailAuthCodeSent: (v: boolean) => void;
  knowledgeEmailEnabled: boolean;
  showRecovery: boolean;
  setShowRecovery: (v: boolean) => void;
  recoveryCode: string;
  setRecoveryCode: (v: string) => void;
  recoveryCodeSent: boolean;
  setRecoveryCodeSent: (v: boolean) => void;
  setEmailAuthCodeSentFalse: () => void;
  resetKnowledgeFlow: () => void;
  glassInput: string;
  otpSlotClass: string;
}

function LoginAuthPanel({
  loginStep,
  setLoginStep,
  form,
  onSubmit,
  handleGoogleLogin,
  handleMfaSubmit,
  handleKnowledgeSubmit,
  handleRequestRecoveryCode,
  handleVerifyRecoveryCode,
  handleVerifyEmailAuthCode,
  isLoading,
  mfaCode,
  setMfaCode,
  knowledgeCode,
  setKnowledgeCode,
  emailAuthCode,
  setEmailAuthCode,
  emailAuthCodeSent,
  setEmailAuthCodeSent,
  knowledgeEmailEnabled,
  showRecovery,
  setShowRecovery,
  recoveryCode,
  setRecoveryCode,
  recoveryCodeSent,
  glassInput,
  otpSlotClass,
  resetKnowledgeFlow,
}: LoginAuthPanelProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <>
${panelInner
  .split("\n")
  .map((l) => "      " + l)
  .join("\n")
  .replace(/mb-4/g, "mb-5")
  .replace(
    'className="solace-login-serif text-[1.85rem]',
    'className="solace-login-serif text-[clamp(1.75rem,2.5vw,2.5rem)]',
  )
  .replace("We?re here for you", "We\u2019re here for you")
  .replace('placeholder="????????"', 'placeholder="Enter your password"')
  .replace(
    'className="flex w-full items-center justify-center gap-3 rounded-full border border-white/14 bg-white/[0.05] py-3.5 text-[15px]',
    'className="flex h-[54px] w-full items-center justify-center gap-3 rounded-full border border-white/14 bg-white/[0.05] text-[15px]',
  )
  .replace("my-5 flex items-center gap-4", "my-4 flex items-center gap-4")
  .replace("space-y-5", "space-y-4")
  .replace("mt-5 text-center text-[14px]", "mt-4 text-center text-[14px]")
  .replace(
    'className="group relative mt-2 flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r',
    'className="group relative mt-1 flex h-[58px] w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r',
  )
  .replace(
    '<span aria-hidden className="transition-transform group-hover:translate-x-0.5">\n                  ?\n                  </span>',
    '<span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>',
  )
  .replace(
    '<Input\n                  type="password"\n                  placeholder="Enter your password"\n                  autoComplete="current-password"\n                  className={cn(glassInput, "pr-11")}\n                  {...field}\n                  />',
    `<Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className={cn(glassInput, "pr-11")}
                  {...field}
                  />
                  <button
                  type="button"
                  className="absolute right-3.5 top-1/2 z-[1] -translate-y-1/2 text-violet-200/50 transition-colors hover:text-violet-100"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>`,
  )}
      <p className="mt-4 flex items-start justify-center gap-2 text-center text-[10px] leading-relaxed text-violet-200/42">
        <Shield size={12} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#f472b8]/65" aria-hidden />
        <span>
          By logging in, you agree to our{" "}
          <Link to="/terms" className="text-[#f472b8]/95 hover:text-[#fbcfe8]">Terms &amp; Conditions</Link> and{" "}
          <Link to="/privacy" className="text-[#f472b8]/95 hover:text-[#fbcfe8]">Privacy Policy</Link>
        </span>
      </p>
    </>
  );
}
`;

if (!s.includes("function LoginAuthPanel")) {
  s = s.replace("export function Login()", panelComponent + "\nexport function Login()");
}

// --- glassInput ---
s = s.replace(
  /const glassInput =\n    "h-12[^"]+";/,
  `const glassInput =
    "h-[54px] w-full rounded-[14px] border border-white/12 bg-white/[0.045] pl-11 pr-3 text-[15px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition-[box-shadow,border-color] placeholder:text-violet-200/35 focus:border-[#E91E63]/45 focus:ring-2 focus:ring-[#E91E63]/28";`,
);

// --- Replace return block ---
const returnStart = s.indexOf("  return (\n    <div className=\"solace-login-page");
const returnEnd = s.lastIndexOf("\n  );\n}");

if (returnStart < 0 || returnEnd < 0) {
  console.error("return block not found", returnStart, returnEnd);
  process.exit(1);
}

const newReturn = `  return (
    <div className="solace-login-page flex h-screen max-h-screen flex-col overflow-hidden bg-[#0b0b1e] text-[#f4f4f8]">
      <SolaceLoginNav />

      <main
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{ height: LOGIN_MAIN_H }}
      >
        <LoginSceneBackdrop />

        <div
          className="relative z-10 grid h-full min-h-0 grid-cols-1 items-center gap-6 overflow-y-auto px-5 py-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(460px,0.95fr)] lg:gap-[clamp(32px,5vw,80px)] lg:overflow-hidden lg:px-[clamp(24px,4vw,64px)] lg:py-0"
          style={{ height: LOGIN_MAIN_H }}
        >
          <section className="hidden min-h-0 flex-col justify-between lg:flex">
            <div className="min-h-0">
              <WelcomeBlock />
              <TrustStack className="mt-5" compact />
            </div>
            <EmotionalQuoteCard className="mt-4 shrink-0" />
          </section>

          <section className="shrink-0 lg:hidden">
            <WelcomeBlock />
            <EmotionalQuoteCard className="mx-auto mt-4 max-w-md" />
          </section>

          <section className="flex min-h-0 items-center justify-center lg:justify-center">
            <div className="w-full max-w-[clamp(460px,36vw,560px)]">
              <div
                className={cn(
                  LOGIN_PANEL_SHELL,
                  "max-h-[calc(100vh-130px)]",
                  loginStep !== "credentials" && "overflow-y-auto [scrollbar-width:thin]",
                )}
              >
                <div className="pointer-events-none absolute inset-0 rounded-[34px] bg-gradient-to-br from-[#E91E63]/[0.06] via-transparent to-[#9C27B0]/[0.08]" />
                <div className="relative">
                  <LoginAuthPanel
                    loginStep={loginStep}
                    setLoginStep={setLoginStep}
                    form={form}
                    onSubmit={onSubmit}
                    handleGoogleLogin={handleGoogleLogin}
                    handleMfaSubmit={handleMfaSubmit}
                    handleKnowledgeSubmit={handleKnowledgeSubmit}
                    handleRequestRecoveryCode={handleRequestRecoveryCode}
                    handleVerifyRecoveryCode={handleVerifyRecoveryCode}
                    handleVerifyEmailAuthCode={handleVerifyEmailAuthCode}
                    isLoading={isLoading}
                    mfaCode={mfaCode}
                    setMfaCode={setMfaCode}
                    knowledgeCode={knowledgeCode}
                    setKnowledgeCode={setKnowledgeCode}
                    emailAuthCode={emailAuthCode}
                    setEmailAuthCode={setEmailAuthCode}
                    emailAuthCodeSent={emailAuthCodeSent}
                    setEmailAuthCodeSent={setEmailAuthCodeSent}
                    knowledgeEmailEnabled={knowledgeEmailEnabled}
                    showRecovery={showRecovery}
                    setShowRecovery={setShowRecovery}
                    recoveryCode={recoveryCode}
                    setRecoveryCode={setRecoveryCode}
                    recoveryCodeSent={recoveryCodeSent}
                    setEmailAuthCodeSentFalse={() => setEmailAuthCodeSent(false)}
                    resetKnowledgeFlow={() => {
                      setKnowledgeCode("");
                      setEmailAuthCode("");
                      setEmailAuthCodeSent(false);
                      setShowRecovery(false);
                      setRecoveryCode("");
                      setRecoveryCodeSent(false);
                    }}
                    glassInput={glassInput}
                    otpSlotClass={otpSlotClass}
                  />
                </motion.div>
              </motion.div>
            </motion.div>
          </section>

          <section className="shrink-0 pb-4 lg:hidden">
            <TrustStack compact className="mx-auto max-w-md" />
          </section>
        </motion.div>
      </main>
    </motion.div>
  );`;

let fixedReturn = newReturn
  .replace(/<motion\.div/g, "<motion.div")
  .replace(/<\/motion\.div>/g, "</motion.div>")
  .replace(/motion\./g, "");

fixedReturn = fixedReturn.replace(/<\/?motion\.div>/g, (t) => t.replace("motion.", ""));

s = s.slice(0, returnStart) + fixedReturn.replace(/<\/?motion\.motion\.motion\.div>/g, (t) => t.replace(/motion\./g, "")) + s.slice(returnEnd);

// cleanup any motion leftovers in return
s = s.replace(/<motion\.div/g, "<motion.div");
s = s.replace(/<\/motion\.div>/g, "</motion.div>");
s = s.replace(/<motion\.motion\.div/g, "<motion.div");
s = s.replace(/<\/motion\.motion\.div>/g, "</motion.div>");

// Fix return - use div only
const rs = s.indexOf("  return (\n    <div className=\"solace-login-page flex h-screen");
const re = s.indexOf("\n  );\n}", rs);
if (rs > 0 && re > rs) {
  let block = s.slice(rs, re + 5);
  block = block.replace(/<\/?motion\.div>/g, (t) => t.replace("motion.", ""));
  s = s.slice(0, rs) + block + s.slice(re + 5);
}

fs.writeFileSync(p, s);
console.log("rebuilt", s.length);
