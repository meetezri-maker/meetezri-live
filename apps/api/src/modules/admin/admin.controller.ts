
import { FastifyReply, FastifyRequest } from 'fastify';
import { 
  getDashboardStats, getAllUsers, getUserById, createUserByAdmin, updateUser, deleteUser, getUserAuditLogs, getRecentActivity,
  getUserSegmentationDashboard, createUserSegment, deleteUserSegment,
  getManualNotifications, createManualNotification, getNotificationAudienceCounts,
  getNudges, createNudge, updateNudge, deleteNudge,
  getNudgeTemplates, createNudgeTemplate, updateNudgeTemplate, deleteNudgeTemplate,
  getEmailTemplates, createEmailTemplate, updateEmailTemplate, deleteEmailTemplate,
  getPushCampaigns, createPushCampaign, updatePushCampaign, deletePushCampaign,
  getSupportTickets, updateSupportTicket,
  getCommunityStats, getCommunityGroups,
  getLiveSessions, getActivityLogs, getGlobalAuditLogs, getSessionRecordings, getErrorLogs, getSessionRecordingTranscript,
  getCrisisEvents, getCrisisEvent, updateCrisisEventStatus,
  endLiveSessionByAdmin, flagSessionForReview,
  getOrgTeamMembers, addOrgTeamMember, updateOrgTeamMember, removeOrgTeamMember,
} from './admin.service';
import { updateUserSchema, createAdminUserSchema } from './admin.schema';
import { z } from 'zod';
import type { DashboardStatsQuery } from './admin.service';

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
    const stats = await getDashboardStats({ chartPeriod, sessionWeekOffset });
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
    const query = request.query as any;
    const page = query.page && !isNaN(parseInt(query.page, 10)) ? parseInt(query.page, 10) : 1;
    const limit = query.limit && !isNaN(parseInt(query.limit, 10)) ? parseInt(query.limit, 10) : 20;
    
    const users = await getAllUsers(page, limit);
    return reply.code(200).send(users);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ 
      message: 'Failed to fetch users',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function resolveWebBaseUrl(request: FastifyRequest): string {
  const origin = request.headers.origin;
  const referer = request.headers.referer;
  if (origin && /^https?:\/\//i.test(origin)) {
    try {
      return new URL(origin).origin;
    } catch {
      /* fall through */
    }
  }
  if (referer && /^https?:\/\//i.test(referer)) {
    try {
      return new URL(referer).origin;
    } catch {
      /* fall through */
    }
  }
  return (
    process.env.WEB_BASE_URL ||
    process.env.APP_URL ||
    'http://localhost:5173'
  );
}

export async function createUserHandler(
  request: FastifyRequest<{ Body: z.infer<typeof createAdminUserSchema> }>,
  reply: FastifyReply
) {
  try {
    const webBaseUrl = resolveWebBaseUrl(request);
    const user = await createUserByAdmin(request.body, webBaseUrl);
    return reply.code(201).send(user);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create user';
    request.log.error({ error }, 'createUser failed');
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
    const { id } = request.params;
    await deleteUser(id);
    return reply.code(200).send({ message: 'User deleted successfully' });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to delete user' });
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
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch segments' });
  }
}

export async function createUserSegmentHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const segment = await createUserSegment(request.body);
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

export async function updateSupportTicketHandler(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  try {
    const ticket = await updateSupportTicket(request.params.id, request.body);
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

export async function getCommunityGroupsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const groups = await getCommunityGroups();
    return reply.code(200).send(groups);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: 'Failed to fetch groups' });
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
    const recordings = await getSessionRecordings(page, limit);
    return reply.code(200).send(recordings);
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
    const webBaseUrl = resolveWebBaseUrl(request);
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
