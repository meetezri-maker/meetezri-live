import { FastifyInstance } from 'fastify';
import {
  completeOnboardingHandler,
  getMeHandler,
  updateProfileHandler,
  deleteUserHandler,
  exportUserDataHandler,
  getCreditsHandler,
  getRecentActivityHandler,
  initProfileHandler,
  getAllUsersHandler,
  getUserProfileAdminHandler,
  checkUserExistsHandler,
  signupHandler,
  resendVerificationHandler,
  confirmEmailHandler,
  getKnowledgeTwoFactorStatusHandler,
  setupKnowledgeTwoFactorHandler,
  setupKnowledgeTwoFactorEmailHandler,
  verifyKnowledgeTwoFactorHandler,
  disableKnowledgeTwoFactorHandler,
  requestKnowledgeTwoFactorRecoveryHandler,
  verifyKnowledgeTwoFactorRecoveryHandler,
  requestKnowledgeTwoFactorLoginCodeHandler,
  verifyKnowledgeTwoFactorLoginCodeHandler,
  reportCrisisEventHandler,
} from './user.controller';
import { checkUserSchema, signupSchema } from './user.schema';

export async function userRoutes(fastify: FastifyInstance) {
  // Public Routes
  fastify.post('/check', { schema: { body: checkUserSchema } }, checkUserExistsHandler);
  fastify.post('/signup', { schema: { body: signupSchema } }, signupHandler);


  // Admin Routes
  fastify.get(
    '/admin/users',
    {
      preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin'])],
    },
    getAllUsersHandler
  );

  fastify.get(
    '/admin/users/:userId',
    {
      preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin'])],
    },
    getUserProfileAdminHandler
  );

  // User Routes
  fastify.post(
    '/init',
    {
      preHandler: [fastify.authenticate],
    },
    initProfileHandler
  );

  fastify.get(
    '/me',
    {
      preHandler: [fastify.authenticate],
    },
    getMeHandler
  );

  fastify.post(
    '/resend-verification',
    {
      preHandler: [fastify.authenticate],
    },
    resendVerificationHandler
  );

  fastify.post(
    '/confirm-email',
    {
      preHandler: [fastify.authenticate],
    },
    confirmEmailHandler
  );

  fastify.get(
    '/credits',
    {
      preHandler: [fastify.authenticate],
    },
    getCreditsHandler
  );

  fastify.get(
    '/activity',
    {
      preHandler: [fastify.authenticate],
    },
    getRecentActivityHandler
  );

  fastify.post(
    '/crisis-events',
    {
      preHandler: [fastify.authenticate],
    },
    reportCrisisEventHandler
  );

  fastify.get(
    '/2fa/knowledge/status',
    {
      preHandler: [fastify.authenticate],
    },
    getKnowledgeTwoFactorStatusHandler
  );

  fastify.post(
    '/2fa/knowledge/setup',
    {
      preHandler: [fastify.authenticate],
    },
    setupKnowledgeTwoFactorHandler
  );

  fastify.post(
    '/2fa/knowledge/setup-email',
    {
      preHandler: [fastify.authenticate],
    },
    setupKnowledgeTwoFactorEmailHandler
  );

  fastify.post(
    '/2fa/knowledge/verify',
    {
      preHandler: [fastify.authenticate],
    },
    verifyKnowledgeTwoFactorHandler
  );

  fastify.post(
    '/2fa/knowledge/disable',
    {
      preHandler: [fastify.authenticate],
    },
    disableKnowledgeTwoFactorHandler
  );

  fastify.post(
    '/2fa/knowledge/recovery/request',
    {
      preHandler: [fastify.authenticate],
    },
    requestKnowledgeTwoFactorRecoveryHandler
  );

  fastify.post(
    '/2fa/knowledge/recovery/verify',
    {
      preHandler: [fastify.authenticate],
    },
    verifyKnowledgeTwoFactorRecoveryHandler
  );

  fastify.post(
    '/2fa/knowledge/login-code/request',
    {
      preHandler: [fastify.authenticate],
    },
    requestKnowledgeTwoFactorLoginCodeHandler
  );

  fastify.post(
    '/2fa/knowledge/login-code/verify',
    {
      preHandler: [fastify.authenticate],
    },
    verifyKnowledgeTwoFactorLoginCodeHandler
  );

  fastify.patch(
    '/me',
    {
      preHandler: [fastify.authenticate],
    },
    updateProfileHandler
  );

  fastify.post(
    '/onboarding',
    {
      preHandler: [fastify.authenticate],
    },
    completeOnboardingHandler
  );

  fastify.delete(
    '/me',
    {
      preHandler: [fastify.authenticate],
    },
    deleteUserHandler
  );

  fastify.get(
    '/export',
    {
      preHandler: [fastify.authenticate],
    },
    exportUserDataHandler
  );
}
