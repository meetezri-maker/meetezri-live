import { motion, AnimatePresence } from "motion/react";
import { X, Download, FileText, FileJson, CheckCircle2, Loader2 } from "lucide-react";
import { SolaceDatePicker } from "@/app/solace";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/app/components/ui/button";
import {
  filterJournalEntriesByDateRange,
  buildJournalJsonExport,
  deviceTimeZone,
  journalExportFileName,
  validateJournalDateRange,
  type JournalExportEntry,
} from "../../../lib/journalExport";
import { PdfUnsupportedTextError } from "@/app/features/goals/progress-report/progress-report.pdf-text";

interface JournalExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: JournalExportEntry[];
  /** Account the loaded `entries` belong to; exporting needs it to be the signed-in account. */
  entriesOwnerId?: string | null;
  currentUserId?: string | null;
  /** Entries are (re)loading: export waits for the settled list. */
  isLoading?: boolean;
  /** The last load failed (so an empty list is not "no entries"). */
  loadFailed?: boolean;
}

const FORMAT_CARD_BASE =
  "rounded-xl border p-4 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35";

const FORMAT_CARD_SELECTED =
  "border-violet-500/45 bg-violet-500/15 shadow-[0_0_24px_rgba(139,92,246,0.18)] ring-1 ring-violet-400/20";

const FORMAT_CARD_IDLE =
  "border-white/[0.08] bg-white/[0.03] hover:border-violet-500/25 hover:bg-white/[0.05]";

