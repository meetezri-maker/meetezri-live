import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  UserCheck,
  Plus,
  Search,
  Mail,
  Phone,
  Calendar,
  Award,
  BarChart3,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
  Clock,
  Loader2,
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
  status: "active" | "inactive" | "pending";
  verified: boolean;
  joinedDate: string;
  sessionsCount: number;
  rating: number;
  availability: string;
  languages: string[];
};

function parseCommaList(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

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
    languages: "",
    availability: "",
  });

  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    license: "",
    specializations: "",
    languages: "",
    availability: "",
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
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const stats = {
    total: companions.length,
    active: companions.filter((t) => t.status === "active").length,
    pending: companions.filter((t) => t.status === "pending").length,
    totalSessions: companions.reduce((sum, t) => sum + t.sessionsCount, 0),
    avgRating:
      companions.filter((t) => t.rating > 0).length > 0
        ? (
            companions.filter((t) => t.rating > 0).reduce((sum, t) => sum + t.rating, 0) /
            companions.filter((t) => t.rating > 0).length
          ).toFixed(1)
        : "0",
  };

  const openEdit = (c: Companion) => {
    setSelectedCompanion(c);
    setEditForm({
      name: c.name,
      phone: normalizeStoredPhoneForInput(c.phone || ""),
      license: c.license,
      specializations: c.specialization.join(", "),
      languages: c.languages.join(", "),
      availability: c.availability === "—" ? "" : c.availability,
      verified: c.verified,
      account_status: c.status === "inactive" ? "inactive" : "active",
    });
    setShowEditModal(true);
  };

  const handleCreate = async () => {
    if (!createForm.name.trim() || !createForm.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (!isValidOptionalAppPhone(createForm.phone)) {
      toast.error("Enter a valid phone with country code (7–12 digits), or leave blank");
      return;
    }
    setSaving(true);
    try {
      const list = (await api.admin.createCompanion({
        full_name: createForm.name.trim(),
        email: createForm.email.trim(),
        phone: createForm.phone.trim() || undefined,
        license_number: createForm.license.trim() || undefined,
        specializations: parseCommaList(createForm.specializations),
        languages: parseCommaList(createForm.languages),
        availability: createForm.availability.trim() || undefined,
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
        languages: "",
        availability: "",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create companion";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedCompanion) return;
    if (!isValidOptionalAppPhone(editForm.phone)) {
      toast.error("Enter a valid phone with country code (7–12 digits), or leave blank");
      return;
    }
    setSaving(true);
    try {
      const list = (await api.admin.updateCompanion(selectedCompanion.id, {
        full_name: editForm.name.trim(),
        phone: editForm.phone.trim() || undefined,
        license_number: editForm.license.trim() || undefined,
        specializations: parseCommaList(editForm.specializations),
        languages: parseCommaList(editForm.languages),
        availability: editForm.availability.trim() || undefined,
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
                <p className="text-gray-600 text-sm">Sessions</p>
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
                <Award className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Avg Rating</p>
                <p className="text-2xl font-bold text-gray-900">{stats.avgRating} ⭐</p>
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
                          {companion.email || "—"}
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone className="w-4 h-4 shrink-0" />
                          {companion.phone || "—"}
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Award className="w-4 h-4 shrink-0" />
                          {companion.license || "—"}
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
                          <p className="text-gray-600">Sessions</p>
                          <p className="font-bold text-gray-900">{companion.sessionsCount}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Rating</p>
                          <p className="font-bold text-gray-900">
                            {companion.rating > 0 ? `${companion.rating.toFixed(1)} ⭐` : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Availability</p>
                          <p className="font-bold text-gray-900 text-xs break-words">{companion.availability}</p>
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
                        <Eye className="w-4 h-4" />
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
              className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Add New Companion</h3>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                    <input
                      type="text"
                      value={createForm.name}
                      onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Dr. Jane Smith"
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">License Number</label>
                    <input
                      type="text"
                      value={createForm.license}
                      onChange={(e) => setCreateForm((f) => ({ ...f, license: e.target.value }))}
                      placeholder="LCSW-12345"
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={createForm.email}
                      onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="companion@example.com"
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone (optional)</label>
                    <p className="text-xs text-muted-foreground mb-1">Country code + number (max 12 digits total).</p>
                    <PhoneInput
                      value={createForm.phone}
                      onChange={(v) => setCreateForm((f) => ({ ...f, phone: v }))}
                      placeholder="Phone number"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Specializations</label>
                  <input
                    type="text"
                    value={createForm.specializations}
                    onChange={(e) => setCreateForm((f) => ({ ...f, specializations: e.target.value }))}
                    placeholder="Anxiety, Depression, Trauma"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Languages</label>
                  <input
                    type="text"
                    value={createForm.languages}
                    onChange={(e) => setCreateForm((f) => ({ ...f, languages: e.target.value }))}
                    placeholder="English, Spanish"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
                  <input
                    type="text"
                    value={createForm.availability}
                    onChange={(e) => setCreateForm((f) => ({ ...f, availability: e.target.value }))}
                    placeholder="Mon–Fri, 9AM–5PM"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
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
                  disabled={saving}
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
              className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
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
              className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Edit Companion</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">License Number</label>
                    <input
                      type="text"
                      value={editForm.license}
                      onChange={(e) => setEditForm((f) => ({ ...f, license: e.target.value }))}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone (optional)</label>
                  <p className="text-xs text-muted-foreground mb-1">Country code + number (max 12 digits total).</p>
                  <PhoneInput
                    value={editForm.phone}
                    onChange={(v) => setEditForm((f) => ({ ...f, phone: v }))}
                    placeholder="Phone number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Specializations (comma-separated)</label>
                  <input
                    type="text"
                    value={editForm.specializations}
                    onChange={(e) => setEditForm((f) => ({ ...f, specializations: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Languages (comma-separated)</label>
                  <input
                    type="text"
                    value={editForm.languages}
                    onChange={(e) => setEditForm((f) => ({ ...f, languages: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
                  <input
                    type="text"
                    value={editForm.availability}
                    onChange={(e) => setEditForm((f) => ({ ...f, availability: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
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
