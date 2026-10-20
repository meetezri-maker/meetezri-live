import { deletedCommunityAuthor } from '../community/community-author';

describe('deleted community author rendering', () => {
  test('NULL author renders as Deleted user without identity or avatar', () => {
    expect(deletedCommunityAuthor(null)).toEqual({
      name: 'Deleted user', avatarUrl: null, role: 'member', authorUserId: null, authorProfilePrivate: false,
    });
  });
  test('live author uses the normal rendering path', () => {
    expect(deletedCommunityAuthor('11111111-1111-4111-8111-111111111111')).toBeNull();
  });
});
