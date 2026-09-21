const seen = new Set<string>();
// Optional chaining so engine modules can also run outside Vite, e.g. in the
// diagnostics scripts that bundle them for plain node.
export const warnOnce = (key: string, message: string) => { if (import.meta.env?.DEV && !seen.has(key)) { seen.add(key); console.warn(message); } };
export const resetWarnings = () => seen.clear();
