import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  document.body.innerHTML =
    '<pre style="padding:16px;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \\"Liberation Mono\\", \\"Courier New\\", monospace;">Fatal: #root element not found.</pre>';
} else {
  const showStartupFatal = (title: string, err: unknown) => {
    const details =
      err instanceof Error
        ? `${err.name}: ${err.message}\n${err.stack ?? ""}`
        : String(err);
    rootEl.innerHTML = `
      <div style="padding:16px;max-width:1000px;margin:0 auto;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">
        <h2 style="margin:0 0 12px 0;">${title}</h2>
        <pre style="white-space:pre-wrap;word-break:break-word;background:#111;color:#eee;padding:12px;border-radius:8px;overflow:auto;">${details}</pre>
        <p style="opacity:0.75">Open DevTools console for more details.</p>
      </div>
    `;
  };

  // Never replace `#root.innerHTML` while React is mounted: that tears down the real DOM
  // without React knowing, and subsequent updates can throw `removeChild` NotFoundErrors.
  window.addEventListener("error", (e) => {
    console.error("Runtime error", e.error ?? e.message, e);
  });
  window.addEventListener("unhandledrejection", (e) => {
    console.error("Unhandled promise rejection", (e as PromiseRejectionEvent).reason, e);
  });

  try {
    createRoot(rootEl).render(<App />);
  } catch (err) {
    showStartupFatal("App crashed during startup", err);
  }
}
  