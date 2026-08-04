import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Calendar,
  Check,
  ChevronsUpDown,
  Info,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Target,
  User,
  Users,
  Zap,
} from "lucide-react";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SolaceDateOfBirthPicker, SolaceSelect } from "@/app/solace";
import { FluentEmoji } from "@/components/ui/FluentEmoji";
import { PHONE_INPUT_HELPER_TEXT } from "@meetezri/shared";
import { PhoneInput } from "@/app/components/ui/phone-input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/app/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/app/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { modalPanelLg, modalSecondaryButton } from "@/lib/modalTheme";
import {
  buildProfileFormDefaults,
  buildProfilePatch,
  createProfileEditSchema,
  formatTimezoneOptionLabel,
  getAvailableTimezones,
  goalsOptions,
  hasStoredEmergencyContact,
  pronounsOptions,
  triggersOptions,
  type ProfileEditFormValues,
} from "./profileFormMapping";
import {
  profileBtnPrimary,
  profileCardSubtitle,
  profileChipSelected,
  profileChipUnselected,
  profileDropdownCommand,
  profileDropdownCommandEmpty,
  profileDropdownCommandInput,
  profileDropdownCommandItem,
  profileDropdownCommandList,
  profileDropdownPopover,
  profileEmergencyInput,
  profileEmergencyPhoneButton,
  profileEmergencyPhoneInput,
  profileFieldLabel,
  profileFormLabel,
  profileIconAmberMd,
  profileIconCircle,
  profileIconEmeraldMd,
  profileIconVioletMd,
  profileInput,
  profilePhoneButton,
  profilePhoneInput,
} from "./profileUi";

const HERO_TRIGGER_ID = "profile-edit-trigger";

interface ProfileEditModalProps {
  open: boolean;
  profile: any;
  authEmail?: string | null;
  /** Optional form key to focus when the modal opens (used by the "Complete now" banner). */
  initialFocusField?: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (updatedProfile: any) => Promise<void> | void;
}

function SectionHeading({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className={profileIconCircle("violet")}>{icon}</span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-zinc-100 [html[data-ezri-theme=light]_&]:text-[var(--text-primary)] [html[data-theme=light]_&]:text-[var(--text-primary)]">
          {title}
        </h3>
        <p className={profileCardSubtitle}>{description}</p>
      </div>
    </div>
  );
}

