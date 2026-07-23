import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { downloadProgressReportPdf } from "./progress-report.pdf";
import type { ProgressReport } from "./progress-report.types";

/**
 * Downloads the current report as a PDF. jsPDF is dynamically imported inside
 * the renderer, so it is only fetched when the user actually exports.
 */
export function ProgressReportDownloadButton({ report }: { report: ProgressReport }) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      await downloadProgressReportPdf(report);
    } catch (error) {
      console.error("Progress report PDF export failed", error);
      toast.error("Unable to generate your report. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      type="button"
      data-testid="download-report-pdf"
      onClick={handleDownload}
      disabled={isGenerating}
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
