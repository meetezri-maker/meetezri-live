import { useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { downloadProgressReportPdf } from "./progress-report.pdf";
import { PdfUnsupportedTextError } from "./progress-report.pdf-text";
import type { ProgressReport } from "./progress-report.types";

interface ProgressReportDownloadButtonProps {
  report: ProgressReport;
  /**
   * False while a range is loading, while previous-range data is shown as a placeholder, or
   * when the loaded data does not belong to the selected range/account.
   */
  ready?: boolean;
  /** Identifies the account + range the report belongs to; re-read after generation. */
  getContextKey?: () => string;
  contextKey?: string;
}

/**
 * Downloads the current report as a PDF. jsPDF and the PDF fonts are loaded only when the user
 * actually exports. The report and its account/range are captured at click time; if either
 * changes before the file is ready, nothing is downloaded.
 */
export function ProgressReportDownloadButton({
  report,
  ready = true,
  getContextKey,
  contextKey,
}: ProgressReportDownloadButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const generatingRef = useRef(false);

  const handleDownload = async () => {
    if (!ready || generatingRef.current) return;
    generatingRef.current = true;
    setIsGenerating(true);
    const snapshot = report;
    const startedFor = contextKey;
    try {
      const outcome = await downloadProgressReportPdf(
        snapshot,
        () => !getContextKey || getContextKey() === startedFor
      );
      if (outcome === "cancelled") {
        toast.info("The report changed while the PDF was being prepared, so it wasn't downloaded. Please try again.");
      }
    } catch (error) {
      console.error("Progress report PDF export failed", error);
      if (error instanceof PdfUnsupportedTextError) {
        toast.error(
          error.reason === "font-unavailable"
            ? "The fonts needed for this report couldn't be loaded, so the PDF wasn't downloaded. Please check your connection and try again."
            : `This report contains characters the PDF can't display (${error.characters.join(" ")}), so it wasn't downloaded.`
        );
      } else {
        toast.error("Unable to generate your report. Please try again.");
      }
    } finally {
      generatingRef.current = false;
      setIsGenerating(false);
    }
  };

  const disabled = !ready || isGenerating;

  return (
    <button
      type="button"
      data-testid="download-report-pdf"
      onClick={handleDownload}
      disabled={disabled}
      aria-busy={isGenerating}
      className={cn(
        "inline-flex min-h-[44px] w-fit items-center justify-center gap-2 rounded-full",
        "border border-white/12 bg-white/[0.06] px-5 text-sm font-semibold text-zinc-100",
        "transition hover:border-fuchsia-400/25 hover:bg-white/[0.09]",
        "disabled:cursor-not-allowed disabled:opacity-60"
      )}
    >
      {isGenerating ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      ) : (
        <Download className="h-4 w-4 shrink-0" aria-hidden />
      )}
      {isGenerating ? "Preparing PDF…" : "Download PDF"}
    </button>
  );
}
