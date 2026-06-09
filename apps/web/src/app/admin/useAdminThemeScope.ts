import { useEffect } from "react";

/** Sets html[data-solace-admin] and .dark so legacy pastel utilities remap correctly. */
export function useAdminThemeScope(active = true) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const root = document.documentElement;
    root.setAttribute("data-solace-admin", "");
    root.classList.add("dark");
    return () => {
      root.removeAttribute("data-solace-admin");
      root.classList.remove("dark");
    };
  }, [active]);
}