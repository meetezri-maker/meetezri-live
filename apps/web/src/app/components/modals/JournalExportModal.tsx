import { motion, AnimatePresence } from "motion/react";
import { X, Download, FileText, FileJson, CheckCircle2, Loader2 } from "lucide-react";
import { SolaceDatePicker } from "@/app/solace";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/app/components/ui/button";
import {
  filterJournalEntriesByDateRange,
  buildJournalJsonExport,
  buildJournalPdf,
  type JournalExportEntry,
} from "../../../lib/journalExport";

interface JournalExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: JournalExportEntry[];
}

const FORMAT_CARD_BASE =
  "rounded-xl border p-4 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35";

const FORMAT_CARD_SELECTED =
  "border-violet-500/45 bg-violet-500/15 shadow-[0_0_24px_rgba(139,92,246,0.18)] ring-1 ring-violet-400/20";

const FORMAT_CARD_IDLE =
  "border-white/[0.08] bg-white/[0.03] hover:border-violet-500/25 hover:bg-white/[0.05]";

export function JournalExportModal({ isOpen, onClose, entries }: JournalExportModalProps) {
  const [exportFormat, setExportFormat] = useState<"pdf" | "json">("pdf");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setDateFrom("");
    setDateTo("");
    setExportComplete(false);
    setIsExporting(false);
  }, [isOpen]);

  const filteredEntries = useMemo(
    () => filterJournalEntriesByDateRange(entries ?? [], dateFrom, dateTo),
    [entries, dateFrom, dateTo],
  );

  const handleExport = async () => {
    if (filteredEntries.length === 0) {
      toast.error("No journal entries to export for this date range.");
      return;
    }

    setIsExporting(true);
    try {
      const stamp = new Date();
      const day = stamp.toISOString().split("T")[0];
      const filename = `ezri-journal-${day}.${exportFormat}`;

      let blob: Blob;
      if (exportFormat === "json") {
        blob = new Blob([buildJournalJsonExport(filteredEntries, stamp)], {
          type: "application/json;charset=utf-8",
        });
      } else {
        const doc = await buildJournalPdf(filteredEntries);
        blob = doc.output("blob");
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
      toast.error("Export failed. Please try again.");
    } finally {
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
                    disabled={isExporting}
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
