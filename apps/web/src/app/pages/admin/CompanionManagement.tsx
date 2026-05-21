import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  UserCheck,
  Plus,
  Search,
  Mail,
  Phone,
  Calendar,
  BarChart3,
  Edit,
  Trash2,
  Info,
  CheckCircle,
  Clock,
  Loader2,
  X,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../../../lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import { PhoneInput } from "../../components/ui/phone-input";
import { normalizeStoredPhoneForInput, isValidOptionalAppPhone } from "@/lib/normalizeStoredPhone";

type Companion = {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialization: string[];
  license: string;
  status: "active" | "inactive" | "pending" | "suspended";
  verified: boolean;
  joinedDate: string;
  sessionsCount: number;
  availability: string;
  languages: string[];
};

function parseCommaList(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** ISO / date string → value for `input type="datetime-local"` (local timezone). */
function isoToDateTimeLocal(raw: string | undefined): string {
  if (!raw || raw === "—") return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatAvailabilityDisplay(raw: string): string {
  if (!raw || raw === "—") return "Field not set";
  // Backend sometimes stores structured JSON as a string (e.g. {"note":"...","timezone":"UTC"}).
  // Don’t show raw JSON to admins — treat as not set / placeholder.
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const note = typeof parsed.note === "string" ? parsed.note.trim() : "";
      if (note) return note;
      return "Field not set";
    } catch {
      return "Field not set";
    }
  }
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toLocaleString();
  return "Field not set";
}

const LICENSE_PATTERN = /^[A-Z]{2,10}-\d{3,10}$/;

function formatLicenseInput(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const prefixMatch = cleaned.match(/^[A-Z]+/);
  const prefix = (prefixMatch?.[0] ?? "").slice(0, 10);
  const digits = cleaned
    .slice(prefix.length)
    .replace(/[A-Z]/g, "")
    .slice(0, 10);
  if (!prefix) return digits;
  if (!digits) return prefix;
  return `${prefix}-${digits}`;
}

function isValidOptionalLicense(license: string): boolean {
  const normalized = formatLicenseInput(license.trim());
  if (!normalized) return true;
  return LICENSE_PATTERN.test(normalized);
}

function isValidRequiredLicense(license: string): boolean {
  const normalized = formatLicenseInput(license.trim());
  if (!normalized) return false;
  return LICENSE_PATTERN.test(normalized);
}

const COMPANION_LANGUAGES: { value: string; label: string }[] = [
  { value: "", label: "Select language" },
  { value: "English", label: "English" },
  { value: "Spanish", label: "Spanish" },
  { value: "French", label: "French" },
  { value: "German", label: "German" },
  { value: "Italian", label: "Italian" },
  { value: "Portuguese", label: "Portuguese" },
  { value: "Chinese", label: "Chinese" },
  { value: "Japanese", label: "Japanese" },
  { value: "Korean", label: "Korean" },
  { value: "Arabic", label: "Arabic" },
  { value: "Hindi", label: "Hindi" },
  { value: "Other", label: "Other" },
];

const COMPANION_SPECIALIZATIONS: { value: string; label: string }[] = [
  { value: "", label: "Select specialization" },
  { value: "Anxiety", label: "Anxiety" },
  { value: "Depression", label: "Depression" },
  { value: "Trauma", label: "Trauma" },
  { value: "Stress Management", label: "Stress Management" },
  { value: "Relationship Counseling", label: "Relationship Counseling" },
  { value: "Family Therapy", label: "Family Therapy" },
  { value: "Child & Adolescent Therapy", label: "Child & Adolescent Therapy" },
  { value: "Substance Abuse", label: "Substance Abuse" },
  { value: "Grief Counseling", label: "Grief Counseling" },
  { value: "Other", label: "Other" },
];

