import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Check,
  CheckCircle,
  Heart,
  History,
  RefreshCw,
  Star,
  Users,
  Volume2,
  User,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { DEFAULT_AI_COMPANIONS, matchDefaultCompanionByAvatarName } from "@meetezri/shared";
import {
  companionCardImageUrl,
  effectiveAvatarImageUrlFromDb,
  tryResolveCompanionPortraitUrl,
} from "@/lib/avatar/companionModelUrl";
import { findLobbyAvatar, isPlaceholderAvatarName } from "@/lib/avatar/lobbyAvatars";
import { useAuth } from "@/app/contexts/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/app/components/ui/skeleton";
import {
  CHANGE_AVATAR_HERO_IMG,
  changeAvatarBackLink,
  changeAvatarCompanionCard,
  changeAvatarCompanionCardCurrent,
  changeAvatarCompanionCardSelected,
  changeAvatarGlassCard,
  changeAvatarHeroCard,
  changeAvatarHeroImage,
  changeAvatarHeroOverlayLeft,
  changeAvatarHeroOverlayPurple,
  changeAvatarHeroOverlayWarmth,
  changeAvatarHistoryCard,
  changeAvatarIconChip,
  changeAvatarManageBtn,
  changeAvatarPageAtmosphere,
  changeAvatarPageFogMid,
  changeAvatarPageGlowTop,
  changeAvatarPageSubtitle,
  changeAvatarPageTitle,
  changeAvatarPageVignette,
  changeAvatarPreviewBtn,
  changeAvatarRailCard,
  changeAvatarRailRow,
  changeAvatarSectionHeading,
  changeAvatarSectionLabel,
  changeAvatarSectionSubtitle,
  changeAvatarSwitchCta,
  changeAvatarTagPill,
} from "@/app/pages/app/change-avatar/changeAvatarUi";

interface AIAvatar {
  id: string;
  name: string;
  gender: string;
  ageRange: string;
  personality: string;
  specialty: string[];
  description: string;
  imageUrl?: string;
  voiceType: string;
  accentType: string;
  rating: number;
  totalUsers: number;
}

function mapApiRowToChangeAvatar(row: Record<string, unknown>): AIAvatar {
  const name = String(row.name ?? "").trim();
  const lobby = findLobbyAvatar(name);
  const rawUrl =
    typeof row.image_url === "string"
      ? effectiveAvatarImageUrlFromDb(row.image_url.trim())
      : "";

  const imageUrl = rawUrl
    ? rawUrl
    : tryResolveCompanionPortraitUrl(name) ?? lobby?.cardImage ?? undefined;

  const canon = matchDefaultCompanionByAvatarName(name);
  const dbSpecialties = Array.isArray(row.specialties)
    ? (row.specialties as string[])
    : [];
  const specialty = canon ? [...canon.specialties] : dbSpecialties;
  const description = canon ? canon.description : String(row.description ?? "");
  return {
    id: String(row.id ?? name),
    name,
    gender: String(row.gender ?? ""),
    ageRange: String(row.age_range ?? ""),
    personality: String(row.personality ?? ""),
    specialty,
    description,
    imageUrl,
    voiceType: String(row.voice_type ?? ""),
    accentType: String(row.accent_type ?? ""),
    rating: Number(row.rating) || 0,
    totalUsers: typeof row.unique_users === "number" ? row.unique_users : 0,
  };
}

function fallbackAiAvatarsFromDefaults(): AIAvatar[] {
  return DEFAULT_AI_COMPANIONS.map((c) => ({
    id: c.name,
    name: c.name,
    gender: c.gender,
    ageRange: c.age_range,
    personality: c.personality,
    specialty: [...c.specialties],
    description: c.description,
    imageUrl: companionCardImageUrl(c.portraitPng),
    voiceType: c.voice_type,
    accentType: c.accent_type,
    rating: c.rating,
    totalUsers: 0,
  }));
}

