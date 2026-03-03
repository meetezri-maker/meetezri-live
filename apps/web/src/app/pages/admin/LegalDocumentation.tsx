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
import { useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { toast } from "sonner";

type Document = {
  id: string;
  title: string;
  version: string;
  lastUpdated: string;
  status: string;
  views: number;
  acceptances: number;
};

export function LegalDocumentation() {
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);

  const documents: Document[] = [
    {
      id: "tos",
      title: "Terms of Service",
      version: "3.2",
      lastUpdated: "2024-01-15",
      status: "active",
      views: 12456,
      acceptances: 11234,
    },
    {
      id: "privacy",
      title: "Privacy Policy",
      version: "2.8",
      lastUpdated: "2024-01-10",
      status: "active",
      views: 13567,
      acceptances: 12345,
    },
    {
      id: "consent",
      title: "Consent Form",
      version: "1.5",
      lastUpdated: "2023-12-20",
      status: "active",
      views: 8901,
      acceptances: 8234,
    },
    {
      id: "hipaa",
      title: "HIPAA Notice",
      version: "1.2",
      lastUpdated: "2023-11-15",
      status: "active",
      views: 5432,
      acceptances: 4987,
    },
    {
      id: "cookies",
      title: "Cookie Policy",
      version: "2.0",
      lastUpdated: "2024-01-05",
      status: "active",
      views: 6789,
      acceptances: 6234,
    },
    {
      id: "disclaimer",
      title: "Medical Disclaimer",
      version: "1.0",
      lastUpdated: "2023-10-01",
      status: "review",
      views: 3456,
      acceptances: 3123,
    },
  ];

  const versionHistory = [
    {
      version: "3.2",
      date: "2024-01-15",
      author: "Legal Team",
      changes: "Updated liability clauses and payment terms",
    },
    {
      version: "3.1",
      date: "2023-12-01",
      author: "Sarah Chen",
      changes: "Added new AI therapy disclosure section",
    },
    {
      version: "3.0",
      date: "2023-10-15",
      author: "Legal Team",
      changes: "Major revision for GDPR compliance",
    },
  ];

  const stats = [
    {
      label: "Active Documents",
      value: "5",
      icon: FileText,
      color: "from-blue-500 to-cyan-600",
    },
    {
      label: "Pending Review",
      value: "1",
      icon: AlertTriangle,
      color: "from-yellow-500 to-orange-600",
    },
    {
      label: "Total Acceptances",
      value: "46.1K",
      icon: CheckCircle2,
      color: "from-green-500 to-emerald-600",
    },
    {
      label: "Compliance Rate",
      value: "94%",
      icon: CheckCircle2,
      color: "from-purple-500 to-pink-600",
    },
  ];

  const handleViewDoc = (doc: Document) => {
    setViewingDoc(doc);
    setShowViewModal(true);
  };

  const handleEditDoc = (doc: Document) => {
    toast.info(`Opening editor for ${doc.title}`);
  };

  const handleExportDoc = (doc: Document) => {
    toast.success(`Exporting ${doc.title}`);
  };

  const handleViewHistory = (doc: Document) => {
    toast.info(`Viewing version history for ${doc.title}`);
  };

  const handleUploadDocument = () => {
    toast.info("Opening document upload dialog");
  };

  const handleSaveChanges = () => {
    toast.success("Changes saved successfully!");
  };

  const handleCreateNewDocument = () => {
    toast.info("Creating new document");
  };

  const handleExportAllDocuments = () => {
    toast.success("Exporting all documents");
  };

  const handleViewFullHistory = () => {
    toast.info("Opening full version history");
  };

  return (
    <AdminLayoutNew>
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
              className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
              onClick={handleUploadDocument}
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
          {/* Documents List */}
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
                            Version {doc.version} • Updated {doc.lastUpdated}
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
                          {doc.views.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Acceptances</p>
                        <p className="text-gray-900 font-medium">
                          {doc.acceptances.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleViewDoc(doc);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleEditDoc(doc);
                        }}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleExportDoc(doc);
                        }}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Export
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleViewHistory(doc);
                        }}
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

          {/* Version History */}
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
                {versionHistory.map((version, index) => (
                  <div key={version.version} className="relative">
                    {index !== versionHistory.length - 1 && (
                      <div className="absolute left-4 top-10 bottom-0 w-px bg-gray-200" />
                    )}
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 relative z-10">
                        <Clock className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-gray-900 font-bold">
                            v{version.version}
                          </span>
                          <span className="text-xs text-gray-500">
                            {version.date}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-1">
                          {version.changes}
                        </p>
                        <p className="text-xs text-gray-500">by {version.author}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="bg-white border-gray-200 p-6 mt-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Quick Actions
              </h3>
              <div className="space-y-2">
                <Button
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white justify-start"
                  size="sm"
                  onClick={handleCreateNewDocument}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Create New Document
                </Button>
                <Button
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 justify-start"
                  size="sm"
                  onClick={handleExportAllDocuments}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export All Documents
                </Button>
                <Button
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

        {/* Document Editor Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-white border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Document Editor</h3>
              <Button
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                onClick={handleSaveChanges}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 min-h-[300px] border border-gray-200">
              <div className="max-w-3xl mx-auto">
                <h1 className="text-2xl font-bold text-gray-900 mb-4">
                  Terms of Service
                </h1>
                <p className="text-sm text-gray-500 mb-6">
                  Version 3.2 • Last updated: January 15, 2024
                </p>

                <div className="space-y-4 text-gray-700">
                  <p>
                    Welcome to Ezri Mental Health. By accessing or using our
                    services, you agree to be bound by these Terms of Service.
                  </p>

                  <h2 className="text-xl font-bold text-gray-900 mt-6 mb-2">
                    1. Acceptance of Terms
                  </h2>
                  <p>
                    By creating an account or using our services, you acknowledge
                    that you have read, understood, and agree to be bound by these
                    Terms of Service and our Privacy Policy.
                  </p>

                  <h2 className="text-xl font-bold text-gray-900 mt-6 mb-2">
                    2. Use of Services
                  </h2>
                  <p>
                    Ezri provides mental health and wellness services through
                    AI-powered sessions, mood tracking, journaling, and wellness
                    tools. These services are intended to support your mental
                    wellness journey but do not replace professional medical advice.
                  </p>

                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      <strong>Note:</strong> This is a preview. Use the editor above
                      to make changes to the document content.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* View Document Modal */}
      {showViewModal && viewingDoc && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
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
                    Version {viewingDoc.version} • Last updated: {viewingDoc.lastUpdated}
                  </p>
                </div>
                <button
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
                    {viewingDoc.views.toLocaleString()}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Acceptances</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {viewingDoc.acceptances.toLocaleString()}
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
                <h3 className="text-lg font-bold text-gray-900 mb-3">Document Content</h3>
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <p className="text-gray-700 mb-4">
                    This is a preview of the {viewingDoc.title} document. The full content
                    would be displayed here with proper formatting and sections.
                  </p>
                  <p className="text-gray-700">
                    Users can review, edit, and export this document using the actions
                    available in the document list.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 flex gap-3">
                <Button
                  className="flex-1"
                  onClick={() => {
                    handleEditDoc(viewingDoc);
                    setShowViewModal(false);
                    setViewingDoc(null);
                  }}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Document
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    handleExportDoc(viewingDoc);
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button
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
      )}
    </AdminLayoutNew>
  );
}