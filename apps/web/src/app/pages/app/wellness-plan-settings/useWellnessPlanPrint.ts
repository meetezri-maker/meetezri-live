import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import {
  buildWellnessPlanPrintSnapshot,
  type WellnessPlanPrintInput,
  type WellnessPlanPrintSnapshot,
} from "./wellnessPlanPrint";

/** On <html> while the Wellness Plan page is mounted; scopes the print stylesheet to this page. */
export const WELLNESS_PLAN_PRINT_PAGE_CLASS = "wellness-plan-print-page";
/** On <html> from print preparation until the print dialog closes. */
export const WELLNESS_PLAN_PRINTING_CLASS = "wellness-plan-printing";

const ASSET_WAIT_MS = 1500;

/** Fonts and the print logo, so the dialog's preview isn't taken before they're ready. */
async function waitForPrintAssets(): Promise<void> {
  const waits: Array<Promise<unknown>> = [];
  if (typeof document !== "undefined" && document.fonts?.ready) waits.push(document.fonts.ready);
  document.querySelectorAll<HTMLImageElement>(".wellness-plan-print-doc img").forEach((img) => {
    if (!img.complete && typeof img.decode === "function") waits.push(img.decode().catch(() => undefined));
  });
  await Promise.race([Promise.all(waits), new Promise((r) => setTimeout(r, ASSET_WAIT_MS))]);
}

/**
 * One preparation path for every print action and for the browser's own print command:
 * snapshot → wait for fonts/logo → confirm the account → window.print(). Nothing is saved.
 */
export function useWellnessPlanPrint(userId: string | null | undefined, getInput: () => WellnessPlanPrintInput) {
  const [snapshot, setSnapshot] = useState<WellnessPlanPrintSnapshot | null>(null);
  const snapshotRef = useRef<WellnessPlanPrintSnapshot | null>(null);
  const getInputRef = useRef(getInput);
  getInputRef.current = getInput;
  const busyRef = useRef(false);
  const mountedRef = useRef(false);

  const capture = useCallback((): WellnessPlanPrintSnapshot | null => {
    const snap = buildWellnessPlanPrintSnapshot(getInputRef.current());
    snapshotRef.current = snap;
    flushSync(() => setSnapshot(snap));
    document.documentElement.classList.add(WELLNESS_PLAN_PRINTING_CLASS);
    return snap;
  }, []);

  const clear = useCallback(() => {
    snapshotRef.current = null;
    document.documentElement.classList.remove(WELLNESS_PLAN_PRINTING_CLASS);
    if (mountedRef.current) setSnapshot(null);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const root = document.documentElement;
    root.classList.add(WELLNESS_PLAN_PRINT_PAGE_CLASS);
    // Ctrl+P / browser menu: take the snapshot as the browser starts printing.
    const onBeforePrint = () => {
      if (!snapshotRef.current) capture();
    };
    const onAfterPrint = () => clear();
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
      root.classList.remove(WELLNESS_PLAN_PRINT_PAGE_CLASS, WELLNESS_PLAN_PRINTING_CLASS);
      snapshotRef.current = null;
    };
  }, [capture, clear]);

  // A snapshot never outlives the account it was taken for.
  useEffect(() => {
    if (snapshotRef.current && snapshotRef.current.userId !== userId) clear();
  }, [userId, clear]);

  const print = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    const startedFor = getInputRef.current().userId ?? null;
    try {
      const snap = capture();
      if (!snap) {
        clear();
        return;
      }
      await waitForPrintAssets();
      if (!mountedRef.current || (getInputRef.current().userId ?? null) !== startedFor || snapshotRef.current !== snap) {
        clear();
        if (mountedRef.current) toast.info("The signed-in account changed, so the plan wasn't printed.");
        return;
      }
      window.print();
    } catch (error) {
      console.error("Wellness plan print failed", error);
      clear();
      toast.error("Couldn't open the print dialog. Please try again.");
    } finally {
      busyRef.current = false;
    }
  }, [capture, clear]);

  return { snapshot, print };
}
