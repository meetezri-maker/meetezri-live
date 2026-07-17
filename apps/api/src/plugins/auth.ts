import fp from 'fastify-plugin';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import prisma from '../lib/prisma';
import { verifySupabaseAccessToken } from '../lib/verifySupabaseToken';
import {
  buildSignupTypeEvidence,
  resolveNeedsOnboarding,
  resolveSignupType,
  type SignupType,
} from '../modules/users/signupType';

function extractBearerToken(request: FastifyRequest): string | null {
  const auth = request.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return null;
}

// Simple in-memory cache for user roles/permissions to reduce DB calls
// Map<userId, { role, permissions, onboardingCompleted, timestamp }>
const userRoleCache = new Map<
  string,
  {
    role: string;
    permissions: any;
    onboardingCompleted: boolean;
    /** Resolved via the shared resolver, so never null - see resolveSignupTypeForRequest. */
    signupType: SignupType;
    accountStatus: string | null;
    timestamp: number;
  }
>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const INACTIVE_ACCOUNT_ALLOWED_PREFIXES = [
  '/api/users/me',
  '/api/users/me/deactivate',
  '/api/users/activation',
  '/api/users/resend-verification',
  '/api/users/confirm-email',
  '/api/users/init',
  '/api/users/2fa',
];

function isInactiveAccountAllowedPath(path: string) {
  return INACTIVE_ACCOUNT_ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function blockInactiveAccountApiAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  accountStatus: string | null | undefined
): boolean {
  if (accountStatus !== 'inactive') return true;
  const path = request.url.split('?')[0] || '';
  if (isInactiveAccountAllowedPath(path)) return true;

  const isOnboardingApi = path.startsWith('/api/users/onboarding');
  const isAppApi = APP_API_PREFIXES.some((p) => path.startsWith(p));
  const isBillingApi = path.startsWith('/api/billing');

  if (isAppApi || isBillingApi || isOnboardingApi) {
    reply.code(403).send({
      statusCode: 403,
      error: 'Forbidden',
      code: 'ACCOUNT_INACTIVE',
      message: 'Account is deactivated. Reactivate your account to continue.',
    });
    return false;
  }
  return true;
}

const APP_API_PREFIXES = [
  '/api/users/credits',
  '/api/sessions',
  '/api/moods',
  '/api/journal',
  '/api/wellness',
  '/api/sleep',
  '/api/habits',
  '/api/notifications',
  '/api/ai-avatars',
  '/api/emergency-contacts',
  '/api/wellness-plan',
  '/api/safety-resource-interactions',
  '/api/community',
];

const ADMIN_ROLES = ['super_admin', 'org_admin', 'team_admin'] as const;
const PRIVILEGED_API_PREFIXES = ['/api/admin', '/api/system-settings', '/api/billing/admin'];

function normalizeAppRole(role?: string | null) {
  if (!role) return undefined;

  switch (role) {
    case 'super':
      return 'super_admin';
    case 'org':
      return 'org_admin';
    case 'team':
      return 'team_admin';
    default:
      return role;
  }
}

function isAdminRole(role?: string | null) {
  return !!role && ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number]);
}

/** Org/super/team admins use the admin console without completing the end-user onboarding wizard. */
function adminBypassesUserOnboarding(role?: string | null) {
  return isAdminRole(normalizeAppRole(role));
}

