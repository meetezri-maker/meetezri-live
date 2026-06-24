
import { FastifyReply, FastifyRequest } from 'fastify';
import { 
  getDashboardStats, getAllUsers, getUserStatusCounts, getUserById, createUserByAdmin, createUsersBulkByAdmin, updateUser, deleteUser, getUserAuditLogs, getRecentActivity,
  getUserSegmentationDashboard, createUserSegment, deleteUserSegment, getUserSegmentUsers,
  getManualNotifications, createManualNotification, getNotificationAudienceCounts,
  getNudges, createNudge, updateNudge, deleteNudge,
  getNudgeTemplates, createNudgeTemplate, updateNudgeTemplate, deleteNudgeTemplate,
  getEmailTemplates, createEmailTemplate, updateEmailTemplate, deleteEmailTemplate,
  getPushCampaigns, createPushCampaign, updatePushCampaign, deletePushCampaign,
  getSupportTickets, getSupportTicketById, updateSupportTicket,
  getCommunityStats, getCommunityGroups,
  getCommunityPostsForAdmin, updateCommunityPostAdmin, softDeleteCommunityPostAdmin,
  createCommunityGroupAdmin, updateCommunityGroupAdmin, deleteCommunityGroupAdmin,
  getCommunityGroupMembersAdmin, addGroupMemberAdmin, removeGroupMemberAdmin,
  dispatchPushCampaignAsNotifications,
  getLiveSessions, getActivityLogs, getGlobalAuditLogs, getSessionRecordings, getErrorLogs, getSessionRecordingTranscript,
  getCrisisEvents, getCrisisEvent, updateCrisisEventStatus,
  endLiveSessionByAdmin, flagSessionForReview,
  getAdminSystemHealth, resolveErrorLog, deleteResolvedErrorLogs, markSessionRecordingReviewed, updateSessionRecordingMeta,
  getOrgTeamMembers, addOrgTeamMember, updateOrgTeamMember, removeOrgTeamMember,
  listCompanionsForAdmin, createCompanionByAdmin, updateCompanionByAdmin, deleteCompanionProfile,
  getBackupRecoveryDashboard, createLogicalBackup, createDataExportRecord, requestRestoreFromBackup,
  getBackupRecordJsonForDownload,
  getContentPerformanceAnalytics,
  getWellnessToolUsageAggregates,
  getAdminAchievements, createAdminAchievement, updateAdminAchievement, deleteAdminAchievement,
} from './admin.service';
import {
  listFeatureFlags,
  createFeatureFlag,
  updateFeatureFlag,
  deleteFeatureFlag,
  listAbTests,
  createAbTest,
  updateAbTest,
  deleteAbTest,
  getApiPlatformConfig,
  saveApiPlatformConfig,
  createAdminApiKey,
  getIntegrationsConfig,
  saveIntegrationsConfig,
  getBrandingConfig,
  saveBrandingConfig,
} from './admin-platform.service';
import { updateUserSchema, createAdminUserSchema, bulkCreateAdminUsersSchema } from './admin.schema';
import { z } from 'zod';
import type { DashboardStatsQuery } from './admin.service';
import { getInviteRedirectBaseUrl } from '../../lib/webBaseUrl';

export async function getDashboardStatsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const q = request.query as Record<string, string | undefined>;
    const cp = q.chartPeriod;
    const chartPeriod: DashboardStatsQuery['chartPeriod'] =
      cp === 'week' || cp === 'year' ? cp : 'month';
    const sessionWeekOffset = Math.min(
      52,
      Math.max(0, parseInt(q.sessionWeekOffset || '0', 10) || 0)
    );
    const rangeDaysRaw = parseInt(q.rangeDays || '', 10);
    const rangeDays =
      Number.isFinite(rangeDaysRaw) && rangeDaysRaw > 0
        ? Math.min(366, Math.max(1, rangeDaysRaw))
        : undefined;
    const dateFrom = q.dateFrom?.trim() || undefined;
    const dateTo = q.dateTo?.trim() || undefined;
    const skipCache = q.refresh === '1' || q.nocache === '1';
    const stats = await getDashboardStats({
      chartPeriod,
      sessionWeekOffset,
      rangeDays,
      dateFrom,
      dateTo,
      skipCache,
    });
    return reply.code(200).send(stats);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch dashboard stats' });
  }
}

export async function getRecentActivityHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const activity = await getRecentActivity();
    return reply.code(200).send(activity);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch recent activity' });
  }
}

