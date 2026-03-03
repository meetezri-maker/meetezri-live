import { motion, AnimatePresence } from "motion/react";
import { X, Download, FileText, FileJson, Calendar, CheckCircle2, Loader } from "lucide-react";
import { useState } from "react";

interface JournalExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entriesCount: number;
}

export function JournalExportModal({ isOpen, onClose, entriesCount }: JournalExportModalProps) {
  const [exportFormat, setExportFormat] = useState<"pdf" | "json">("pdf");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    
    // Simulate export process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Create mock download
    const filename = `ezri-journal-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
    const mockData = exportFormat === "json" 
      ? JSON.stringify({ entries: entriesCount, exportDate: new Date(), format: "Ezri Journal Export" }, null, 2)
      : "PDF Content would be generated here...";
    
    const blob = new Blob([mockData], { type: exportFormat === "json" ? "application/json" : "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    
    setIsExporting(false);
    setExportComplete(true);
    
    setTimeout(() => {
      setExportComplete(false);
      onClose();
    }, 2000);
  };

  const getFilteredCount = () => {
    if (!dateFrom && !dateTo) return entriesCount;
    // Mock filtered count
    return Math.floor(entriesCount * 0.6);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-lg w-full pointer-events-auto overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-b-2 border-blue-200 p-6 relative">
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-full bg-white/80 hover:bg-white transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>

                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg">
                    <Download className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Export Journal</h2>
                </div>
                <p className="text-sm text-gray-600">Download your journal entries</p>
              </div>

              {/* Content */}
              <div className="p-6">
                {exportComplete ? (
                  /* Success State */
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center py-8"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", duration: 0.6 }}
                      className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full shadow-xl mb-4"
                    >
                      <CheckCircle2 className="w-10 h-10 text-white" />
                    </motion.div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Export Complete!</h3>
                    <p className="text-gray-600">Your journal has been downloaded successfully</p>
                  </motion.div>
                ) : (
                  <>
                    {/* Format Selection */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-3">Export Format</label>
                      <div className="grid grid-cols-2 gap-3">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setExportFormat("pdf")}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            exportFormat === "pdf"
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <FileText className={`w-8 h-8 mx-auto mb-2 ${
                            exportFormat === "pdf" ? "text-blue-600" : "text-gray-400"
                          }`} />
                          <p className={`text-sm font-medium ${
                            exportFormat === "pdf" ? "text-blue-900" : "text-gray-600"
                          }`}>
                            PDF Document
                          </p>
                          <p className="text-xs text-gray-500 mt-1">Printable format</p>
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setExportFormat("json")}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            exportFormat === "json"
                              ? "border-purple-500 bg-purple-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <FileJson className={`w-8 h-8 mx-auto mb-2 ${
                            exportFormat === "json" ? "text-purple-600" : "text-gray-400"
                          }`} />
                          <p className={`text-sm font-medium ${
                            exportFormat === "json" ? "text-purple-900" : "text-gray-600"
                          }`}>
                            JSON Data
                          </p>
                          <p className="text-xs text-gray-500 mt-1">Machine readable</p>
                        </motion.button>
                      </div>
                    </div>

                    {/* Date Range */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Date Range (Optional)
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">From</label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="date"
                              value={dateFrom}
                              onChange={(e) => setDateFrom(e.target.value)}
                              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">To</label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="date"
                              value={dateTo}
                              onChange={(e) => setDateTo(e.target.value)}
                              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Export Summary */}
                    <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-4 mb-6 border-2 border-gray-200">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Export Summary</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-gray-500">Entries</p>
                          <p className="font-bold text-gray-900">{getFilteredCount()} {getFilteredCount() === 1 ? 'entry' : 'entries'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Format</p>
                          <p className="font-bold text-gray-900 uppercase">{exportFormat}</p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onClose}
                        disabled={isExporting}
                        className="flex-1 px-4 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all disabled:opacity-50"
                      >
                        Cancel
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleExport}
                        disabled={isExporting}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold shadow-lg transition-all disabled:opacity-50 ${
                          exportFormat === "pdf"
                            ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:shadow-xl"
                            : "bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:shadow-xl"
                        }`}
                      >
                        {isExporting ? (
                          <>
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            >
                              <Loader className="w-5 h-5" />
                            </motion.div>
                            Exporting...
                          </>
                        ) : (
                          <>
                            <Download className="w-5 h-5" />
                            Export Journal
                          </>
                        )}
                      </motion.button>
                    </div>

                    {/* Privacy Note */}
                    <div className="mt-4 text-center text-xs text-gray-500">
                      Your journal data is exported securely and remains private
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
