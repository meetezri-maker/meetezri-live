export const DELETED_COMMUNITY_AUTHOR_NAME = 'Deleted user';

export function deletedCommunityAuthor(userId: string | null): {
  name: typeof DELETED_COMMUNITY_AUTHOR_NAME;
  avatarUrl: null;
  role: 'member';
  authorUserId: null;
  authorProfilePrivate: false;
} | null {
  if (userId !== null) return null;
  return {
    name: DELETED_COMMUNITY_AUTHOR_NAME,
    avatarUrl: null,
    role: 'member',
    authorUserId: null,
    authorProfilePrivate: false,
  };
}
