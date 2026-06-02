import { Button } from "../../components/ui/button";
import { motion } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
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
  Loader2,
  Info,
  ShieldCheck,
  Bell,
  Lock,
  MessageCircle,
  MoreVertical,
  ChevronRight,
  Eye,
  Check,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { queryKeys } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EmergencyContactConsentModal } from "../../components/consent/EmergencyContactConsentModal";
import { Skeleton } from "../../components/ui/skeleton";
import { PhoneInput } from "../../components/ui/phone-input";
import { Checkbox } from "../../components/ui/checkbox";
import { Label } from "../../components/ui/label";
import {
  normalizeStoredPhoneForInput,
  isValidOptionalAppPhone,
} from "@/lib/normalizeStoredPhone";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import {
  EMERGENCY_HERO_IMG,
  EMERGENCY_RAIL_IMG,
  emergencyAboutCard,
  emergencyActionBtn,
  emergencyConsentReviewTrigger,
  emergencyConsentReviewTriggerAgreed,
  emergencyBackLink,
  emergencyBtnPrimary,
  emergencyBtnRose,
  emergencyContactAvatar,
  emergencyContactConsentBadge,
  emergencyContactCard,
  emergencyGlassCard,
  emergencyHeroAccent,
  emergencyHeroIcon,
  emergencyHeroCard,
  emergencyHeroImage,
  emergencyHeroLightScrim,
  emergencyHeroOverlayAccent,
  emergencyHeroOverlayBottom,
  emergencyHeroOverlayReadability,
  emergencyHeroTitle,
  emergencyIconChip,
  emergencyModalBtnCancel,
  emergencyModalBtnDestructive,
  emergencyModalBtnRow,
  emergencyModalEmphasis,
  emergencyModalBtnSave,
  emergencyModalCheckbox,
  emergencyModalCheckboxHelp,
  emergencyModalCheckboxLabel,
  emergencyModalConsentBox,
  emergencyModalEyebrow,
  emergencyModalField,
  emergencyModalFieldHint,
  emergencyModalFormStack,
  emergencyModalHeaderIcon,
  emergencyModalInput,
  emergencyModalLabel,
  emergencyModalOverlayMotion,
  emergencyModalPhoneButton,
  emergencyModalPhoneInput,
  emergencyModalShell,
  emergencyModalSubtitle,
  emergencyModalTitle,
  emergencyPageAtmosphere,
  emergencyPageFogMid,
  emergencyPageGlowTop,
  emergencyPageVignette,
  emergencyAboutTitle,
  emergencyBannerBody,
  emergencyBannerBodyMuted,
  emergencyBannerContent,
  emergencyBannerTitle,
  emergencyBannerTitleLg,
  emergencyFooterFine,
  emergencyFooterMuted,
  emergencyHeroSubtitle,
  emergencyRailBody,
  emergencyRailCard,
  emergencyRailItemTitle,
  emergencyRailTitle,
  emergencyResourcesBanner,
  emergencyResourcesBannerImg,
  emergencyResourcesCta,
  emergencyResourcesOverlayDark,
  emergencySafetyRow,
  emergencyScenicBanner,
  emergencyScenicBannerImage,
  emergencyScenicLightScrim,
  emergencyScenicOverlayDark,
  emergencyScenicOverlayWarm,
} from "@/app/pages/app/emergency-contacts/emergencyContactsUi";

interface EmergencyContact {
  id: string;
  name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  is_trusted: boolean | null;
  created_at: string;
  updated_at: string;
}

function contactHasConsent(contact: EmergencyContact): boolean {
  return contact.is_trusted === true;
}

function contactInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

const SAFETY_GUIDANCE = [
  {
    tone: "pink" as const,
    icon: Heart,
    title: "Keep them informed",
    description: "Let your contacts know they're listed as your emergency contacts.",
  },
  {
    tone: "violet" as const,
    icon: ShieldCheck,
    title: "Share with people you trust",
    description: "Choose someone who knows you and can support you.",
  },
  {
    tone: "amber" as const,
    icon: Bell,
    title: "We'll notify them only",
    description: "If you request help or show signs you need support.",
  },
  {
    tone: "cyan" as const,
    icon: Lock,
    title: "Your privacy matters",
    description: "Your contacts are never notified without your consent.",
  },
];