export function JournalExportModal({
  isOpen,
  onClose,
  entries,
  entriesOwnerId,
  currentUserId,
  isLoading = false,
  loadFailed = false,
}: JournalExportModalProps) {
  const [exportFormat, setExportFormat] = useState<"pdf" | "json">("pdf");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const generatingRef = useRef(false);
  /** Increments each time the dialog opens, so an export started before closing can't finish later. */
  const [openCount, setOpenCount] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setOpenCount((n) => n + 1);
    setDateFrom("");
    setDateTo("");
    setExportComplete(false);
    setIsExporting(false);
  }, [isOpen]);

  // Entries are exportable only once loaded for the signed-in account.
  const ownerKnown = entriesOwnerId !== undefined || currentUserId !== undefined;
  const ready = !isLoading && (!ownerKnown || (!!currentUserId && entriesOwnerId === currentUserId));

  // What an export was started for; if any of it changes before the file is ready, it is not saved.
  const contextKey = `${openCount}|${isOpen}|${currentUserId ?? ""}|${entriesOwnerId ?? ""}|${exportFormat}|${dateFrom}|${dateTo}`;
  const contextRef = useRef({ key: contextKey, entries });
  contextRef.current = { key: contextKey, entries };

  const filteredEntries = useMemo(
    () => filterJournalEntriesByDateRange(entries ?? [], dateFrom, dateTo),
    [entries, dateFrom, dateTo],
  );

  const handleExport = async () => {
    if (generatingRef.current || !ready) return;

    const range = validateJournalDateRange(dateFrom, dateTo);
    if (!range.ok) {
      toast.error(range.message);
      return;
    }
    if (loadFailed && (entries ?? []).length === 0) {
      toast.error("We couldn't load your journal, so there is nothing to export yet. Please try again.");
      return;
    }
    if (entriesOwnerId && (entries ?? []).some((e) => e.user_id && e.user_id !== entriesOwnerId)) {
      toast.error("Export failed. Please reload your journal and try again.");
      return;
    }
    if (filteredEntries.length === 0) {
      toast.error("No journal entries to export for this date range.");
      return;
    }

    generatingRef.current = true;
    setIsExporting(true);
    const started = contextRef.current;
    const isStillCurrent = () => contextRef.current.key === started.key && contextRef.current.entries === started.entries;
    try {
      const stamp = new Date();
      const timeZone = deviceTimeZone();
      const filename = journalExportFileName(exportFormat, dateFrom, dateTo, stamp);

      let blob: Blob;
      if (exportFormat === "json") {
        blob = new Blob([buildJournalJsonExport(filteredEntries, stamp, { dateFrom, dateTo, timeZone })], {
          type: "application/json;charset=utf-8",
        });
      } else {
        const { createJournalPdf } = await import("../../../lib/journalExportPdf");
        const { doc } = await createJournalPdf({ entries: filteredEntries, dateFrom, dateTo, generatedAt: stamp, timeZone });
        blob = doc.output("blob");
      }

      if (!isStillCurrent()) {
        toast.info("Your journal or export options changed while the file was being prepared, so it wasn't downloaded. Please try again.");
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.rel = "noopener";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);

      setExportComplete(true);
      setTimeout(() => {
        setExportComplete(false);
        onClose();
      }, 2000);
    } catch (e) {
      console.error("Journal export failed", e);
      if (e instanceof PdfUnsupportedTextError) {
        toast.error(
          e.reason === "font-unavailable"
            ? "The fonts needed for this PDF couldn't be loaded, so it wasn't downloaded. Please check your connection and try again, or export as JSON."
            : `Your journal contains characters the PDF can't display (${e.characters.join(" ")}), so it wasn't downloaded. You can export as JSON instead.`
        );
      } else {
        toast.error("Export failed. Please try again.");
      }
    } finally {
      generatingRef.current = false;
      setIsExporting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              role="dialog"
              aria-labelledby="journal-export-title"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-[#0c0c14]/96 shadow-[0_28px_90px_-48px_rgba(0,0,0,0.92),0_0_48px_-24px_rgba(139,92,246,0.28)] ring-1 ring-inset ring-white/[0.045] backdrop-blur-xl"
            >
              {/* Header */}
              <div className="relative shrink-0 border-b border-white/[0.06] px-5 py-5 sm:px-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-zinc-400 transition hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-zinc-100"
                  aria-label="Close export dialog"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="flex items-start gap-3 pr-12">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-500/25 bg-gradient-to-br from-violet-600/90 to-indigo-600/90 shadow-[0_0_24px_rgba(139,92,246,0.35)]">
                    <Download className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <h2
                      id="journal-export-title"
                      className="font-serif text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl"
                    >
                      Export Journal
                    </h2>
                    <p className="text-sm text-zinc-500">Download your journal entries</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
                {exportComplete ? (
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="py-8 text-center"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", duration: 0.6 }}
                      className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/15 shadow-[0_0_28px_rgba(16,185,129,0.25)]"
                    >
                      <CheckCircle2 className="h-8 w-8 text-emerald-300" />
                    </motion.div>
                    <h3 className="mb-2 text-lg font-semibold text-zinc-50">Export complete</h3>
                    <p className="text-sm text-zinc-400">Your journal has been downloaded successfully.</p>
                  </motion.div>
                ) : (
                  <>
                    <div className="mb-6">
                      <label className="mb-3 block text-sm font-medium text-zinc-300">Export Format</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setExportFormat("pdf")}
                          className={cn(
                            FORMAT_CARD_BASE,
                            exportFormat === "pdf" ? FORMAT_CARD_SELECTED : FORMAT_CARD_IDLE,
                          )}
                        >
                          <FileText
                            className={cn(
                              "mx-auto mb-2 h-8 w-8",
                              exportFormat === "pdf" ? "text-violet-300" : "text-zinc-500",
                            )}
                          />
                          <p
                            className={cn(
                              "text-sm font-medium",
                              exportFormat === "pdf" ? "text-violet-100" : "text-zinc-300",
                            )}
                          >
                            PDF Document
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">Printable format</p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setExportFormat("json")}
                          className={cn(
                            FORMAT_CARD_BASE,
                            exportFormat === "json" ? FORMAT_CARD_SELECTED : FORMAT_CARD_IDLE,
                          )}
                        >
                          <FileJson
                            className={cn(
                              "mx-auto mb-2 h-8 w-8",
                              exportFormat === "json" ? "text-violet-300" : "text-zinc-500",
                            )}
                          />
                          <p
                            className={cn(
                              "text-sm font-medium",
                              exportFormat === "json" ? "text-violet-100" : "text-zinc-300",
                            )}
                          >
                            JSON Data
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">Machine readable</p>
                        </button>
                      </div>
                    </div>

                    <div className="mb-6">
                      <label className="mb-3 block text-sm font-medium text-zinc-300">
                        Date Range (Optional)
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1.5 block text-xs text-zinc-500">From</label>
                          <SolaceDatePicker
                            value={dateFrom}
                            onChange={setDateFrom}
                            placeholder="Start date"
                            toDate={dateTo ? new Date(`${dateTo}T12:00:00`) : new Date()}
                            triggerClassName="min-h-11 w-full rounded-xl border border-white/[0.08] bg-[#0B0B15]/80 py-2.5 px-3 text-sm text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus:border-violet-500/40 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs text-zinc-500">To</label>
                          <SolaceDatePicker
                            value={dateTo}
                            onChange={setDateTo}
                            placeholder="End date"
                            fromDate={dateFrom ? new Date(`${dateFrom}T12:00:00`) : undefined}
                            toDate={new Date()}
                            triggerClassName="min-h-11 w-full rounded-xl border border-white/[0.08] bg-[#0B0B15]/80 py-2.5 px-3 text-sm text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus:border-violet-500/40 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                          />
                        </div>
                      </div>
                      <p className="mt-2.5 text-xs leading-relaxed text-zinc-500">
                        Counts use each entry&apos;s date in your time zone. Leave both empty to export all
                        loaded entries.
                      </p>
                    </div>

                    <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                      <h4 className="mb-3 text-sm font-medium text-zinc-200">Export Summary</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-zinc-500">Entries</p>
                          <p className="font-semibold tabular-nums text-zinc-100">
                            {filteredEntries.length}{" "}
                            {filteredEntries.length === 1 ? "entry" : "entries"}
                          </p>
                        </div>
                        <div>
                          <p className="text-zinc-500">Format</p>
                          <p className="font-semibold uppercase text-zinc-100">{exportFormat}</p>
                        </div>
                      </div>
                    </div>

                    <p className="mb-5 text-center text-xs text-zinc-500">
                      Your journal data is exported securely and remains private.
                    </p>
                  </>
                )}
              </div>

              {!exportComplete ? (
                <div className="flex shrink-0 gap-3 border-t border-white/[0.06] px-5 py-4 sm:px-6 sm:py-5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={isExporting}
                    className="min-h-11 flex-1 border-white/[0.1] bg-white/[0.04] text-zinc-300 hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-zinc-100"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleExport}
                    disabled={isExporting || !ready}
                    aria-busy={isExporting}
                    className="min-h-11 flex-1 bg-gradient-to-r from-violet-600/95 to-fuchsia-600/90 text-white shadow-[0_0_28px_rgba(139,92,246,0.3)] hover:from-violet-500 hover:to-fuchsia-500"
                  >
                    {isExporting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Export Journal
                      </>
                    )}
                  </Button>
                </div>
              ) : null}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
