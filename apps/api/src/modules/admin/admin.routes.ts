
import { FastifyInstance } from 'fastify';
import { 
  getDashboardStatsHandler, getUsersHandler, getUserHandler, updateUserHandler, deleteUserHandler, getUserAuditLogsHandler, getRecentActivityHandler,
  getUserSegmentsHandler, createUserSegmentHandler, deleteUserSegmentHandler,
  getManualNotificationsHandler, createManualNotificationHandler, getNotificationAudienceCountsHandler,
  getNudgesHandler, createNudgeHandler, updateNudgeHandler, deleteNudgeHandler,
  getNudgeTemplatesHandler, createNudgeTemplateHandler, updateNudgeTemplateHandler, deleteNudgeTemplateHandler,
  getEmailTemplatesHandler, createEmailTemplateHandler, updateEmailTemplateHandler, deleteEmailTemplateHandler,
  getPushCampaignsHandler, createPushCampaignHandler, updatePushCampaignHandler, deletePushCampaignHandler,
  getSupportTicketsHandler, updateSupportTicketHandler,
  getCommunityStatsHandler, getCommunityGroupsHandler,
  getLiveSessionsHandler, endLiveSessionHandler, flagSessionForReviewHandler, getActivityLogsHandler, getGlobalAuditLogsHandler, getSessionRecordingsHandler, getErrorLogsHandler, getSessionRecordingTranscriptHandler,
  getCrisisEventsHandler, getCrisisEventHandler, updateCrisisEventStatusHandler
} from './admin.controller';
import { dashboardStatsSchema, userListSchema, userSchema, updateUserSchema } from './admin.schema';
import { z } from 'zod';

export async function adminRoutes(fastify: FastifyInstance) {
  // Stats & Dashboard
  fastify.get(
    '/stats',
    {
      preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])],
      schema: {
        response: {
          200: dashboardStatsSchema,
        },
      },
    },
    getDashboardStatsHandler
  );

  fastify.get(
    '/stats/recent',
    {
      preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])],
    },
    getRecentActivityHandler
  );

  // User Management
  fastify.get(
    '/users',
    {
      preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])],
      schema: {
        response: {
          200: userListSchema,
        },
      },
    },
    getUsersHandler
  );

  fastify.get(
    '/users/:id',
    {
      preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])],
      schema: {
        response: {
          200: userSchema,
        },
      },
    },
    getUserHandler
  );

  fastify.patch(
    '/users/:id',
    {
      preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])],
      schema: {
        body: updateUserSchema,
        response: {
          200: userSchema,
        },
      },
    },
    updateUserHandler
  );

  fastify.delete(
    '/users/:id',
    {
      preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])],
    },
    deleteUserHandler
  );

  fastify.get(
    '/users/:id/audit-logs',
    {
      preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])],
    },
    getUserAuditLogsHandler
  );

  // User Segmentation
  fastify.get('/user-segments', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, getUserSegmentsHandler);
  fastify.post('/user-segments', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, createUserSegmentHandler);
  fastify.delete('/user-segments/:id', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, deleteUserSegmentHandler);

  // Notifications
  fastify.get('/notifications/manual', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, getManualNotificationsHandler);
  fastify.post('/notifications/manual', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, createManualNotificationHandler);
  fastify.get('/notifications/audience-counts', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, getNotificationAudienceCountsHandler);

  // Nudge Templates
  fastify.get('/nudge-templates', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, getNudgeTemplatesHandler);
  fastify.post('/nudge-templates', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, createNudgeTemplateHandler);
  fastify.put('/nudge-templates/:id', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, updateNudgeTemplateHandler);
  fastify.delete('/nudge-templates/:id', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, deleteNudgeTemplateHandler);

  // Nudges
  fastify.get('/nudges', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, getNudgesHandler);
  fastify.post('/nudges', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, createNudgeHandler);
  fastify.put('/nudges/:id', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, updateNudgeHandler);
  fastify.delete('/nudges/:id', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, deleteNudgeHandler);

  // Email Templates
  fastify.get('/email-templates', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, getEmailTemplatesHandler);
  fastify.post('/email-templates', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, createEmailTemplateHandler);
  fastify.put('/email-templates/:id', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, updateEmailTemplateHandler);
  fastify.delete('/email-templates/:id', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, deleteEmailTemplateHandler);

  // Push Campaigns
  fastify.get('/push-campaigns', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, getPushCampaignsHandler);
  fastify.post('/push-campaigns', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, createPushCampaignHandler);
  fastify.put('/push-campaigns/:id', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, updatePushCampaignHandler);
  fastify.delete('/push-campaigns/:id', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, deletePushCampaignHandler);

  // Support Tickets
  fastify.get('/support-tickets', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, getSupportTicketsHandler);
  fastify.put('/support-tickets/:id', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, updateSupportTicketHandler);

  // Community
  fastify.get('/community/stats', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, getCommunityStatsHandler);
  fastify.get('/community/groups', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, getCommunityGroupsHandler);

  // Monitoring
  fastify.get('/live-sessions', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, getLiveSessionsHandler);
  fastify.post('/live-sessions/:id/end', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, endLiveSessionHandler);
  fastify.post('/live-sessions/:id/flag', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, flagSessionForReviewHandler);
  fastify.get('/activity-logs', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, getActivityLogsHandler);
  fastify.get('/audit-logs', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, getGlobalAuditLogsHandler);
  fastify.get('/session-recordings', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, getSessionRecordingsHandler);
  fastify.get('/session-recordings/:id/transcript', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, getSessionRecordingTranscriptHandler);
  fastify.get('/error-logs', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, getErrorLogsHandler);

  // Crisis Management
  fastify.get('/crisis-events', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, getCrisisEventsHandler);
  fastify.get('/crisis-events/:id', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, getCrisisEventHandler);
  fastify.patch('/crisis-events/:id/status', { preHandler: [fastify.authenticate, fastify.authorize(['super_admin', 'org_admin', 'team_admin'])] }, updateCrisisEventStatusHandler);
}
