import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, BookOpen, Clock, ExternalLink, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { WELLNESS_BUILTIN_TOOLS_ADMIN } from "@/lib/wellnessBuiltinToolsMetadata";
import { getBuiltinArticleBody } from "@/lib/resourcesArticleBodies";
import {
  formatStepDurationSeconds,
  parseGuidedPayloadFromContentUrl,
  type GuidedWellnessPayload,
} from "@/lib/parseGuidedWellnessContentUrl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  formatCategoryLabel,
  getResourceCardAtmosphere,
  resourcesArticleBodyText,
  resourcesArticleShell,
  resourcesArticleStepNumber,
  resourcesArticleStepShell,
  resourcesArticleTitle,
  resourcesBackLink,
  resourcesPageAtmosphere,
  resourcesPageFogMid,
  resourcesPageGlowTop,
  resourcesPageVignette,
  resourcesReadBtn,
} from "@/app/pages/app/resources-library/resourcesLibraryUi";

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function ResourceArticlePage() {
  const { articleId: rawParam } = useParams<{ articleId: string }>();
  const navigate = useNavigate();
  const articleId = useMemo(() => (rawParam ? decodeURIComponent(rawParam) : ""), [rawParam]);

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState<string | null>(null);
  const [externalUrl, setExternalUrl] = useState<string | null>(null);
  const [guided, setGuided] = useState<Partial<GuidedWellnessPayload> | null>(null);

  useEffect(() => {
    if (!articleId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        if (articleId.startsWith("builtin:")) {
          const id = articleId.slice("builtin:".length);
          const meta = WELLNESS_BUILTIN_TOOLS_ADMIN.find((t) => t.id === id);
          if (!meta) {
            toast.error("Article not found");
            navigate("/app/settings/resources", { replace: true });
            return;
          }
          const text = getBuiltinArticleBody(id);
          if (cancelled) return;
          setTitle(meta.title);
          setCategory(meta.category);
          setDescription(meta.description);
          setBody(
            text ||
              `${meta.description}\n\nOpen Wellness Tools for a guided version of this practice when you are ready.`
          );
          setExternalUrl(null);
          setGuided(null);
          return;
        }

        const tool = (await api.wellness.getTool(articleId)) as Record<string, unknown> | null;
        if (!tool) {
          toast.error("Article not found");
          navigate("/app/settings/resources", { replace: true });
          return;
        }

        void api.wellness.startSession(articleId).catch(() => {});

        if (cancelled) return;
        setTitle(String(tool.title || "Article"));
        setCategory(String(tool.category || "General"));
        setDescription(String(tool.description || ""));

        const cu = tool.content_url != null ? String(tool.content_url).trim() : "";
        if (cu && isHttpUrl(cu)) {
          setBody(null);
          setGuided(null);
          setExternalUrl(cu);
        } else if (cu.length > 0) {
          const guidedPayload = parseGuidedPayloadFromContentUrl(cu);
          const steps = guidedPayload?.scriptSteps?.filter(
            (s) => s && typeof s.instruction === "string"
          );
          if (steps && steps.length > 0) {
            setGuided({ ...guidedPayload, scriptSteps: steps });
            setBody(null);
            setExternalUrl(null);
          } else if (cu.trim().startsWith("{")) {
            setGuided(null);
            setExternalUrl(null);
            try {
              JSON.parse(cu);
              setBody(
                `${String(tool.description || "").trim() || "This activity is set up in the app."}\n\nOpen Wellness Tools to use timers, audio, and visuals when they are available for this item.`
              );
            } catch {
              setBody(cu);
            }
          } else {
            setGuided(null);
            setBody(cu);
            setExternalUrl(null);
          }
        } else {
          setGuided(null);
          setBody(
            String(tool.description || "").trim() ||
              "This article does not have extra body text yet. Check back later or explore Wellness Tools for related activities."
          );
          setExternalUrl(null);
        }
      } catch {
        if (!cancelled) {
          toast.error("Could not load article");
          navigate("/app/settings/resources", { replace: true });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [articleId, navigate]);

  const paragraphs = useMemo(() => {
    if (!body) return [];
    return body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  }, [body]);

  const isBuiltinArticle = articleId.startsWith("builtin:");
  const guidedSteps = guided?.scriptSteps?.length ? guided.scriptSteps : null;
  const showWellnessCta = isBuiltinArticle || Boolean(guidedSteps);
  const atmosphere = getResourceCardAtmosphere(category);

  if (loading) {
    return (
      <div className={resourcesPageAtmosphere} aria-busy="true" aria-label="Loading article">
        <motion.div
          className={resourcesPageGlowTop}
          aria-hidden
          animate={{ opacity: [0.55, 0.85, 0.55] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className={resourcesPageFogMid} aria-hidden />
        <motion.div
          className={resourcesPageVignette}
          aria-hidden
          animate={{ opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="relative z-10 flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-violet-400" aria-label="Loading" />
        </div>
      </div>
    );
  }

  return (
    <div className={resourcesPageAtmosphere}>
      <motion.div
        className={resourcesPageGlowTop}
        aria-hidden
        animate={{ opacity: [0.55, 0.85, 0.55] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className={resourcesPageFogMid} aria-hidden />
      <motion.div
        className={resourcesPageVignette}
        aria-hidden
        animate={{ opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 mx-auto w-full max-w-[min(100%,48rem)] px-4 pb-12 pt-5 sm:px-6 sm:pb-14 lg:px-8 lg:pt-6">
        <Link to="/app/settings/resources" className={cn(resourcesBackLink, "mb-6")}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to reading library
        </Link>

        <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className={resourcesArticleShell}
        >
          <header
            className={cn(
              "relative overflow-hidden border-b border-white/[0.06] px-6 py-8 sm:px-10 sm:py-10",
              atmosphere.visualBg
            )}
          >
            <div className={cn("pointer-events-none absolute inset-0", atmosphere.radialGlow)} aria-hidden />
            <div
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(8,9,20,0.75)_100%)]"
              aria-hidden
            />
            <div className="relative z-10">
              <div
                className={cn(
                  "mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.65rem] font-semibold tracking-[0.14em]",
                  atmosphere.pillClass
                )}
              >
                <BookOpen className={cn("h-3.5 w-3.5 shrink-0", atmosphere.iconClass)} aria-hidden />
                {formatCategoryLabel(category)}
              </div>
              <h1 className={resourcesArticleTitle}>{title}</h1>
              {description ? (
                <p className={cn("mt-4 max-w-2xl", resourcesArticleBodyText)}>{description}</p>
              ) : null}
            </div>
          </header>

          <div className="px-6 py-8 sm:px-10 sm:py-10">
            {externalUrl ? (
              <div className="space-y-6">
                <p className={resourcesArticleBodyText}>
                  This piece is hosted outside the app. Use the button below to read it in full; your session has been
                  started so we can keep your library in sync.
                </p>
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(resourcesReadBtn, "w-fit px-6")}
                >
                  Read full article
                  <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                </a>
              </div>
            ) : guidedSteps ? (
              <div className="space-y-6">
                <p className={resourcesArticleBodyText}>
                  Step-by-step script from your care team. For timed prompts, audio, and visuals, use Wellness Tools.
                </p>
                <ol className="m-0 list-none space-y-4 p-0">
                  {guidedSteps.map((step, index) => (
                    <li key={String(step.id ?? index)} className={resourcesArticleStepShell}>
                      <span className={resourcesArticleStepNumber} aria-hidden>
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-relaxed text-[var(--solace-text)]">
                          {step.instruction?.trim() || "—"}
                        </p>
                        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[rgba(255,255,255,0.45)]">
                          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          {formatStepDurationSeconds(step.duration)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                {(guided?.tags && guided.tags.length > 0) ||
                guided?.audioEnabled != null ||
                guided?.visualsEnabled != null ? (
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    {guided?.tags?.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-violet-400/25 bg-violet-500/12 px-2.5 py-0.5 text-xs font-medium text-violet-200/90"
                      >
                        #{t}
                      </span>
                    ))}
                    {guided?.audioEnabled ? (
                      <span className="text-xs text-[rgba(255,255,255,0.45)]">Audio on</span>
                    ) : null}
                    {guided?.visualsEnabled ? (
                      <span className="text-xs text-[rgba(255,255,255,0.45)]">Visuals on</span>
                    ) : null}
                    {guided?.enabledForGuidedMode === false ? (
                      <span className="text-xs text-amber-200/90">Guided mode off in editor</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                {paragraphs.map((para, i) => (
                  <p key={i} className={resourcesArticleBodyText}>
                    {para}
                  </p>
                ))}
              </div>
            )}

            {showWellnessCta ? (
              <p className="mt-10 border-t border-white/[0.08] pt-8 text-sm text-[rgba(255,255,255,0.52)]">
                {guidedSteps ? "Run this with timers and cues in the app. " : "Want timers and audio in the app? "}
                <Link
                  to="/app/wellness-tools"
                  className="font-semibold text-[color:var(--accent-secondary,#a78bfa)] transition-colors hover:text-[color:var(--accent-secondary,#a78bfa)]"
                >
                  Open Wellness Tools
                </Link>
              </p>
            ) : null}
          </div>
        </motion.article>
      </div>
    </div>
  );
}