export async function getUsersHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const query = request.query as { page?: string; limit?: string; search?: string };
    const page = query.page && !isNaN(parseInt(query.page, 10)) ? parseInt(query.page, 10) : 1;
    const limit = query.limit && !isNaN(parseInt(query.limit, 10)) ? parseInt(query.limit, 10) : 500;
    const search = typeof query.search === 'string' ? query.search.trim() : undefined;

    const users = await getAllUsers(page, limit, search);
    return reply.code(200).send(users);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ 
      message: 'Failed to fetch users',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function getUserCountsHandler(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const counts = await getUserStatusCounts();
    return reply.code(200).send(counts);
  } catch (error) {
    _request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch user counts' });
  }
}

export async function createUserHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const webBaseUrl = getInviteRedirectBaseUrl(request);
    const body = createAdminUserSchema.parse(request.body);
    const user = await createUserByAdmin(body, webBaseUrl);
    return reply.code(201).send(user);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create user';
    request.log.error({ error }, 'createUser failed');
    return reply.code(400).send({ message });
  }
}

export async function createUsersBulkHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const webBaseUrl = resolveWebBaseUrl(request);
    const body = bulkCreateAdminUsersSchema.parse(request.body);
    const result = await createUsersBulkByAdmin(body, webBaseUrl);
    return reply.code(201).send(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create users';
    request.log.error({ error }, 'createUsersBulk failed');
    return reply.code(400).send({ message });
  }
}

export async function getUserHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const user = await getUserById(id);
    if (!user) {
      return reply.code(404).send({ message: 'User not found' });
    }
    return reply.code(200).send(user);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch user' });
  }
}

export async function updateUserHandler(
  request: FastifyRequest<{ Params: { id: string }, Body: z.infer<typeof updateUserSchema> }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const data = request.body;
    const user = await updateUser(id, data);
    return reply.code(200).send(user);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to update user' });
  }
}

export async function deleteUserHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const actor = request.user as { sub?: string } | undefined;
    const { id } = request.params;
    await deleteUser(id, { actorId: actor?.sub });
    return reply.code(200).send({ message: 'User deleted successfully' });
  } catch (error) {
    request.log.error(error);
    const message =
      error instanceof Error ? error.message : 'Failed to delete user';
    const statusCode =
      (error as Error & { statusCode?: number }).statusCode ??
      (message.includes('Cannot delete') ||
      message.includes('cannot delete') ||
      message.includes('You cannot delete')
        ? 403
        : 500);
    return reply.code(statusCode).send({ message });
  }
}

export async function getUserAuditLogsHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const logs = await getUserAuditLogs(id);
    return reply.code(200).send(logs);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch user audit logs' });
  }
}

export async function getCrisisEventsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const query = (request.query || {}) as any;
    const status = query.status as string | undefined;
    const page = query.page && !isNaN(parseInt(query.page, 10)) ? parseInt(query.page, 10) : 1;
    const limit = query.limit && !isNaN(parseInt(query.limit, 10)) ? parseInt(query.limit, 10) : 20;
    const events = await getCrisisEvents(status, page, limit);
    return reply.code(200).send(events);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch crisis events' });
  }
}

export async function getCrisisEventHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const event = await getCrisisEvent(id);
    if (!event) {
      return reply.code(404).send({ message: 'Crisis event not found' });
    }
    return reply.code(200).send(event);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch crisis event' });
  }
}

export async function updateCrisisEventStatusHandler(
  request: FastifyRequest<{ Params: { id: string }, Body: { status?: string; notes?: string; assigned_to?: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const body = (request.body || {}) as { status?: string; notes?: string; assigned_to?: string };
    const event = await updateCrisisEventStatus(id, body);
    return reply.code(200).send(event);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to update crisis event' });
  }
}

// --- New Handlers ---

// User Segmentation
export async function getUserSegmentsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const dashboard = await getUserSegmentationDashboard();
    return reply.code(200).send(dashboard);
  } catch (error: unknown) {
    request.log.error(error);
    const detail = error instanceof Error ? error.message : String(error);
    return reply.code(500).send({ message: `Failed to fetch segments: ${detail}` });
  }
}

export async function createUserSegmentHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const body = (request.body || {}) as {
      name?: string;
      description?: string | null;
      criteria?: unknown;
      user_count?: number | null;
    };
    if (!body.name?.trim()) {
      return reply.code(400).send({ message: 'Segment name is required' });
    }
    const segment = await createUserSegment({
      name: body.name,
      description: body.description,
      criteria: body.criteria ?? {},
      user_count: body.user_count,
    });
    return reply.code(201).send(segment);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to create segment' });
  }
}

