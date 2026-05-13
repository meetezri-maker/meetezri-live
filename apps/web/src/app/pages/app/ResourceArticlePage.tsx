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
import { cn } from "@/app/components/ui/utils";

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
  /** When `content_url` holds guided JSON (`scriptSteps`), render steps instead of raw text. */
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

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
          <Loader2 className="h-10 w-10 animate-spin text-violet-600" aria-label="Loading" />
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-violet-50/40 dark:from-slate-950 dark:via-slate-950 dark:to-violet-950/20 transition-colors duration-300">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
          <Link
            to="/app/settings/resources"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 mb-8 transition-colors font-medium text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to reading library
          </Link>

          <motion.article
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm shadow-violet-500/5 overflow-hidden"
          >
            <header className="border-b border-slate-100 dark:border-slate-800 px-6 sm:px-10 py-8 bg-gradient-to-br from-violet-50/90 to-fuchsia-50/50 dark:from-violet-950/40 dark:to-slate-900">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/90 dark:bg-slate-950/80 px-3 py-1 text-xs font-semibold text-violet-800 dark:text-violet-200 mb-4">
                <BookOpen className="h-3.5 w-3.5" aria-hidden />
                {category}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                {title}
              </h1>
              {description ? (
                <p className="mt-4 text-slate-700 dark:text-slate-300 text-base leading-relaxed">{description}</p>
              ) : null}
            </header>

            <div className="px-6 sm:px-10 py-8 sm:py-10">
              {externalUrl ? (
                <div className="space-y-6">
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    This piece is hosted outside the app. Use the button below to read it in full; your session has been
                    started so we can keep your library in sync.
                  </p>
                  <a
                    href={externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold px-6 py-3 text-sm shadow-md shadow-violet-500/25 hover:opacity-95 transition-opacity"
                  >
                    Read full article
                    <ExternalLink className="w-4 h-4 shrink-0" aria-hidden />
                  </a>
                </div>
              ) : guidedSteps ? (
                <div className="space-y-6">
                  <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                    Step-by-step script from your care team. For timed prompts, audio, and visuals, use Wellness Tools.
                  </p>
                  <ol className="space-y-4 list-none p-0 m-0">
                    {guidedSteps.map((step, index) => (
                      <li
                        key={String(step.id ?? index)}
                        className="flex gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/50 p-4 sm:p-5"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-sm font-bold text-white shadow-sm">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-slate-900 dark:text-white font-medium leading-relaxed">
                            {step.instruction?.trim() || "—"}
                          </p>
                          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                            <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden />
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
                          className="rounded-full bg-violet-100 dark:bg-violet-950/80 px-2.5 py-0.5 text-xs font-medium text-violet-800 dark:text-violet-200"
                        >
                          #{t}
                        </span>
                      ))}
                      {guided?.audioEnabled ? (
                        <span className="text-xs text-slate-500 dark:text-slate-400">Audio on</span>
                      ) : null}
                      {guided?.visualsEnabled ? (
                        <span className="text-xs text-slate-500 dark:text-slate-400">Visuals on</span>
                      ) : null}
                      {guided?.enabledForGuidedMode === false ? (
                        <span className="text-xs text-amber-700 dark:text-amber-300">Guided mode off in editor</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div
                  className={cn(
                    "prose prose-slate dark:prose-invert max-w-none",
                    "prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-p:leading-relaxed prose-p:mb-4",
                    "prose-headings:text-slate-900 dark:prose-headings:text-white"
                  )}
                >
                  {paragraphs.map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              )}

              {showWellnessCta ? (
                <p className="mt-10 pt-8 border-t border-slate-100 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-400">
                  {guidedSteps ? "Run this with timers and cues in the app. " : "Want timers and audio in the app? "}
                  <Link
                    to="/app/wellness-tools"
                    className="font-semibold text-violet-700 dark:text-violet-300 hover:underline"
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
