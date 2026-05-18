import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const filePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/app/pages/Login.tsx",
);
let c = fs.readFileSync(filePath, "utf8");

const marker = '  return (\n    <motion.div className="solace-login-page flex h-screen';
const altMarker = '  return (\n    <motion.div className="solace-login-page flex h-screen';
const marker2 = '  return (\n    <motion.div className="solace-login-page flex h-screen';
const markerReal = '  return (\n    <motion.div className="solace-login-page flex h-screen';

const start =
  c.indexOf('  return (\n    <motion.div className="solace-login-page flex h-screen') >= 0
    ? c.indexOf('  return (\n    <motion.div className="solace-login-page flex h-screen')
    : c.indexOf('  return (\n    <motion.div className="solace-login-page flex h-screen');

const startActual = c.indexOf(
  '  return (\n    <motion.div className="solace-login-page flex h-screen',
);
const startDiv = c.indexOf(
  '  return (\n    <motion.div className="solace-login-page flex h-screen',
);

const startOk = c.indexOf(
  '  return (\n    <motion.div className="solace-login-page flex h-screen',
);

let startPos = c.indexOf('  return (\n    <motion.div className="solace-login-page flex h-screen');
if (startPos < 0) {
  startPos = c.indexOf('  return (\n    <motion.div className="solace-login-page flex h-screen');
}
if (startPos < 0) {
  startPos = c.indexOf('  return (\n    <motion.div className="solace-login-page flex h-screen');
}
if (startPos < 0) {
  startPos = c.indexOf('  return (\n    <motion.div className="solace-login-page flex h-screen');
}
if (startPos < 0) {
  startPos = c.indexOf('  return (\n    <motion.div className="solace-login-page flex h-screen');
}
if (startPos < 0) {
  startPos = c.indexOf('  return (\n    <motion.div className="solace-login-page flex h-screen');
}

// Actual marker from file
startPos = c.indexOf('  return (\n    <motion.div className="solace-login-page flex h-screen');
if (startPos < 0) {
  startPos = c.indexOf('  return (\n    <motion.div className="solace-login-page flex h-screen');
}
if (startPos < 0) {
  startPos = c.indexOf('  return (\n    <motion.div className="solace-login-page flex h-screen');
}
if (startPos < 0) {
  startPos = c.indexOf('  return (\n    <motion.div className="solace-login-page flex h-screen');
}
if (startPos < 0) {
  startPos = c.indexOf('  return (\n    <motion.div className="solace-login-page flex h-screen');
}
if (startPos < 0) {
  startPos = c.indexOf('  return (\n    <motion.div className="solace-login-page flex h-screen');
}
if (startPos < 0) {
  startPos = c.indexOf('  return (\n    <motion.div className="solace-login-page flex h-screen');
}

startPos = c.indexOf('  return (\n    <motion.div className="solace-login-page flex h-screen');
if (startPos < 0) {
  startPos = c.indexOf('  return (\n    <motion.div className="solace-login-page flex h-screen');
}
if (startPos < 0) {
  startPos = c.indexOf('  return (\n    <div className="solace-login-page flex h-screen');
}

if (startPos < 0) {
  console.error("start not found");
  process.exit(1);
}

const endPos = c.indexOf("  );\n}", startPos);
if (endPos < 0) {
  console.error("end not found");
  process.exit(1);
}

const block = `  return (
    <div className="solace-login-page relative min-h-screen bg-[#050612] text-[#f4f4f8]">
      <LoginSceneBackdrop />

      <div className="relative z-10 flex min-h-screen flex-col">
        <SolaceLoginNav />

        <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
          <div className="grid grid-cols-1 items-center gap-6 px-5 py-6 sm:py-8 lg:grid-cols-2 lg:gap-10 lg:px-[clamp(32px,4.5vw,72px)] lg:py-10">
            <section className="hidden flex-col justify-center py-2 lg:flex">
              <WelcomeBlock />
              <TrustStack className="mt-7 max-w-lg" />
              <EmotionalQuoteCard className="mt-auto pt-8" />
            </section>

            <section className="order-first flex items-center justify-center lg:order-none lg:justify-end">
              <div className="w-full max-w-[min(100%,560px)]">
                <div className={LOGIN_PANEL_SHELL}>
                  <motion.div className="pointer-events-none absolute -left-12 -top-12 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(236,72,153,0.28),transparent_70%)]" />
                  <div className="pointer-events-none absolute inset-0 rounded-[34px] bg-gradient-to-br from-[#E91E63]/[0.06] via-transparent to-[#9C27B0]/[0.05]" />
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
                      setIsLoading={setIsLoading}
                    />
                  </motion.div>
                </motion.div>
              </motion.div>
            </section>

            <section className="shrink-0 pb-6 lg:hidden">
              <WelcomeBlock />
              <TrustStack className="mt-5" compact />
              <EmotionalQuoteCard className="mx-auto mt-4 max-w-md" />
            </section>
          </motion.div>
        </main>
      </motion.div>
    </motion.div>
  )`;

const cleanBlock = block.replaceAll("motion.", "");

c = c.slice(0, startPos) + cleanBlock + c.slice(endPos);
c = c.replace(/LOGIN_MAIN_H/g, "LOGIN_NAV_H_UNUSED");
c = c.replace("style={{ height: LOGIN_NAV_H_UNUSED }}", "");

fs.writeFileSync(filePath, c);
console.log("ok");