export async function deleteUserSegmentHandler(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  try {
    await deleteUserSegment(request.params.id);
    return reply.code(204).send();
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to delete segment' });
  }
}

export async function getUserSegmentUsersHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Querystring: { page?: string; limit?: string };
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const q = (request.query || {}) as { page?: string; limit?: string };
    const page = q.page && !Number.isNaN(parseInt(q.page, 10)) ? parseInt(q.page, 10) : 1;
    const limit = q.limit && !Number.isNaN(parseInt(q.limit, 10)) ? parseInt(q.limit, 10) : 25;
    const data = await getUserSegmentUsers(id, { page, limit });
    return reply.code(200).send(data);
  } catch (error: unknown) {
    const sc =
      error && typeof error === 'object' && 'statusCode' in error
        ? (error as { statusCode?: number }).statusCode
        : undefined;
    if (sc === 404) {
      return reply.code(404).send({ message: 'Segment not found' });
    }
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch segment users' });
  }
}

// Notifications
export async function getManualNotificationsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const notifications = await getManualNotifications();
    return reply.code(200).send(notifications);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch notifications' });
  }
}

export async function createManualNotificationHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const notification = await createManualNotification(request.body);
    return reply.code(201).send(notification);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to create notification' });
  }
}

export async function getNotificationAudienceCountsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const counts = await getNotificationAudienceCounts();
    return reply.code(200).send(counts);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch audience counts' });
  }
}

export async function getNudgesHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const nudges = await getNudges();
    return reply.code(200).send(nudges);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch nudges' });
  }
}

export async function createNudgeHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user as { sub?: string } | undefined;
    const createdBy = user?.sub;
    const nudge = await createNudge(request.body, createdBy);
    return reply.code(201).send(nudge);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to create nudge' });
  }
}

export async function updateNudgeHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const nudge = await updateNudge(id, request.body);
    return reply.code(200).send(nudge);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to update nudge' });
  }
}

export async function deleteNudgeHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    await deleteNudge(id);
    return reply.code(204).send();
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to delete nudge' });
  }
}

export async function getNudgeTemplatesHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const templates = await getNudgeTemplates();
    return reply.code(200).send(templates);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch nudge templates' });
  }
}

export async function createNudgeTemplateHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user as { sub?: string } | undefined;
    const createdBy = user?.sub;
    const template = await createNudgeTemplate(request.body, createdBy);
    return reply.code(201).send(template);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({
      message: 'Failed to create nudge template',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function updateNudgeTemplateHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const template = await updateNudgeTemplate(id, request.body);
    return reply.code(200).send(template);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to update nudge template' });
  }
}

export async function deleteNudgeTemplateHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    await deleteNudgeTemplate(id);
    return reply.code(204).send();
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to delete nudge template' });
  }
}

// Email Templates
export async function getEmailTemplatesHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const templates = await getEmailTemplates();
    return reply.code(200).send(templates);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch templates' });
  }
}

export async function createEmailTemplateHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const template = await createEmailTemplate(request.body);
    return reply.code(201).send(template);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to create template' });
  }
}

export async function updateEmailTemplateHandler(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  try {
    const template = await updateEmailTemplate(request.params.id, request.body);
    return reply.code(200).send(template);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to update template' });
  }
}

export async function deleteEmailTemplateHandler(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  try {
    await deleteEmailTemplate(request.params.id);
    return reply.code(204).send();
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to delete template' });
  }
}

// Push Campaigns
export async function getPushCampaignsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const campaigns = await getPushCampaigns();
    return reply.code(200).send(campaigns);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch campaigns' });
  }
}

export async function createPushCampaignHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const campaign = await createPushCampaign(request.body);
    return reply.code(201).send(campaign);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to create campaign' });
  }
}

export async function updatePushCampaignHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const campaign = await updatePushCampaign(request.params.id, request.body);
    return reply.code(200).send(campaign);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to update campaign' });
  }
}

export async function deletePushCampaignHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    await deletePushCampaign(request.params.id);
    return reply.code(204).send();
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to delete campaign' });
  }
}

// Support Tickets
export async function getSupportTicketsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const query = (request.query || {}) as any;
    const page = query.page && !isNaN(parseInt(query.page, 10)) ? parseInt(query.page, 10) : 1;
    const limit = query.limit && !isNaN(parseInt(query.limit, 10)) ? parseInt(query.limit, 10) : 20;
    const status = query.status as string | undefined;
    const tickets = await getSupportTickets(page, limit, status);
    return reply.code(200).send(tickets);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch tickets' });
  }
}

export async function getSupportTicketHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const ticket = await getSupportTicketById(request.params.id);
    return reply.code(200).send(ticket);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch ticket' });
  }
}

