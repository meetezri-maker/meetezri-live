import { useEffect } from "react";

function syncAdminDarkClass(root: HTMLElement) {
  const theme = root.getAttribute("data-theme") ?? "dark";
  if (theme === "light") {
    root.classList.remove("dark");
  } else {
    root.classList.add("dark");
  }
}

/** Sets html[data-solace-admin]; respects data-theme for light/dark admin shell. */
export function useAdminThemeScope(active = true) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const root = document.documentElement;
    root.setAttribute("data-solace-admin", "");
    syncAdminDarkClass(root);

    const observer = new MutationObserver(() => syncAdminDarkClass(root));
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      observer.disconnect();
      root.removeAttribute("data-solace-admin");
    };
  }, [active]);
}
