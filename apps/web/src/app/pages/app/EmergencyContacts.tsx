import { AppLayout } from "../../components/AppLayout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import {
  Heart,
  Plus,
  Phone,
  Mail,
  User,
  Edit,
  Trash2,
  ArrowLeft,
  AlertCircle,
  Loader2
} from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "../../../lib/api";
import { toast } from "sonner";
import { Skeleton } from "../../components/ui/skeleton";
import { PhoneInput } from "../../components/ui/phone-input";
import {
  normalizeStoredPhoneForInput,
  isValidOptionalAppPhone,
} from "@/lib/normalizeStoredPhone";

interface EmergencyContact {
  id: string;
  name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  is_trusted: boolean;
  created_at: string;
  updated_at: string;
}

export function EmergencyContacts() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    relationship: "",
    phone: "",
    email: "",
  });

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      setIsLoading(true);
      const data = await api.emergencyContacts.getAll();
      setContacts(data);
    } catch (error) {
      console.error('Failed to load contacts:', error);
      toast.error("Failed to load emergency contacts");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ 
      name: "", 
      relationship: "", 
      phone: "", 
      email: "",
    });
    setEditingContact(null);
    setShowAddModal(false);
  };

  const handleAddContact = async () => {
    if (!formData.name) {
      toast.error("Name is required");
      return;
    }
    if (!isValidOptionalAppPhone(formData.phone)) {
      toast.error("Enter a valid phone with country code (7–12 digits total), or leave blank");
      return;
    }

    try {
      setIsSubmitting(true);
      const newContact = await api.emergencyContacts.create({
        name: formData.name,
        relationship: formData.relationship || undefined,
        phone: formData.phone.trim() || undefined,
        email: formData.email || undefined,
        is_trusted: true
      });
      
      setContacts([newContact, ...contacts]);
      toast.success("Contact added successfully");
      resetForm();
    } catch (error) {
      console.error('Failed to add contact:', error);
      toast.error("Failed to add contact");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditContact = (contact: EmergencyContact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      relationship: contact.relationship || "",
      phone: normalizeStoredPhoneForInput(contact.phone || ""),
      email: contact.email || "",
    });
    setShowAddModal(true);
  };

  const handleUpdateContact = async () => {
    if (!editingContact) return;
    if (!formData.name) {
      toast.error("Name is required");
      return;
    }
    if (!isValidOptionalAppPhone(formData.phone)) {
      toast.error("Enter a valid phone with country code (7–12 digits total), or leave blank");
      return;
    }

    try {
      setIsSubmitting(true);
      const updatedContact = await api.emergencyContacts.update(editingContact.id, {
        name: formData.name,
        relationship: formData.relationship || undefined,
        phone: formData.phone.trim() || undefined,
        email: formData.email || undefined,
        is_trusted: true
      });

      setContacts(contacts.map(c => c.id === editingContact.id ? updatedContact : c));
      toast.success("Contact updated successfully");
      resetForm();
    } catch (error) {
      console.error('Failed to update contact:', error);
      toast.error("Failed to update contact");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (confirm("Are you sure you want to delete this emergency contact?")) {
      try {
        setDeletingId(id);
        await api.emergencyContacts.delete(id);
        setContacts(contacts.filter(c => c.id !== id));
        toast.success("Contact deleted successfully");
      } catch (error) {
        console.error('Failed to delete contact:', error);
        toast.error("Failed to delete contact");
      } finally {
        setDeletingId(null);
      }
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <div className="mb-8">
            <Skeleton className="h-4 w-24 mb-4" />
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-80" />
              </div>
              <Skeleton className="h-10 w-32 rounded-lg" />
            </div>
          </div>
          <div className="space-y-4 mb-6">
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="w-5 h-5 rounded-full mt-1" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </Card>
          </div>
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <Skeleton className="w-10 h-10 rounded-full" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Heart className="w-8 h-8 text-primary" />
                <h1 className="text-3xl font-bold">Emergency Contacts</h1>
              </div>
              <p className="text-muted-foreground">
                Manage contacts we can notify if you need support
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
              className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 text-white rounded-lg shadow-lg hover:shadow-xl transition-shadow"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Add Contact</span>
            </motion.button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 space-y-4"
        >
          <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">About Emergency Contacts</h3>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  These contacts may be notified if you're in crisis or need immediate support. Make sure to inform them that they're listed as emergency contacts.
                </p>
              </div>
            </div>
          </Card>

        </motion.div>

        {/* Contacts List */}
        <div className="space-y-4">
          {contacts.map((contact, index) => (
            <motion.div
              key={contact.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.05 }}
            >
              <Card className="p-6 shadow-lg hover:shadow-xl transition-all group dark:bg-gray-800">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center text-white text-xl font-bold">
                        {contact.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-lg">{contact.name}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">{contact.relationship}</p>
                      </div>
                    </div>
                    <div className="space-y-2 ml-15">
                      {contact.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <a href={`tel:${contact.phone}`} className="hover:text-primary transition-colors">
                            {contact.phone}
                          </a>
                        </div>
                      )}
                      {contact.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <a href={`mailto:${contact.email}`} className="hover:text-primary transition-colors">
                            {contact.email}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {/* Edit/Delete Actions */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleEditContact(contact)}
                        disabled={deletingId === contact.id}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4 text-gray-600" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDeleteContact(contact.id)}
                        disabled={deletingId === contact.id}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        {deletingId === contact.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-red-500" />
                        )}
                      </motion.button>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {contacts.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="font-bold text-lg mb-2">No Emergency Contacts Yet</h3>
            <p className="text-muted-foreground mb-4">Add emergency contacts who can support you in crisis situations</p>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Contact
            </Button>
          </motion.div>
        )}

        {/* Add/Edit Modal */}
        {showAddModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={resetForm}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg z-50"
            >
              <Card className="p-6 shadow-2xl">
                <h2 className="text-2xl font-bold mb-6">
                  {editingContact ? "Edit Contact" : "Add Emergency Contact"}
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Name *</label>
                    <div className="flex items-center gap-2 p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                      <User className="w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Contact name"
                        className="flex-1 outline-none bg-transparent dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Relationship</label>
                    <div className="flex items-center gap-2 p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                      <Heart className="w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={formData.relationship}
                        onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                        placeholder="e.g., Mother, Friend, Companion"
                        className="flex-1 outline-none bg-transparent dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
                      Phone number
                    </label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Choose country code, then number (max 12 digits including code).
                    </p>
                    <PhoneInput
                      value={formData.phone}
                      onChange={(v) => setFormData({ ...formData, phone: v })}
                      placeholder="Phone number"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Email (Optional)</label>
                    <div className="flex items-center gap-2 p-3 border border-gray-300 rounded-lg">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="contact@email.com"
                        className="flex-1 outline-none bg-transparent"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={resetForm}
                      variant="outline"
                      className="flex-1"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={editingContact ? handleUpdateContact : handleAddContact}
                      className="flex-1"
                      disabled={!formData.name || isSubmitting}
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      {editingContact ? "Update Contact" : "Add Contact"}
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