export async function updateSupportTicketHandler(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  try {
    const actorId = (request.user as any)?.sub as string | undefined;
    const ticket = await updateSupportTicket(request.params.id, request.body, actorId);
    return reply.code(200).send(ticket);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to update ticket' });
  }
}

// Community
export async function getCommunityStatsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const stats = await getCommunityStats();
    return reply.code(200).send(stats);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch community stats' });
  }
}

export async function getContentPerformanceHandler(
  request: FastifyRequest<{ Querystring: { range?: string } }>,
  reply: FastifyReply
) {
  try {
    const r = request.query?.range;
    const days: 7 | 30 | 90 = r === '7d' ? 7 : r === '90d' ? 90 : 30;
    const data = await getContentPerformanceAnalytics(days);
    return reply.code(200).send(data);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch content performance' });
  }
}

export async function getWellnessToolUsageHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const data = await getWellnessToolUsageAggregates();
    return reply.code(200).send(data);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch wellness tool usage' });
  }
}

export async function getCommunityGroupsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const groups = await getCommunityGroups();
    return reply.code(200).send(groups);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch groups' });
  }
}

export async function getCommunityPostsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const posts = await getCommunityPostsForAdmin();
    return reply.code(200).send(posts);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch community posts' });
  }
}

export async function patchCommunityPostHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { locked?: boolean; flag_count?: number } }>,
  reply: FastifyReply
) {
  try {
    const post = await updateCommunityPostAdmin(request.params.id, request.body || {});
    return reply.code(200).send(post);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to update post' });
  }
}

export async function deleteCommunityPostHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    await softDeleteCommunityPostAdmin(request.params.id);
    return reply.code(204).send();
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to delete post' });
  }
}

export async function createCommunityGroupHandler(
  request: FastifyRequest<{ Body: { name: string; description: string; category: string; privacy: string } }>,
  reply: FastifyReply
) {
  try {
    const group = await createCommunityGroupAdmin(request.body || ({} as any));
    return reply.code(201).send(group);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to create group' });
  }
}

export async function patchCommunityGroupHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: Record<string, unknown> }>,
  reply: FastifyReply
) {
  try {
    const group = await updateCommunityGroupAdmin(request.params.id, request.body || {});
    return reply.code(200).send(group);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to update group' });
  }
}

export async function deleteCommunityGroupHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    await deleteCommunityGroupAdmin(request.params.id);
    return reply.code(204).send();
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to delete group' });
  }
}

export async function getCommunityGroupMembersHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const members = await getCommunityGroupMembersAdmin(request.params.id);
    return reply.code(200).send(members);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch group members' });
  }
}

export async function addGroupMemberHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { userId: string; role?: string } }>,
  reply: FastifyReply
) {
  try {
    const result = await addGroupMemberAdmin(request.params.id, request.body.userId, request.body.role);
    return reply.code(200).send(result);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(error?.statusCode === 404 ? 404 : 500).send({ message: error?.message || 'Failed to add member' });
  }
}

export async function removeGroupMemberHandler(
  request: FastifyRequest<{ Params: { id: string; userId: string } }>,
  reply: FastifyReply
) {
  try {
    await removeGroupMemberAdmin(request.params.id, request.params.userId);
    return reply.code(204).send();
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to remove member' });
  }
}

export async function dispatchPushCampaignHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const result = await dispatchPushCampaignAsNotifications(request.params.id);
    return reply.code(200).send(result);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: (error as Error).message || 'Failed to dispatch campaign' });
  }
}

// Monitoring
export async function getLiveSessionsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const sessions = await getLiveSessions();
    return reply.code(200).send(sessions);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch live sessions' });
  }
}

export async function endLiveSessionHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const session = await endLiveSessionByAdmin(request.params.id);
    return reply.code(200).send(session);
  } catch (error: any) {
    if (error?.message === 'Session not found') {
      return reply.code(404).send({ message: 'Session not found' });
    }
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to end session' });
  }
}

export async function flagSessionForReviewHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const session = await flagSessionForReview(request.params.id);
    return reply.code(200).send(session);
  } catch (error: any) {
    if (error?.message === 'Session not found') {
      return reply.code(404).send({ message: 'Session not found' });
    }
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to flag session' });
  }
}

export async function getActivityLogsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const query = (request.query || {}) as any;
    const page = query.page && !isNaN(parseInt(query.page, 10)) ? parseInt(query.page, 10) : 1;
    const limit = query.limit && !isNaN(parseInt(query.limit, 10)) ? parseInt(query.limit, 10) : 25;
    const logs = await getActivityLogs(page, limit);
    return reply.code(200).send(logs);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch activity logs' });
  }
}

