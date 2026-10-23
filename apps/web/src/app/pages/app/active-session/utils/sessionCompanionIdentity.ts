/**
 * WHO A LIVE SESSION'S COMPANION IS — extracted verbatim from `ActiveSession`
 * so the precedence can be tested without rendering the page.
 *
 *   1. `config.avatar` from router state, when it is a non-empty string;
 *   2. otherwise the identity pinned to THIS session's id in
 *      `ezri_active_session_identity`, and only when that stored id matches;
 *   3. otherwise `undefined`.
 *
 * The profile's current selection is deliberately not an input: it is what the
 * member will pick NEXT, and must never rename a session already running.
 */
export function resolveSessionCompanionLabel(
  configAvatar: unknown,
  rememberedIdentity: { id: string; avatar: string } | null,
  apiSessionId: string | null,
): string | undefined {
  if (typeof configAvatar === "string" && configAvatar.trim()) return configAvatar;
  if (
    rememberedIdentity &&
    apiSessionId &&
    rememberedIdentity.id === apiSessionId &&
    rememberedIdentity.avatar.trim()
  ) {
    return rememberedIdentity.avatar;
  }
  return undefined;
}