export function CompanionManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const companionsFirstLoad = useRef(true);

  const [selectedCompanion, setSelectedCompanion] = useState<Companion | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    phone: "",
    license: "",
    specializations: "",
    language: "",
    availabilityAt: "",
  });

  const [createErrors, setCreateErrors] = useState<Partial<Record<keyof typeof createForm, string>>>({});

  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    license: "",
    specializations: "",
    language: "",
    availabilityAt: "",
    availabilityLegacy: "",
    verified: false,
    account_status: "active",
  });

  const loadCompanions = useCallback(async () => {
    try {
      if (companionsFirstLoad.current) setLoading(true);
      const data = (await api.admin.getCompanions()) as Companion[];
      setCompanions(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load companions");
      setCompanions([]);
    } finally {
      if (companionsFirstLoad.current) {
        setLoading(false);
        companionsFirstLoad.current = false;
      }
    }
  }, []);

  useEffect(() => {
    void loadCompanions();
  }, [loadCompanions]);

  const filteredCompanions = companions.filter((companion) => {
    const matchesSearch =
      companion.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      companion.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      companion.specialization.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = filterStatus === "all" || companion.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700";
      case "inactive":
        return "bg-gray-100 text-gray-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "suspended":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const stats = {
    total: companions.length,
    active: companions.filter((t) => t.status === "active").length,
    pending: companions.filter((t) => t.status === "pending").length,
    totalSessions: companions.reduce((sum, t) => sum + t.sessionsCount, 0),
    verified: companions.filter((t) => t.verified).length,
  };

  const openEdit = (c: Companion) => {
    setSelectedCompanion(c);
    const rawAvail = c.availability === "—" ? "" : c.availability;
    const dtLocal = isoToDateTimeLocal(rawAvail);
    setEditForm({
      name: c.name,
      email: c.email ?? "",
      phone: normalizeStoredPhoneForInput(c.phone || ""),
      license: c.license,
      specializations: c.specialization[0] ?? "",
      language: c.languages[0] ?? "",
      availabilityAt: dtLocal,
      availabilityLegacy: dtLocal ? "" : rawAvail,
      verified: c.verified,
      account_status:
        c.status === "suspended"
          ? "suspended"
          : c.status === "inactive"
            ? "inactive"
            : "active",
    });
    setShowEditModal(true);
  };

  const validateCreate = (form: typeof createForm) => {
    const errors: Partial<Record<keyof typeof createForm, string>> = {};
    if (!form.name.trim()) errors.name = "Full name is required";
    if (!form.email.trim()) errors.email = "Email is required";
    if (!form.license.trim()) errors.license = "License number is required";
    if (form.license.trim() && !isValidRequiredLicense(form.license)) errors.license = "Use format like LCSW-12345";
    if (!form.phone.trim()) {
      errors.phone = "Phone is required";
    } else if (!isValidOptionalAppPhone(form.phone)) {
      errors.phone = "Enter a valid phone with country code and exactly 12 digits";
    }
    if (!form.specializations) errors.specializations = "Select a specialization";
    if (!form.language) errors.language = "Select a language";
    if (!form.availabilityAt.trim()) errors.availabilityAt = "Availability is required";
    return errors;
  };

  const createIsValid = Object.keys(validateCreate(createForm)).length === 0;

  const handleCreate = async () => {
    const errors = validateCreate(createForm);
    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      toast.error("Please fill all required fields");
      return;
    }
    setSaving(true);
    try {
      const availabilityPayload =
        createForm.availabilityAt.trim() !== "" ? new Date(createForm.availabilityAt).toISOString() : undefined;
      const list = (await api.admin.createCompanion({
        full_name: createForm.name.trim(),
        email: createForm.email.trim(),
        phone: createForm.phone.trim(),
        license_number: createForm.license.trim(),
        specializations: parseCommaList(createForm.specializations),
        languages: [createForm.language],
        availability: availabilityPayload!,
      })) as Companion[];
      setCompanions(Array.isArray(list) ? list : companions);
      toast.success("Companion saved. New accounts receive an invite email when needed.");
      setShowCreateModal(false);
      setCreateForm({
        name: "",
        email: "",
        phone: "",
        license: "",
        specializations: "",
        language: "",
        availabilityAt: "",
      });
      setCreateErrors({});
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create companion";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedCompanion) return;
    if (!editForm.name.trim() || !editForm.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (!isValidOptionalLicense(editForm.license)) {
      toast.error("License format must be like LCSW-12345");
      return;
    }
    if (!isValidOptionalAppPhone(editForm.phone)) {
      toast.error("Enter a valid phone with country code and exactly 12 digits, or leave blank");
      return;
    }
    setSaving(true);
    try {
      const availabilityOut =
        editForm.availabilityAt.trim() !== ""
          ? new Date(editForm.availabilityAt).toISOString()
          : editForm.availabilityLegacy.trim() !== ""
            ? editForm.availabilityLegacy.trim()
            : undefined;
      const list = (await api.admin.updateCompanion(selectedCompanion.id, {
        full_name: editForm.name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || undefined,
        license_number: editForm.license.trim() || undefined,
        specializations: parseCommaList(editForm.specializations),
        languages: editForm.language ? [editForm.language] : [],
        availability: availabilityOut,
        is_verified: editForm.verified,
        account_status: editForm.account_status,
      })) as Companion[];
      setCompanions(Array.isArray(list) ? list : companions);
      toast.success("Companion updated");
      setShowEditModal(false);
      setSelectedCompanion(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCompanion) return;
    setSaving(true);
    try {
      const list = (await api.admin.deleteCompanion(selectedCompanion.id)) as Companion[];
      setCompanions(Array.isArray(list) ? list : companions);
      toast.success("Companion profile removed (user account remains)");
      setShowDeleteModal(false);
      setSelectedCompanion(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const joinedLabel = (iso: string) => {
    try {
      return format(new Date(iso), "MMM d, yyyy");
    } catch {
      return iso;
    }
  };

  if (loading && companions.length === 0) {
    return (
      <AdminLayoutNew>
        <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
          <div className="h-10 bg-gray-200 rounded-lg w-80 max-w-full" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-28 bg-gray-100 rounded-2xl" />
            ))}
          </div>
          <div className="h-12 bg-gray-100 rounded-xl" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 bg-gray-100 rounded-2xl" />
            ))}
          </div>
        </div>
      </AdminLayoutNew>
    );
  }

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Companion Management</h1>
            <p className="text-gray-600 mt-1">Licensed companions from your database (companion_profiles)</p>
          </div>

          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center gap-2 shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Add Companion
          </motion.button>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                <UserCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Total</p>
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
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Active</p>
                <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
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
              <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Pending</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Talk it out</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalSessions}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-red-600">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Verified</p>
                <p className="text-2xl font-bold text-gray-900">{stats.verified}</p>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="search"
                placeholder="Search companions by name, email, or specialization..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-6">Companions ({filteredCompanions.length})</h2>

          <div className="space-y-4">
            {filteredCompanions.map((companion, index) => {
              return (
                <motion.div
                  key={companion.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + index * 0.05 }}
                  className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                      {companion.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="font-bold text-gray-900 text-lg">{companion.name}</h3>
                        {companion.verified && (
                          <div className="p-1 rounded-full bg-blue-100">
                            <CheckCircle className="w-4 h-4 text-blue-600" />
                          </div>
                        )}
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(companion.status)}`}>
                          {companion.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Mail className="w-4 h-4 shrink-0" />
                          {companion.email || "Field not set"}
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone className="w-4 h-4 shrink-0" />
                          {companion.phone || "Field not set"}
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <CheckCircle className="w-4 h-4 shrink-0" />
                          {companion.license || "Field not set"}
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="w-4 h-4 shrink-0" />
                          Joined {joinedLabel(companion.joinedDate)}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-3">
                        {companion.specialization.map((spec) => (
                          <span key={spec} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-lg font-medium">
                            {spec}
                          </span>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2 mb-3">
                        {companion.languages.map((lang) => (
                          <span key={lang} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-lg">
                            {lang}
                          </span>
                        ))}
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Talk it out</p>
                          <p className="font-bold text-gray-900">{companion.sessionsCount}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">License</p>
                          <p className="font-bold text-gray-900 text-xs break-words">{companion.license || "—"}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Availability</p>
                          <p className="font-bold text-gray-900 text-xs break-words">
                            {formatAvailabilityDisplay(companion.availability)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          setSelectedCompanion(companion);
                          setShowViewModal(true);
                        }}
                        className="p-2 rounded-lg hover:bg-blue-50 text-blue-600"
                      >
                        <Info className="w-4 h-4" />
                      </motion.button>

                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => openEdit(companion)}
                        className="p-2 rounded-lg hover:bg-green-50 text-green-600"
                      >
                        <Edit className="w-4 h-4" />
                      </motion.button>

                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          setSelectedCompanion(companion);
                          setShowDeleteModal(true);
                        }}
                        className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {filteredCompanions.length === 0 && (
            <div className="text-center py-12">
              <UserCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No companions match your filters</p>
            </div>
          )}
        </motion.div>

        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => !saving && setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] shadow-xl border border-gray-100"
            >
              <div className="flex items-start justify-between gap-4 mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Add New Companion</h3>
                <button
                  type="button"
                  aria-label="Close"
                  disabled={saving}
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                    <input
                      type="text"
                      value={createForm.name}
                      required
                      aria-invalid={Boolean(createErrors.name)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCreateForm((f) => ({ ...f, name: v }));
                        if (createErrors.name) setCreateErrors((p) => ({ ...p, name: undefined }));
                      }}
                      placeholder="Dr. Jane Smith"
                      className={`w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-blue-300 outline-none ${createErrors.name ? "border-red-300" : "border-gray-200"}`}
                    />
                    {createErrors.name ? <p className="text-xs text-red-600 mt-1.5">{createErrors.name}</p> : null}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">License Number</label>
                    <input
                      type="text"
                      value={createForm.license}
                      required
                      aria-invalid={Boolean(createErrors.license)}
                      onChange={(e) => {
                        const v = formatLicenseInput(e.target.value);
                        setCreateForm((f) => ({ ...f, license: v }));
                        if (createErrors.license) setCreateErrors((p) => ({ ...p, license: undefined }));
                      }}
                      pattern="[A-Z]{2,10}-[0-9]{3,10}"
                      title="Use format like LCSW-12345"
                      placeholder="LCSW-12345"
                      className={`w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-blue-300 outline-none ${createErrors.license ? "border-red-300" : "border-gray-200"}`}
                    />
                    {createErrors.license ? <p className="text-xs text-red-600 mt-1.5">{createErrors.license}</p> : null}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={createForm.email}
                      required
                      aria-invalid={Boolean(createErrors.email)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCreateForm((f) => ({ ...f, email: v }));
                        if (createErrors.email) setCreateErrors((p) => ({ ...p, email: undefined }));
                      }}
                      placeholder="companion@example.com"
                      className={`w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-blue-300 outline-none ${createErrors.email ? "border-red-300" : "border-gray-200"}`}
                    />
                    {createErrors.email ? <p className="text-xs text-red-600 mt-1.5">{createErrors.email}</p> : null}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                    <p className="text-xs text-gray-500 mb-1.5">Country code + number (exactly 12 digits total).</p>
                    <PhoneInput
                      value={createForm.phone}
                      onChange={(v) => {
                        setCreateForm((f) => ({ ...f, phone: v }));
                        if (createErrors.phone) setCreateErrors((p) => ({ ...p, phone: undefined }));
                      }}
                      placeholder="Phone number"
                    />
                    {createErrors.phone ? <p className="text-xs text-red-600 mt-1.5">{createErrors.phone}</p> : null}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Specializations</label>
                  <select
                    value={createForm.specializations}
                    required
                    aria-invalid={Boolean(createErrors.specializations)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCreateForm((f) => ({ ...f, specializations: v }));
                      if (createErrors.specializations) setCreateErrors((p) => ({ ...p, specializations: undefined }));
                    }}
                    className={`w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-blue-300 outline-none bg-white ${createErrors.specializations ? "border-red-300" : "border-gray-200"}`}
                  >
                    {COMPANION_SPECIALIZATIONS.map((opt, i) => (
                      <option key={opt.value || `spec-${i}`} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {createErrors.specializations ? (
                    <p className="text-xs text-red-600 mt-1.5">{createErrors.specializations}</p>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Languages</label>
                    <select
                      value={createForm.language}
                      required
                      aria-invalid={Boolean(createErrors.language)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCreateForm((f) => ({ ...f, language: v }));
                        if (createErrors.language) setCreateErrors((p) => ({ ...p, language: undefined }));
                      }}
                      className={`w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-blue-300 outline-none bg-white ${createErrors.language ? "border-red-300" : "border-gray-200"}`}
                    >
                      {COMPANION_LANGUAGES.map((opt, i) => (
                        <option key={opt.value || `lang-${i}`} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {createErrors.language ? <p className="text-xs text-red-600 mt-1.5">{createErrors.language}</p> : null}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
                    <input
                      type="datetime-local"
                      value={createForm.availabilityAt}
                      required
                      aria-invalid={Boolean(createErrors.availabilityAt)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCreateForm((f) => ({ ...f, availabilityAt: v }));
                        if (createErrors.availabilityAt) setCreateErrors((p) => ({ ...p, availabilityAt: undefined }));
                      }}
                      className={`w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-blue-300 outline-none ${createErrors.availabilityAt ? "border-red-300" : "border-gray-200"}`}
                    />
                    {createErrors.availabilityAt ? (
                      <p className="text-xs text-red-600 mt-1.5">{createErrors.availabilityAt}</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={saving}
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium disabled:opacity-50"
                >
                  Cancel
                </motion.button>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={saving || !createIsValid}
                  onClick={() => void handleCreate()}
                  className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Add Companion
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showViewModal && selectedCompanion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => setShowViewModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Companion Details</h3>
              <div className="space-y-3 text-sm">
                <p>
                  <span className="text-gray-600">Name:</span>{" "}
                  <span className="font-medium">{selectedCompanion.name}</span>
                </p>
                <p>
                  <span className="text-gray-600">Email:</span>{" "}
                  <span className="font-medium">{selectedCompanion.email}</span>
                </p>
                <p>
                  <span className="text-gray-600">Phone:</span>{" "}
                  <span className="font-medium">{selectedCompanion.phone || "—"}</span>
                </p>
                <p>
                  <span className="text-gray-600">License:</span>{" "}
                  <span className="font-medium">{selectedCompanion.license || "—"}</span>
                </p>
                <p>
                  <span className="text-gray-600">Status:</span>{" "}
                  <span className="font-medium">{selectedCompanion.status}</span>
                </p>
              </div>
              <div className="flex gap-3 mt-6">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowViewModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                >
                  Close
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showEditModal && selectedCompanion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => !saving && setShowEditModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] shadow-xl border border-gray-100"
            >
              <div className="flex items-start justify-between gap-4 mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Edit Companion</h3>
                <button
                  type="button"
                  aria-label="Close"
                  disabled={saving}
                  onClick={() => setShowEditModal(false)}
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Dr. Jane Smith"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">License Number</label>
                    <input
                      type="text"
                      value={editForm.license}
                      onChange={(e) => setEditForm((f) => ({ ...f, license: formatLicenseInput(e.target.value) }))}
                      pattern="[A-Z]{2,10}-[0-9]{3,10}"
                      title="Use format like LCSW-12345"
                      placeholder="LCSW-12345"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-300 outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="companion@example.com"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone (optional)</label>
                    <p className="text-xs text-gray-500 mb-1.5">Country code + number (exactly 12 digits total).</p>
                    <PhoneInput
                      value={editForm.phone}
                      onChange={(v) => setEditForm((f) => ({ ...f, phone: v }))}
                      placeholder="Phone number"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Specializations</label>
                  <select
                    value={editForm.specializations}
                    onChange={(e) => setEditForm((f) => ({ ...f, specializations: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-300 outline-none bg-white"
                  >
                    {COMPANION_SPECIALIZATIONS.map((opt, i) => (
                      <option key={opt.value || `spec-edit-${i}`} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Languages</label>
                    <select
                      value={editForm.language}
                      onChange={(e) => setEditForm((f) => ({ ...f, language: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-300 outline-none bg-white"
                    >
                      {COMPANION_LANGUAGES.map((opt, i) => (
                        <option key={opt.value || `lang-${i}`} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
                    <input
                      type="datetime-local"
                      value={editForm.availabilityAt}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          availabilityAt: e.target.value,
                          availabilityLegacy: e.target.value ? "" : f.availabilityLegacy,
                        }))
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-300 outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1.5">Date and time for next availability (optional).</p>
                    {editForm.availabilityLegacy ? (
                      <p className="text-xs text-amber-700 mt-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
                        Previously saved as text: {editForm.availabilityLegacy}
                        <br />
                        Set a date above to replace, or save to keep this text.
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="verified"
                    checked={editForm.verified}
                    onChange={(e) => setEditForm((f) => ({ ...f, verified: e.target.checked }))}
                  />
                  <label htmlFor="verified" className="text-sm font-medium text-gray-700">
                    Verified
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account status</label>
                  <select
                    value={editForm.account_status}
                    onChange={(e) => setEditForm((f) => ({ ...f, account_status: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={saving}
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                >
                  Cancel
                </motion.button>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={saving}
                  onClick={() => void handleSaveEdit()}
                  className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium inline-flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showDeleteModal && selectedCompanion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => !saving && setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-lg w-full"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Remove companion profile</h3>
              <p className="text-gray-600">
                Remove the companion profile for <strong>{selectedCompanion.name}</strong>? Their user account stays; only the
                companion record is removed and their role is set back to user.
              </p>
              <div className="flex gap-3 mt-6">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={saving}
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                >
                  Cancel
                </motion.button>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={saving}
                  onClick={() => void handleDelete()}
                  className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-medium inline-flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Remove
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </AdminLayoutNew>
  );
}