export async function getGlobalAuditLogsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const query = (request.query || {}) as any;
    const page = query.page && !isNaN(parseInt(query.page, 10)) ? parseInt(query.page, 10) : 1;
    const limit = query.limit && !isNaN(parseInt(query.limit, 10)) ? parseInt(query.limit, 10) : 50;
    const logs = await getGlobalAuditLogs(page, limit);
    return reply.code(200).send(logs);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch audit logs' });
  }
}

export async function getSessionRecordingsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const query = (request.query || {}) as any;
    const page = query.page && !isNaN(parseInt(query.page, 10)) ? parseInt(query.page, 10) : 1;
    const limit = query.limit && !isNaN(parseInt(query.limit, 10)) ? parseInt(query.limit, 10) : 20;
    const { items, total } = await getSessionRecordings(page, limit);
    return reply.code(200).send({ items, total });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch recordings' });
  }
}

export async function getSessionRecordingTranscriptHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const transcript = await getSessionRecordingTranscript(request.params.id);
    return reply.code(200).send(transcript);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch session transcript' });
  }
}

export async function getErrorLogsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const query = (request.query || {}) as any;
    const page = query.page && !isNaN(parseInt(query.page, 10)) ? parseInt(query.page, 10) : 1;
    const limit = query.limit && !isNaN(parseInt(query.limit, 10)) ? parseInt(query.limit, 10) : 25;
    const logs = await getErrorLogs(page, limit);
    return reply.code(200).send(logs);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch error logs' });
  }
}

export async function getAdminSystemHealthHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const snapshot = await getAdminSystemHealth();
    return reply.code(200).send(snapshot);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to load system health' });
  }
}

export async function patchErrorLogResolveHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    await resolveErrorLog(request.params.id);
    return reply.code(204).send();
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return reply.code(404).send({ message: 'Error log not found' });
    }
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to resolve error log' });
  }
}

export async function postErrorLogsArchiveResolvedHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const result = await deleteResolvedErrorLogs();
    return reply.code(200).send({ deleted: result.count });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to archive resolved error logs' });
  }
}

export async function postSessionRecordingReviewedHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const user = request.user as { sub?: string } | undefined;
    if (!user?.sub) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }
    const session = await markSessionRecordingReviewed(request.params.id, user.sub);
    return reply.code(200).send(session);
  } catch (error: any) {
    if (error?.message === 'Session not found') {
      return reply.code(404).send({ message: 'Session not found' });
    }
    if (error?.message === 'Session is still active') {
      return reply.code(400).send({ message: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to mark recording as reviewed' });
  }
}

export async function patchSessionRecordingHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Body: {
      admin_flagged?: boolean;
      review_notes?: string;
      topics?: string[];
      summary?: string;
      status?: string;
    };
  }>,
  reply: FastifyReply
) {
  try {
    const body = (request.body || {}) as {
      admin_flagged?: boolean;
      review_notes?: string;
      topics?: string[];
      summary?: string;
      status?: string;
    };
    const session = await updateSessionRecordingMeta(request.params.id, {
      admin_flagged: typeof body.admin_flagged === 'boolean' ? body.admin_flagged : undefined,
      review_notes: typeof body.review_notes === 'string' ? body.review_notes : undefined,
      topics: Array.isArray(body.topics) ? body.topics : undefined,
      summary: typeof body.summary === 'string' ? body.summary : undefined,
      status:
        typeof body.status === 'string' &&
        ['completed', 'flagged', 'reviewed', 'escalated'].includes(body.status)
          ? (body.status as any)
          : undefined,
    });
    return reply.code(200).send(session);
  } catch (error: any) {
    if (error?.message === 'Session not found') {
      return reply.code(404).send({ message: 'Session not found' });
    }
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to update session recording' });
  }
}

// Organization team (Team Management)
export async function getOrgTeamHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user as { sub?: string; appRole?: string };
    if (!user.sub) return reply.code(401).send({ message: 'Unauthorized' });
    const q = (request.query || {}) as { org_id?: string };
    const data = await getOrgTeamMembers(user.sub, user.appRole, q.org_id);
    return reply.code(200).send(data);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to load organization team' });
  }
}

