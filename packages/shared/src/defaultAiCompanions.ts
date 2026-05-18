/**
 * Canonical default AI companions — must match `apps/web/public/avatars/*.png` filenames.
 * Order: Alex, Jordan Taylor, Maya Chen, Sara Mitchell (same as product defaults everywhere).
 */
export type DefaultAiCompanionDefinition = {
  /** Stable id for UI keys (usually same as display name) */
  id: string;
  /** Display name — must match PNG stem + DB `ai_avatars.name` */
  name: string;
  portraitPng: string;
  /** Short line for session lobby cards */
  lobbyTagline: string;
  gender: string;
  age_range: string;
  personality: string;
  specialties: string[];
  description: string;
  voice_type: string;
  accent_type: string;
  rating: number;
};

export const DEFAULT_AI_COMPANIONS: readonly DefaultAiCompanionDefinition[] = [
  {
    id: "Alex",
    name: "Alex",
    portraitPng: "Alex.png",
    lobbyTagline: "Supportive and empathetic",
    gender: "Male",
    age_range: "30-35",
    personality: "Calm, Patient, Understanding",
    specialties: ["Life Transitions"],
    description:
      "A gentle and patient listener who creates a safe space for healing. Alex focuses on emotional healing and navigating life's big changes.",
    voice_type: "Deep & Calming",
    accent_type: "Neutral American",
    rating: 4.8,
  },
  {
    id: "Jordan Taylor",
    name: "Jordan Taylor",
    portraitPng: "jordan Taylor.png",
    lobbyTagline: "Professional and attentive",
    gender: "Non-binary",
    age_range: "28-32",
    personality: "Energetic, Positive, Supportive",
    specialties: ["Self-Esteem", "Relationships", "Personal Growth"],
    description:
      "An uplifting companion who helps you discover your strengths. Jordan specializes in building confidence and personal development.",
    voice_type: "Bright & Encouraging",
    accent_type: "Neutral American",
    rating: 4.7,
  },
  {
    id: "Maya Chen",
    name: "Maya Chen",
    portraitPng: "maya chen.png",
    lobbyTagline: "Kind and patient",
    gender: "Female",
    age_range: "35-40",
    personality: "Warm, Empathetic, Supportive",
    specialties: ["anxiousness", "Low morale support", "Stress Management"],
    description:
      "A compassionate AI companion with a warm presence. Maya specializes in helping with anxiousness, stress, and building emotional resilience through mindfulness.",
    voice_type: "Warm & Soothing",
    accent_type: "Neutral American",
    rating: 4.9,
  },
  {
    id: "Sara Mitchell",
    name: "Sara Mitchell",
    portraitPng: "Sara Mitchell.png",
    lobbyTagline: "Warm and understanding",
    gender: "Female",
    age_range: "45-50",
    personality: "Wise, Grounded, Nurturing",
    specialties: ["Grief", "Family Issues", "Chronic Illness"],
    description:
      "A wise and nurturing presence with deep empathy. Sara brings years of life experience in supporting people through challenging times.",
    voice_type: "Gentle & Maternal",
    accent_type: "British",
    rating: 4.9,
  },
];

/** Lowercased trimmed `ai_avatars.name` → canonical default `name` / `id` in DEFAULT_AI_COMPANIONS. */
const AVATAR_NAME_ALIASES: Record<string, string> = {
  "alex rivera": "Alex",
  alex: "Alex",
  "maya chen": "Maya Chen",
  maya: "Maya Chen",
  "jordan taylor": "Jordan Taylor",
  jordan: "Jordan Taylor",
  "sara mitchell": "Sara Mitchell",
  "sarah mitchell": "Sara Mitchell",
  sara: "Sara Mitchell",
  sarah: "Sara Mitchell",
};

/**
 * Resolve a DB or profile avatar label (e.g. `"Alex Rivera"`) to the matching row in DEFAULT_AI_COMPANIONS.
 * Use on the member app when API rows lag behind seeded product copy.
 */
export function matchDefaultCompanionByAvatarName(
  rawName: string
): DefaultAiCompanionDefinition | undefined {
  const key = rawName.trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return undefined;

  const viaAlias = AVATAR_NAME_ALIASES[key];
  if (viaAlias) {
    const hit = DEFAULT_AI_COMPANIONS.find(
      (c) => c.name === viaAlias || c.id === viaAlias
    );
    if (hit) return hit;
  }

  return (
    DEFAULT_AI_COMPANIONS.find((c) => c.name.trim().toLowerCase() === key) ??
    DEFAULT_AI_COMPANIONS.find((c) => c.id.trim().toLowerCase() === key)
  );
}
