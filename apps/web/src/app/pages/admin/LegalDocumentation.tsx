import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  FileText,
  Edit,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Download,
  Upload,
  Save,
  History,
  X,
  Plus,
  Clock,
} from "lucide-react";
import {
  useState,
  useMemo,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";

type Document = {
  id: string;
  title: string;
  version: string;
  lastUpdated: string;
  status: string;
  views: number | null;
  acceptances: number | null;
};

type VersionEntry = { version: string; date: string; author: string; changes: string };

const LS_DOC = (id: string) => `ezri-legal-doc-${id}`;
const LS_VER = (id: string) => `ezri-legal-versions-${id}`;
const LS_SAVED = (id: string) => `ezri-legal-savedAt-${id}`;
const LS_EXTRA_CATALOG = "ezri-legal-extra-catalog";

function loadExtraCatalog(): Document[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_EXTRA_CATALOG);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Document[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveExtraCatalog(docs: Document[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_EXTRA_CATALOG, JSON.stringify(docs));
}

function defaultBody(title: string, id: string): string {
  return `${title}\n\nThis draft is stored in this browser only (localStorage). Replace with counsel-approved text before production use.\n\nDocument ID: ${id}\n`;
}

function readDocBody(id: string, title: string): string {
  if (typeof window === "undefined") return defaultBody(title, id);
  return window.localStorage.getItem(LS_DOC(id)) ?? defaultBody(title, id);
}

function readLastSavedLabel(id: string): string {
  if (typeof window === "undefined") return "—";
  const t = window.localStorage.getItem(LS_SAVED(id));
  if (!t) return "—";
  try {
    return format(new Date(t), "MMM d, yyyy HH:mm");
  } catch {
    return "—";
  }
}

function readVersions(id: string): VersionEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_VER(id));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VersionEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function pushVersion(id: string, changes: string) {
  const list = readVersions(id);
  const next: VersionEntry = {
    version: `v${list.length + 1}`,
    date: new Date().toISOString(),
    author: "Admin",
    changes,
  };
  window.localStorage.setItem(LS_VER(id), JSON.stringify([next, ...list].slice(0, 40)));
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

const BUILTIN: Document[] = [
  { id: "tos", title: "Terms of Service", version: "live", lastUpdated: "—", status: "active", views: null, acceptances: null },
  { id: "privacy", title: "Privacy Policy", version: "live", lastUpdated: "—", status: "active", views: null, acceptances: null },
  { id: "consent", title: "Consent & Disclosures", version: "live", lastUpdated: "—", status: "active", views: null, acceptances: null },
  { id: "hipaa", title: "HIPAA / Health Information Notice", version: "live", lastUpdated: "—", status: "active", views: null, acceptances: null },
  { id: "cookies", title: "Cookie Policy", version: "live", lastUpdated: "—", status: "active", views: null, acceptances: null },
  { id: "disclaimer", title: "Medical / Wellness Disclaimer", version: "live", lastUpdated: "—", status: "review", views: null, acceptances: null },
];

export function LegalDocumentation() {
  const [extraDocs, setExtraDocs] = useState<Document[]>(() => loadExtraCatalog());
  const [refreshTick, setRefreshTick] = useState(0);

  // View modal
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);

  // Editor modal
  const [editorDoc, setEditorDoc] = useState<Document | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [editorSaving, setEditorSaving] = useState(false);

  // History modal
  const [historyDoc, setHistoryDoc] = useState<Document | null>(null);
  const [historyFullCatalog, setHistoryFullCatalog] = useState(false);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");

  const uploadRef = useRef<HTMLInputElement>(null);

  const bump = useCallback(() => setRefreshTick((t) => t + 1), []);

  const documents = useMemo(() => {
    const merged = [...BUILTIN, ...extraDocs];
    return merged.map((d) => ({ ...d, lastUpdated: readLastSavedLabel(d.id) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraDocs, refreshTick]);

  const stats = useMemo(
    () => [
      { label: "Catalog entries", value: String(documents.length), icon: FileText, color: "from-blue-500 to-cyan-600" },
      { label: "Pending review", value: String(documents.filter((d) => d.status === "review").length), icon: AlertTriangle, color: "from-yellow-500 to-orange-600" },
      { label: "Acceptances tracked", value: "—", icon: CheckCircle2, color: "from-green-500 to-emerald-600" },
      { label: "Views tracked", value: "—", icon: CheckCircle2, color: "from-purple-500 to-pink-600" },
    ],
    [documents]
  );

  // ── Handlers ────────────────────────────────────────────────────────────────

  const openEditor = useCallback((doc: Document) => {
    setEditorDoc(doc);
    setEditorContent(readDocBody(doc.id, doc.title));
  }, []);

  const closeEditor = useCallback(() => {
    setEditorDoc(null);
    setEditorContent("");
  }, []);

  const handleSaveInEditor = useCallback(() => {
    if (!editorDoc) return;
    setEditorSaving(true);
    try {
      window.localStorage.setItem(LS_DOC(editorDoc.id), editorContent);
      window.localStorage.setItem(LS_SAVED(editorDoc.id), new Date().toISOString());
      pushVersion(editorDoc.id, "Saved from admin editor");
      bump();
      toast.success(`"${editorDoc.title}" saved`);
    } finally {
      setEditorSaving(false);
    }
  }, [editorDoc, editorContent, bump]);

  const handleExportDoc = useCallback((doc: Document) => {
    const body = readDocBody(doc.id, doc.title);
    const safe = doc.title.replace(/[^\w\d\-]+/g, "_").slice(0, 80) || "document";
    downloadText(`${safe}-${doc.id}.txt`, body);
    toast.success(`Downloaded "${doc.title}"`);
  }, []);

  const handleUploadClick = () => uploadRef.current?.click();

  const handleUploadFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const base = crypto?.randomUUID?.() ?? `up-${Date.now()}`;
      const slug = file.name.replace(/\.[^/.]+$/, "").slice(0, 80) || "upload";
      const id = `custom-${slug}-${base.slice(0, 8)}`;
      window.localStorage.setItem(LS_DOC(id), text);
      window.localStorage.setItem(LS_SAVED(id), new Date().toISOString());
      pushVersion(id, "Uploaded from file");
      const doc: Document = {
        id,
        title: file.name.replace(/\.[^/.]+$/, "") || "Uploaded document",
        version: "draft",
        lastUpdated: readLastSavedLabel(id),
        status: "active",
        views: null,
        acceptances: null,
      };
      const updated = [...extraDocs, doc];
      setExtraDocs(updated);
      saveExtraCatalog(updated);
      bump();
      toast.success(`Imported "${doc.title}" — opening editor`);
      openEditor(doc);
    } catch (err) {
      console.error(err);
      toast.error("Could not read that file.");
    }
  };

  const submitCreateDocument = () => {
    const title = newDocTitle.trim();
    if (!title) { toast.error("Enter a document title."); return; }
    const id = crypto?.randomUUID?.() ? `new-${crypto.randomUUID()}` : `new-${Date.now()}`;
    const body = defaultBody(title, id);
    window.localStorage.setItem(LS_DOC(id), body);
    window.localStorage.setItem(LS_SAVED(id), new Date().toISOString());
    pushVersion(id, "Created in admin");
    const doc: Document = { id, title, version: "draft", lastUpdated: readLastSavedLabel(id), status: "active", views: null, acceptances: null };
    const updated = [...extraDocs, doc];
    setExtraDocs(updated);
    saveExtraCatalog(updated);
    bump();
    setShowCreateModal(false);
    setNewDocTitle("");
    toast.success(`"${title}" created — opening editor`);
    openEditor(doc);
  };

  const handleExportAll = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      documents: documents.map((d) => ({ id: d.id, title: d.title, status: d.status, body: readDocBody(d.id, d.title), versions: readVersions(d.id) })),
    };
    downloadText(`legal-docs-export-${new Date().toISOString().split("T")[0]}.json`, JSON.stringify(payload, null, 2));
    toast.success("Exported all documents as JSON.");
  };

  // ── Modals ───────────────────────────────────────────────────────────────────

  const allHistoryRows = useMemo(() => {
    if (!historyFullCatalog) return [];
    const rows: { docTitle: string; docId: string; v: VersionEntry }[] = [];
    for (const d of documents) {
      for (const v of readVersions(d.id)) rows.push({ docTitle: d.title, docId: d.id, v });
    }
    return rows.sort((a, b) => (a.v.date < b.v.date ? 1 : -1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyFullCatalog, documents, refreshTick]);

  /* View modal */
  const viewModal = viewingDoc ? (
    <ModalOverlay onClose={() => setViewingDoc(null)}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
      >
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{viewingDoc.title}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Version {viewingDoc.version} · Last saved: {readLastSavedLabel(viewingDoc.id)}
            </p>
          </div>
          <button type="button" onClick={() => setViewingDoc(null)} className="text-gray-400 hover:text-gray-700 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 flex-1 overflow-y-auto space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Views", value: viewingDoc.views == null ? "—" : viewingDoc.views.toLocaleString() },
              { label: "Acceptances", value: viewingDoc.acceptances == null ? "—" : viewingDoc.acceptances.toLocaleString() },
              { label: "Status", value: viewingDoc.status },
            ].map((s) => (
              <div key={s.label} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                {s.label === "Status" ? (
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${viewingDoc.status === "active" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {viewingDoc.status}
                  </span>
                ) : (
                  <p className="text-lg font-bold text-gray-900">{s.value}</p>
                )}
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Document Content</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto font-mono">
              {readDocBody(viewingDoc.id, viewingDoc.title)}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-2 flex-wrap">
          <Button
            type="button"
            onClick={() => { openEditor(viewingDoc); setViewingDoc(null); }}
          >
            <Edit className="w-4 h-4 mr-1.5" />
            Edit Document
          </Button>
          <Button type="button" variant="outline" onClick={() => handleExportDoc(viewingDoc)}>
            <Download className="w-4 h-4 mr-1.5" />
            Export .txt
          </Button>
          <Button type="button" variant="outline" onClick={() => setViewingDoc(null)}>
            Close
          </Button>
        </div>
      </motion.div>
    </ModalOverlay>
  ) : null;

  /* Editor modal */
  const editorModal = editorDoc ? (
    <ModalOverlay onClose={closeEditor}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Editor header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Edit className="w-4 h-4 text-purple-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 truncate">{editorDoc.title}</h2>
              <p className="text-xs text-gray-400">
                Last saved: {readLastSavedLabel(editorDoc.id)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              type="button"
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
              onClick={handleSaveInEditor}
              disabled={editorSaving}
            >
              <Save className="w-4 h-4 mr-1.5" />
              Save Changes
            </Button>
            <button
              type="button"
              onClick={closeEditor}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Editor toolbar */}
        <div className="px-6 py-2 border-b border-gray-100 flex items-center gap-3 bg-gray-50 flex-wrap">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${editorDoc.status === "active" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
            {editorDoc.status}
          </span>
          <span className="text-xs text-gray-400">v{editorDoc.version}</span>
          <span className="text-xs text-gray-300">·</span>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Changes saved to browser storage
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-xs h-7"
              onClick={() => { handleExportDoc(editorDoc); }}
            >
              <Download className="w-3 h-3 mr-1" />
              Export
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-xs h-7"
              onClick={() => {
                setHistoryDoc(editorDoc);
                setHistoryFullCatalog(false);
              }}
            >
              <History className="w-3 h-3 mr-1" />
              History
            </Button>
          </div>
        </div>

        {/* Editor body */}
        <div className="flex-1 overflow-hidden flex flex-col px-6 py-4">
          <Textarea
            className="flex-1 font-mono text-sm resize-none min-h-[400px] h-full border-gray-200 focus:ring-2 focus:ring-purple-400"
            value={editorContent}
            onChange={(e) => setEditorContent(e.target.value)}
            spellCheck
            placeholder="Start typing the document content..."
          />
          <p className="text-xs text-gray-400 mt-2 text-right">
            {editorContent.length.toLocaleString()} characters · {editorContent.split(/\n/).length} lines
          </p>
        </div>
      </motion.div>
    </ModalOverlay>
  ) : null;

  /* History modal */
  const historyModal = historyDoc || historyFullCatalog ? (
    <ModalOverlay onClose={() => { setHistoryDoc(null); setHistoryFullCatalog(false); }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {historyFullCatalog ? "Version History — All Documents" : `History: ${historyDoc?.title}`}
          </h2>
          <button
            type="button"
            onClick={() => { setHistoryDoc(null); setHistoryFullCatalog(false); }}
            className="text-gray-400 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {historyFullCatalog ? (
            allHistoryRows.length === 0 ? (
              <EmptyHistory />
            ) : (
              allHistoryRows.map((row, i) => (
                <VersionCard key={`${row.docId}-${i}`} label={row.docTitle} v={row.v} />
              ))
            )
          ) : historyDoc ? (
            readVersions(historyDoc.id).length === 0 ? (
              <EmptyHistory />
            ) : (
              readVersions(historyDoc.id).map((v, i) => (
                <VersionCard key={i} label={v.version} v={v} />
              ))
            )
          ) : null}
        </div>
      </motion.div>
    </ModalOverlay>
  ) : null;

  /* Create modal */
  const createModal = showCreateModal ? (
    <ModalOverlay onClose={() => { setShowCreateModal(false); setNewDocTitle(""); }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-gray-900">New Document</h2>
          <button
            type="button"
            onClick={() => { setShowCreateModal(false); setNewDocTitle(""); }}
            className="text-gray-400 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <label htmlFor="new-doc-title" className="block text-sm font-medium text-gray-700 mb-1.5">
          Document Title
        </label>
        <Input
          id="new-doc-title"
          value={newDocTitle}
          onChange={(e) => setNewDocTitle(e.target.value)}
          placeholder="e.g. Regional Privacy Addendum"
          className="mb-5"
          onKeyDown={(e) => { if (e.key === "Enter") submitCreateDocument(); }}
          autoFocus
        />
        <p className="text-xs text-gray-400 mb-5">
          A draft will be created in browser storage. The editor will open immediately after creation.
        </p>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={() => { setShowCreateModal(false); setNewDocTitle(""); }}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white"
            onClick={submitCreateDocument}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create & Edit
          </Button>
        </div>
      </motion.div>
    </ModalOverlay>
  ) : null;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <AdminLayoutNew>
      <input ref={uploadRef} type="file" accept=".txt,.md,.markdown,text/plain" className="hidden" onChange={handleUploadFile} />

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Legal &amp; Documentation</h1>
              <p className="text-gray-500 mt-1 text-sm">Terms, policies, and compliance documents</p>
            </div>
            <Button
              type="button"
              className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
              onClick={handleUploadClick}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Document
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.07 }}
            >
              <Card className="bg-white border-gray-100 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Documents + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Document list */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="lg:col-span-2"
          >
            <Card className="bg-white border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-5">Legal Documents</h3>
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 bg-gray-50 hover:bg-gray-100 transition-colors rounded-xl border border-gray-100"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-gray-900 font-semibold text-sm truncate">{doc.title}</h4>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {doc.version} · Saved {doc.lastUpdated}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                          doc.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {doc.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3 text-xs text-gray-500">
                      <span>Views: {doc.views == null ? "—" : doc.views.toLocaleString()}</span>
                      <span>Acceptances: {doc.acceptances == null ? "—" : doc.acceptances.toLocaleString()}</span>
                    </div>

                    <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-200 flex-wrap">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-7 text-xs"
                        onClick={() => setViewingDoc(doc)}
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        View
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 h-7 text-xs"
                        onClick={() => openEditor(doc)}
                      >
                        <Edit className="w-3.5 h-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 h-7 text-xs"
                        onClick={() => handleExportDoc(doc)}
                      >
                        <Download className="w-3.5 h-3.5 mr-1" />
                        Export
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 h-7 text-xs"
                        onClick={() => { setHistoryDoc(doc); setHistoryFullCatalog(false); }}
                      >
                        <History className="w-3.5 h-3.5 mr-1" />
                        History
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-4"
          >
            <Card className="bg-white border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-4">
                <History className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-bold text-gray-900">Version History</h3>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Versions are stored in this browser when you save from the editor. Each save creates a new version entry.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 w-full text-xs"
                onClick={() => { setHistoryDoc(null); setHistoryFullCatalog(true); }}
              >
                <History className="w-3.5 h-3.5 mr-1.5" />
                View Full History
              </Button>
            </Card>

            <Card className="bg-white border-gray-100 p-6">
              <h3 className="text-base font-bold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Button
                  type="button"
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white justify-start text-sm"
                  size="sm"
                  onClick={() => setShowCreateModal(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Document
                </Button>
                <Button
                  type="button"
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white justify-start text-sm"
                  size="sm"
                  onClick={handleUploadClick}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
                <Button
                  type="button"
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 justify-start text-sm"
                  size="sm"
                  onClick={handleExportAll}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export All (JSON)
                </Button>
              </div>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-100 p-5">
              <p className="text-xs text-purple-700 font-semibold mb-1">Storage note</p>
              <p className="text-xs text-purple-600 leading-relaxed">
                All edits are saved to your browser's localStorage. For production, integrate with your CMS or a database-backed API.
              </p>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Portals */}
      {typeof document !== "undefined" && viewModal ? createPortal(viewModal, document.body) : null}
      {typeof document !== "undefined" && editorModal ? createPortal(editorModal, document.body) : null}
      {typeof document !== "undefined" && historyModal ? createPortal(historyModal, document.body) : null}
      {typeof document !== "undefined" && createModal ? createPortal(createModal, document.body) : null}
    </AdminLayoutNew>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function VersionCard({ label, v }: { label: string; v: VersionEntry }) {
  return (
    <div className="border border-gray-100 rounded-xl p-3 bg-gray-50 text-sm">
      <p className="font-semibold text-gray-900 truncate">{label}</p>
      <p className="text-xs text-gray-400 mt-0.5">
        {v.version} · {format(new Date(v.date), "MMM d, yyyy HH:mm")} · {v.author}
      </p>
      <p className="text-gray-600 mt-1 text-xs">{v.changes}</p>
    </div>
  );
}

function EmptyHistory() {
  return (
    <div className="py-8 text-center">
      <History className="w-10 h-10 text-gray-200 mx-auto mb-3" />
      <p className="text-sm text-gray-500">No saved versions yet.</p>
      <p className="text-xs text-gray-400 mt-1">Save a document in the editor to create history entries.</p>
    </div>
  );
}