export async function addOrgTeamMemberHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user as { sub?: string; appRole?: string };
    if (!user.sub) return reply.code(401).send({ message: 'Unauthorized' });
    const body = (request.body || {}) as {
      org_id?: string;
      email?: string;
      full_name?: string;
      phone?: string;
      profile_role?: 'org_admin' | 'team_admin' | 'user';
    };
    const profile_role = body.profile_role ?? 'team_admin';
    if (!['org_admin', 'team_admin', 'user'].includes(profile_role)) {
      return reply.code(400).send({ message: 'Invalid profile_role' });
    }
    const webBaseUrl = getInviteRedirectBaseUrl(request);
    const data = await addOrgTeamMember(
      user.sub,
      user.appRole,
      {
        org_id: body.org_id,
        email: String(body.email ?? ''),
        full_name: String(body.full_name ?? ''),
        phone: body.phone,
        profile_role,
      },
      webBaseUrl
    );
    return reply.code(201).send(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to add member';
    request.log.error({ error }, 'addOrgTeamMember');
    const code = msg === 'Forbidden' ? 403 : 400;
    return reply.code(code).send({ message: msg });
  }
}

export async function updateOrgTeamMemberHandler(
  request: FastifyRequest<{ Params: { userId: string } }>,
  reply: FastifyReply
) {
  try {
    const user = request.user as { sub?: string; appRole?: string };
    if (!user.sub) return reply.code(401).send({ message: 'Unauthorized' });
    const q = (request.query || {}) as { org_id?: string };
    const body = (request.body || {}) as {
      phone?: string;
      profile_role?: 'org_admin' | 'team_admin' | 'user';
      account_status?: string;
      org_role?: string;
    };
    if (
      body.profile_role &&
      !['org_admin', 'team_admin', 'user'].includes(body.profile_role)
    ) {
      return reply.code(400).send({ message: 'Invalid profile_role' });
    }
    const data = await updateOrgTeamMember(user.sub, user.appRole, q.org_id, request.params.userId, body);
    return reply.code(200).send(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update member';
    request.log.error({ error }, 'updateOrgTeamMember');
    const code = msg === 'Forbidden' ? 403 : 400;
    return reply.code(code).send({ message: msg });
  }
}

export async function removeOrgTeamMemberHandler(
  request: FastifyRequest<{ Params: { userId: string } }>,
  reply: FastifyReply
) {
  try {
    const user = request.user as { sub?: string; appRole?: string };
    if (!user.sub) return reply.code(401).send({ message: 'Unauthorized' });
    const q = (request.query || {}) as { org_id?: string };
    const data = await removeOrgTeamMember(user.sub, user.appRole, q.org_id, request.params.userId);
    return reply.code(200).send(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to remove member';
    request.log.error({ error }, 'removeOrgTeamMember');
    const code = msg === 'Forbidden' ? 403 : 400;
    return reply.code(code).send({ message: msg });
  }
}

export async function getCompanionsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const list = await listCompanionsForAdmin();
    return reply.code(200).send(list);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to load companions' });
  }
}

export async function postCompanionHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const body = (request.body || {}) as {
      email?: string;
      full_name?: string;
      phone?: string;
      license_number?: string;
      specializations?: string[];
      languages?: string[];
      availability?: string;
    };
    const webBaseUrl = getInviteRedirectBaseUrl(request);
    const list = await createCompanionByAdmin(
      {
        email: String(body.email ?? ''),
        full_name: String(body.full_name ?? ''),
        phone: body.phone,
        license_number: body.license_number,
        specializations: body.specializations,
        languages: body.languages,
        availability: body.availability,
      },
      webBaseUrl
    );
    return reply.code(201).send(list);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create companion';
    request.log.error({ error }, 'postCompanion');
    return reply.code(400).send({ message: msg });
  }
}

export async function patchCompanionHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const body = (request.body || {}) as {
      full_name?: string;
      email?: string;
      phone?: string;
      license_number?: string;
      specializations?: string[];
      languages?: string[];
      availability?: string;
      is_verified?: boolean;
      account_status?: string;
    };
    const list = await updateCompanionByAdmin(request.params.id, body);
    return reply.code(200).send(list);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update companion';
    request.log.error({ error }, 'patchCompanion');
    return reply.code(400).send({ message: msg });
  }
}

export async function deleteCompanionHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const list = await deleteCompanionProfile(request.params.id);
    return reply.code(200).send(list);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete companion';
    request.log.error({ error }, 'deleteCompanion');
    return reply.code(400).send({ message: msg });
  }
}

export async function getBackupRecoveryHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const data = await getBackupRecoveryDashboard();
    return reply.code(200).send(data);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to load backup & recovery' });
  }
}

export async function postBackupRecoveryCreateHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user as { sub?: string };
    if (!user.sub) return reply.code(401).send({ message: 'Unauthorized' });
    const body = (request.body || {}) as { kind?: string };
    const kind = body.kind === 'incremental' ? 'incremental' : 'full';
    const data = await createLogicalBackup(user.sub, kind);
    return reply.code(201).send(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create backup';
    request.log.error({ error }, 'createLogicalBackup');
    return reply.code(400).send({ message: msg });
  }
}

export async function postBackupRecoveryExportHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user as { sub?: string };
    if (!user.sub) return reply.code(401).send({ message: 'Unauthorized' });
    const body = (request.body || {}) as {
      exportType?: string;
      format?: string;
      dateRange?: string;
      compression?: string;
    };
    const result = await createDataExportRecord(user.sub, {
      exportType: body.exportType,
      format: body.format,
      dateRange: body.dateRange,
      compression: body.compression,
    });
    return reply.code(201).send(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to export';
    request.log.error({ error }, 'createDataExportRecord');
    return reply.code(400).send({ message: msg });
  }
}

export async function postBackupRecoveryRestoreHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const user = request.user as { sub?: string };
    if (!user.sub) return reply.code(401).send({ message: 'Unauthorized' });
    const data = await requestRestoreFromBackup(user.sub, request.params.id);
    return reply.code(200).send(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to record restore request';
    request.log.error({ error }, 'requestRestoreFromBackup');
    return reply.code(400).send({ message: msg });
  }
}

export async function getBackupRecoveryDownloadHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const json = await getBackupRecordJsonForDownload(request.params.id);
    if (!json) return reply.code(404).send({ message: 'Record not found' });
    const filename = `ezri-backup-record-${request.params.id}.json`;
    return reply
      .header('Content-Type', 'application/json; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(JSON.stringify(json, null, 2));
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to download' });
  }
}

// --- Platform admin (feature flags, A/B tests, API config, integrations, branding) ---

export async function getFeatureFlagsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const flags = await listFeatureFlags();
    return reply.code(200).send(flags);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to list feature flags' });
  }
}

export async function postFeatureFlagHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const body = (request.body || {}) as Record<string, unknown>;
    const flag = await createFeatureFlag({
      key: String(body.key ?? ''),
      name: String(body.name ?? ''),
      description: body.description != null ? String(body.description) : undefined,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      environment: body.environment != null ? String(body.environment) : undefined,
      rolloutPercentage:
        typeof body.rolloutPercentage === 'number' ? body.rolloutPercentage : undefined,
      category: body.category != null ? String(body.category) : undefined,
      targetUsers: Array.isArray(body.targetUsers) ? (body.targetUsers as string[]) : undefined,
    });
    return reply.code(201).send(flag);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create feature flag';
    const code = msg.includes('already exists') ? 409 : 400;
    return reply.code(code).send({ message: msg });
  }
}

export async function patchFeatureFlagHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const body = (request.body || {}) as Record<string, unknown>;
    const flag = await updateFeatureFlag(request.params.id, {
      name: body.name != null ? String(body.name) : undefined,
      description: body.description != null ? String(body.description) : undefined,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      environment: body.environment != null ? String(body.environment) : undefined,
      rolloutPercentage:
        typeof body.rolloutPercentage === 'number' ? body.rolloutPercentage : undefined,
      category: body.category != null ? String(body.category) : undefined,
      targetUsers: Array.isArray(body.targetUsers) ? (body.targetUsers as string[]) : undefined,
    });
    return reply.code(200).send(flag);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update feature flag';
    return reply.code(400).send({ message: msg });
  }
}

export async function deleteFeatureFlagHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    await deleteFeatureFlag(request.params.id);
    return reply.code(204).send();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete feature flag';
    return reply.code(400).send({ message: msg });
  }
}

export async function getAbTestsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const tests = await listAbTests();
    return reply.code(200).send(tests);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to list A/B tests' });
  }
}

export async function postAbTestHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const body = (request.body || {}) as Record<string, unknown>;
    const test = await createAbTest({
      name: String(body.name ?? ''),
      description: body.description != null ? String(body.description) : undefined,
      status: body.status != null ? String(body.status) : undefined,
      goal: body.goal != null ? String(body.goal) : undefined,
      variants: Array.isArray(body.variants) ? body.variants : undefined,
    });
    return reply.code(201).send(test);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create A/B test';
    return reply.code(400).send({ message: msg });
  }
}