function EmergencyContactsSkeleton() {
  return (
    <motion.div
      className={emergencyPageAtmosphere}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div className={emergencyPageGlowTop} aria-hidden />
      <motion.div className={emergencyPageFogMid} aria-hidden />
      <motion.div className={emergencyPageVignette} aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-7 sm:py-9">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]">
          <div className="min-w-0 space-y-6">
            <Skeleton className="h-[280px] w-full rounded-[2rem] bg-white/[0.06]" />
            <Skeleton className="h-28 w-full rounded-[1.5rem] bg-white/[0.06]" />
            <div className="space-y-4">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-[1.5rem] bg-white/[0.06]" />
              ))}
            </div>
          </div>
          <motion.div className="space-y-5 xl:col-start-2 xl:row-start-1">
            <Skeleton className="h-80 w-full rounded-3xl bg-white/[0.06]" />
            <Skeleton className="h-52 w-full rounded-3xl bg-white/[0.06]" />
          </motion.div>
          <div className="xl:col-start-1">
            <Skeleton className="h-44 w-full rounded-[1.75rem] bg-white/[0.06]" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function EmergencyContacts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: queryKeys.profile.me(),
    queryFn: () => api.getMe(),
    staleTime: 5 * 60_000,
  });

  const consentMutation = useMutation({
    mutationFn: () => api.updateProfile({ emergency_consent: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.me() });
      setConsentReviewOpen(false);
      toast.success("Your consent has been saved.");
    },
    onError: () => {
      toast.error("Could not save consent. Please try again.");
    },
  });

  const hasPageConsent = profile?.emergency_consent === true;
  const showBlockingConsentModal =
    !profileLoading && !profileError && profile != null && !hasPageConsent;
  const [consentReviewOpen, setConsentReviewOpen] = useState(false);
  const consentModalVariant = showBlockingConsentModal ? "gate" : "review";
  const consentModalOpen = showBlockingConsentModal || consentReviewOpen;

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EmergencyContact | null>(null);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const [emergencyConsentChecked, setEmergencyConsentChecked] = useState(false);
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
      console.error("Failed to load contacts:", error);
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
    setEmergencyConsentChecked(false);
    setShowAddModal(false);
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleAddContact = async () => {
    if (!emergencyConsentChecked) {
      toast.error("Please confirm emergency contact consent before saving");
      return;
    }
    if (!formData.name) {
      toast.error("Name is required");
      return;
    }
    if (!isValidOptionalAppPhone(formData.phone)) {
      toast.error(
        "Enter a valid phone with country code and exactly 12 digits total, or leave blank"
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const newContact = await api.emergencyContacts.create({
        name: formData.name,
        relationship: formData.relationship || undefined,
        phone: formData.phone.trim() || undefined,
        email: formData.email || undefined,
        is_trusted: true,
      });

      setContacts([newContact, ...contacts]);
      toast.success("Contact added successfully");
      resetForm();
    } catch (error) {
      console.error("Failed to add contact:", error);
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
    setEmergencyConsentChecked(contactHasConsent(contact));
    setShowAddModal(true);
  };

  const isConsentLocked =
    (editingContact != null && contactHasConsent(editingContact)) || emergencyConsentChecked;

  const handleUpdateContact = async () => {
    if (!editingContact) return;
    if (!emergencyConsentChecked) {
      toast.error("Please confirm emergency contact consent before saving");
      return;
    }
    if (!formData.name) {
      toast.error("Name is required");
      return;
    }
    if (!isValidOptionalAppPhone(formData.phone)) {
      toast.error(
        "Enter a valid phone with country code and exactly 12 digits total, or leave blank"
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const updatedContact = await api.emergencyContacts.update(editingContact.id, {
        name: formData.name,
        relationship: formData.relationship || undefined,
        phone: formData.phone.trim() || undefined,
        email: formData.email || undefined,
        is_trusted: contactHasConsent(editingContact) || emergencyConsentChecked,
      });

      setContacts(contacts.map((c) => (c.id === editingContact.id ? updatedContact : c)));
      toast.success("Contact updated successfully");
      resetForm();
    } catch (error) {
      console.error("Failed to update contact:", error);
      toast.error("Failed to update contact");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteContact = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    try {
      setDeletingId(id);
      await api.emergencyContacts.delete(id);
      setContacts(contacts.filter((c) => c.id !== id));
      setDeleteTarget(null);
      toast.success("Contact deleted successfully");
    } catch (error) {
      console.error("Failed to delete contact:", error);
      toast.error("Failed to delete contact");
    } finally {
      setDeletingId(null);
    }
  };

  if (profileLoading || isLoading) {
    return <EmergencyContactsSkeleton />;
  }

  if (profileError) {
    return (
      <motion.div
        className={emergencyPageAtmosphere}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="relative z-10 mx-auto flex max-w-lg flex-col items-center justify-center gap-4 px-4 py-20 text-center">
          <AlertCircle className="h-10 w-10 text-rose-300/90" aria-hidden />
          <motion.div>
            <h2 className="text-lg font-semibold text-white">Couldn&apos;t load your profile</h2>
            <p className="mt-1 text-sm text-[rgba(255,255,255,0.48)]">
              We need your profile to check emergency contact consent. Please try again.
            </p>
          </motion.div>
          <Button type="button" onClick={() => void refetchProfile()} className={emergencyBtnPrimary}>
            Retry
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <>
      <EmergencyContactConsentModal
        open={consentModalOpen}
        variant={consentModalVariant}
        alreadyConsented={hasPageConsent}
        onConsent={() => consentMutation.mutate()}
        onCancel={() => {
          if (consentReviewOpen) {
            setConsentReviewOpen(false);
            return;
          }
          navigate("/app/settings");
        }}
        onClose={() => setConsentReviewOpen(false)}
        isSubmitting={consentMutation.isPending}
      />

      <motion.div
        className={emergencyPageAtmosphere}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
      >
        <motion.div className={emergencyPageGlowTop} aria-hidden />
        <motion.div className={emergencyPageFogMid} aria-hidden />
        <motion.div className={emergencyPageVignette} aria-hidden />

        <div
          className={cn(
            "relative z-10 mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-7 sm:py-9",
            showBlockingConsentModal && "pointer-events-none select-none opacity-40",
          )}
          aria-hidden={showBlockingConsentModal}
        >
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]">
            {/* Main column */}
            <motion.div className="min-w-0 space-y-6 xl:col-start-1">
              {/* 1. Cinematic header / hero */}
              <section className={emergencyHeroCard}>
                <img
                  src={EMERGENCY_HERO_IMG}
                  alt=""
                  className={emergencyHeroImage}
                  width={1600}
                  height={900}
                  loading="eager"
                  decoding="async"
                />
                <div className={emergencyHeroLightScrim} aria-hidden />
                <div className={emergencyHeroOverlayReadability} aria-hidden />
                <div className={emergencyHeroOverlayAccent} aria-hidden />
                <div className={emergencyHeroOverlayBottom} aria-hidden />

                <div className="relative z-10 flex min-h-[240px] flex-col justify-between p-6 sm:min-h-[260px] sm:p-8">
                  <div>
                    <button
                      type="button"
                      onClick={() => navigate("/app/settings")}
                      className={emergencyBackLink}
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden />
                      Back to Settings
                    </button>

                    <motion.div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <Heart className={emergencyHeroIcon} strokeWidth={1.5} aria-hidden />
                          <h1 className={emergencyHeroTitle}>
                            Emergency <span className={emergencyHeroAccent}>Contacts</span>
                          </h1>
                        </div>
                        <p className={emergencyHeroSubtitle}>
                          Manage contacts we can notify if you need support
                        </p>
                      </div>

                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={openAddModal}
                        className={cn(emergencyBtnPrimary, "w-full sm:w-auto")}
                      >
                        <Plus className="h-5 w-5" aria-hidden />
                        Add Contact
                      </motion.button>
                    </motion.div>
                  </div>
                </div>
              </section>

              {/* 2. About Emergency Contacts */}
              <section className={emergencyAboutCard}>
                <div className="flex items-start gap-4">
                  <div className={emergencyIconChip("violet")}>
                    <Info className="h-5 w-5" aria-hidden />
                  </div>
                  <motion.div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className={emergencyAboutTitle}>About Emergency Contacts</h2>
                      <button
                        type="button"
                        onClick={() => setConsentReviewOpen(true)}
                        className={cn(
                          hasPageConsent
                            ? emergencyConsentReviewTriggerAgreed
                            : emergencyConsentReviewTrigger,
                        )}
                        aria-label={
                          hasPageConsent
                            ? "View safety consent — you already agreed"
                            : "View emergency contact safety consent"
                        }
                      >
                        <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {hasPageConsent ? (
                          <span>You have provided Consent</span>
                        ) : (
                          <span>Safety Consent</span>
                        )}
                      </button>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-[rgba(255,255,255,0.55)]">
                      These contacts may be notified if you&apos;re in distress or need immediate
                      support. Make sure to inform them that they&apos;re listed as emergency
                      contacts.
                    </p>
                  </motion.div>
                  <ShieldCheck
                    className="hidden h-16 w-16 shrink-0 text-violet-400/15 sm:block"
                    strokeWidth={1.25}
                    aria-hidden
                  />
                </div>
              </section>

              {/* 3. Emergency contacts list */}
              <div className="space-y-4">
                {contacts.map((contact, index) => (
                  <motion.article
                    key={contact.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + index * 0.04 }}
                    className={emergencyContactCard}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      {/* Left: avatar + identity */}
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="relative shrink-0">
                          <motion.div className={emergencyContactAvatar} aria-hidden>
                            {contactInitials(contact.name)}
                          </motion.div>
                          {contactHasConsent(contact) ? (
                            <span
                              className={emergencyContactConsentBadge}
                              title="Consent confirmed for this contact"
                              aria-label="Consent confirmed for this contact"
                            >
                              <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                            </span>
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold text-white">{contact.name}</h3>
                          <p className="mt-0.5 text-sm text-[rgba(255,255,255,0.45)]">
                            {contact.relationship || "Emergency contact"}
                          </p>
                        </div>
                      </div>

                      {/* Center: phone + email */}
                      <div className="min-w-0 flex-1 space-y-2 lg:px-4">
                        {contact.phone ? (
                          <div className="flex items-center gap-2.5 text-sm text-[rgba(255,255,255,0.72)]">
                            <Phone className="h-4 w-4 shrink-0 text-violet-300/60" aria-hidden />
                            <a
                              href={`tel:${contact.phone}`}
                              className="truncate transition-colors hover:text-fuchsia-200/95"
                            >
                              {contact.phone}
                            </a>
                          </div>
                        ) : null}
                        {contact.email ? (
                          <motion.div className="flex items-center gap-2.5 text-sm text-[rgba(255,255,255,0.72)]">
                            <Mail className="h-4 w-4 shrink-0 text-cyan-300/55" aria-hidden />
                            <a
                              href={`mailto:${contact.email}`}
                              className="truncate transition-colors hover:text-fuchsia-200/95"
                            >
                              {contact.email}
                            </a>
                          </motion.div>
                        ) : null}
                      </div>

                      {/* Right: quick actions */}
                      <div className="flex shrink-0 items-center gap-2 self-end lg:self-center">
                        {contact.phone ? (
                          <a
                            href={`tel:${contact.phone}`}
                            className={emergencyActionBtn}
                            aria-label={`Call ${contact.name}`}
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                        ) : null}
                        {contact.email || contact.phone ? (
                          <a
                            href={
                              contact.email
                                ? `mailto:${contact.email}`
                                : `sms:${contact.phone?.replace(/\s/g, "")}`
                            }
                            className={emergencyActionBtn}
                            aria-label={
                              contact.email ? `Email ${contact.name}` : `Message ${contact.name}`
                            }
                          >
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        ) : null}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className={emergencyActionBtn}
                              aria-label={`More options for ${contact.name}`}
                              disabled={deletingId === contact.id}
                            >
                              {deletingId === contact.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreVertical className="h-4 w-4" />
                              )}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="min-w-[10rem] border-white/10 bg-[#12122a] text-white"
                          >
                            <DropdownMenuItem
                              className="cursor-pointer focus:bg-violet-500/15 focus:text-white"
                              onClick={() => handleEditContact(contact)}
                            >
                              <Edit className="h-4 w-4" />
                              Edit contact
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              className="cursor-pointer focus:bg-rose-500/15"
                              onClick={() => setDeleteTarget(contact)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete contact
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </motion.article>
                ))}

                {contacts.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={cn(emergencyGlassCard, "rounded-[1.5rem] px-6 py-14 text-center")}
                  >
                    <Heart
                      className="mx-auto h-14 w-14 text-fuchsia-300/35"
                      strokeWidth={1.25}
                      aria-hidden
                    />
                    <h3 className="mt-4 text-lg font-semibold text-white">
                      No emergency contacts yet
                    </h3>
                    <p className="mx-auto mt-2 max-w-sm text-sm text-[rgba(255,255,255,0.48)]">
                      Add someone you trust.
                    </p>
                    <button type="button" onClick={openAddModal} className={cn(emergencyBtnPrimary, "mt-6")}>
                      <Plus className="h-4 w-4" aria-hidden />
                      Add Contact
                    </button>
                  </motion.div>
                ) : null}
              </div>
            </motion.div>

            {/* Right rail â€” between contacts and helpful resources on mobile */}
            <aside className="space-y-5 xl:col-start-2 xl:row-start-1 xl:row-span-2 xl:sticky xl:top-6 xl:self-start">
              {/* For your safety */}
              <motion.div
                className={emergencyRailCard}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
              >
                <h2 className={emergencyRailTitle}>For your safety</h2>
                <div className="mt-5">
                  {SAFETY_GUIDANCE.map((item) => (
                    <div key={item.title} className={emergencySafetyRow}>
                      <div className={emergencyIconChip(item.tone)}>
                        <item.icon className="h-4 w-4" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <p className={emergencyRailItemTitle}>{item.title}</p>
                        <p className={emergencyRailBody}>{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Need help right now? */}
              <motion.div
                className={emergencyScenicBanner}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
              >
                <img src={EMERGENCY_RAIL_IMG} alt="" className={emergencyScenicBannerImage} />
                <div className={emergencyScenicLightScrim} aria-hidden />
                <div className={emergencyScenicOverlayDark} aria-hidden />
                <div className={emergencyScenicOverlayWarm} aria-hidden />

                <div className={emergencyBannerContent}>
                  <h2 className={emergencyBannerTitle}>Need help right now?</h2>
                  <p className={emergencyBannerBody}>
                    You don&apos;t have to go through this alone.
                  </p>
                  <Link to="/app/emergency-resources" className={cn(emergencyBtnRose, "mt-5")}>
                    View emergency resources
                  </Link>
                </div>
              </motion.div>
            </aside>

            {/* Main column â€” helpful resources + footer */}
            <motion.div className="min-w-0 space-y-6 xl:col-start-1">
            {/* 4. Helpful Resources */}
            <section
              className={emergencyResourcesBanner}
              aria-labelledby="emergency-resources-heading"
            >
              <img src={EMERGENCY_HERO_IMG} alt="" className={emergencyResourcesBannerImg} />
              <div className={emergencyResourcesOverlayDark} aria-hidden />

              <div className={emergencyBannerContent}>
                <div className="flex flex-wrap items-start gap-4">
                  <motion.div
                    className={cn(
                      emergencyIconChip("pink"),
                      "h-12 w-12 [&_svg]:h-5 [&_svg]:w-5"
                    )}
                  >
                    <Phone className="h-5 w-5" aria-hidden />
                  </motion.div>
                  <div className="min-w-0 flex-1">
                    <h2 id="emergency-resources-heading" className={emergencyBannerTitleLg}>
                      Helpful Resources Available 24/7
                    </h2>
                    <p className={emergencyBannerBodyMuted}>
                      Support is always here when you need it.
                    </p>
                  </div>
                </div>

                <Link to="/app/emergency-resources" className={emergencyResourcesCta}>
                  <span>Emergency Resources</span>
                  <ChevronRight
                    className="h-5 w-5 shrink-0 transition group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </div>
            </section>

            {/* 5. Footer */}
            <footer className="pb-2 pt-2 text-center">
              <div className={cn("mb-2 flex items-center justify-center gap-2", emergencyFooterMuted)}>
                <Heart className="h-4 w-4 text-fuchsia-400/70" aria-hidden />
                <span>Made with care for your wellbeing</span>
              </div>
              <p className={emergencyFooterFine}>
                Solace v1.0.0 • © 2026 •{" "}
                <Link to="/privacy" className="underline-offset-2 hover:text-violet-300/80 hover:underline">
                  Privacy
                </Link>{" "}
                •{" "}
                <Link to="/terms" className="underline-offset-2 hover:text-violet-300/80 hover:underline">
                  Terms
                </Link>
              </p>
            </footer>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Delete confirmation modal */}
      {deleteTarget ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!deletingId) setDeleteTarget(null);
            }}
            className={emergencyModalOverlayMotion}
            aria-hidden
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="emergency-contact-delete-title"
            aria-describedby="emergency-contact-delete-desc"
          >
            <div
              className={emergencyModalShell}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-4">
                <div className={cn(emergencyIconChip("rose"), "h-12 w-12 shrink-0 [&_svg]:h-5 [&_svg]:w-5")}>
                  <Trash2 className="h-5 w-5 text-rose-200/95" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={emergencyModalEyebrow}>Remove contact</p>
                  <h2 id="emergency-contact-delete-title" className={emergencyModalTitle}>
                    Delete emergency contact?
                  </h2>
                  <p id="emergency-contact-delete-desc" className={emergencyModalSubtitle}>
                    Are you sure you want to remove{" "}
                    <span className={emergencyModalEmphasis}>{deleteTarget.name}</span> from
                    your emergency contacts? This cannot be undone.
                  </p>
                </div>
              </div>

              <div className={cn(emergencyModalBtnRow, "mt-6")}>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deletingId === deleteTarget.id}
                  className={emergencyModalBtnCancel}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDeleteContact()}
                  disabled={deletingId === deleteTarget.id}
                  className={emergencyModalBtnDestructive}
                >
                  {deletingId === deleteTarget.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : null}
                  Delete contact
                </button>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}

      {/* Add / Edit modal */}
      {showAddModal ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={resetForm}
            className={emergencyModalOverlayMotion}
            aria-hidden
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="emergency-contact-modal-title"
          >
            <div
              className={emergencyModalShell}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-4">
                <div className={emergencyModalHeaderIcon}>
                  <Heart className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={emergencyModalEyebrow}>Trusted contact</p>
                  <h2 id="emergency-contact-modal-title" className={emergencyModalTitle}>
                    {editingContact ? "Edit Emergency Contact" : "Add Emergency Contact"}
                  </h2>
                  <p className={emergencyModalSubtitle}>
                    Add someone you trust who can support you if needed.
                  </p>
                </div>
              </div>

              <div className={cn(emergencyModalFormStack, "mt-6")}>
                <div>
                  <label className={emergencyModalLabel} htmlFor="ec-name">
                    Name *
                  </label>
                  <div className={emergencyModalField}>
                    <User className="h-4 w-4 shrink-0 text-violet-300/50" aria-hidden />
                    <input
                      id="ec-name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Contact name"
                      className={emergencyModalInput}
                    />
                  </div>
                </div>

                <div>
                  <label className={emergencyModalLabel} htmlFor="ec-relationship">
                    Relationship
                  </label>
                  <div className={emergencyModalField}>
                    <Heart className="h-4 w-4 shrink-0 text-fuchsia-300/50" aria-hidden />
                    <input
                      id="ec-relationship"
                      type="text"
                      value={formData.relationship}
                      onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                      placeholder="e.g., Mother, Friend, Companion"
                      className={emergencyModalInput}
                    />
                  </div>
                </div>

                <div>
                  <label className={emergencyModalLabel} htmlFor="ec-phone">
                    Phone number
                  </label>
                  <p className={emergencyModalFieldHint}>
                    Choose country code, then number (exactly 12 digits including code).
                  </p>
                  <PhoneInput
                    value={formData.phone}
                    onChange={(v) => setFormData({ ...formData, phone: v })}
                    placeholder="Phone number"
                    className="w-full"
                    buttonClassName={emergencyModalPhoneButton}
                    inputClassName={emergencyModalPhoneInput}
                  />
                </div>

                <div>
                  <label className={emergencyModalLabel} htmlFor="ec-email">
                    Email (Optional)
                  </label>
                  <div className={emergencyModalField}>
                    <Mail className="h-4 w-4 shrink-0 text-cyan-300/50" aria-hidden />
                    <input
                      id="ec-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="contact@email.com"
                      className={emergencyModalInput}
                    />
                  </div>
                </div>

                <div className={emergencyModalConsentBox}>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="emergency-contact-consent-modal"
                      checked={emergencyConsentChecked}
                      onCheckedChange={(value) => {
                        if (isConsentLocked && value !== true) return;
                        setEmergencyConsentChecked(value === true);
                      }}
                      disabled={isConsentLocked}
                      className={emergencyModalCheckbox}
                      aria-describedby="emergency-contact-consent-modal-desc"
                    />
                    <div className="min-w-0 space-y-1">
                      <Label
                        htmlFor="emergency-contact-consent-modal"
                        className={cn(
                          emergencyModalCheckboxLabel,
                          isConsentLocked && "cursor-default opacity-90",
                        )}
                      >
                        I confirm this person knows they may be contacted only during urgent
                        wellbeing or safety situations.
                      </Label>
                      <p
                        id="emergency-contact-consent-modal-desc"
                        className={emergencyModalCheckboxHelp}
                      >
                        {isConsentLocked
                          ? "Consent is saved for this contact and cannot be removed."
                          : "Required to save changes in this form."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={emergencyModalBtnRow}>
                  <button
                    type="button"
                    onClick={resetForm}
                    className={emergencyModalBtnCancel}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={editingContact ? handleUpdateContact : handleAddContact}
                    className={emergencyModalBtnSave}
                    disabled={!formData.name || isSubmitting || !emergencyConsentChecked}
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                    {editingContact ? "Update Contact" : "Add Contact"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </>
  );
}