export function ProfileEditModal({
  open,
  profile,
  authEmail,
  initialFocusField,
  onOpenChange,
  onSaved,
}: ProfileEditModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const savingRef = useRef(false);

  const availableTimezones = useMemo(() => getAvailableTimezones(), []);
  // The modal is mounted only while open, so defaults are computed once per opening. That is
  // what keeps reopening free of stale values without any reset effect.
  const defaults = useMemo(
    () => buildProfileFormDefaults(profile, authEmail),
    [profile, authEmail]
  );
  const storedContact = useMemo(() => hasStoredEmergencyContact(profile), [profile]);
  const schema = useMemo(
    () => createProfileEditSchema({ hasStoredEmergencyContact: storedContact }),
    [storedContact]
  );

  const form = useForm<ProfileEditFormValues>({
    resolver: zodResolver(schema as any),
    defaultValues: {
      firstName: defaults.firstName,
      lastName: defaults.lastName,
      birthday: defaults.birthday,
      pronouns: defaults.pronouns,
      timezone: defaults.timezone,
      phone: defaults.phone,
      in_therapy: defaults.in_therapy,
      selected_goals: defaults.selected_goals,
      selected_triggers: defaults.selected_triggers,
      emergency_contact_name: defaults.emergency_contact_name,
      emergency_contact_relationship: defaults.emergency_contact_relationship,
      emergency_contact_phone: defaults.emergency_contact_phone,
      emergency_consent: defaults.emergency_consent,
    },
  });

  // RHF wraps `formState` in a render-tracking Proxy: a property only stays current if it is
  // read during render. These two are read exclusively inside handlers, so subscribe here.
  const { isDirty } = form.formState;
  void form.formState.dirtyFields;

  const restoreFocusToTrigger = () => {
    const trigger = document.getElementById(HERO_TRIGGER_ID);
    if (trigger instanceof HTMLElement) trigger.focus();
  };

  /** Every close path funnels through here: X, Escape, outside click, and Cancel. */
  const requestClose = (next: boolean) => {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (savingRef.current || isSaving) return;
    if (isDirty) {
      setDiscardOpen(true);
      return;
    }
    onOpenChange(false);
  };

  /** Radix closes on Escape/outside-click by default; block while saving or when dirty. */
  const blockCloseWhileBusy = (event: Event) => {
    if (savingRef.current || isSaving || isDirty) {
      event.preventDefault();
    }
  };

  const confirmDiscard = () => {
    form.reset();
    setDiscardOpen(false);
    onOpenChange(false);
  };

  const onSubmit = async (values: ProfileEditFormValues) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);

    try {
      const patch = buildProfilePatch(values, defaults, form.formState.dirtyFields as any);

      if (!Object.keys(patch).length) {
        toast.success("No changes to save");
        onOpenChange(false);
        return;
      }

      const updated = await api.updateProfile(patch);
      // The parent refreshes local + AuthContext state BEFORE the modal unmounts, so the
      // sidebar behind the overlay is already current when it disappears.
      await onSaved(updated);
      toast.success("Profile updated!");
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      const isAgeError =
        /must be at least\s*18/i.test(message) || /18\+/i.test(message) || /18\s*years/i.test(message);

      if (isAgeError) {
        form.setError("birthday", { type: "manual", message });
      } else if (/emergency contact/i.test(message)) {
        form.setError("emergency_contact_name", { type: "manual", message });
      }
      // The modal stays open and every entered value is preserved.
      toast.error(message || "Failed to update profile");
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const pronounsValue = form.watch("pronouns") || "";
  const isKnownPronoun = pronounsOptions.includes(pronounsValue.toLowerCase());

  return (
    <>
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent
          aria-label="Edit profile"
          className={cn(
            modalPanelLg,
            "flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
          )}
          onEscapeKeyDown={blockCloseWhileBusy}
          onPointerDownOutside={blockCloseWhileBusy}
          onInteractOutside={blockCloseWhileBusy}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreFocusToTrigger();
          }}
          onOpenAutoFocus={(event) => {
            if (!initialFocusField) return;
            event.preventDefault();
            const target = document.getElementById(`profile-edit-field-${initialFocusField}`);
            if (target instanceof HTMLElement) target.focus();
          }}
        >
          <DialogHeader className="border-b border-white/[0.08] px-5 py-4 sm:px-6 sm:py-5">
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>
              Update your personal, wellness, and emergency contact details.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
              {/* Only this region scrolls, so the footer actions stay reachable on short viewports. */}
              <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-5 py-5 sm:px-6">
                {/* ── Section 1: Personal information ── */}
                <section className="space-y-4">
                  <SectionHeading
                    icon={<User className="h-4 w-4" />}
                    title="Personal information"
                    description="Your details and preferences"
                  />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={profileFormLabel}>First name</FormLabel>
                          <FormControl>
                            <input
                              {...field}
                              id="profile-edit-field-name"
                              disabled={isSaving}
                              placeholder="First name"
                              className={profileInput}
                            />
                          </FormControl>
                          <FormMessage className="mt-1 text-xs" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={profileFormLabel}>Last name</FormLabel>
                          <FormControl>
                            <input
                              {...field}
                              value={field.value ?? ""}
                              disabled={isSaving}
                              placeholder="Last name"
                              className={profileInput}
                            />
                          </FormControl>
                          <FormMessage className="mt-1 text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Email is display-only: not an RHF field, so it can never become dirty or
                      reach the payload. */}
                  <div className="space-y-1.5">
                    <p className={cn("flex items-center gap-2", profileFormLabel)}>
                      <Mail className="h-3.5 w-3.5" /> Email
                    </p>
                    <input
                      readOnly
                      disabled
                      aria-readonly="true"
                      aria-label="Email"
                      value={defaults.emailDisplay}
                      className={cn(profileInput, "cursor-not-allowed opacity-70")}
                    />
                    <p className="text-xs text-zinc-400 [html[data-ezri-theme=light]_&]:text-[var(--text-secondary)] [html[data-theme=light]_&]:text-[var(--text-secondary)]">
                      Email is managed by your account and cannot be changed here. Contact support
                      to update it.
                    </p>
                  </div>

                  <FormField
                    control={form.control}
                    name="birthday"
                    render={({ field, fieldState }) => (
                      <FormItem id="profile-edit-field-birthday">
                        <FormLabel className={cn("flex items-center gap-2", profileFormLabel)}>
                          <Calendar className="h-3.5 w-3.5" /> Date of birth
                        </FormLabel>
                        <SolaceDateOfBirthPicker
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          disabled={isSaving}
                          minAgeYears={18}
                          externalError={fieldState.error?.message}
                          showLabelIcon={false}
                          showAgeHint
                          placeholder="MM/DD/YYYY"
                          triggerClassName={cn(profileInput, "pr-10 text-sm")}
                          className="w-full"
                        />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pronouns"
                    render={({ field }) => (
                      <FormItem id="profile-edit-field-pronouns">
                        <FormLabel className={profileFormLabel}>Pronouns</FormLabel>
                        <div className="space-y-2">
                          <SolaceSelect
                            value={isKnownPronoun ? pronounsValue.toLowerCase() : "__custom__"}
                            onValueChange={(v) => field.onChange(v === "__custom__" ? "" : v)}
                            disabled={isSaving}
                            ariaLabel="Pronouns"
                            placeholder="Select pronouns"
                            variant="form"
                            options={[
                              ...pronounsOptions.map((option) => ({ value: option, label: option })),
                              { value: "__custom__", label: "Other (custom)" },
                            ]}
                          />
                          {!isKnownPronoun && (
                            <input
                              value={field.value || ""}
                              disabled={isSaving}
                              placeholder="Type custom pronouns"
                              onChange={(e) => field.onChange(e.target.value)}
                              className={profileInput}
                            />
                          )}
                        </div>
                        <FormMessage className="mt-1 text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="timezone"
                    render={({ field }) => (
                      <FormItem id="profile-edit-field-timezone">
                        <FormLabel className={cn("flex items-center gap-2", profileFormLabel)}>
                          <MapPin className="h-3.5 w-3.5" /> Timezone
                        </FormLabel>
                        <Popover open={timezoneOpen} onOpenChange={setTimezoneOpen}>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              disabled={isSaving}
                              className={cn(profileInput, "flex items-center justify-between")}
                            >
                              <span className="truncate text-left">
                                {field.value
                                  ? formatTimezoneOptionLabel(field.value)
                                  : "Select timezone"}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            className={cn(profileDropdownPopover, "w-[--radix-popover-trigger-width]")}
                            side="bottom"
                            align="start"
                            sideOffset={8}
                            avoidCollisions
                            collisionPadding={16}
                          >
                            <Command className={profileDropdownCommand}>
                              <CommandInput
                                placeholder="Search timezone…"
                                className={profileDropdownCommandInput}
                              />
                              <CommandList className={profileDropdownCommandList}>
                                <CommandEmpty className={profileDropdownCommandEmpty}>
                                  No timezone found.
                                </CommandEmpty>
                                <CommandGroup>
                                  {availableTimezones.map((timezone) => (
                                    <CommandItem
                                      key={timezone}
                                      className={profileDropdownCommandItem}
                                      value={`${timezone} ${formatTimezoneOptionLabel(timezone)}`}
                                      onSelect={() => {
                                        field.onChange(timezone);
                                        setTimezoneOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={`h-4 w-4 ${
                                          field.value === timezone ? "opacity-100" : "opacity-0"
                                        }`}
                                      />
                                      <span className="truncate">
                                        {formatTimezoneOptionLabel(timezone)}
                                      </span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage className="mt-1 text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem id="profile-edit-field-phone">
                        <FormLabel className={cn("flex items-center gap-2", profileFieldLabel)}>
                          <Phone className="h-3.5 w-3.5" /> Phone{" "}
                          <span className="font-normal opacity-60">(optional)</span>
                        </FormLabel>
                        <p className="mb-2 text-xs opacity-60">{PHONE_INPUT_HELPER_TEXT}</p>
                        <PhoneInput
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          disabled={isSaving}
                          placeholder="Phone number"
                          className="w-full min-w-0"
                          buttonClassName={profilePhoneButton}
                          inputClassName={profilePhoneInput}
                          popoverClassName={profileDropdownPopover}
                          commandClassName={profileDropdownCommand}
                          commandInputClassName={profileDropdownCommandInput}
                          commandListClassName={profileDropdownCommandList}
                          commandItemClassName={profileDropdownCommandItem}
                          commandEmptyClassName={profileDropdownCommandEmpty}
                        />
                        <FormMessage className="mt-1 text-xs" />
                      </FormItem>
                    )}
                  />
                </section>

                {/* ── Section 2: Wellness information ── */}
                <section className="space-y-4 border-t border-white/[0.06] pt-6">
                  <SectionHeading
                    icon={<Users className="h-4 w-4" />}
                    title="Wellness information"
                    description="Your current wellness overview"
                  />

                  <FormField
                    control={form.control}
                    name="in_therapy"
                    render={({ field }) => (
                      <FormItem id="profile-edit-field-in_therapy">
                        <div className="mb-2 flex items-center gap-2">
                          <Users className={profileIconVioletMd} />
                          <FormLabel className={profileFormLabel}>Are you currently working with a therapist?</FormLabel>
                        </div>
                        <FormControl>
                          <SolaceSelect
                            value={field.value || "__unset__"}
                            onValueChange={(v) => field.onChange(v === "__unset__" ? "" : v)}
                            disabled={isSaving}
                            ariaLabel="Therapist"
                            placeholder="Select…"
                            variant="form"
                            options={[
                              { value: "Yes", label: "Yes" },
                              { value: "No", label: "No" },
                              { value: "Prefer not to say", label: "Prefer not to say" },
                            ]}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="selected_goals"
                    render={({ field }) => (
                      <FormItem id="profile-edit-field-selected_goals">
                        <div className="mb-2 flex items-center gap-2">
                          <Target className={profileIconEmeraldMd} />
                          <FormLabel className={profileFormLabel}>Wellness goals</FormLabel>
                        </div>
                        <FormControl>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {goalsOptions.map((g) => {
                              const selected = (field.value || []).includes(g.value);
                              return (
                                <button
                                  key={g.value}
                                  type="button"
                                  disabled={isSaving}
                                  aria-pressed={selected}
                                  onClick={() =>
                                    field.onChange(
                                      selected
                                        ? (field.value || []).filter((v: string) => v !== g.value)
                                        : [...(field.value || []), g.value]
                                    )
                                  }
                                  className={cn(
                                    "flex items-center gap-2 text-left transition-all",
                                    selected ? profileChipSelected("emerald") : profileChipUnselected
                                  )}
                                >
                                  <FluentEmoji emoji={g.emoji} size={16} className="shrink-0" />{" "}
                                  {g.label}
                                </button>
                              );
                            })}
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="selected_triggers"
                    render={({ field }) => (
                      <FormItem id="profile-edit-field-selected_triggers">
                        <div className="mb-2 flex items-center gap-2">
                          <Zap className={profileIconAmberMd} />
                          <FormLabel className={profileFormLabel}>Challenges</FormLabel>
                        </div>
                        <FormControl>
                          <div className="grid grid-cols-2 gap-2">
                            {triggersOptions.map((t) => {
                              const selected = (field.value || []).includes(t.value);
                              return (
                                <button
                                  key={t.value}
                                  type="button"
                                  disabled={isSaving}
                                  aria-pressed={selected}
                                  onClick={() =>
                                    field.onChange(
                                      selected
                                        ? (field.value || []).filter((v: string) => v !== t.value)
                                        : [...(field.value || []), t.value]
                                    )
                                  }
                                  className={cn(
                                    "px-2.5 py-2 text-left transition-all",
                                    selected ? profileChipSelected("amber") : profileChipUnselected
                                  )}
                                >
                                  {t.label}
                                </button>
                              );
                            })}
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </section>

                {/* ── Section 3: Emergency contact ── */}
                <section className="space-y-4 border-t border-white/[0.06] pt-6">
                  <SectionHeading
                    icon={<Phone className="h-4 w-4" />}
                    title="Emergency contact"
                    description="Trusted person we can reach if needed"
                  />

                  <p className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-xs opacity-80">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    We only use this contact during serious safety concerns, such as when we cannot
                    reach you in a high-risk wellbeing event. It is never used for marketing or
                    regular app notifications.
                  </p>

                  <FormField
                    control={form.control}
                    name="emergency_contact_name"
                    render={({ field }) => (
                      <FormItem id="profile-edit-field-emergency_contact_name">
                        <FormLabel className={profileFormLabel}>Name</FormLabel>
                        <FormControl>
                          <input
                            {...field}
                            value={field.value ?? ""}
                            disabled={isSaving}
                            placeholder="Contact name"
                            className={profileEmergencyInput}
                          />
                        </FormControl>
                        <FormMessage className="mt-1 text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="emergency_contact_relationship"
                    render={({ field }) => (
                      <FormItem id="profile-edit-field-emergency_contact_relationship">
                        <FormLabel className={profileFormLabel}>Relationship</FormLabel>
                        <FormControl>
                          <input
                            {...field}
                            value={field.value ?? ""}
                            disabled={isSaving}
                            placeholder="e.g. Parent"
                            className={profileEmergencyInput}
                          />
                        </FormControl>
                        <FormMessage className="mt-1 text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="emergency_contact_phone"
                    render={({ field }) => (
                      <FormItem id="profile-edit-field-emergency_contact_phone">
                        <FormLabel className={profileFormLabel}>Phone</FormLabel>
                        <p className="mb-2 text-xs opacity-60">{PHONE_INPUT_HELPER_TEXT}</p>
                        <PhoneInput
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          disabled={isSaving}
                          placeholder="Contact phone"
                          className="w-full min-w-0"
                          buttonClassName={profileEmergencyPhoneButton}
                          inputClassName={profileEmergencyPhoneInput}
                          popoverClassName={profileDropdownPopover}
                          commandClassName={profileDropdownCommand}
                          commandInputClassName={profileDropdownCommandInput}
                          commandListClassName={profileDropdownCommandList}
                          commandItemClassName={profileDropdownCommandItem}
                          commandEmptyClassName={profileDropdownCommandEmpty}
                        />
                        <FormMessage className="mt-1 text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="emergency_consent"
                    render={({ field }) => (
                      <FormItem id="profile-edit-field-emergency_consent">
                        <div className="rounded-xl border border-rose-400/20 bg-rose-500/[0.08] px-3 py-2.5">
                          <label className="flex cursor-pointer items-start gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={field.value === true}
                              disabled={isSaving}
                              onChange={(e) => field.onChange(e.target.checked)}
                              className="mt-0.5 h-4 w-4 rounded border-zinc-600 text-rose-500 focus:ring-rose-400"
                            />
                            <span>
                              I confirm this person knows they may be contacted only during urgent
                              wellbeing or safety situations.
                            </span>
                          </label>
                        </div>
                        <FormMessage className="mt-1 text-xs" />
                      </FormItem>
                    )}
                  />
                </section>
              </div>

              <div className="flex flex-col gap-2 border-t border-white/[0.08] bg-black/20 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                <button
                  type="button"
                  onClick={() => requestClose(false)}
                  disabled={isSaving}
                  className={cn(modalSecondaryButton, "sm:flex-none")}
                >
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className={profileBtnPrimary}>
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSaving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your edits have not been saved. Discarding will restore your previous details.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={modalSecondaryButton}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDiscard} className={profileBtnPrimary}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