export async function patchAbTestHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const body = (request.body || {}) as Record<string, unknown>;
    const test = await updateAbTest(request.params.id, {
      name: body.name != null ? String(body.name) : undefined,
      description: body.description != null ? String(body.description) : undefined,
      status: body.status != null ? String(body.status) : undefined,
      startDate: body.startDate != null ? String(body.startDate) : undefined,
      endDate: body.endDate === null ? null : body.endDate != null ? String(body.endDate) : undefined,
      variants: Array.isArray(body.variants) ? body.variants : undefined,
      goal: body.goal != null ? String(body.goal) : undefined,
      confidence: typeof body.confidence === 'number' ? body.confidence : undefined,
      winner: body.winner === null ? null : body.winner != null ? String(body.winner) : undefined,
    });
    return reply.code(200).send(test);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update A/B test';
    return reply.code(400).send({ message: msg });
  }
}

export async function deleteAbTestHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    await deleteAbTest(request.params.id);
    return reply.code(204).send();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete A/B test';
    return reply.code(400).send({ message: msg });
  }
}

export async function getApiPlatformConfigHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const cfg = await getApiPlatformConfig();
    return reply.code(200).send(cfg);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to load API configuration' });
  }
}

export async function putApiPlatformConfigHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user as { sub?: string };
    const body = (request.body || {}) as { apiKeys?: unknown[]; webhooks?: unknown[] };
    const cfg = await saveApiPlatformConfig(
      { apiKeys: body.apiKeys, webhooks: body.webhooks },
      user.sub
    );
    return reply.code(200).send(cfg);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to save API configuration' });
  }
}

export async function postAdminApiKeyHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user as { sub?: string };
    const body = (request.body || {}) as { name?: string; environment?: string; rateLimit?: string };
    const key = await createAdminApiKey(
      {
        name: String(body.name ?? 'API Key'),
        environment: String(body.environment ?? 'production'),
        rateLimit: String(body.rateLimit ?? '1000/hour'),
      },
      user.sub
    );
    return reply.code(201).send(key);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to create API key' });
  }
}

export async function getIntegrationsConfigHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const data = await getIntegrationsConfig();
    return reply.code(200).send(data);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to load integrations' });
  }
}

export async function putIntegrationsConfigHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user as { sub?: string };
    const body = request.body;
    if (!Array.isArray(body)) {
      return reply.code(400).send({ message: 'Body must be a JSON array' });
    }
    await saveIntegrationsConfig(body as import('@prisma/client').Prisma.JsonArray, user.sub);
    return reply.code(200).send(body);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to save integrations' });
  }
}

export async function getBrandingConfigHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const data = await getBrandingConfig();
    return reply.code(200).send(data ?? {});
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to load branding' });
  }
}

export async function putBrandingConfigHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user as { sub?: string };
    const body = (request.body || {}) as Record<string, unknown>;
    await saveBrandingConfig(body, user.sub);
    return reply.code(200).send(body);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to save branding' });
  }
}

// ── Achievements Admin ──────────────────────────────────────────────────────

export async function getAdminAchievementsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const data = await getAdminAchievements();
    return reply.code(200).send(data);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch achievements' });
  }
}

export async function postAdminAchievementHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const body = (request.body || {}) as Record<string, unknown>;
    const achievement = await createAdminAchievement({
      name: String(body.name ?? ''),
      description: body.description !== undefined ? String(body.description) : undefined,
      category: body.category !== undefined ? String(body.category) : undefined,
      iconUrl: body.iconUrl !== undefined ? String(body.iconUrl) : undefined,
      criteria: body.criteria as Record<string, unknown> | undefined,
      points: body.points !== undefined ? Number(body.points) : undefined,
      level: body.level !== undefined ? Number(body.level) : undefined,
      maxLevel: body.maxLevel !== undefined ? Number(body.maxLevel) : undefined,
    });
    return reply.code(201).send(achievement);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to create achievement' });
  }
}

export async function patchAdminAchievementHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as Record<string, unknown>;
    const achievement = await updateAdminAchievement(id, {
      name: body.name !== undefined ? String(body.name) : undefined,
      description: body.description !== undefined ? String(body.description) : undefined,
      category: body.category !== undefined ? String(body.category) : undefined,
      iconUrl: body.iconUrl !== undefined ? String(body.iconUrl) : undefined,
      criteria: body.criteria as Record<string, unknown> | undefined,
      points: body.points !== undefined ? Number(body.points) : undefined,
      level: body.level !== undefined ? Number(body.level) : undefined,
      maxLevel: body.maxLevel !== undefined ? Number(body.maxLevel) : undefined,
    });
    return reply.code(200).send(achievement);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to update achievement' });
  }
}

export async function deleteAdminAchievementHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    await deleteAdminAchievement(id);
    return reply.code(204).send();
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to delete achievement' });
  }
}
