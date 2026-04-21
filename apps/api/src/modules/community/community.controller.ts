import { FastifyReply, FastifyRequest } from 'fastify';
import * as communityService from './community.service';

interface UserPayload {
  sub: string;
}

export async function getOverviewHandler(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    return await communityService.getCommunityOverview();
  } catch {
    return reply.code(500).send({ message: 'Failed to load community overview' });
  }
}

export async function getGroupsHandler(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user as UserPayload;
  try {
    return await communityService.getCommunityGroupsForUser(user.sub);
  } catch {
    return reply.code(500).send({ message: 'Failed to load groups' });
  }
}

export async function getPostsHandler(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user as UserPayload;
  const q = request.query as { limit?: string };
  const limit = q.limit ? Math.min(parseInt(q.limit, 10) || 30, 50) : 30;
  try {
    return await communityService.getCommunityPostsForUser(user.sub, limit);
  } catch {
    return reply.code(500).send({ message: 'Failed to load posts' });
  }
}

export async function getMemberProfileHandler(
  request: FastifyRequest<{ Params: { userId: string } }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  try {
    return await communityService.getCommunityMemberPublicProfile(
      user.sub,
      request.params.userId
    );
  } catch (err: any) {
    const code = err?.statusCode === 404 ? 404 : 500;
    return reply
      .code(code)
      .send({ message: err?.message || 'Failed to load profile' });
  }
}

export async function createPostHandler(
  request: FastifyRequest<{ Body: { content: string; tags?: string[]; group_id?: string | null } }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const { content, tags, group_id } = request.body || ({} as any);
  if (!content || typeof content !== 'string' || !content.trim()) {
    return reply.code(400).send({ message: 'Content is required' });
  }
  try {
    const post = await communityService.createCommunityPost(user.sub, {
      content,
      tags,
      group_id: group_id || undefined,
    });
    return { id: post.id, created_at: post.created_at };
  } catch (err: any) {
    const code = err?.statusCode === 403 ? 403 : err?.statusCode === 404 ? 404 : 500;
    return reply
      .code(code)
      .send({ message: err?.message || 'Failed to create post' });
  }
}

export async function joinGroupHandler(
  request: FastifyRequest<{ Params: { groupId: string } }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  try {
    return await communityService.joinCommunityGroup(user.sub, request.params.groupId);
  } catch (err: any) {
    const code = err?.statusCode === 404 ? 404 : 500;
    return reply.code(code).send({ message: err?.message || 'Failed to join group' });
  }
}

export async function leaveGroupHandler(
  request: FastifyRequest<{ Params: { groupId: string } }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  try {
    return await communityService.leaveCommunityGroup(user.sub, request.params.groupId);
  } catch {
    return reply.code(500).send({ message: 'Failed to leave group' });
  }
}

export async function likePostHandler(
  request: FastifyRequest<{ Params: { postId: string } }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  try {
    return await communityService.togglePostLike(user.sub, request.params.postId);
  } catch (err: any) {
    const code = err?.statusCode === 404 ? 404 : 500;
    return reply.code(code).send({ message: err?.message || 'Failed to like post' });
  }
}

export async function addCommentHandler(
  request: FastifyRequest<{ Params: { postId: string }; Body: { content: string } }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const content = request.body?.content;
  if (!content || typeof content !== 'string' || !content.trim()) {
    return reply.code(400).send({ message: 'Comment content is required' });
  }
  try {
    return await communityService.addPostComment(user.sub, request.params.postId, content);
  } catch (err: any) {
    const code = err?.statusCode === 404 ? 404 : 500;
    return reply.code(code).send({ message: err?.message || 'Failed to add comment' });
  }
}

export async function getPostCommentsHandler(
  request: FastifyRequest<{ Params: { postId: string } }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  try {
    return await communityService.getPostCommentsForUser(user.sub, request.params.postId);
  } catch (err: any) {
    const code = err?.statusCode === 404 ? 404 : 500;
    return reply.code(code).send({ message: err?.message || 'Failed to load comments' });
  }
}

export async function updatePostHandler(
  request: FastifyRequest<{ Params: { postId: string }; Body: { content: string } }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const content = request.body?.content;
  if (!content || typeof content !== 'string' || !content.trim()) {
    return reply.code(400).send({ message: 'Content is required' });
  }
  try {
    return await communityService.updateCommunityPost(user.sub, request.params.postId, content);
  } catch (err: any) {
    const code = err?.statusCode || 500;
    return reply.code(code).send({ message: err?.message || 'Failed to update post' });
  }
}

export async function deletePostHandler(
  request: FastifyRequest<{ Params: { postId: string } }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  try {
    return await communityService.deleteCommunityPost(user.sub, request.params.postId);
  } catch (err: any) {
    const code = err?.statusCode || 500;
    return reply.code(code).send({ message: err?.message || 'Failed to delete post' });
  }
}