function isPrivilegedApi(path: string) {
  return PRIVILEGED_API_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function inferAdminRoleFromAuthUser(authUser: {
  is_super_admin?: boolean | null;
  raw_app_meta_data?: any;
  raw_user_meta_data?: any;
} | null) {
  if (!authUser) return undefined;
  if (authUser.is_super_admin === true) return 'super_admin';

  const metadataCandidates = [authUser.raw_app_meta_data, authUser.raw_user_meta_data];

  for (const metadata of metadataCandidates) {
    const candidate = normalizeAppRole(
      metadata?.app_role ?? metadata?.admin_role ?? metadata?.role
    );

    if (isAdminRole(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

async function resolveAppRole(
  userId: string,
  profileRole: string | null | undefined,
  usePrivilegedFallback: boolean
) {
  const normalizedProfileRole = normalizeAppRole(profileRole);

  if (!usePrivilegedFallback || isAdminRole(normalizedProfileRole)) {
    return normalizedProfileRole;
  }

  const authUser = await prisma.users.findUnique({
    where: { id: userId },
    select: {
      is_super_admin: true,
      raw_app_meta_data: true,
      raw_user_meta_data: true,
    },
  });

  const inferredAdminRole = inferAdminRoleFromAuthUser(authUser);

  if (!inferredAdminRole) {
    return normalizedProfileRole;
  }

  if (inferredAdminRole !== normalizedProfileRole) {
    await prisma.profiles.updateMany({
      where: { id: userId },
      data: { role: inferredAdminRole },
    });
  }

  return inferredAdminRole;
}

/**
 * Resolve signup_type for the middleware using the SAME algorithm and the SAME evidence
 * as GET /users/me, so the two can never disagree about a user.
 *
 * The evidence must match what user.service.getProfile() feeds the resolver:
 *   - profiles.signup_type / stripe_customer_id (selected alongside the profile)
 *   - plan_type of the newest active subscription (queried here with the same filter
 *     and ordering getProfile uses)
 *   - auth metadata signup_type (only fetched when nothing stronger has decided it)
 *
 * Dropping any of these would silently downgrade a legacy paid account to the trial
 * default and weaken the paid onboarding gate, so they are gathered up front.
 */
async function resolveSignupTypeForRequest(
  userId: string,
  profile: { signup_type?: unknown; stripe_customer_id?: unknown } | null
): Promise<SignupType> {
  // Mirrors getProfile(): newest subscription in an active-ish state.
  let subscriptionPlan: string | null = null;
  try {
    const subscription = await prisma.subscriptions.findFirst({
      where: { user_id: userId, status: { in: ['active', 'trialing', 'past_due'] } },
      orderBy: { created_at: 'desc' },
      select: { plan_type: true },
    });
    subscriptionPlan = subscription?.plan_type ?? null;
  } catch {
    // Fall through: absent subscription evidence only ever costs us the paid tiers,
    // and an explicit signup_type still decides below.
  }

  let authMeta: Record<string, any> | null = null;
  try {
    const authUser = await prisma.users.findUnique({
      where: { id: userId },
      select: { raw_user_meta_data: true },
    });
    authMeta = (authUser?.raw_user_meta_data ?? null) as Record<string, any> | null;
  } catch {
    authMeta = null;
  }

  const evidence = buildSignupTypeEvidence(
    {
      signup_type: profile?.signup_type,
      subscription_plan: subscriptionPlan,
      stripe_customer_id: profile?.stripe_customer_id,
    },
    authMeta
  );

  return resolveSignupType(evidence).signupType;
}

export default fp(async (fastify: FastifyInstance) => {
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      request.log.info(
        {
          url: request.url,
          hasAuthHeader:
            typeof request.headers.authorization === 'string' &&
            request.headers.authorization.startsWith('Bearer '),
        },
        'Auth middleware start'
      );

      // Restrict accepted algorithms based on available verification material.
      // If HS256 secret isn't configured, do not accept HS256 tokens.
      const allowedAlgorithms: string[] = ['RS256', 'ES256', 'PS256'];
      if (process.env.SUPABASE_JWT_SECRET) {
        allowedAlgorithms.unshift('HS256');
      }

      try {
        await request.jwtVerify({
          allowedAlgorithms,
        } as any);
      } catch (jwtErr: any) {
        const token = extractBearerToken(request);
        const isExpired =
          jwtErr?.code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED' ||
          jwtErr?.message?.includes('expired');

        if (!token || !isExpired) {
          throw jwtErr;
        }

        const payload = await verifySupabaseAccessToken(token);
        if (!payload) {
          throw jwtErr;
        }

        request.user = payload as any;
        request.log.info(
          { url: request.url, via: 'supabase-auth' },
          'JWT verified via Supabase (local clock skew tolerance)'
        );
      }

      request.log.info(
        {
          url: request.url,
          tokenVerified: !!request.user,
        },
        'JWT verification succeeded'
      );

      // Fetch profile data and attach to request.user
      const user = request.user as any;
      if (user && user.sub) {
        // Check cache first
        const cached = userRoleCache.get(user.sub);
        const now = Date.now();
        const path = request.url.split('?')[0] || '';
        const isPrivilegedRoute = isPrivilegedApi(path);

        if (cached && !isPrivilegedRoute && (now - cached.timestamp < CACHE_TTL)) {
          user.appRole = normalizeAppRole(cached.role);
          user.permissions = cached.permissions;
          user.onboarding_completed = cached.onboardingCompleted;
          user.account_status = cached.accountStatus ?? 'active';

          if (!blockInactiveAccountApiAccess(request, reply, cached.accountStatus)) {
            return;
          }

          const isOnboardingApi = path.startsWith('/api/users/onboarding');
          const isAppApi = APP_API_PREFIXES.some((p) => path.startsWith(p));
          const isBillingApi = path.startsWith('/api/billing');

          // Same shared rule as the DB path below; the cached signup type came from the
          // shared resolver, so the two paths cannot disagree.
          const cachedNeedsOnboarding = resolveNeedsOnboarding(
            cached.signupType,
            cached.onboardingCompleted
          );

          // Cache-staleness guard: when cached onboarding status is incomplete for paid users,
          // re-check once before denying app/billing access.
          if ((isAppApi || isBillingApi) && cachedNeedsOnboarding) {
            userRoleCache.delete(user.sub);
          } else {

          // Plan buyers must not initiate billing while onboarding is incomplete.
            if (isBillingApi && cachedNeedsOnboarding) {
              reply.code(403).send({
                statusCode: 403,
                error: 'Forbidden',
                message: 'Billing is not allowed during onboarding for plan buyers.',
              });
              return;
            }

            if (isOnboardingApi && cached.onboardingCompleted) {
              reply.code(403).send({
                statusCode: 403,
                error: 'Forbidden',
                message: 'Onboarding is already completed for this account.',
              });
              return;
            }

            if (
              isAppApi &&
              cachedNeedsOnboarding &&
              !adminBypassesUserOnboarding(cached.role)
            ) {
              reply.code(403).send({
                statusCode: 403,
                error: 'Forbidden',
                message:
                  'Onboarding is incomplete. Please complete onboarding before using the app.',
              });
              return;
            }
          }
        } else {
          // Fetch from DB if not in cache or expired
          // Important: keep login stable even if the DB migration isn't applied yet.
          // If `onboarding_completed` column doesn't exist, Prisma will throw.
          // We catch it and fall back to legacy inference.
          let profile: any;
          try {
            profile = await prisma.profiles.findUnique({
              where: { id: user.sub },
              select: {
                role: true,
                permissions: true,
                full_name: true,
                selected_goals: true,
                emergency_contact_relationship: true,
                notification_preferences: true,
                timezone: true,
                signup_type: true,
                stripe_customer_id: true,
                account_status: true,
              } as any,
            });
          } catch (e: any) {
            request.log.error(
              { err: e, userId: user.sub },
              'Failed selecting onboarding_completed from profiles; falling back'
            );
            profile = await prisma.profiles.findUnique({
              where: { id: user.sub },
              select: {
                role: true,
                permissions: true,
                full_name: true,
                selected_goals: true,
                emergency_contact_relationship: true,
                notification_preferences: true,
                timezone: true,
                account_status: true,
              },
            });
          }
          
          if (profile) {
            const resolvedAppRole = await resolveAppRole(user.sub, profile.role, isPrivilegedRoute);

            user.appRole = resolvedAppRole;
            user.permissions = profile.permissions;

            // One algorithm, shared with GET /users/me. Previously this middleware ran its
            // own chain that stopped at auth metadata and left null, so an OAuth user whom
            // /users/me called 'trial' was treated here as "not trial" and 403'd out of
            // every app API.
            const signupTypeResolved: SignupType = await resolveSignupTypeForRequest(
              user.sub,
              profile as any
            );

            // Resolve onboarding completion deterministically.
            // Trial completion == "required trial profile setup is done".
            const onboardingCompletedResolved = (() => {
              if ((profile as any).onboarding_completed === true) return true;

              // If onboarding_completed is explicitly false AND this is NOT a trial user,
              // treat it as authoritative (paid flow).
              if ((profile as any).onboarding_completed === false && signupTypeResolved !== 'trial') {
                return false;
              }

              const fullNameOk =
                typeof profile.full_name === 'string' &&
                profile.full_name.trim().length > 1;

              const emergencyRelationshipOk =
                typeof profile.emergency_contact_relationship === 'string' &&
                profile.emergency_contact_relationship.trim().length > 0;

              const timezoneOk =
                typeof (profile as any).timezone === 'string' &&
                (profile as any).timezone.trim().length > 0;

              const roleOk =
                typeof resolvedAppRole === 'string' && resolvedAppRole.length > 0;

              // Trial: fullName + timezone + emergency contact + role.
              if (signupTypeResolved === 'trial') {
                return fullNameOk && timezoneOk && emergencyRelationshipOk && roleOk;
              }

              // Plan: stricter paid onboarding wizard criteria.
              const goalsOk =
                Array.isArray(profile.selected_goals) &&
                profile.selected_goals.length > 0;

              const permissionsOk =
                !!profile.permissions &&
                typeof profile.permissions === 'object' &&
                Object.keys(profile.permissions as any).length > 0;

              const notificationPrefsOk =
                !!profile.notification_preferences &&
                typeof profile.notification_preferences === 'object' &&
                Object.keys(profile.notification_preferences as any).length > 0;

              return (
                fullNameOk &&
                goalsOk &&
                emergencyRelationshipOk &&
                permissionsOk &&
                notificationPrefsOk &&
                roleOk
              );
            })();

            user.onboarding_completed = onboardingCompletedResolved;
            const accountStatusResolved =
              typeof (profile as any).account_status === 'string'
                ? (profile as any).account_status
                : 'active';
            user.account_status = accountStatusResolved;

            // Update cache
            userRoleCache.set(user.sub, {
              role: resolvedAppRole ?? 'user',
              permissions: profile.permissions,
              onboardingCompleted: onboardingCompletedResolved,
              signupType: signupTypeResolved,
              accountStatus: accountStatusResolved,
              timestamp: now
            });

            // Backend route guard: deny app API usage until onboarding is complete
            const path = request.url.split('?')[0] || '';

            if (!blockInactiveAccountApiAccess(request, reply, accountStatusResolved)) {
              return;
            }

            const isOnboardingApi = path.startsWith('/api/users/onboarding');
            const isAppApi = APP_API_PREFIXES.some((p) => path.startsWith(p));

            const isBillingApi = path.startsWith('/api/billing');

            // The shared rule: trial accounts are onboarding-exempt, paid accounts are not
            // until they finish. Identical to the old inline conditions for a non-null
            // signup type - which is now guaranteed.
            const needsOnboarding = resolveNeedsOnboarding(
              signupTypeResolved,
              onboardingCompletedResolved
            );

            if (isBillingApi && needsOnboarding) {
              reply.code(403).send({
                statusCode: 403,
                error: 'Forbidden',
                message: 'Billing is not allowed during onboarding for plan buyers.',
              });
              return;
            }

            if (isOnboardingApi && onboardingCompletedResolved) {
              reply.code(403).send({
                statusCode: 403,
                error: 'Forbidden',
                message: 'Onboarding is already completed for this account.',
              });
              return;
            }

            if (
              isAppApi &&
              needsOnboarding &&
              !adminBypassesUserOnboarding(resolvedAppRole)
            ) {
              reply.code(403).send({
                statusCode: 403,
                error: 'Forbidden',
                message: 'Onboarding is incomplete. Please complete onboarding before using the app.',
              });
              return;
            }
          } else {
            // Profile missing -> treat onboarding as incomplete and block app API usage.
            const path = request.url.split('?')[0] || '';
            const isOnboardingApi = path.startsWith('/api/users/onboarding');
            const isAppApi = APP_API_PREFIXES.some((p) => path.startsWith(p));

            user.onboarding_completed = false;

            if (isOnboardingApi) {
              // allow onboarding to proceed to completion
              return;
            }

            let appApiAllowedWithoutProfile = false;
            if (isAppApi) {
              try {
                const authUser = await prisma.users.findUnique({
                  where: { id: user.sub },
                  select: {
                    is_super_admin: true,
                    raw_app_meta_data: true,
                    raw_user_meta_data: true,
                  },
                });
                appApiAllowedWithoutProfile = adminBypassesUserOnboarding(
                  inferAdminRoleFromAuthUser(authUser)
                );
              } catch {
                appApiAllowedWithoutProfile = false;
              }
            }

            if (isAppApi && !appApiAllowedWithoutProfile) {
              reply.code(403).send({
                statusCode: 403,
                error: 'Forbidden',
                message:
                  'Onboarding is incomplete. Please complete onboarding before using the app.',
              });
              return;
            }
          }
        }
      }
    } catch (err) {
      request.log.warn(
        {
          err,
          url: request.url,
          hasAuthHeader:
            typeof request.headers.authorization === 'string' &&
            request.headers.authorization.startsWith('Bearer '),
        },
        'Authentication failed in auth plugin'
      );
      reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication failed'
      });
    }
  });

  fastify.decorate('authorize', (allowedRoles: string[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as any;
      
      // If no user or no appRole, deny
      if (!user || !user.appRole) {
        reply.code(403).send({ 
          statusCode: 403,
          error: 'Forbidden',
          message: 'Access denied: No role assigned' 
        });
        return;
      }

      // Check if user has one of the allowed roles
      if (!allowedRoles.includes(user.appRole)) {
        reply.code(403).send({ 
          statusCode: 403,
          error: 'Forbidden',
          message: `Access denied: Requires one of [${allowedRoles.join(', ')}] role` 
        });
        return;
      }
    };
  });
});

declare module 'fastify' {
  export interface FastifyInstance {
    authenticate: any;
    authorize: (allowedRoles: string[]) => any;
  }
}
