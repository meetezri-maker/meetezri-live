import { FastifyInstance } from 'fastify';
import {
  addCommentHandler,
  createPostHandler,
  deletePostHandler,
  getPostCommentsHandler,
  getGroupsHandler,
  getMemberProfileHandler,
  getOverviewHandler,
  getPostsHandler,
  joinGroupHandler,
  leaveGroupHandler,
  likePostHandler,
  updatePostHandler,
} from './community.controller';

export async function communityRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/overview',
    { preHandler: [fastify.authenticate] },
    getOverviewHandler
  );
  fastify.get(
    '/groups',
    { preHandler: [fastify.authenticate] },
    getGroupsHandler
  );
  fastify.get(
    '/posts',
    { preHandler: [fastify.authenticate] },
    getPostsHandler
  );
  fastify.get(
    '/members/:userId',
    { preHandler: [fastify.authenticate] },
    getMemberProfileHandler
  );
  fastify.post(
    '/posts',
    { preHandler: [fastify.authenticate] },
    createPostHandler
  );
  fastify.post(
    '/groups/:groupId/join',
    { preHandler: [fastify.authenticate] },
    joinGroupHandler
  );
  fastify.post(
    '/groups/:groupId/leave',
    { preHandler: [fastify.authenticate] },
    leaveGroupHandler
  );
  fastify.post(
    '/posts/:postId/like',
    { preHandler: [fastify.authenticate] },
    likePostHandler
  );
  fastify.post(
    '/posts/:postId/comments',
    { preHandler: [fastify.authenticate] },
    addCommentHandler
  );
  fastify.get(
    '/posts/:postId/comments',
    { preHandler: [fastify.authenticate] },
    getPostCommentsHandler
  );
  fastify.patch(
    '/posts/:postId',
    { preHandler: [fastify.authenticate] },
    updatePostHandler
  );
  fastify.delete(
    '/posts/:postId',
    { preHandler: [fastify.authenticate] },
    deletePostHandler
  );
}