function voiceDemoForGender(gender: string): string {
  const g = gender.trim().toLowerCase();
  if (g === "female") return "voice1female.wav";
  if (g === "male") return "voice2male.wav";
  return "voice3female.wav";
}

interface AvatarPortraitProps {
  imageUrl?: string;
  name: string;
  sizeClass?: string;
  ringClass?: string;
}

const COMPANION_CARD_SKELETON_COUNT = 4;

function ChangeAvatarSkeleton() {
  return (
    <motion.div
      className={changeAvatarPageAtmosphere}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      aria-busy="true"
      aria-label="Loading companions"
    >
      <div className={changeAvatarPageGlowTop} aria-hidden />
      <motion.div className={changeAvatarPageFogMid} aria-hidden />
      <div className={changeAvatarPageVignette} aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-7 sm:py-9">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] xl:gap-7">
          <div className="min-w-0 space-y-6">
            <header>
              <Skeleton className="h-5 w-36 rounded-md bg-white/[0.06]" />
              <Skeleton className="mt-4 h-9 w-64 max-w-full rounded-md bg-white/[0.06]" />
              <Skeleton className="mt-2 h-4 w-80 max-w-full rounded-md bg-white/[0.06]" />
            </header>

            <Skeleton className="min-h-[220px] w-full rounded-[1.75rem] bg-white/[0.06] sm:min-h-[235px] lg:min-h-[250px]" />

            <div>
              <div className="flex items-start gap-3">
                <Skeleton className="h-11 w-11 shrink-0 rounded-xl bg-white/[0.06]" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-7 w-56 rounded-md bg-white/[0.06]" />
                  <Skeleton className="h-4 w-full max-w-md rounded-md bg-white/[0.06]" />
                  <Skeleton className="h-4 w-[80%] max-w-sm rounded-md bg-white/[0.06]" />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
                {Array.from({ length: COMPANION_CARD_SKELETON_COUNT }).map((_, i) => (
                  <div
                    key={i}
                    className="overflow-hidden rounded-[1.625rem] border border-white/[0.07] bg-[linear-gradient(160deg,rgba(18,18,42,0.6)_0%,rgba(10,10,26,0.75)_100%)] p-5 sm:p-6"
                  >
                    <div className="flex items-start gap-4">
                      <Skeleton className="h-[72px] w-[72px] shrink-0 rounded-full bg-white/[0.06]" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-5 w-32 rounded-md bg-white/[0.06]" />
                        <Skeleton className="h-4 w-28 rounded-md bg-white/[0.06]" />
                        <div className="flex gap-3">
                          <Skeleton className="h-3.5 w-12 rounded-md bg-white/[0.06]" />
                          <Skeleton className="h-3.5 w-16 rounded-md bg-white/[0.06]" />
                        </div>
                      </div>
                    </div>
                    <Skeleton className="mt-4 h-3 w-20 rounded-md bg-white/[0.06]" />
                    <Skeleton className="mt-2 h-4 w-full rounded-md bg-white/[0.06]" />
                    <div className="mt-3 flex gap-2">
                      <Skeleton className="h-6 w-24 rounded-full bg-white/[0.06]" />
                      <Skeleton className="h-6 w-20 rounded-full bg-white/[0.06]" />
                    </div>
                    <Skeleton className="mt-3 h-4 w-full rounded-md bg-white/[0.06]" />
                    <Skeleton className="mt-2 h-4 w-[85%] rounded-md bg-white/[0.06]" />
                  </div>
                ))}
              </div>
            </div>

            <footer className="space-y-3 pb-2 pt-2 text-center">
              <Skeleton className="mx-auto h-3 w-72 rounded-md bg-white/[0.06]" />
              <Skeleton className="mx-auto h-4 w-56 rounded-md bg-white/[0.06]" />
              <Skeleton className="mx-auto h-3 w-64 rounded-md bg-white/[0.06]" />
            </footer>
          </div>

          <aside className="w-full shrink-0 space-y-4">
            <div className="rounded-[1.5rem] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(16,16,36,0.6)_0%,rgba(9,9,22,0.75)_100%)] p-5 sm:p-6">
              <Skeleton className="h-3 w-28 rounded-md bg-white/[0.06]" />
              <Skeleton className="mt-3 h-4 w-40 rounded-md bg-white/[0.06]" />
              <Skeleton className="mt-2 h-3 w-full rounded-md bg-white/[0.06]" />
              <ul className="mt-5 space-y-3">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="flex gap-3 rounded-xl border border-white/[0.06] p-3">
                    <Skeleton className="h-9 w-9 shrink-0 rounded-lg bg-white/[0.06]" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-24 rounded-md bg-white/[0.06]" />
                      <Skeleton className="h-3 w-full rounded-md bg-white/[0.06]" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[1.5rem] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(16,16,36,0.6)_0%,rgba(9,9,22,0.75)_100%)] p-5 sm:p-6">
              <Skeleton className="h-3 w-36 rounded-md bg-white/[0.06]" />
              <div className="mt-4 flex flex-col items-center">
                <Skeleton className="h-20 w-20 rounded-full bg-white/[0.06]" />
                <Skeleton className="mt-3 h-5 w-28 rounded-md bg-white/[0.06]" />
                <Skeleton className="mt-2 h-5 w-20 rounded-full bg-white/[0.06]" />
                <div className="mt-3 flex gap-2">
                  <Skeleton className="h-6 w-20 rounded-full bg-white/[0.06]" />
                  <Skeleton className="h-6 w-24 rounded-full bg-white/[0.06]" />
                </div>
                <Skeleton className="mt-3 h-3 w-full rounded-md bg-white/[0.06]" />
                <Skeleton className="mt-4 h-10 w-full rounded-full bg-white/[0.06]" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </motion.div>
  );
}

