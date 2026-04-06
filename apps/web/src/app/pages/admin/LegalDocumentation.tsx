import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  FileText,
  Edit,
  Eye,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Download,
  Upload,
  Save,
  History,
  X,
} from "lucide-react";
import { useState, useMemo, useRef, useEffect, useCallback, type ReactNode } from "react";
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
  {
    id: "tos",
    title: "Terms of Service",
    version: "live",
    lastUpdated: "—",
    status: "active",
    views: null,
    acceptances: null,
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    version: "live",
    lastUpdated: "—",
    status: "active",
    views: null,
    acceptances: null,
  },
  {
    id: "consent",
    title: "Consent & disclosures",
    version: "live",
    lastUpdated: "—",
    status: "active",
    views: null,
    acceptances: null,
  },
  {
    id: "hipaa",
    title: "HIPAA / health information notice",
    version: "live",
    lastUpdated: "—",
    status: "active",
    views: null,
    acceptances: null,
  },
  {
    id: "cookies",
    title: "Cookie policy",
    version: "live",
    lastUpdated: "—",
    status: "active",
    views: null,
    acceptances: null,
  },
  {
    id: "disclaimer",
    title: "Medical / wellness disclaimer",
    version: "live",
    lastUpdated: "—",
    status: "review",
    views: null,
    acceptances: null,
  },
];

