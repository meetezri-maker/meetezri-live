import { FastifyInstance } from 'fastify';
import {
  addCommentHandler,
  createPostHandler,
  getGroupsHandler,
  getMemberProfileHandler,
  getOverviewHandler,
  getPostsHandler,
  joinGroupHandler,
  leaveGroupHandler,
  likePostHandler,
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
}
