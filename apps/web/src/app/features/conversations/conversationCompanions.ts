import { DEFAULT_AI_COMPANIONS, companionDisplayName } from "@meetezri/shared";
import { isCompanionComingSoon } from "@/lib/avatar/companionAvailability";
import { tryResolveCompanionPortraitUrl } from "@/lib/avatar/companionModelUrl";
import type { ConversationCompanion, ConversationCompanionKey } from "./types";

/**
 * Display ORDER for the companion selector, matching the approved Conversations references
 * (Romy, Frankie, Tessa, Andre, Bianca, Damian, Sasha).
 *
 * This is ordering only. Every entry is a canonical `DEFAULT_AI_COMPANIONS` id; identity, names
 * and portraits all come from the shared registry and existing avatar utilities. Any registry
 * companion missing from this list is appended at the end so a new companion is never dropped.
 */
const SELECTOR_ORDER: readonly ConversationCompanionKey[] = [
  "Sara Mitchell",
  "Alex",
  "Maya Chen",
  "Jordan Taylor",
  "Bianca",
  "Damian",
  "Sasha",
];

function toConversationCompanion(key: ConversationCompanionKey): ConversationCompanion {
  return {
    key,
    displayName: companionDisplayName(key) || key,
    portraitUrl: tryResolveCompanionPortraitUrl(key),
  };
}

/** Selectable companions for a new conversation, in selector order. */
export function listConversationCompanions(): ConversationCompanion[] {
  const registryIds = DEFAULT_AI_COMPANIONS.map((c) => c.id);
  const ordered = [
    ...SELECTOR_ORDER.filter((id) => registryIds.includes(id)),
    ...registryIds.filter((id) => !SELECTOR_ORDER.includes(id)),
  ];
  return ordered.filter((id) => !isCompanionComingSoon(id)).map(toConversationCompanion);
}

/** Resolve a stored canonical key for display. Unknown keys keep their label, no portrait. */
export function resolveConversationCompanion(key: ConversationCompanionKey): ConversationCompanion {
  const known = DEFAULT_AI_COMPANIONS.some((c) => c.id === key);
  if (known) return toConversationCompanion(key);
  return { key, displayName: companionDisplayName(key) || key, portraitUrl: null };
}