export function LegalDocumentation() {
  const [extraDocs, setExtraDocs] = useState<Document[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyDoc, setHistoryDoc] = useState<Document | null>(null);
  const [historyFullCatalog, setHistoryFullCatalog] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [editorDocId, setEditorDocId] = useState<string>("tos");
  const [editorContent, setEditorContent] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const documents = useMemo(() => {
    const merged = [...BUILTIN, ...extraDocs];
    return merged.map((d) => ({
      ...d,
      lastUpdated: readLastSavedLabel(d.id),
    }));
  }, [extraDocs, refreshTick]);

  const editorTitle = useMemo(() => {
    const d = documents.find((x) => x.id === editorDocId);
    return d?.title ?? "Document";
  }, [documents, editorDocId]);

  useEffect(() => {
    const d = documents.find((x) => x.id === editorDocId);
    if (d) setEditorContent(readDocBody(d.id, d.title));
  }, [editorDocId, documents]);

  const bump = useCallback(() => setRefreshTick((t) => t + 1), []);

  const stats = useMemo(
    () => [
      {
        label: "Catalog entries",
        value: String(documents.length),
        icon: FileText,
        color: "from-blue-500 to-cyan-600",
      },
      {
        label: "Pending review",
        value: String(documents.filter((d) => d.status === "review").length),
        icon: AlertTriangle,
        color: "from-yellow-500 to-orange-600",
      },
      {
        label: "Acceptances tracked",
        value: "—",
        icon: CheckCircle2,
        color: "from-green-500 to-emerald-600",
      },
      {
        label: "Views tracked",
        value: "—",
        icon: CheckCircle2,
        color: "from-purple-500 to-pink-600",
      },
    ],
    [documents]
  );

  const handleViewDoc = (doc: Document) => {
    setViewingDoc(doc);
    setShowViewModal(true);
  };

  const handleEditDoc = (doc: Document) => {
    setEditorDocId(doc.id);
    setEditorContent(readDocBody(doc.id, doc.title));
    editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    toast.success(`Editor loaded: ${doc.title}`);
  };

  const handleExportDoc = (doc: Document) => {
    const body = readDocBody(doc.id, doc.title);
    const safe = doc.title.replace(/[^\w\d\-]+/g, "_").slice(0, 80) || "document";
    downloadText(`${safe}-${doc.id}.txt`, body);
    toast.success(`Downloaded ${doc.title}`);
  };

  const handleViewHistory = (doc: Document) => {
    setHistoryDoc(doc);
    setHistoryFullCatalog(false);
    setShowHistoryModal(true);
  };

  const handleUploadClick = () => {
    uploadRef.current?.click();
  };

  const handleUploadFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const base =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `up-${Date.now()}`;
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
      setExtraDocs((prev) => [...prev, doc]);
      setEditorDocId(id);
      setEditorContent(text);
      bump();
      toast.success(`Imported “${doc.title}”`);
    } catch (err) {
      console.error(err);
      toast.error("Could not read that file.");
    }
  };

  const handleSaveChanges = () => {
    const d = documents.find((x) => x.id === editorDocId);
    if (!d) {
      toast.error("Select a document in the editor.");
      return;
    }
    window.localStorage.setItem(LS_DOC(editorDocId), editorContent);
    window.localStorage.setItem(LS_SAVED(editorDocId), new Date().toISOString());
    pushVersion(editorDocId, "Saved from admin editor");
    bump();
    toast.success("Changes saved in this browser.");
  };

  const handleCreateNewDocument = () => {
    setNewDocTitle("");
    setShowCreateModal(true);
  };

  const submitCreateDocument = () => {
    const title = newDocTitle.trim();
    if (!title) {
      toast.error("Enter a document title.");
      return;
    }
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? `new-${crypto.randomUUID()}`
        : `new-${Date.now()}`;
    const body = defaultBody(title, id);
    window.localStorage.setItem(LS_DOC(id), body);
    window.localStorage.setItem(LS_SAVED(id), new Date().toISOString());
    pushVersion(id, "Created in admin");
    const doc: Document = {
      id,
      title,
      version: "draft",
      lastUpdated: readLastSavedLabel(id),
      status: "active",
      views: null,
      acceptances: null,
    };
    setExtraDocs((prev) => [...prev, doc]);
    setEditorDocId(id);
    setEditorContent(body);
    setShowCreateModal(false);
    bump();
    toast.success("Document created.");
  };

  const handleExportAllDocuments = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      documents: documents.map((d) => ({
        id: d.id,
        title: d.title,
        status: d.status,
        body: readDocBody(d.id, d.title),
        versions: readVersions(d.id),
      })),
    };
    downloadText(`legal-documentation-export-${new Date().toISOString().split("T")[0]}.json`, JSON.stringify(payload, null, 2));
    toast.success("Exported catalog + drafts (JSON).");
  };

  const handleViewFullHistory = () => {
    setHistoryDoc(null);
    setHistoryFullCatalog(true);
    setShowHistoryModal(true);
  };

  const viewModalContent =
    showViewModal && viewingDoc ? (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        >
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{viewingDoc.title}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Version {viewingDoc.version} • Last saved: {readLastSavedLabel(viewingDoc.id)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowViewModal(false);
                  setViewingDoc(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Views</p>
                <p className="text-2xl font-bold text-gray-900">
                  {viewingDoc.views == null ? "—" : viewingDoc.views.toLocaleString()}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Acceptances</p>
                <p className="text-2xl font-bold text-gray-900">
                  {viewingDoc.acceptances == null ? "—" : viewingDoc.acceptances.toLocaleString()}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Status</p>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    viewingDoc.status === "active"
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {viewingDoc.status}
                </span>
              </div>
            </div>

            <div className="prose max-w-none">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Content</h3>
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 whitespace-pre-wrap text-gray-800 text-sm max-h-[50vh] overflow-y-auto">
                {readDocBody(viewingDoc.id, viewingDoc.title)}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 flex gap-3 flex-wrap">
              <Button
                type="button"
                className="flex-1 min-w-[120px]"
                onClick={() => {
                  handleEditDoc(viewingDoc);
                  setShowViewModal(false);
                  setViewingDoc(null);
                }}
              >
                <Edit className="w-4 h-4 mr-2" />
                Open in editor
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 min-w-[120px]"
                onClick={() => handleExportDoc(viewingDoc)}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowViewModal(false);
                  setViewingDoc(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    ) : null;

  const allHistoryRows = useMemo(() => {
    if (!historyFullCatalog) return [];
    const rows: { docTitle: string; docId: string; v: VersionEntry }[] = [];
    for (const d of documents) {
      for (const v of readVersions(d.id)) {
        rows.push({ docTitle: d.title, docId: d.id, v });
      }
    }
    return rows.sort((a, b) => (a.v.date < b.v.date ? 1 : -1));
  }, [historyFullCatalog, documents, showHistoryModal, refreshTick]);

  const historyModalContent =
    showHistoryModal && (historyDoc || historyFullCatalog) ? (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col"
        >
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {historyFullCatalog ? "Version history (all documents)" : `History: ${historyDoc?.title}`}
            </h2>
            <button
              type="button"
              onClick={() => {
                setShowHistoryModal(false);
                setHistoryDoc(null);
                setHistoryFullCatalog(false);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {historyFullCatalog ? (
              allHistoryRows.length === 0 ? (
                <p className="text-sm text-gray-500">No saved versions yet. Saving the editor creates history entries.</p>
              ) : (
                allHistoryRows.map((row, i) => (
                  <div key={`${row.docId}-${i}`} className="border rounded-lg p-3 text-sm">
                    <p className="font-medium text-gray-900">{row.docTitle}</p>
                    <p className="text-xs text-gray-500">{row.v.version} · {format(new Date(row.v.date), "PPpp")}</p>
                    <p className="text-gray-700 mt-1">{row.v.changes}</p>
                  </div>
                ))
              )
            ) : historyDoc ? (
              readVersions(historyDoc.id).length === 0 ? (
                <p className="text-sm text-gray-500">No versions yet for this document.</p>
              ) : (
                readVersions(historyDoc.id).map((v, i) => (
                  <div key={i} className="border rounded-lg p-3 text-sm">
                    <p className="font-medium text-gray-900">{v.version}</p>
                    <p className="text-xs text-gray-500">{format(new Date(v.date), "PPpp")} · {v.author}</p>
                    <p className="text-gray-700 mt-1">{v.changes}</p>
                  </div>
                ))
              )
            ) : null}
          </div>
        </motion.div>
      </div>
    ) : null;

  const createModalContent = showCreateModal ? (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
      >
        <h2 className="text-xl font-bold text-gray-900 mb-4">New document</h2>
        <LabelBlock htmlFor="new-doc-title">Title</LabelBlock>
        <Input
          id="new-doc-title"
          value={newDocTitle}
          onChange={(e) => setNewDocTitle(e.target.value)}
          placeholder="e.g. Regional privacy addendum"
          className="mb-4"
        />
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submitCreateDocument}>
            Create
          </Button>
        </div>
      </motion.div>
    </div>
  ) : null;

  return (
    <AdminLayoutNew>
      <input ref={uploadRef} type="file" accept=".txt,.md,.markdown,text/plain" className="hidden" onChange={handleUploadFile} />

      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Legal & Documentation
              </h1>
              <p className="text-gray-600">
                Terms, policies, and compliance documents
              </p>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="bg-white border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}
                  >
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2"
          >
            <Card className="bg-white border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Legal Documents</h3>

              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all border border-gray-200"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="text-gray-900 font-medium">{doc.title}</h4>
                          <p className="text-xs text-gray-500">
                            Version {doc.version} • Saved {doc.lastUpdated}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          doc.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {doc.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500">Views</p>
                        <p className="text-gray-900 font-medium">
                          {doc.views == null ? "—" : doc.views.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Acceptances</p>
                        <p className="text-gray-900 font-medium">
                          {doc.acceptances == null ? "—" : doc.acceptances.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 flex-wrap">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => handleViewDoc(doc)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                        onClick={() => handleEditDoc(doc)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                        onClick={() => handleExportDoc(doc)}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Export
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                        onClick={() => handleViewHistory(doc)}
                      >
                        <History className="w-4 h-4 mr-1" />
                        History
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <History className="w-6 h-6 text-purple-600" />
                <h3 className="text-xl font-bold text-gray-900">Version History</h3>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Versions are stored in this browser when you save from the editor. Production tracking belongs in your CMS or repo.
                </p>
              </div>
            </Card>

            <Card className="bg-white border-gray-200 p-6 mt-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Quick Actions
              </h3>
              <div className="space-y-2">
                <Button
                  type="button"
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white justify-start"
                  size="sm"
                  onClick={handleCreateNewDocument}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Create New Document
                </Button>
                <Button
                  type="button"
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 justify-start"
                  size="sm"
                  onClick={handleExportAllDocuments}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export All Documents
                </Button>
                <Button
                  type="button"
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 justify-start"
                  size="sm"
                  onClick={handleViewFullHistory}
                >
                  <History className="w-4 h-4 mr-2" />
                  View Full History
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>

        <motion.div
          ref={editorRef}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-white border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h3 className="text-xl font-bold text-gray-900">Document Editor</h3>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm text-gray-600 whitespace-nowrap">Editing:</label>
                <select
                  className="border rounded-lg px-3 py-2 text-sm min-w-[200px]"
                  value={editorDocId}
                  onChange={(e) => setEditorDocId(e.target.value)}
                >
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                  onClick={handleSaveChanges}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-2">
              {editorTitle} · last saved {readLastSavedLabel(editorDocId)}
            </p>
            <Textarea
              className="min-h-[320px] font-mono text-sm"
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
              spellCheck
            />
          </Card>
        </motion.div>
      </div>

      {typeof document !== "undefined" && viewModalContent ? createPortal(viewModalContent, document.body) : null}
      {typeof document !== "undefined" && historyModalContent ? createPortal(historyModalContent, document.body) : null}
      {typeof document !== "undefined" && createModalContent ? createPortal(createModalContent, document.body) : null}
    </AdminLayoutNew>
  );
}

function LabelBlock({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
      {children}
    </label>
  );
}
