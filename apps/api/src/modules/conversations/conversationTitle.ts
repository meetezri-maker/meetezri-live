/**
 * Conversation title from the first user message — the same rule the Conversations UI preview uses
 * (`apps/web/src/app/features/conversations/conversationList.ts` → `deriveConversationTitle`), so a
 * stored title matches what members already see: whitespace collapsed, first letter capitalised,
 * cut at a word boundary within 40 characters with an ellipsis. Returns "" for blank input.
 */
const TITLE_MAX_CHARS = 40;

export function deriveConversationTitle(firstUserMessage: string): string {
  const text = firstUserMessage.replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= TITLE_MAX_CHARS) return text.charAt(0).toUpperCase() + text.slice(1);
  const cut = text.slice(0, TITLE_MAX_CHARS);
  const lastSpace = cut.lastIndexOf(' ');
  const base = (lastSpace > 15 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:!?-]+$/, '');
  return `${base.charAt(0).toUpperCase()}${base.slice(1)}…`;
}
