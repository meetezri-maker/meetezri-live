
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  document.body.innerHTML =
    '<pre style="padding:16px;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \\"Liberation Mono\\", \\"Courier New\\", monospace;">Fatal: #root element not found.</pre>';
} else {
  const showFatal = (title: string, err: unknown) => {
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

  window.addEventListener("error", (e) => showFatal("Runtime error", e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) =>
    showFatal("Unhandled promise rejection", (e as PromiseRejectionEvent).reason)
  );

  try {
    createRoot(rootEl).render(<App />);
  } catch (err) {
    showFatal("App crashed during startup", err);
  }
}
  