/**
 * Journal export guards: only the signed-in account's settled entries are exported, failures and
 * empty results are told apart, repeated clicks run once, and changes during generation cancel
 * the download.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { JournalExportEntry } from "@/lib/journalExport";

const h = vi.hoisted(() => ({
  createPdf: vi.fn(),
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
  blobs: [] as Blob[],
  downloads: [] as string[],
}));

vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@/lib/journalExportPdf", () => ({ createJournalPdf: h.createPdf }));
vi.mock("../../../lib/journalExportPdf", () => ({ createJournalPdf: h.createPdf }));

import { JournalExportModal } from "./JournalExportModal";
import { PdfUnsupportedTextError } from "@/app/features/goals/progress-report/progress-report.pdf-text";

const entry = (id: string, over: Partial<JournalExportEntry> = {}): JournalExportEntry => ({
  id, title: `Entry ${id}`, content: "<div>آج 😊 &amp; more</div>", mood_tags: [], is_private: null, location: null,
  created_at: "2026-10-02T12:00:00.000Z", updated_at: "2026-10-02T12:00:00.000Z", user_id: "user-a", ...over,
});

type Props = Parameters<typeof JournalExportModal>[0];
const baseProps = (over: Partial<Props> = {}): Props => ({
  isOpen: true, onClose: vi.fn(), entries: [entry("1")], entriesOwnerId: "user-a", currentUserId: "user-a", isLoading: false, loadFailed: false, ...over,
});

const exportButton = () => screen.getByRole("button", { name: /Export Journal|Exporting/ });
const fakeDoc = { doc: { output: () => new Blob(["%PDF"], { type: "application/pdf" }) } };

const readBlob = (b: Blob) =>
  new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsText(b);
  });

beforeEach(() => {
  vi.clearAllMocks();
  h.blobs = [];
  h.downloads = [];
  h.createPdf.mockResolvedValue(fakeDoc);
  (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (b: Blob) => {
    h.blobs.push(b);
    return "blob:x";
  };
  (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => undefined;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    h.downloads.push(this.download);
  });
});

describe("Journal export guards", () => {
  it("waits for entries to finish loading for the signed-in account", () => {
    const { rerender } = render(<JournalExportModal {...baseProps({ isLoading: true })} />);
    expect(exportButton()).toBeDisabled();
    rerender(<JournalExportModal {...baseProps({ entriesOwnerId: "user-b" })} />);
    expect(exportButton()).toBeDisabled();
    rerender(<JournalExportModal {...baseProps()} />);
    expect(exportButton()).not.toBeDisabled();
  });

  it("reports a failed load instead of 'no entries'", async () => {
    render(<JournalExportModal {...baseProps({ entries: [], loadFailed: true })} />);
    fireEvent.click(exportButton());
    expect(h.toast.error).toHaveBeenCalledWith("We couldn't load your journal, so there is nothing to export yet. Please try again.");
    expect(h.downloads).toEqual([]);
  });

  it("uses the existing message for an empty selection", () => {
    render(<JournalExportModal {...baseProps({ entries: [] })} />);
    fireEvent.click(exportButton());
    expect(h.toast.error).toHaveBeenCalledWith("No journal entries to export for this date range.");
  });

  it("refuses entries that belong to another account", () => {
    render(<JournalExportModal {...baseProps({ entries: [entry("1"), entry("2", { user_id: "user-b" })] })} />);
    fireEvent.click(exportButton());
    expect(h.toast.error).toHaveBeenCalledWith("Export failed. Please reload your journal and try again.");
    expect(h.createPdf).not.toHaveBeenCalled();
  });

  it("runs one generation for repeated clicks", async () => {
    let finish: (v: unknown) => void = () => {};
    h.createPdf.mockImplementation(() => new Promise((r) => { finish = r; }));
    render(<JournalExportModal {...baseProps()} />);
    fireEvent.click(exportButton());
    fireEvent.click(exportButton());
    fireEvent.click(exportButton());
    await waitFor(() => expect(h.createPdf).toHaveBeenCalledTimes(1));
    await act(async () => finish(fakeDoc));
    expect(h.toast.info).not.toHaveBeenCalled();
    await waitFor(() => expect(h.downloads).toHaveLength(1));
  });

  it("cancels the download when the account changes during generation", async () => {
    let finish: (v: unknown) => void = () => {};
    h.createPdf.mockImplementation(() => new Promise((r) => { finish = r; }));
    const { rerender } = render(<JournalExportModal {...baseProps()} />);
    fireEvent.click(exportButton());
    await waitFor(() => expect(h.createPdf).toHaveBeenCalled());
    rerender(<JournalExportModal {...baseProps({ currentUserId: "user-b" })} />);
    await act(async () => finish(fakeDoc));
    await waitFor(() => expect(h.toast.info).toHaveBeenCalled());
    expect(h.downloads).toEqual([]);
  });

  it("cancels the download when the selection changes during generation", async () => {
    let finish: (v: unknown) => void = () => {};
    h.createPdf.mockImplementation(() => new Promise((r) => { finish = r; }));
    const props = baseProps();
    const { rerender } = render(<JournalExportModal {...props} />);
    fireEvent.click(exportButton());
    await waitFor(() => expect(h.createPdf).toHaveBeenCalled());
    rerender(<JournalExportModal {...props} entries={[entry("1"), entry("2")]} />); // entries reloaded
    await act(async () => finish(fakeDoc));
    await waitFor(() => expect(h.toast.info).toHaveBeenCalled());
    expect(h.downloads).toEqual([]);
  });

  it("cancels the download when the dialog is closed during generation", async () => {
    let finish: (v: unknown) => void = () => {};
    h.createPdf.mockImplementation(() => new Promise((r) => { finish = r; }));
    const { rerender } = render(<JournalExportModal {...baseProps()} />);
    fireEvent.click(exportButton());
    await waitFor(() => expect(h.createPdf).toHaveBeenCalled());
    rerender(<JournalExportModal {...baseProps({ isOpen: false })} />);
    rerender(<JournalExportModal {...baseProps()} />);
    await act(async () => finish(fakeDoc));
    await waitFor(() => expect(h.toast.info).toHaveBeenCalled());
    expect(h.downloads).toEqual([]);
  });

  it("explains a PDF that can't be drawn faithfully and downloads nothing", async () => {
    h.createPdf.mockRejectedValueOnce(new PdfUnsupportedTextError(["你", "好"], "no-glyph"));
    render(<JournalExportModal {...baseProps()} />);
    fireEvent.click(exportButton());
    await waitFor(() => expect(h.toast.error).toHaveBeenCalled());
    expect(h.toast.error.mock.calls[0][0]).toBe(
      "Your journal contains characters the PDF can't display (你 好), so it wasn't downloaded. You can export as JSON instead."
    );
    expect(h.downloads).toEqual([]);
  });

  it("exports JSON with the original HTML and Unicode untouched", async () => {
    render(<JournalExportModal {...baseProps()} />);
    fireEvent.click(screen.getByRole("button", { name: /JSON Data/ }));
    fireEvent.click(exportButton());
    await waitFor(() => expect(h.downloads).toHaveLength(1));
    expect(h.downloads[0]).toMatch(/^solace-journal-\d{4}-\d{2}-\d{2}\.json$/);
    const json = JSON.parse(await readBlob(h.blobs[0]));
    expect(json.entries[0].contentHtml).toBe("<div>آج 😊 &amp; more</div>");
    expect(json.entries[0].contentPlain).toBe("آج 😊 & more");
    expect(json.entries[0].isPrivate).toBeNull();
    expect(h.createPdf).not.toHaveBeenCalled();
  });
});
