import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, "../src/app/pages/Login.tsx");
const file = fs.readFileSync(filePath, "utf8");

const start = file.indexOf("function LoginSceneBackdrop()");
const end = file.indexOf("const otpSlotClass");
if (start < 0 || end < 0) {
  console.error("markers not found", start, end);
  process.exit(1);
}

const newFn = `function LoginSceneBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <img
        src={LOGIN_HERO_BG}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[28%_62%] brightness-[0.62] contrast-[1.05] saturate-[1.08] lg:object-[32%_58%]"
      />
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(105deg, rgba(5,6,18,0.82) 0%, rgba(5,6,18,0.38) 42%, rgba(5,6,18,0.72) 100%)",
        }}
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_12%_88%,rgba(251,146,60,0.14)_0%,transparent_58%)]"
        aria-hidden
      />
    </motion.div>
  );
}

`;

// eslint-disable-next-line no-unused-vars
const _ = newFn;

const newFnClean = `function LoginSceneBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <img
        src={LOGIN_HERO_BG}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[28%_62%] brightness-[0.62] contrast-[1.05] saturate-[1.08] lg:object-[32%_58%]"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(105deg, rgba(5,6,18,0.82) 0%, rgba(5,6,18,0.38) 42%, rgba(5,6,18,0.72) 100%)",
        }}
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_12%_88%,rgba(251,146,60,0.14)_0%,transparent_58%)]"
        aria-hidden
      />
    </div>
  );
}

`;

const out = file.slice(0, start) + newFnClean + file.slice(end);
fs.writeFileSync(filePath, out);
console.log("LoginSceneBackdrop updated");