function AvatarPortrait({ imageUrl, name, sizeClass = "h-20 w-20", ringClass }: AvatarPortraitProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={cn(
          sizeClass,
          "shrink-0 rounded-full object-cover",
          ringClass ?? "ring-2 ring-violet-400/25 shadow-[0_0_28px_-6px_rgba(139,92,246,0.45)]"
        )}
      />
    );
  }
  return (
    <motion.div
      className={cn(
        sizeClass,
        "flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]",
        ringClass
      )}
    >
      <User className="h-1/2 w-1/2 text-white/40" aria-hidden />
    </motion.div>
  );
}

export function ChangeAvatar() {
  const { profile, refreshProfile } = useAuth();
  const [aiAvatars, setAiAvatars] = useState<AIAvatar[]>([]);
  const [avatarsLoading, setAvatarsLoading] = useState(true);
  const [currentAvatarId, setCurrentAvatarId] = useState("");
  const [selectedAvatarId, setSelectedAvatarId] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [switchHistory, setSwitchHistory] = useState<{ date: string; from: string; to: string }[]>([]);
  const [playingVoiceFor, setPlayingVoiceFor] = useState<string | null>(null);
  const voicePreviewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await api.aiAvatars.getAll();
        if (!Array.isArray(rows) || rows.length === 0) {
          if (!cancelled) setAiAvatars(fallbackAiAvatarsFromDefaults());
          return;
        }
        const mapped = rows
          .filter(
            (r: Record<string, unknown>) =>
              r.is_active !== false && typeof r.name === "string" && !isPlaceholderAvatarName(String(r.name))
          )
          .map((r: Record<string, unknown>) => mapApiRowToChangeAvatar(r));
        if (!cancelled) {
          setAiAvatars(mapped.length > 0 ? mapped : fallbackAiAvatarsFromDefaults());
        }
      } catch {
        if (!cancelled) setAiAvatars(fallbackAiAvatarsFromDefaults());
      } finally {
        if (!cancelled) setAvatarsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const avatarIdByName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of aiAvatars) {
      m[a.name.trim().toLowerCase()] = a.id;
    }
    return m;
  }, [aiAvatars]);

  useEffect(() => {
    if (aiAvatars.length === 0) return;
    const selectedFromProfile = (profile?.selected_avatar || aiAvatars[0]?.name || "").trim().toLowerCase();
    const nextAvatarId = avatarIdByName[selectedFromProfile] || aiAvatars[0].id;
    setCurrentAvatarId(nextAvatarId);
    setSelectedAvatarId(nextAvatarId);
  }, [profile?.selected_avatar, avatarIdByName, aiAvatars]);

  const currentAvatar = aiAvatars.find((a) => a.id === currentAvatarId);
  const selectedAvatar = aiAvatars.find((a) => a.id === selectedAvatarId);

  const stopVoicePreview = useCallback(() => {
    const existing = voicePreviewAudioRef.current;
    if (!existing) return;
    existing.pause();
    existing.currentTime = 0;
    voicePreviewAudioRef.current = null;
    setPlayingVoiceFor(null);
  }, []);

  const playVoicePreview = useCallback(
    async (avatar: AIAvatar) => {
      try {
        stopVoicePreview();
        const demoFile = voiceDemoForGender(avatar.gender);
        const base = import.meta.env.BASE_URL.endsWith("/")
          ? import.meta.env.BASE_URL
          : `${import.meta.env.BASE_URL}/`;
        const audio = new Audio(`${base}avatarvoices/${encodeURIComponent(demoFile)}`);
        voicePreviewAudioRef.current = audio;
        setPlayingVoiceFor(avatar.id);
        audio.onended = () => {
          if (voicePreviewAudioRef.current === audio) {
            voicePreviewAudioRef.current = null;
            setPlayingVoiceFor(null);
          }
        };
        audio.onerror = () => {
          if (voicePreviewAudioRef.current === audio) {
            voicePreviewAudioRef.current = null;
            setPlayingVoiceFor(null);
          }
          toast.error("Could not play voice preview");
        };
        await audio.play();
      } catch {
        setPlayingVoiceFor(null);
        toast.error("Could not play voice preview");
      }
    },
    [stopVoicePreview]
  );

  useEffect(() => {
    return () => {
      stopVoicePreview();
    };
  }, [stopVoicePreview]);

  const handleConfirmChange = async () => {
    if (!selectedAvatar || isSaving) return;
    setIsSaving(true);
    try {
      await api.updateProfile({ selected_avatar: selectedAvatar.name });
      await refreshProfile();
      setCurrentAvatarId(selectedAvatarId);
      setSwitchHistory([
        {
          date: new Date().toISOString().split("T")[0],
          from: currentAvatar?.name || "",
          to: selectedAvatar?.name || "",
        },
        ...switchHistory,
      ]);
      setShowConfirmModal(false);
      toast.success(`AI companion changed to ${selectedAvatar.name}`);
    } catch (error) {
      console.error(error);
      toast.error("Could not update AI companion");
    } finally {
      setIsSaving(false);
    }
  };

  if (avatarsLoading) {
    return <ChangeAvatarSkeleton />;
  }

  const canSwitch = selectedAvatarId !== currentAvatarId;

  return (
    <motion.div
      className={changeAvatarPageAtmosphere}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <div className={changeAvatarPageGlowTop} aria-hidden />
      <motion.div className={changeAvatarPageFogMid} aria-hidden />
      <div className={changeAvatarPageVignette} aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-7 sm:py-9">
        <motion.div
          className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] xl:gap-7"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Main column */}
          <div className="min-w-0 space-y-6">
            {/* Header */}
            <header>
              <Link to="/app/settings" className={changeAvatarBackLink}>
                <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                Back to Settings
              </Link>
              <h1 className={cn(changeAvatarPageTitle, "mt-4")}>Change Solace Avatar</h1>
              <p className={changeAvatarPageSubtitle}>
                Switch to a different Avatar for your talks
              </p>
            </header>

            {/* Current avatar hero */}
            {currentAvatar ? (
              <section className={changeAvatarHeroCard}>
                <img src={CHANGE_AVATAR_HERO_IMG} alt="" className={changeAvatarHeroImage} />
                <motion.div className={changeAvatarHeroOverlayLeft} aria-hidden />
                <motion.div className={changeAvatarHeroOverlayPurple} aria-hidden />
                <motion.div className={changeAvatarHeroOverlayWarmth} aria-hidden />

                <div className="relative flex min-h-[220px] flex-col justify-between gap-5 p-5 sm:min-h-[235px] sm:flex-row sm:items-center sm:p-6 lg:min-h-[250px]">
                  <div className="min-w-0 flex-1 space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/25 ring-1 ring-violet-400/35">
                        <Check className="h-3.5 w-3.5 text-violet-200" strokeWidth={3} aria-hidden />
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/80">
                        Current Avatar
                      </span>
                    </div>

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <AvatarPortrait
                        imageUrl={currentAvatar.imageUrl}
                        name={currentAvatar.name}
                        sizeClass="h-[88px] w-[88px] sm:h-24 sm:w-24"
                      />
                      <div className="min-w-0">
                        <h2 className="text-xl font-semibold text-white sm:text-2xl">{currentAvatar.name}</h2>
                        <p className="mt-1 text-sm text-[rgba(255,255,255,0.55)]">
                          {currentAvatar.gender} • {currentAvatar.ageRange} years
                        </p>
                        <p className="mt-2 max-w-lg text-sm leading-relaxed text-[rgba(255,255,255,0.62)]">
                          {currentAvatar.description}
                        </p>
                        {currentAvatar.specialty[0] ? (
                          <div className="mt-3">
                            <span className={changeAvatarTagPill}>{currentAvatar.specialty[0]}</span>
                          </div>
                        ) : null}
                        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[rgba(255,255,255,0.48)]">
                          <span className="inline-flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5" aria-hidden />
                            {currentAvatar.totalUsers.toLocaleString()} users
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Volume2 className="h-3.5 w-3.5" aria-hidden />
                            {currentAvatar.voiceType}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => void playVoicePreview(currentAvatar)}
                    className={changeAvatarPreviewBtn}
                    aria-label={`Preview ${currentAvatar.name}'s voice`}
                  >
                    <Volume2 className="h-4 w-4 text-violet-200/90" aria-hidden />
                    {playingVoiceFor === currentAvatar.id ? "Playing…" : "Preview Voice"}
                  </motion.button>
                </div>
              </section>
            ) : null}

            {/* Choose new avatar */}
            <section>
              <div className="flex items-start gap-3">
                <div className={changeAvatarIconChip("violet")}>
                  <RefreshCw className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h2 className={changeAvatarSectionHeading}>Choose a New Avatar</h2>
                  <p className={changeAvatarSectionSubtitle}>
                    Select a different AI companion that better fits your needs. Your session history
                    will be preserved.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
                {aiAvatars.map((avatar) => {
                  const isCurrent = avatar.id === currentAvatarId;
                  const isSelected = avatar.id === selectedAvatarId;

                  return (
                    <motion.button
                      key={avatar.id}
                      type="button"
                      whileHover={isCurrent ? undefined : { y: -2 }}
                      whileTap={isCurrent ? undefined : { scale: 0.99 }}
                      onClick={() => !isCurrent && setSelectedAvatarId(avatar.id)}
                      disabled={isCurrent}
                      className={cn(
                        changeAvatarCompanionCard,
                        isCurrent && changeAvatarCompanionCardCurrent,
                        isSelected && !isCurrent && changeAvatarCompanionCardSelected
                      )}
                      aria-pressed={isSelected}
                      aria-disabled={isCurrent}
                    >
                      {isCurrent ? (
                        <span className="absolute right-4 top-4 z-10 inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200/95">
                          <CheckCircle className="h-3 w-3" aria-hidden />
                          Current
                        </span>
                      ) : null}

                      {isSelected && !isCurrent ? (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-[0_0_16px_-2px_rgba(192,132,252,0.65)]"
                          aria-hidden
                        >
                          <Check className="h-4 w-4 text-white" strokeWidth={3} />
                        </motion.span>
                      ) : null}

                      <motion.div className="p-5 sm:p-6">
                        <div className="flex items-start gap-4">
                          <AvatarPortrait
                            imageUrl={avatar.imageUrl}
                            name={avatar.name}
                            sizeClass="h-[72px] w-[72px]"
                            ringClass="ring-2 ring-white/10"
                          />
                          <div className="min-w-0 flex-1">
                            <h3 className="text-lg font-semibold text-white">{avatar.name}</h3>
                            <p className="mt-0.5 text-sm text-[rgba(255,255,255,0.48)]">
                              {avatar.gender} • {avatar.ageRange} years
                            </p>
                            <motion.div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[rgba(255,255,255,0.45)]">
                              <span className="inline-flex items-center gap-1">
                                <Users className="h-3.5 w-3.5" aria-hidden />
                                {avatar.totalUsers.toLocaleString()} users
                              </span>
                            </motion.div>
                          </div>
                        </div>

                        <div className="mt-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgba(255,255,255,0.4)]">
                            Personality
                          </p>
                          <p className="mt-1 text-sm text-[rgba(255,255,255,0.62)]">{avatar.personality}</p>
                        </div>

                        {avatar.specialty.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {avatar.specialty.map((spec) => (
                              <span key={spec} className={changeAvatarTagPill}>
                                {spec}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        <p className="mt-3 text-sm leading-relaxed text-[rgba(255,255,255,0.52)]">
                          {avatar.description}
                        </p>

                        <div className="mt-4 border-t border-white/[0.06] pt-3">
                          <div className="flex flex-wrap items-center gap-3 text-xs text-[rgba(255,255,255,0.42)]">
                            <span className="inline-flex items-center gap-1">
                              <Volume2 className="h-3 w-3" aria-hidden />
                              {avatar.voiceType}
                            </span>
                            <span aria-hidden>•</span>
                            <span>{avatar.accentType}</span>
                          </div>
                        </div>
                      </motion.div>
                    </motion.button>
                  );
                })}
              </div>
            </section>

            {/* Switch history */}
            {switchHistory.length > 0 ? (
              <section className={changeAvatarHistoryCard}>
                <div className="flex items-center gap-3">
                  <History className="h-4 w-4 shrink-0 text-violet-300/70" aria-hidden />
                  <motion.div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[rgba(255,255,255,0.4)]">
                      Switch History
                    </p>
                    <p className="mt-1 text-sm text-[rgba(255,255,255,0.72)]">
                      <span className="font-medium text-white">{switchHistory[0].from}</span>
                      {" → "}
                      <span className="font-medium text-white">{switchHistory[0].to}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-[rgba(255,255,255,0.38)]">
                      {new Date(switchHistory[0].date).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </motion.div>
                </div>
              </section>
            ) : null}

            {/* CTA */}
            {canSwitch && selectedAvatar ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center pt-2"
              >
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowConfirmModal(true)}
                  className={changeAvatarSwitchCta}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden />
                  Switch to {selectedAvatar.name}
                </motion.button>
              </motion.div>
            ) : null}

            {/* Footer */}
            <footer className="space-y-3 pb-2 pt-2 text-center">
              <p className="text-xs text-[rgba(255,255,255,0.38)]">
                Your conversations and progress will be safely transferred
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-[rgba(255,255,255,0.42)]">
                <Heart className="h-4 w-4 text-fuchsia-400/70" aria-hidden />
                <span>Made with care for your wellbeing</span>
              </div>
              <p className="text-xs text-[rgba(255,255,255,0.32)]">
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
          </div>

          {/* Right rail */}
          <aside className="w-full shrink-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
            <div className={changeAvatarRailCard}>
              <p className={changeAvatarSectionLabel}>Solace helps you…</p>
              <h2 className="mt-2 text-sm font-semibold text-white">Choose with intention</h2>
              <p className="mt-1 text-xs text-[rgba(255,255,255,0.45)]">
                Your companion shapes how Solace meets you in every session.
              </p>

              <ul className="mt-5 space-y-3">
                {[
                  {
                    icon: Heart,
                    tone: "pink" as const,
                    title: "Connection",
                    description:
                      "Find emotional resonance with someone who understands how you feel.",
                  },
                  {
                    icon: Star,
                    tone: "amber" as const,
                    title: "Needs",
                    description:
                      "Match support to what you are going through right now.",
                  },
                  {
                    icon: RefreshCw,
                    tone: "cyan" as const,
                    title: "Evolution",
                    description:
                      "Grow with a companion who adapts as your journey continues.",
                  },
                ].map((row) => {
                  const Icon = row.icon;
                  return (
                    <li key={row.title} className={changeAvatarRailRow}>
                      <div className={changeAvatarIconChip(row.tone)}>
                        <Icon className="h-4 w-4" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[rgba(255,255,255,0.9)]">{row.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-[rgba(255,255,255,0.45)]">
                          {row.description}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {currentAvatar ? (
              <motion.div className={changeAvatarRailCard}>
                <p className={changeAvatarSectionLabel}>Your current avatar</p>
                <div className="mt-4 flex flex-col items-center text-center">
                  <AvatarPortrait
                    imageUrl={currentAvatar.imageUrl}
                    name={currentAvatar.name}
                    sizeClass="h-20 w-20"
                  />
                  <p className="mt-3 text-lg font-semibold text-white">{currentAvatar.name}</p>
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-emerald-400/28 bg-emerald-500/12 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200/90">
                    <CheckCircle className="h-3 w-3" aria-hidden />
                    Current
                  </span>

                  {currentAvatar.specialty.length > 0 ? (
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      {currentAvatar.specialty.slice(0, 3).map((spec) => (
                        <span key={spec} className={changeAvatarTagPill}>
                          {spec}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <p className="mt-3 text-xs leading-relaxed text-[rgba(255,255,255,0.48)]">
                    {currentAvatar.personality}
                  </p>

                  <Link to="/app/session-lobby" className={changeAvatarManageBtn}>
                    <Sparkles className="mr-1.5 inline h-3.5 w-3.5 text-violet-200/80" aria-hidden />
                    Manage avatar settings
                  </Link>
                </div>
              </motion.div>
            ) : null}
          </aside>
        </motion.div>
      </div>

      {/* Confirmation modal */}
      {showConfirmModal ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#05060f]/80 p-4 backdrop-blur-md"
          onClick={() => setShowConfirmModal(false)}
          role="presentation"
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              changeAvatarGlassCard,
              "w-full max-w-md rounded-[1.75rem] border-violet-400/20 p-6 sm:p-7"
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-avatar-change-title"
          >
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-500/15 ring-1 ring-violet-400/25">
                <AlertCircle className="h-7 w-7 text-violet-300" aria-hidden />
              </div>
              <h3
                id="confirm-avatar-change-title"
                className="text-lg font-semibold text-white"
              >
                Confirm AI Companion Change
              </h3>
              <p className="mt-2 text-sm text-[rgba(255,255,255,0.58)]">
                Are you sure you want to switch from{" "}
                <span className="font-medium text-white">{currentAvatar?.name}</span> to{" "}
                <span className="font-medium text-white">{selectedAvatar?.name}</span>?
              </p>
              <p className="mt-3 text-xs text-[rgba(255,255,255,0.42)]">
                Your session history and progress will be preserved.
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={isSaving}
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 rounded-full border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={isSaving}
                onClick={() => void handleConfirmChange()}
                className={cn(changeAvatarSwitchCta, "w-full flex-1 max-w-none rounded-full py-3 text-sm")}
              >
                {isSaving ? "Saving…" : "Confirm Change"}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </motion.div>
  );
}
