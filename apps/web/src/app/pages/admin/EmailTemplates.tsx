import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { 
  Mail,
  Plus,
  Edit,
  Trash2,
  Eye,
  Send,
  Copy,
  Save,
  Code,
  Type,
  Image as ImageIcon,
  Search
} from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "../../../lib/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  category: "welcome" | "notification" | "marketing" | "system" | "crisis";
  htmlContent: string;
  textContent: string;
  variables: string[];
  lastModified: Date;
  sentCount: number;
  openRate: number;
}

export function EmailTemplates() {
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "html" | "text">("preview");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSendModal, setShowSendModal] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editMode, setEditMode] = useState<"create" | "edit">("create");
  const [formName, setFormName] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formCategory, setFormCategory] =
    useState<EmailTemplate["category"]>("system");
  const [formHtmlContent, setFormHtmlContent] = useState("");
  const [formTextContent, setFormTextContent] = useState("");
  const [formVariables, setFormVariables] = useState("");

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const data = await api.admin.getEmailTemplates();
      setTemplates(data.map((t: any) => ({
        id: t.id,
        name: t.name,
        subject: t.subject,
        category: (t.category as EmailTemplate["category"]) || "system",
        htmlContent: t.html_content || t.body || "",
        textContent: t.text_content || "",
        variables: Array.isArray(t.variables) ? t.variables : [],
        lastModified: new Date(t.updated_at || t.created_at),
        sentCount: t.sent_count || 0,
        openRate: t.open_rate || 0
      })));
      if (data.length > 0) {
        // Optionally select first template or keep it null
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error);
      toast.error("Failed to load email templates");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCategoryColor = (category: string) => {
    switch(category) {
      case "welcome": return "bg-green-100 text-green-700";
      case "notification": return "bg-blue-100 text-blue-700";
      case "marketing": return "bg-purple-100 text-purple-700";
      case "system": return "bg-gray-100 text-gray-700";
      case "crisis": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const stats = {
    total: templates.length,
    sent: templates.reduce((sum, t) => sum + t.sentCount, 0),
    avgOpenRate: templates.length
      ? (
          templates.reduce((sum, t) => sum + t.openRate, 0) / templates.length
        ).toFixed(1)
      : "0.0"
  };

  // Replace template variables with preview values
  const getPreviewContent = (template: EmailTemplate) => {
    let content = template.htmlContent;
    
    // Replace common variables with preview values
    const replacements: Record<string, string> = {
      '{{user_name}}': 'John Doe',
      '{{app_url}}': '/therapy-session',
      '{{session_url}}': '/therapy-session',
      '{{session_time}}': '2:00 PM',
      '{{reset_url}}': '/reset-password',
      '{{upgrade_url}}': '/pricing',
      '{{sessions_count}}': '5',
      '{{mood_count}}': '12',
      '{{journal_count}}': '8',
      '{{streak_days}}': '7'
    };
    
    Object.entries(replacements).forEach(([variable, value]) => {
      content = content.replace(new RegExp(variable, 'g'), value);
    });
    
    return content;
  };

  const handleSendTestEmail = async () => {
    if (!selectedTemplate || !testEmail) return;
    
    setIsSending(true);
    try {
      const html = getPreviewContent(selectedTemplate);
      await api.sendEmail(testEmail, selectedTemplate.subject, html, selectedTemplate.textContent);
      toast.success("Test email sent successfully");
      setShowSendModal(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormSubject("");
    setFormCategory("system");
    setFormHtmlContent("");
    setFormTextContent("");
    setFormVariables("");
  };

  const openCreateModal = () => {
    resetForm();
    setEditMode("create");
    setIsEditing(true);
    setShowEditModal(true);
  };

  const openEditModal = () => {
    if (!selectedTemplate) return;
    setEditMode("edit");
    setFormName(selectedTemplate.name);
    setFormSubject(selectedTemplate.subject);
    setFormCategory(selectedTemplate.category);
    setFormHtmlContent(selectedTemplate.htmlContent);
    setFormTextContent(selectedTemplate.textContent);
    setFormVariables(selectedTemplate.variables.join(", "));
    setIsEditing(true);
    setShowEditModal(true);
  };

  const handleSaveTemplate = async () => {
    if (!formName || !formSubject) {
      toast.error("Name and subject are required");
      return;
    }

    const variables = formVariables
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    const payload = {
      name: formName,
      subject: formSubject,
      body: formHtmlContent || formTextContent || "",
      variables,
    };

    try {
      if (editMode === "create") {
        const created = await api.admin.createEmailTemplate(payload);
        toast.success("Template created");
        await fetchTemplates();
        if (created?.id) {
          const match = templates.find((t) => t.id === created.id);
          if (match) {
            setSelectedTemplate(match);
          }
        }
      } else if (editMode === "edit" && selectedTemplate) {
        await api.admin.updateEmailTemplate(selectedTemplate.id, payload);
        toast.success("Template updated");
        await fetchTemplates();
      }
      setShowEditModal(false);
      setIsEditing(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || "Failed to save template");
    }
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return;
    const confirmed = window.confirm(
      `Delete template "${selectedTemplate.name}"?`
    );
    if (!confirmed) return;

    try {
      await api.admin.deleteEmailTemplate(selectedTemplate.id);
      toast.success("Template deleted");
      const remaining = templates.filter(
        (t) => t.id !== selectedTemplate.id
      );
      setTemplates(remaining);
      setSelectedTemplate(remaining[0] || null);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete template");
    }
  };

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Email Templates</h1>
            <p className="text-gray-600 mt-1">Manage and customize email templates</p>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center gap-2 shadow-lg"
          >
            <Plus className="w-4 h-4" />
            New Template
          </motion.button>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Total Templates</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600">
                <Send className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Emails Sent</p>
                <p className="text-2xl font-bold text-gray-900">{stats.sent.toLocaleString()}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
                <Eye className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Avg Open Rate</p>
                <p className="text-2xl font-bold text-gray-900">{stats.avgOpenRate}%</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Templates List */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-6">Templates ({filteredTemplates.length})</h2>

            <div className="space-y-3">
              {filteredTemplates.map((template, index) => (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.05 }}
                  onClick={() => setSelectedTemplate(template)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedTemplate?.id === template.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{template.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{template.subject}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getCategoryColor(template.category)}`}>
                      {template.category}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs text-gray-600 mt-3">
                    <div>
                      <p className="font-medium">Sent</p>
                      <p>{template.sentCount}</p>
                    </div>
                    <div>
                      <p className="font-medium">Open Rate</p>
                      <p>{template.openRate}%</p>
                    </div>
                    <div>
                      <p className="font-medium">Variables</p>
                      <p>{template.variables.length}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Template Preview */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 sticky top-6"
          >
            {selectedTemplate ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Preview</h2>
                  <div className="flex gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={openEditModal}
                      className="p-2 rounded-lg hover:bg-blue-50 text-blue-600"
                    >
                      <Edit className="w-4 h-4" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-3 py-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 flex items-center gap-2 text-sm font-medium"
                      onClick={() => setShowSendModal(true)}
                    >
                      <Send className="w-4 h-4" />
                      Send Test
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleDeleteTemplate}
                      className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </motion.button>
                  </div>
                </div>

                {/* View Mode Tabs */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setViewMode("preview")}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      viewMode === "preview"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <Eye className="w-4 h-4 inline mr-1" />
                    Preview
                  </button>
                  <button
                    onClick={() => setViewMode("html")}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      viewMode === "html"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <Code className="w-4 h-4 inline mr-1" />
                    HTML
                  </button>
                  <button
                    onClick={() => setViewMode("text")}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      viewMode === "text"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <Type className="w-4 h-4 inline mr-1" />
                    Text
                  </button>
                </div>

                {/* Subject Line */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Subject Line</p>
                  <p className="font-medium text-gray-900">{selectedTemplate.subject}</p>
                </div>

                {/* Variables */}
                {selectedTemplate.variables.length > 0 && (
                  <div className="mb-4 p-3 bg-purple-50 rounded-lg">
                    <p className="text-xs text-purple-700 font-medium mb-2">Available Variables</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplate.variables.map(variable => (
                        <code key={variable} className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                          {`{{${variable}}}`}
                        </code>
                      ))}
                    </div>
                  </div>
                )}

                {/* Content */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  {viewMode === "preview" && (
                    <div 
                      className="p-4 max-h-96 overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: getPreviewContent(selectedTemplate) }}
                    />
                  )}
                  
                  {viewMode === "html" && (
                    <pre className="p-4 text-xs bg-gray-900 text-green-400 max-h-96 overflow-auto font-mono">
                      {selectedTemplate.htmlContent}
                    </pre>
                  )}
                  
                  {viewMode === "text" && (
                    <div className="p-4 text-sm text-gray-700 max-h-96 overflow-y-auto whitespace-pre-wrap">
                      {selectedTemplate.textContent}
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-600 text-xs">Sent</p>
                    <p className="font-bold text-gray-900">{selectedTemplate.sentCount}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-600 text-xs">Open Rate</p>
                    <p className="font-bold text-gray-900">{selectedTemplate.openRate}%</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-600 text-xs">Modified</p>
                    <p className="font-bold text-gray-900 text-xs">{selectedTemplate.lastModified.toLocaleDateString()}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">Select a template to preview</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
      
      <Dialog open={showSendModal} onOpenChange={setShowSendModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
            <DialogDescription>
              Send a test email of <strong>{selectedTemplate?.name}</strong> to the address below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendModal(false)}>Cancel</Button>
            <Button onClick={handleSendTestEmail} disabled={isSending || !testEmail}>
              {isSending ? "Sending..." : "Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editMode === "create" ? "New Email Template" : "Edit Email Template"}
            </DialogTitle>
            <DialogDescription>
              Define the content and variables for this email template.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Welcome Email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-subject">Subject</Label>
              <Input
                id="template-subject"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                placeholder="Welcome to Ezri"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-category">Category</Label>
              <select
                id="template-category"
                value={formCategory}
                onChange={(e) =>
                  setFormCategory(e.target.value as EmailTemplate["category"])
                }
                className="w-full px-3 py-2 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="welcome">Welcome</option>
                <option value="notification">Notification</option>
                <option value="marketing">Marketing</option>
                <option value="system">System</option>
                <option value="crisis">Crisis</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-html">HTML Content</Label>
              <textarea
                id="template-html"
                value={formHtmlContent}
                onChange={(e) => setFormHtmlContent(e.target.value)}
                rows={8}
                placeholder="<p>Hello {{user_name}}, welcome to Ezri...</p>"
                className="w-full px-3 py-2 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-text">Text Content (optional)</Label>
              <textarea
                id="template-text"
                value={formTextContent}
                onChange={(e) => setFormTextContent(e.target.value)}
                rows={4}
                placeholder="Hello {{user_name}}, welcome to Ezri..."
                className="w-full px-3 py-2 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-variables">
                Variables (comma separated, without curly braces)
              </Label>
              <Input
                id="template-variables"
                value={formVariables}
                onChange={(e) => setFormVariables(e.target.value)}
                placeholder="user_name, app_url, reset_url"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditModal(false);
                setIsEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate}>
              {editMode === "create" ? "Create Template" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayoutNew>
  );
}
